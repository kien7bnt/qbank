"""
AI Provider abstraction for supporting multiple LLM providers.
Supports: OpenAI, Ollama, Local LLM, etc.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Optional
import json
import httpx
from pydantic import BaseModel


class StructuredOutput(BaseModel):
    """Base class for all AI structured outputs"""
    pass


class AIProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_format: Optional[type[StructuredOutput]] = None,
    ) -> str | dict:
        """Generate response from LLM"""
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Check if provider is available"""
        pass


class OpenAIProvider(AIProvider):
    """OpenAI API provider (GPT-4, GPT-3.5)"""
    
    def __init__(self, api_key: str, model: str = "gpt-3.5-turbo"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.openai.com/v1"
        
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_format: Optional[type[StructuredOutput]] = None,
    ) -> str | dict:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        
        # If response_format specified, use JSON mode
        if response_format:
            payload["response_format"] = {"type": "json_object"}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                    timeout=45.0,
                )
                if response.status_code == 429:
                    from fastapi import HTTPException
                    raise HTTPException(
                        status_code=429,
                        detail="Tài khoản OpenAI hiện tại đã hết hạn mức (Quota Exceeded / 429 Too Many Requests). Vui lòng nạp thêm credit hoặc chuyển AI Provider sang Google Gemini / Mock trong phần Cài đặt AI!",
                    )
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=429,
                    detail="Tài khoản OpenAI hiện tại đã hết hạn mức (Quota Exceeded / 429 Too Many Requests). Vui lòng nạp thêm credit hoặc chuyển AI Provider sang Google Gemini / Mock trong phần Cài đặt AI!",
                )
            raise
            
        content = data["choices"][0]["message"]["content"]
        
        if response_format:
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return content
        
        return content
    
    async def health_check(self) -> bool:
        try:
            headers = {"Authorization": f"Bearer {self.api_key}"}
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers=headers,
                    timeout=5.0,
                )
            return response.status_code == 200
        except Exception:
            return False


class OllamaProvider(AIProvider):
    """Ollama local LLM provider"""
    
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama2"):
        self.base_url = base_url
        self.model = model
    
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_format: Optional[type[StructuredOutput]] = None,
    ) -> str | dict:
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"
        
        payload = {
            "model": self.model,
            "prompt": full_prompt,
            "temperature": temperature,
            "num_predict": max_tokens,
            "stream": False,
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload,
                    timeout=120.0,
                )
                if response.status_code == 404:
                    raise ValueError(
                        f"Không tìm thấy mô hình '{self.model}' trong Ollama (404 Not Found). "
                        f"Vui lòng chạy lệnh 'ollama pull {self.model}' trên terminal hoặc chuyển sang Google Gemini / Mock Mode trong Cài đặt."
                    )
                response.raise_for_status()
                data = response.json()
        except httpx.ConnectError:
            raise ValueError(
                f"Không thể kết nối đến Ollama tại {self.base_url}. "
                f"Vui lòng khởi động Ollama (`ollama serve`) hoặc chuyển sang Google Gemini / Mock Mode trong Cài đặt."
            )
        except httpx.HTTPStatusError as e:
            raise ValueError(f"Lỗi Ollama ({e.response.status_code}): {e.response.text}")

        content = data.get("response", "")
        
        if response_format:
            try:
                clean_content = content.strip()
                if clean_content.startswith("```json"):
                    clean_content = clean_content[7:]
                if clean_content.startswith("```"):
                    clean_content = clean_content[3:]
                if clean_content.endswith("```"):
                    clean_content = clean_content[:-3]
                return json.loads(clean_content.strip())
            except json.JSONDecodeError:
                return content
        
        return content
    
    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/api/tags",
                    timeout=5.0,
                )
            return response.status_code == 200
        except Exception:
            return False


class GeminiProvider(AIProvider):
    """Google Gemini API Provider (gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash)"""

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_format: Optional[type[StructuredOutput]] = None,
    ) -> str | dict:
        full_text = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

        payload = {
            "contents": [
                {
                    "parts": [{"text": full_text}]
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            }
        }

        if response_format:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}",
                json=payload,
                timeout=45.0,
            )
            resp.raise_for_status()
            data = resp.json()

        try:
            candidates = data.get("candidates", [])
            if not candidates:
                raise ValueError("Gemini returned empty response")
            content = candidates[0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            raise ValueError(f"Failed to parse Gemini response: {e}")

        if response_format:
            try:
                # Handle possible markdown backticks from LLM output
                clean_content = content.strip()
                if clean_content.startswith("```json"):
                    clean_content = clean_content[7:]
                if clean_content.startswith("```"):
                    clean_content = clean_content[3:]
                if clean_content.endswith("```"):
                    clean_content = clean_content[:-3]
                return json.loads(clean_content.strip())
            except json.JSONDecodeError:
                return content

        return content

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.base_url}/models?key={self.api_key}",
                    timeout=8.0,
                )
            return resp.status_code == 200
        except Exception:
            return False


def get_provider(provider_name: str, **kwargs) -> AIProvider:
    """Factory function to get AI provider"""
    p_name = provider_name.lower()
    if p_name == "openai":
        return OpenAIProvider(**kwargs)
    elif p_name in ("gemini", "google"):
        return GeminiProvider(**kwargs)
    elif p_name == "ollama":
        return OllamaProvider(**kwargs)
    elif p_name == "mock":
        from .mock_provider import MockProvider
        return MockProvider()
    else:
        raise ValueError(f"Unsupported AI provider: {provider_name}")
