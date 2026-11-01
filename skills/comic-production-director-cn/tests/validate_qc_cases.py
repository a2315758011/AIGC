import json, sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
required = {"schema", "purpose", "cases"}
assert data["schema"] == "comic-page-qc-cases-v1"
assert len(data["cases"]) >= 4

def evaluate(x):
    if not x.get("reading_direction") or x["reading_direction"] not in ("ltr", "rtl"):
        return "BLOCKED"
    if not x.get("character_reference_approved"):
        return "BLOCKED"
    if not x.get("speaker_visible") or not x.get("bubble_tail_target"):
        return "BLOCKED"
    if x.get("dialogue_overflow"):
        return "BLOCKED"
    if not x.get("export_reopens"):
        return "BLOCKED"
    if not x.get("continuity_match"):
        return "REWORK_PANEL"
    return "PASS"

for case in data["cases"]:
    actual = evaluate(case["input"])
    assert actual == case["expected"], f'{case["id"]}: expected {case["expected"]}, got {actual}'
print(f"PASS {len(data['cases'])}/{len(data['cases'])} comic QC cases")
