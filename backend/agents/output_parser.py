"""
output_parser.py - Unified output parsing for all LLM responses.
Main functions:
  parse_json_response(raw_text) -> dict: Multi-strategy JSON extraction for
    Planner/ProfileUpdater output (full JSON responses).
  extract_markers(text) -> (cleaned_text, markers): Extract structured markers
    ([COMPONENT_SPEC], [PHASE_TRANSITION], [LAYER_PASSED], [UNIT_PASSED],
     [DIAGNOSIS_COMPLETE]) from Teacher/Verifier/Diagnostician output.
Design ref: MVP2 section 2.2 (unified output parsing).
"""
import json
import re
from components.catalog import get_valid_names


def parse_json_response(raw_text: str) -> dict:
    """
    Multi-strategy JSON parsing for full-JSON LLM responses (Planner, ProfileUpdater).
    Strategies tried in order:
      1. Direct json.loads
      2. Strip markdown code blocks, then parse
      3. Regex extract first {...} block
    Returns parsed dict, or empty dict on failure.
    """
    text = raw_text.strip()

    # Strategy 1: direct parse
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        pass

    # Strategy 2: strip markdown code blocks
    stripped = text
    if stripped.startswith("```json"):
        stripped = stripped[len("```json"):]
    elif stripped.startswith("```"):
        stripped = stripped[3:]
    if stripped.endswith("```"):
        stripped = stripped[:-3]
    stripped = stripped.strip()
    try:
        return json.loads(stripped)
    except (json.JSONDecodeError, ValueError):
        pass

    # Strategy 3: regex extract first JSON object
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except (json.JSONDecodeError, ValueError):
            pass

    print(f"[output_parser] Failed to parse JSON from LLM response ({len(text)} chars)")
    return {}


def extract_markers(text: str) -> tuple[str, dict]:
    """
    Extract structured markers from Teacher/Verifier/Diagnostician output.
    Returns (cleaned_text, markers) where markers is a dict with optional keys:
      - "component_spec": parsed JSON dict (only if component name is in whitelist)
      - "phase_transition": str ("verification" or "teaching")
      - "layer_passed": int (layer number)
      - "unit_passed": int (score)
      - "diagnosis_complete": True
    All marker strings are stripped from cleaned_text.
    """
    markers: dict = {}
    cleaned = text

    # [COMPONENT_SPEC]...[/COMPONENT_SPEC]
    if "[COMPONENT_SPEC]" in cleaned and "[/COMPONENT_SPEC]" in cleaned:
        try:
            start = cleaned.find("[COMPONENT_SPEC]") + len("[COMPONENT_SPEC]")
            end = cleaned.find("[/COMPONENT_SPEC]")
            spec_str = cleaned[start:end].strip()
            parsed_spec = json.loads(spec_str)
            comp_name = parsed_spec.get("component", "")
            valid = get_valid_names()
            if comp_name in valid:
                markers["component_spec"] = parsed_spec
            else:
                print(f"[output_parser] LLM hallucinated component "
                      f"'{comp_name}' -- not in whitelist, dropping")
        except Exception as e:
            print(f"[output_parser] Error parsing component spec: {e}")
        cleaned = cleaned[:cleaned.find("[COMPONENT_SPEC]")].strip()

    # [PHASE_TRANSITION: verification]
    if "[PHASE_TRANSITION: verification]" in cleaned:
        markers["phase_transition"] = "verification"
        cleaned = cleaned.replace("[PHASE_TRANSITION: verification]", "").strip()

    # [LAYER_PASSED: N]
    layer_match = re.search(r"\[LAYER_PASSED:\s*(\d+)\]", cleaned)
    if layer_match:
        markers["layer_passed"] = int(layer_match.group(1))
        cleaned = re.sub(r"\[LAYER_PASSED:\s*\d+\]", "", cleaned).strip()

    # [UNIT_PASSED: score=N]
    unit_match = re.search(r"\[UNIT_PASSED:\s*score=(\d+)\]", cleaned)
    if unit_match:
        markers["unit_passed"] = int(unit_match.group(1))
        cleaned = re.sub(r"\[UNIT_PASSED:\s*score=\d+\]", "", cleaned).strip()

    # [DIAGNOSIS_RESULT]...[/DIAGNOSIS_RESULT]
    if "[DIAGNOSIS_RESULT]" in cleaned and "[/DIAGNOSIS_RESULT]" in cleaned:
        try:
            dr_start = cleaned.find("[DIAGNOSIS_RESULT]") + len("[DIAGNOSIS_RESULT]")
            dr_end = cleaned.find("[/DIAGNOSIS_RESULT]")
            dr_str = cleaned[dr_start:dr_end].strip()
            markers["diagnosis_result"] = json.loads(dr_str)
        except Exception as e:
            print(f"[output_parser] Error parsing diagnosis result: {e}")
        cleaned = cleaned[:cleaned.find("[DIAGNOSIS_RESULT]")].strip()

    # [DIAGNOSIS_COMPLETE]
    if "[DIAGNOSIS_COMPLETE]" in cleaned:
        markers["diagnosis_complete"] = True
        cleaned = cleaned.replace("[DIAGNOSIS_COMPLETE]", "").strip()

    return cleaned, markers
