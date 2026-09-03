import json
import re
from typing import Any, Optional

def parse_json_from_llm(raw_content: Any) -> dict | list:
    """
    Robust JSON parser for LLM outputs.
    Handles:
    - Already parsed dicts/lists
    - Markdown code fences (```json ... ```)
    - Preamble/postamble text outside JSON brackets
    - Trailing commas
    """
    if isinstance(raw_content, (dict, list)):
        return raw_content
    
    if not isinstance(raw_content, str):
        return {}

    text = raw_content.strip()
    if not text:
        return {}

    # Strip markdown code fences
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1).strip()

    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Extract outermost { ... }
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        candidate = text[first_brace:last_brace + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            # Clean common trailing commas before closing braces
            cleaned = re.sub(r",\s*([}\]])", r"\1", candidate)
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                pass

    # Extract outermost [ ... ]
    first_sq = text.find("[")
    last_sq = text.rfind("]")
    if first_sq != -1 and last_sq != -1 and last_sq > first_sq:
        candidate = text[first_sq:last_sq + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            cleaned = re.sub(r",\s*([}\]])", r"\1", candidate)
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                pass

    return {}
