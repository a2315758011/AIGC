#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const STATE_KEYS = [
  "expression_id",
  "gaze_target_id",
  "brow_state",
  "eye_state",
  "mouth_state",
  "jaw_state",
  "tension_level",
  "head_pose",
  "intent"
];
const ROLES = new Set(["primary", "reacting", "speaking", "background", "none"]);
const TENSION = new Set(["low", "medium", "high"]);
const EVIDENCE_TYPES = new Set(["official_docs", "provider_ui", "measured"]);

function add(issues, code, shotId, entityId, message) {
  issues.push({ code, shot: shotId || null, entity: entityId || null, message });
}

function signature(state) {
  return JSON.stringify(STATE_KEYS.map((key) => state[key] ?? null));
}

function validState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  for (const key of STATE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(state, key)) return false;
    if (key === "gaze_target_id") {
      if (state[key] !== null &&
          (typeof state[key] !== "string" || state[key].trim().length === 0)) return false;
    } else if (typeof state[key] !== "string" || state[key].trim().length === 0) {
      return false;
    }
  }
  return TENSION.has(state.tension_level);
}

function eventExists(shots, startIndex, endIndex, eventId) {
  if (typeof eventId !== "string" || eventId.trim().length === 0) return false;
  for (let i = Math.max(0, startIndex); i <= endIndex; i += 1) {
    const events = Array.isArray(shots[i] && shots[i].events) ? shots[i].events : [];
    if (events.some((event) => event && event.id === eventId)) return true;
  }
  return false;
}

function validateSegments(scene, shots, issues) {
  const declared = Object.prototype.hasOwnProperty.call(scene, "generation_segments");
  const segmentByShot = new Map();
  const shotIndexes = new Map();
  const assigned = new Set();

  for (let i = 0; i < shots.length; i += 1) {
    const shot = shots[i];
    if (!shot || typeof shot.id !== "string" || shot.id.trim().length === 0 ||
        shotIndexes.has(shot.id)) {
      add(issues, "F01", shot && shot.id, null, "shot id 缺失或重复");
    } else {
      shotIndexes.set(shot.id, i);
    }
  }

  if (!declared) {
    for (const shot of shots) {
      if (shot && shot.generation_segment_id != null) {
        add(issues, "F01", shot.id, null,
          "shot 声明 generation_segment_id，但 scene 未声明 generation_segments");
      }
    }
    return segmentByShot;
  }

  const segments = scene.generation_segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    add(issues, "F01", null, null, "generation_segments 必须是非空数组");
    return segmentByShot;
  }

  const segmentIds = new Set();
  for (const segment of segments) {
    if (!segment || typeof segment.id !== "string" || segment.id.trim().length === 0 ||
        segmentIds.has(segment.id) || !Array.isArray(segment.shot_ids) ||
        segment.shot_ids.length === 0) {
      add(issues, "F01", segment && segment.id, null,
        "生成段落必须有唯一 id 和非空 shot_ids");
      continue;
    }
    segmentIds.add(segment.id);

    if (typeof segment.model_profile !== "string" || segment.model_profile.trim().length === 0 ||
        !Number.isInteger(segment.max_duration_ms) || segment.max_duration_ms <= 0) {
      add(issues, "F01", segment.id, null,
        "生成段落必须声明实际 model_profile 和正整数 max_duration_ms");
    }

    const evidence = segment.duration_limit_evidence;
    if (!evidence || evidence.status !== "verified" ||
        !EVIDENCE_TYPES.has(evidence.source_type) ||
        typeof evidence.reference !== "string" || evidence.reference.trim().length === 0 ||
        typeof evidence.verified_at !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(evidence.verified_at)) {
      add(issues, "F02", segment.id, null,
        "模型时长上限缺少已核实且可追溯的证据记录");
    }

    const indexes = [];
    const localIds = new Set();
    let referencesValid = true;
    for (const shotId of segment.shot_ids) {
      if (typeof shotId !== "string" || localIds.has(shotId) ||
          !shotIndexes.has(shotId) || assigned.has(shotId)) {
        add(issues, "F01", shotId, null,
          "生成段落引用不存在、重复或已分配的 shot_id");
        referencesValid = false;
        continue;
      }
      localIds.add(shotId);
      assigned.add(shotId);
      segmentByShot.set(shotId, segment.id);
      indexes.push(shotIndexes.get(shotId));
    }

    if (!referencesValid || indexes.length !== segment.shot_ids.length) continue;

    for (let i = 1; i < indexes.length; i += 1) {
      if (indexes[i] !== indexes[i - 1] + 1) {
        add(issues, "F01", segment.shot_ids[i], null,
          "同一生成段落的 shot_ids 必须按 scene.shots 顺序连续");
      }
    }

    let timeValid = true;
    for (let i = 0; i < indexes.length; i += 1) {
      const shot = shots[indexes[i]];
      if (!Number.isInteger(shot.time_start_ms) ||
          !Number.isInteger(shot.time_end_ms) ||
          shot.time_start_ms < 0 || shot.time_end_ms <= shot.time_start_ms) {
        add(issues, "F11", shot.id, null,
          "分段生成中的每个 shot 必须有合法毫秒起止时间");
        timeValid = false;
      }
      if (shot.generation_segment_id !== segment.id) {
        add(issues, "F01", shot.id, null,
          "shot.generation_segment_id 与所属生成段落不一致");
      }
      if (i > 0) {
        const previous = shots[indexes[i - 1]];
        if (Number.isInteger(previous.time_end_ms) &&
            Number.isInteger(shot.time_start_ms) &&
            previous.time_end_ms !== shot.time_start_ms) {
          add(issues, "F11", shot.id, null,
            "同一生成段落的镜头时间存在重叠或未建模空档");
          timeValid = false;
        }
      }
    }

    if (timeValid && Number.isInteger(segment.max_duration_ms)) {
      const first = shots[indexes[0]];
      const last = shots[indexes[indexes.length - 1]];
      const duration = last.time_end_ms - first.time_start_ms;
      if (duration > segment.max_duration_ms) {
        add(issues, "F02", segment.id, null,
          "生成段落时长 " + duration + "ms 超过已核实模型上限 " +
          segment.max_duration_ms + "ms");
      }
    }
  }

  for (const shot of shots) {
    if (!shot) continue;
    if (!assigned.has(shot.id)) {
      add(issues, "F01", shot.id, null,
        "启用 generation_segments 后，每个 shot 必须且只能属于一个段落");
    }
    if (shot.generation_segment_id != null && !segmentIds.has(shot.generation_segment_id)) {
      add(issues, "F01", shot.id, null,
        "shot.generation_segment_id 指向不存在的段落");
    }
  }

  return segmentByShot;
}

function validateScene(scene) {
  const issues = [];
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) {
    return [{ code: "F01", shot: null, entity: null, message: "scene 必须是对象" }];
  }

  const shots = Array.isArray(scene.shots) ? scene.shots : [];
  if (shots.length === 0) {
    add(issues, "F01", null, null, "scene.shots 必须是非空数组");
    return issues;
  }

  const segmentByShot = validateSegments(scene, shots, issues);
  const lastVisiblePerformance = new Map();

  for (let shotIndex = 0; shotIndex < shots.length; shotIndex += 1) {
    const shot = shots[shotIndex];
    if (!shot || !Array.isArray(shot.entities)) continue;
    const seenEntityIds = new Set();

    for (const entity of shot.entities) {
      if (!entity || entity.type !== "person" ||
          entity.exists === false || entity.visible === false) continue;

      if (typeof entity.id !== "string" || entity.id.trim().length === 0) {
        add(issues, "F03", shot.id, null, "可见 person entity 缺少稳定 id");
        continue;
      }
      if (seenEntityIds.has(entity.id)) {
        add(issues, "F03", shot.id, entity.id, "同一 shot 重复声明人物 entity");
        continue;
      }
      seenEntityIds.add(entity.id);

      const performance = entity.attributes && entity.attributes.facial_performance;
      if (!performance || typeof performance !== "object" || Array.isArray(performance)) {
        add(issues, "F03", shot.id, entity.id,
          "可见人物未声明 facial_performance");
        continue;
      }

      if (!["visible", "not_visible"].includes(performance.face_visibility) ||
          !ROLES.has(performance.acting_role)) {
        add(issues, "F09", shot.id, entity.id,
          "face_visibility 或 acting_role 不合法");
        continue;
      }

      if (performance.face_visibility !== "visible" ||
          ["background", "none"].includes(performance.acting_role)) {
        continue;
      }

      if (!validState(performance.entry_state) ||
          !validState(performance.exit_state)) {
        add(issues, "F04", shot.id, entity.id,
          "关键表演人物的 entry_state/exit_state 缺少规范字段");
        continue;
      }

      const beatsValid = performance.beats === undefined ||
        Array.isArray(performance.beats);
      const beats = Array.isArray(performance.beats) ? performance.beats : [];
      if (!beatsValid) {
        add(issues, "F08", shot.id, entity.id, "beats 必须是数组");
      }

      let beatStatesValid = beatsValid;
      const beatEventIds = new Set();
      for (const beat of beats) {
        if (!beat || typeof beat !== "object" ||
            !eventExists(shots, shotIndex, shotIndex, beat.trigger_event_id)) {
          add(issues, "F07", shot.id, entity.id,
            "beat 必须引用本镜真实的 shot.events[].id");
          beatStatesValid = false;
        }
        if (!beat || !validState(beat.state_after)) {
          add(issues, "F04", shot.id, entity.id,
            "beat.state_after 缺少规范面部状态字段");
          beatStatesValid = false;
        }
        if (beat && typeof beat.trigger_event_id === "string") {
          if (beatEventIds.has(beat.trigger_event_id)) {
            add(issues, "F08", shot.id, entity.id, "同一表演状态重复引用同一个 beat 事件");
            beatStatesValid = false;
          }
          beatEventIds.add(beat.trigger_event_id);
        }
      }

      const continuity = performance.continuity;
      const previous = lastVisiblePerformance.get(entity.id);
      if (!continuity || typeof continuity !== "object" || Array.isArray(continuity)) {
        add(issues, "F05", shot.id, entity.id, "缺少 continuity 声明");
      } else if (!previous) {
        if (continuity.mode !== "establish" ||
            (continuity.from_shot_id != null && continuity.from_shot_id !== "") ||
            continuity.segment_boundary !== false) {
          add(issues, "F05", shot.id, entity.id,
            "首次可见表演状态必须使用 establish、无来源镜头且 segment_boundary=false");
        }
        if (signature(performance.entry_state) !== signature(performance.exit_state)) {
          if (beats.length === 0 || !beatStatesValid ||
              signature(beats[beats.length - 1].state_after) !== signature(performance.exit_state)) {
            add(issues, "F08", shot.id, entity.id,
              "首次镜头内 entry/exit 不同，必须记录有效 beats 且最后状态等于 exit_state");
          }
        } else if (beats.length > 0 && beatStatesValid &&
            signature(beats[beats.length - 1].state_after) !== signature(performance.exit_state)) {
          add(issues, "F08", shot.id, entity.id,
            "最后一个 beat.state_after 必须等于 exit_state");
        }
      } else {
        const currentSegment = segmentByShot.get(shot.id) ??
          shot.generation_segment_id ?? null;
        const boundary = previous.segmentId !== currentSegment;
        if (continuity.from_shot_id !== previous.shotId ||
            continuity.segment_boundary !== boundary) {
          add(issues, "F05", shot.id, entity.id,
            "from_shot_id 或 segment_boundary 未指向最近一次可见表演状态");
        }

        if (continuity.mode === "inherit") {
          if (signature(performance.entry_state) !== signature(previous.state)) {
            add(issues, "F06", shot.id, entity.id,
              "inherit 的 entry_state 与上一可见表演镜头 exit_state 不一致");
          }
          if (signature(performance.entry_state) !== signature(performance.exit_state) ||
              beats.length > 0) {
            add(issues, "F08", shot.id, entity.id,
              "inherit 不得无事件改变表演状态；有变化时应使用 change");
          }
        } else if (continuity.mode === "change") {
          const triggerId = continuity.trigger_event_id;
          const reasonValid = typeof continuity.reason === "string" &&
            continuity.reason.trim().length > 0;
          const timing = continuity.change_timing;
          const triggerEndIndex = timing === "before_entry" ? shotIndex - 1 : shotIndex;
          const triggerExists = eventExists(
            shots, previous.shotIndex + 1, triggerEndIndex, triggerId
          );
          if (!triggerExists || !reasonValid ||
              !["before_entry", "within_shot"].includes(timing)) {
            add(issues, "F07", shot.id, entity.id,
              "change 必须引用前序可见表演镜头之后的真实事件；before_entry 事件必须位于当前镜头之前，当前镜头事件只能用于 within_shot；同时声明变化原因与 change_timing");
          }

          if (timing === "before_entry") {
            if (signature(performance.entry_state) === signature(previous.state)) {
              add(issues, "F06", shot.id, entity.id,
                "before_entry 必须在当前 entry_state 中体现剧情触发后的状态变化");
            }
            if (beats.length === 0) {
              if (signature(performance.entry_state) !== signature(performance.exit_state)) {
                add(issues, "F08", shot.id, entity.id,
                  "before_entry 无后续 beats 时，entry_state 必须等于 exit_state");
              }
            } else if (!beatStatesValid ||
                signature(beats[beats.length - 1].state_after) !== signature(performance.exit_state)) {
              add(issues, "F08", shot.id, entity.id,
                "before_entry 后续 beats 的最后状态必须等于 exit_state");
            }
          } else if (timing === "within_shot") {
            if (signature(performance.entry_state) !== signature(previous.state)) {
              add(issues, "F06", shot.id, entity.id,
                "within_shot 必须从上一可见镜头的 exit_state 开始");
            }
            if (!beatEventIds.has(triggerId) || beats.length === 0 ||
                !beatStatesValid ||
                signature(beats[beats.length - 1].state_after) !== signature(performance.exit_state) ||
                signature(performance.entry_state) === signature(performance.exit_state)) {
              add(issues, "F08", shot.id, entity.id,
                "within_shot 必须记录触发事件 beat、真实状态变化及最终 exit_state");
            }
          }
        } else {
          add(issues, "F05", shot.id, entity.id,
            "存在上一可见表演状态时只能使用 inherit 或 change");
        }
      }

      lastVisiblePerformance.set(entity.id, {
        state: performance.exit_state,
        shotId: shot.id,
        shotIndex,
        segmentId: segmentByShot.get(shot.id) ??
          shot.generation_segment_id ?? null
      });
    }
  }

  return issues;
}

function runCase(testCase) {
  const issues = validateScene(testCase.scene || {});
  const actualErrors = [...new Set(issues.map((item) => item.code))].sort();
  const expectedErrors = [...new Set(testCase.expected_errors || [])].sort();
  const actualOk = issues.length === 0;
  const expectationMatch = actualOk === (testCase.expected_ok === true) &&
    JSON.stringify(actualErrors) === JSON.stringify(expectedErrors);
  return {
    case_id: testCase.case_id || null,
    actual_ok: actualOk,
    actual_errors: actualErrors,
    expectation_match: expectationMatch,
    issues
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error(
      "usage: node validate-facial-performance-continuity.cjs <scene.json|regression.json>"
    );
    process.exit(2);
  }

  const data = JSON.parse(fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, ""));
  if (Array.isArray(data.cases)) {
    if (data.cases.length === 0) {
      console.error("FAIL regression fixture contains no cases");
      process.exit(2);
    }
    const results = data.cases.map(runCase);
    for (const result of results) console.log(JSON.stringify(result));
    const passed = results.filter((result) => result.expectation_match).length;
    const failed = results.length - passed;
    console.log(JSON.stringify({ summary: { total: results.length, passed, failed } }));
    process.exit(failed ? 1 : 0);
  }

  const scenes = Array.isArray(data.scenes) ? data.scenes :
    [data.scene && typeof data.scene === "object" ? data.scene : data];
  const results = scenes.map((scene, index) => ({
    scene_index: index,
    actual_ok: validateScene(scene).length === 0,
    issues: validateScene(scene)
  }));
  for (const result of results) console.log(JSON.stringify(result));
  const failed = results.filter((result) => !result.actual_ok).length;
  console.log(JSON.stringify({ summary: { total: results.length, passed: results.length - failed, failed } }));
  process.exit(failed ? 1 : 0);
}

if (require.main === module) main();
