"""
AI Agent base class and orchestrator.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Optional, Generic, TypeVar
from datetime import datetime, timezone
from dataclasses import dataclass
from enum import Enum
import logging

from app.ai.providers.base import AIProvider, StructuredOutput


logger = logging.getLogger(__name__)

T = TypeVar('T', bound=StructuredOutput)


class AgentStatus(str, Enum):
    """Agent execution status"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class AgentOutput(Generic[T]):
    """Agent execution output"""
    status: AgentStatus
    data: Optional[T] = None
    error: Optional[str] = None
    warning: Optional[str] = None
    confidence: float = 1.0
    tokens_used: Optional[int] = None
    execution_time_ms: float = 0.0
    retries: int = 0


class Agent(ABC, Generic[T]):
    """Base class for all AI agents"""
    
    def __init__(
        self,
        name: str,
        provider: AIProvider,
        model_version: str = "v1",
        max_retries: int = 3,
        timeout_seconds: int = 30,
    ):
        self.name = name
        self.provider = provider
        self.model_version = model_version
        self.max_retries = max_retries
        self.timeout_seconds = timeout_seconds
    
    @abstractmethod
    async def execute(self, **kwargs) -> AgentOutput[T]:
        """Execute agent with given inputs"""
        pass
    
    async def _call_provider(
        self,
        prompt: str,
        system_prompt: str,
        response_format: Optional[type[T]] = None,
    ) -> str | dict:
        """Call LLM provider with error handling"""
        for attempt in range(self.max_retries):
            try:
                result = await self.provider.generate(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    response_format=response_format,
                )
                return result
            except Exception as e:
                logger.warning(f"Agent {self.name} attempt {attempt + 1} failed: {str(e)}")
                if attempt == self.max_retries - 1:
                    raise
        
        raise RuntimeError(f"Agent {self.name} failed after {self.max_retries} retries")
    
    def _log_execution(
        self,
        input_data: dict,
        output: AgentOutput[T],
        user_id: Optional[str] = None,
    ):
        """Log agent execution for audit trail"""
        logger.info(
            f"Agent: {self.name}, Status: {output.status.value}, "
            f"Confidence: {output.confidence}, Time: {output.execution_time_ms}ms"
        )


class AIOrchestrator:
    """Orchestrator for routing and executing multiple agents"""
    
    def __init__(self, provider: AIProvider):
        self.provider = provider
        self.agents: dict[str, Agent] = {}
        self.execution_log: list[dict] = []
    
    def register_agent(self, agent_name: str, agent: Agent) -> None:
        """Register an agent"""
        self.agents[agent_name] = agent
    
    async def execute_agent(
        self,
        agent_name: str,
        user_id: Optional[str] = None,
        **kwargs
    ) -> AgentOutput:
        """Execute a specific agent"""
        if agent_name not in self.agents:
            return AgentOutput(
                status=AgentStatus.FAILED,
                error=f"Agent '{agent_name}' not found"
            )
        
        agent = self.agents[agent_name]
        
        start_time = datetime.now(timezone.utc)
        try:
            output = await agent.execute(**kwargs)
            execution_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            output.execution_time_ms = execution_time
            
            # Log execution
            self.execution_log.append({
                "timestamp": start_time.isoformat(),
                "agent": agent_name,
                "user_id": user_id,
                "status": output.status.value,
                "confidence": output.confidence,
                "execution_time_ms": execution_time,
            })
            
            return output
        
        except Exception as e:
            logger.error(f"Agent {agent_name} execution failed: {str(e)}")
            execution_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            return AgentOutput(
                status=AgentStatus.FAILED,
                error=str(e),
                execution_time_ms=execution_time
            )
    
    async def execute_pipeline(
        self,
        agents_sequence: list[str],
        initial_input: dict,
        user_id: Optional[str] = None,
    ) -> dict[str, AgentOutput]:
        """Execute multiple agents in sequence, passing output to next agent"""
        results = {}
        current_input = initial_input
        
        for agent_name in agents_sequence:
            output = await self.execute_agent(agent_name, user_id, **current_input)
            results[agent_name] = output
            
            if output.status != AgentStatus.SUCCESS:
                logger.warning(f"Pipeline stopped at {agent_name}: {output.error}")
                break
            
            # Pass output data to next agent if available
            if output.data:
                current_input.update(output.data.model_dump())
        
        return results
