#!/usr/bin/env python3
"""Project AIGC's reviewed event-time ledger into video-director's render timeline.

This is a one-way projection. It does not copy or recreate SCG entities, relations or events.
Usage:
  python compile_aigc_timeline.py --events events.json --episode EP01 \
      --render-spec render-spec.json --out timeline.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

RENDER_FIELDS = (
    "objects", "vo", "reads", "cuts", "silences", "sfx",
    "captions", "texts", "terms", "camera",
)
FORBIDDEN_RENDER_FIELDS = {"scenes", "shots", "events", "entities", "relations", "hero", "episode_id"}
ALLOWED_RENDER_SPEC_FIELDS = set(RENDER_FIELDS) | {"meta", "hero_event_id", "hero_what", "source_refs"}


class ContractError(ValueError):
    """Input does not satisfy the AIGC source/render boundary."""


def is_num(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def require_number(obj: dict, key: str, label: str) -> float:
    value = obj.get(key)
    if not is_num(value):
        raise ContractError(f"{label}.{key} must be a number")
    return float(value)


def require_id(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ContractError(f"{label} must be a non-empty string")
    return value


def compile_timeline(
    ledger: dict,
    render_spec: dict,
    episode_id: str,
    source_ledger_path: str | None = None,
) -> dict:
    """Compile one AIGC episode into a video-director timeline without copying world state."""
    if not isinstance(ledger, dict) or not isinstance(render_spec, dict):
        raise ContractError("event ledger and render spec must both be JSON objects")

    forbidden = sorted(FORBIDDEN_RENDER_FIELDS.intersection(render_spec))
    if forbidden:
        raise ContractError(
            "render spec must not define source world/shot data: " + ", ".join(forbidden)
        )
    unknown = sorted(set(render_spec) - ALLOWED_RENDER_SPEC_FIELDS)
    if unknown:
        raise ContractError("unknown render-spec fields: " + ", ".join(unknown))
    if "source_refs" in render_spec and not isinstance(render_spec["source_refs"], list):
        raise ContractError("render-spec.source_refs must be an array of repo-relative references")

    episodes = ledger.get("episodes")
    if not isinstance(episodes, list) or not episodes:
        raise ContractError("event ledger needs a non-empty episodes[]")

    matches = [e for e in episodes if isinstance(e, dict) and e.get("episode_id") == episode_id]
    if len(matches) != 1:
        raise ContractError(f"episode_id {episode_id!r} must match exactly one episode")
    episode = matches[0]

    ep_start = require_number(episode, "time_start_ms", f"episode {episode_id}")
    ep_end = require_number(episode, "time_end_ms", f"episode {episode_id}")
    if ep_start >= ep_end:
        raise ContractError("episode time_start_ms must be less than time_end_ms")

    shots = episode.get("shots")
    events = episode.get("events")
    if not isinstance(shots, list) or not shots:
        raise ContractError("episode needs a non-empty shots[]")
    if not isinstance(events, list):
        raise ContractError("episode.events must be an array")

    event_map: dict[str, dict] = {}
    for index, event in enumerate(events):
        if not isinstance(event, dict):
            raise ContractError(f"events[{index}] must be an object")
        event_id = require_id(event.get("event_id"), f"events[{index}].event_id")
        if event_id in event_map:
            raise ContractError(f"duplicate event_id: {event_id}")
        start = require_number(event, "event_start_ms", f"event {event_id}")
        end = require_number(event, "event_end_ms", f"event {event_id}")
        if start >= end:
            raise ContractError(f"event {event_id}: event_start_ms must be less than event_end_ms")
        if start < ep_start or end > ep_end:
            raise ContractError(f"event {event_id}: event interval falls outside episode bounds")
        event_map[event_id] = event

    scene_rows = []
    visible_anywhere: set[str] = set()
    shot_ids: set[str] = set()
    previous_start = None

    for index, shot in enumerate(shots):
        if not isinstance(shot, dict):
            raise ContractError(f"shots[{index}] must be an object")
        shot_id = require_id(shot.get("id"), f"shots[{index}].id")
        if shot_id in shot_ids:
            raise ContractError(f"duplicate shot id: {shot_id}")
        shot_ids.add(shot_id)

        start = require_number(shot, "time_start_ms", f"shot {shot_id}")
        end = require_number(shot, "time_end_ms", f"shot {shot_id}")
        if start >= end:
            raise ContractError(f"shot {shot_id}: time_start_ms must be less than time_end_ms")
        if start < ep_start or end > ep_end:
            raise ContractError(f"shot {shot_id}: shot interval falls outside episode bounds")
        if previous_start is not None and start < previous_start:
            raise ContractError("shots must remain in source order; do not silently reorder them")
        previous_start = start

        visible_ids = shot.get("visible_event_ids", [])
        if not isinstance(visible_ids, list) or any(not isinstance(x, str) for x in visible_ids):
            raise ContractError(f"shot {shot_id}.visible_event_ids must be an array of event IDs")
        if len(set(visible_ids)) != len(visible_ids):
            raise ContractError(f"shot {shot_id} contains duplicate visible_event_ids")

        beats: dict[str, float] = {}
        cue_refs: dict[str, dict] = {}
        for event_id in visible_ids:
            event = event_map.get(event_id)
            if event is None:
                raise ContractError(f"shot {shot_id} references unknown event_id {event_id}")
            event_start = float(event["event_start_ms"])
            event_end = float(event["event_end_ms"])
            if event_start >= end or event_end <= start:
                raise ContractError(
                    f"event {event_id} does not overlap shot {shot_id}, but is marked visible"
                )

            # A continuing event can be visible at a cut even if it began in the previous shot.
            # Its render cue is clamped to this shot's start; the original event time is retained.
            anchor_ms = max(event_start, start)
            beats[event_id] = round((anchor_ms - ep_start) / 1000.0, 6)
            cue_refs[event_id] = {
                "source_event_id": event_id,
                "source_event_start_ms": event_start,
                "source_event_end_ms": event_end,
                "render_anchor_ms": anchor_ms,
                "anchor_policy": (
                    "clamped_to_shot_start_for_continuing_event"
                    if event_start < start else "source_event_start"
                ),
            }
            visible_anywhere.add(event_id)

        scene_rows.append({
            "id": shot_id,
            "source_shot_id": shot_id,
            "source_time_start_ms": start,
            "source_time_end_ms": end,
            "start": round((start - ep_start) / 1000.0, 6),
            "end": round((end - ep_start) / 1000.0, 6),
            "beats": beats,
            "visible_event_ids": list(visible_ids),
            "cueRef": cue_refs,
        })

    for event_id, event in event_map.items():
        if event.get("requires_visible") is True and event_id not in visible_anywhere:
            raise ContractError(
                f"event {event_id} requires visible evidence but is absent from every shot.visible_event_ids"
            )

    meta = render_spec.get("meta")
    if not isinstance(meta, dict):
        raise ContractError("render-spec.meta is required")
    for key in ("w", "h", "fps"):
        value = require_number(meta, key, "render-spec.meta")
        if value <= 0:
            raise ContractError(f"render-spec.meta.{key} must be positive")
    clock = meta.get("clock")
    if clock not in ("music", "voice", "reads"):
        raise ContractError('render-spec.meta.clock must be "music", "voice" or "reads"')
    if clock == "music":
        bpm = require_number(meta, "bpm", "render-spec.meta")
        if bpm <= 0:
            raise ContractError("render-spec.meta.bpm must be positive when clock=music")

    duration = round((ep_end - ep_start) / 1000.0, 6)
    if "dur" in meta:
        supplied_dur = require_number(meta, "dur", "render-spec.meta")
        half_frame = 0.5 / float(meta["fps"])
        if abs(supplied_dur - duration) > half_frame:
            raise ContractError(
                f"render-spec.meta.dur ({supplied_dur}) conflicts with source episode duration ({duration})"
            )

    output_meta = dict(meta)
    output_meta["dur"] = duration
    output_meta["source_timebase"] = "milliseconds_projected_to_seconds"
    output_meta["source_episode_id"] = episode_id
    output_meta["source_episode_start_ms"] = ep_start
    output_meta["source_episode_end_ms"] = ep_end

    timeline = {"meta": output_meta, "scenes": scene_rows}
    for field in RENDER_FIELDS:
        if field in render_spec:
            timeline[field] = render_spec[field]

    hero_event_id = render_spec.get("hero_event_id")
    if hero_event_id is not None:
        hero_event_id = require_id(hero_event_id, "render-spec.hero_event_id")
        if hero_event_id not in event_map:
            raise ContractError(f"hero_event_id {hero_event_id} is not in the source event ledger")
        anchors = [
            scene["beats"][hero_event_id]
            for scene in scene_rows if hero_event_id in scene["beats"]
        ]
        if not anchors:
            raise ContractError(
                f"hero_event_id {hero_event_id} is not marked visible in any shot"
            )
        event = event_map[hero_event_id]
        what = render_spec.get("hero_what") or event.get("action") or hero_event_id
        timeline["hero"] = {"t": min(anchors), "what": str(what)}

    source_hash = None
    if source_ledger_path:
        source_hash = hashlib.sha256(Path(source_ledger_path).read_bytes()).hexdigest()

    ledger_label = None
    if source_ledger_path:
        ledger_label = str(source_ledger_path).replace("\\\\", "/").rsplit("/", 1)[-1]
    timeline["aigc_source"] = {
        "event_time_contract": "skills/storyboard-director-cn/references/分镜事件时间数据契约-V1.md",
        "scg_contract": "skills/storyboard-director-cn/references/分镜SCG数据契约-V1.md",
        "episode_id": episode_id,
        "source_timebase": "ms",
        "event_ledger_path": ledger_label,
        "event_ledger_sha256": source_hash,
        "scg_refs": render_spec.get("source_refs", []),
        "authority_note": (
            "This timeline is a render projection only. SCG remains the only world-state source; "
            "the AIGC event-time ledger remains the timing source."
        ),
    }
    return timeline


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--events", required=True, help="人工复核后的 AIGC 事件时间账本 JSON")
    parser.add_argument("--episode", required=True, help="要编译的 episode_id")
    parser.add_argument("--render-spec", required=True, help="渲染层规格 JSON；不得包含 scenes/shots/events/entities/relations")
    parser.add_argument("--out", required=True, help="输出 timeline.json 路径")
    args = parser.parse_args()

    try:
        events_path = Path(args.events)
        render_spec_path = Path(args.render_spec)
        ledger = json.loads(events_path.read_text(encoding="utf-8"))
        render_spec = json.loads(render_spec_path.read_text(encoding="utf-8"))
        timeline = compile_timeline(
            ledger, render_spec, args.episode, source_ledger_path=str(events_path)
        )
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(timeline, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"OK: compiled {args.episode} -> {out}")
        print(f"shots={len(timeline['scenes'])}, duration={timeline['meta']['dur']} s")
        return 0
    except (OSError, json.JSONDecodeError, ContractError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
