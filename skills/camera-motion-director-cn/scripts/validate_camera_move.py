#!/usr/bin/env python3
"""Validate a camera-motion plan or run named regression cases. Static checks only."""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

MOVE_TYPES = {"static", "pan", "tilt", "roll", "dolly", "truck", "pedestal", "crane", "arc", "orbit", "tracking", "follow", "lead", "zoom", "rack_focus", "handheld"}
MAGNITUDES = {"minimal", "small", "medium", "large"}
RISKS = {"low", "medium", "high"}
TRANSLATIONS = {"dolly", "truck", "pedestal", "crane", "arc", "orbit", "tracking", "follow", "lead"}
HIGH_RECONSTRUCTION = {"crane", "orbit"}
ROTATIONS = {"pan", "tilt", "roll"}


def validate(plan: dict) -> tuple[list[str], list[str]]:
    errors, warnings = [], []
    camera = plan.get("camera")
    if not isinstance(camera, dict):
        return ["camera must be an object"], []
    move, magnitude, risk = camera.get("move_type"), camera.get("magnitude"), plan.get("risk")
    if move not in MOVE_TYPES:
        errors.append(f"camera.move_type must be one of {sorted(MOVE_TYPES)}")
    if magnitude not in MAGNITUDES:
        errors.append(f"camera.magnitude must be one of {sorted(MAGNITUDES)}")
    if risk not in RISKS:
        errors.append(f"risk must be one of {sorted(RISKS)}")
    for field in ("start_position", "end_position", "direction", "speed_profile"):
        if not isinstance(camera.get(field), str) or not camera[field].strip():
            errors.append(f"camera.{field} must be a non-empty string")
    for field in ("story_function", "subject_motion", "environment_motion", "end_frame", "fallback"):
        if not isinstance(plan.get(field), str) or not plan[field].strip():
            errors.append(f"{field} must be a non-empty string")
    if move in {"static", "rack_focus"} and magnitude in {"medium", "large"}:
        errors.append(f"{move} cannot use {magnitude} camera travel")
    if move in HIGH_RECONSTRUCTION and magnitude == "large" and risk != "high":
        errors.append("large crane/orbit must be marked high risk")
    if move in TRANSLATIONS and magnitude == "large":
        warnings.append("large camera translation requires multi-view, depth, or 3D evidence")
    if move in ROTATIONS and "parallax" in str(camera.get("description", "")).lower():
        warnings.append("pan/tilt/roll do not create translation parallax")
    if move == "orbit":
        angle = camera.get("angle_degrees")
        if not isinstance(angle, (int, float)) or isinstance(angle, bool):
            errors.append("orbit requires numeric camera.angle_degrees")
        elif angle < 0 or angle > 360:
            errors.append("camera.angle_degrees must be between 0 and 360")
        elif angle > 45:
            warnings.append("orbit above 45 degrees requires explicit unseen-surface evidence")
        if not plan.get("source_evidence"):
            errors.append("orbit requires source_evidence describing visible side/back/depth support")
    duration = camera.get("duration_seconds")
    if duration is not None and (not isinstance(duration, (int, float)) or isinstance(duration, bool) or duration <= 0):
        errors.append("camera.duration_seconds must be a positive number or null")
    continuity = plan.get("continuity_locks")
    if not isinstance(continuity, list) or not continuity or not all(isinstance(x, str) and x.strip() for x in continuity):
        errors.append("continuity_locks must be a non-empty list of strings")
    prompt = plan.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        errors.append("prompt must be a non-empty model-ready prompt")
    if move != "static" and move in TRANSLATIONS and magnitude == "minimal":
        warnings.append("verify that the requested movement is visibly distinguishable from a locked shot")
    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", help="JSON plan path, '-' for stdin, or named regression-case map")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--strict", action="store_true", help="warnings also fail")
    args = parser.parse_args()
    try:
        raw = sys.stdin.read() if args.plan == "-" else Path(args.plan).read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("top-level JSON must be an object")
        cases = {"plan": data} if "camera" in data else data
        if not cases or not all(isinstance(value, dict) for value in cases.values()):
            raise ValueError("expected one plan object or a map of named plan cases")
        results, errors, warnings = {}, [], []
        for name, plan in cases.items():
            case_errors, case_warnings = validate(plan)
            actual_valid = not case_errors
            expected_valid = plan.get("expected_valid", True)
            if not isinstance(expected_valid, bool):
                case_errors.append("expected_valid must be boolean")
                actual_valid = False
                expected_valid = True
            passed = actual_valid == expected_valid and (not args.strict or not case_warnings)
            results[name] = {"passed": passed, "actual_valid": actual_valid, "expected_valid": expected_valid, "errors": case_errors, "warnings": case_warnings}
            if not passed:
                errors.extend(f"{name}: {item}" for item in case_errors)
                if actual_valid != expected_valid:
                    errors.append(f"{name}: expected_valid={expected_valid}, actual_valid={actual_valid}")
                if args.strict:
                    warnings.extend(f"{name}: {item}" for item in case_warnings)
            warnings.extend(f"{name}: {item}" for item in case_warnings)
        valid = all(item["passed"] for item in results.values())
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        errors, warnings, results, valid = [str(exc)], [], {}, False
    if args.json:
        print(json.dumps({"valid": valid, "cases": results, "errors": errors, "warnings": warnings}, ensure_ascii=False, indent=2))
    else:
        for item in errors:
            print(f"错误：{item}")
        for item in warnings:
            print(f"警告：{item}")
        if valid:
            print("通过：运镜计划回归校验")
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
