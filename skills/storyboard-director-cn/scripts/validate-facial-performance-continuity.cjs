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

function issue(issues, code, shotId, entityId, message) {
  issues.push({ code, shot: shotId || null, entity: entityId || null, message });
}

function stateSignature(state) {
  if (!state || typeof state !== "object") return null;
  return JSON.stringify(STATE_KEYS.map((key) => state[key] ?? null));
}

function validateState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  for (const key of STATE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(state, key)) return false;
    if (key === "gaze_target_id") {
      if (state[key] !== null && (typeof state[key] !== "string" || !state[key].trim())) return false;
    } else if (typeof state[key] !== "string" || !state[key].trim()) {
      return false;
    }
  }
  return TENSION.has(state.tension_level);
}

function eventExists(shots, startIndex, endIndex, eventId) {
  if (typeof eventId !== "string" || !eventId.trim()) return false;
  for (let i = Math.max(0, startIndex); i <= endIndex; i += 1) {
    if ((shots[i].events || []).some((event) => event && event.id === eventId)) return true;
  }
  return false;
}

function validateSegments(scene, shots, issues) {
  const hasSegments = Object.prototype.hasOwnProperty.call(scene, "generation_segments");
  const segments = scene.generation_segments;
  const shotIndexes = new Map(shots.map((shot, index) => [shot.id, index]));
  const assigned = new Map();

  if (hasSegments && !Array.isArray(segments)) {
    issue(issues, "F01", null, null, "generation_segments 必须为数组");
    return { hasSegments: true, segmentByShot: new Map() };
  }

  if (!Array.isArray(segments) || segments.length === 0) {
    for (const shot of shots) {
      if (shot.generation_segment_id) {
        issue(issues, "F01", shot.id, null, "存在 generation_segment_id，但 scene 未声明 generation_segments");
      }
    }
    return { hasSegments: false, segmentByShot: new Map() };
  }

  const segmentIds = new Set();
  const segmentByShot = new Map();

  for (const segment of segments) {
    if (!segment || typeof segment.id !== "string" || !segment.id.trim() ||
        segmentIds.has(segment.id) || !Array.isArray(segment.shot_ids) ||
        segment.shot_ids.length === 0 ||
        !Number.isInteger(segment.max_duration_ms) || segment.max_duration_ms <= 0) {
      issue(issues, "F01", null, null, "生成段落缺少唯一 id、有效 shot_ids 或正整数 max_duration_ms");
      continue;
    }
    segmentIds.add(segment.id);

    const indexes = [];
    let valid = true;
    for (const shotId of segment.shot_ids) {
      if (typeof shotId !== "string" || !shotIndexes.has(shotId) || assigned.has(shotId)) {
        issue(issues, "F01", shotId, null, "生成段落引用不存在或重复的 shot_id");
        valid = false;
        continue;
      }
      assigned.set(shotId, segment.id);
      segmentByShot.set(shotId, segment.id);
      indexes.push(shotIndexes.get(shotId));
    }

    if (!valid || indexes.length !== segment.shot_ids.length) continue;
    for (let i = 1; i < indexes.length; i += 1) {
      if (indexes[i] !== indexes[i - 1] + 1) {
        issue(issues, "F01", segment.shot_ids[i], null, "同一生成段落的 shot_ids 必须按场景顺序连续排列");
        valid = false;
      }
    }

    const first = shots[indexes[0]];
    const last = shots[indexes[indexes.length - 1]];
    if (!Number.isInteger(first.time_start_ms) || !Number.isInteger(last.time_end_ms) ||
        last.time_end_ms <= first.time_start_ms) {
      issue(issues, "F01", segment.id, null, "生成段落无法从首末 shot 的毫秒时间推导有效时长");
      valid = false;
    } else {
      const duration = last.time_end_ms - first.time_start_ms;
      if (duration > segment.max_duration_ms) {
        issue(issues, "F02", segment.id, null,
          "生成段落时长 " + duration + "ms 超过本次模型上限 " + segment.max_duration_ms + "ms");
      }
    }

    for (const shotId of segment.shot_ids) {
      const shot = shots[shotIndexes.get(shotId)];
      if (shot.generation_segment_id !== segment.id) {
        issue(issues, "F01", shotId, null, "shot.generation_segment_id 与所属分组不一致");
      }
    }
  }

  for (const shot of shots) {
    if (!assigned.has(shot.id)) {
      issue(issues, "F01", shot.id, null, "启用 generation_segments 后，每个 shot 必须且只能属于一个生成段落");
    }
    if (shot.generation_segment_id && !segmentIds.has(shot.generation_segment_id)) {
      issue(issues, "F01", shot.id, null, "shot.generation_segment_id 指向不存在的生成段落");
    }
  }

  return { hasSegments: true, segmentByShot };
}

function validateScene(scene) {
  const issues = [];
  const shots = Array.isArray(scene.shots) ? scene.shots : [];
  const shotIds = new Set();

  for (const shot of shots) {
    if (!shot || typeof shot.id !== "string" || !shot.id.trim() || shotIds.has(shot.id)) {
      issue(issues, "F01", shot && shot.id, null, "shot id 缺失或重复");
    } else {
      shotIds.add(shot.id);
    }
  }

  const { segmentByShot } = validateSegments(scene, shots, issues);
  const lastPerformance = new Map();

  for (let shotIndex = 0; shotIndex < shots.length; shotIndex += 1) {
    const shot = shots[shotIndex];
    if (!shot || !Array.isArray(shot.entities)) continue;
    const seenEntities = new Set();

    for (const entity of shot.entities) {
      if (!entity || entity.type !== "person" || entity.exists === false || entity.visible === false) continue;
      if (typeof entity.id !== "string" || !entity.id.trim()) {
        issue(issues, "F03", shot.id, null, "可见 person entity 缺少稳定 id");
        continue;
      }
      if (seenEntities.has(entity.id)) {
        issue(issues, "F03", shot.id, entity.id, "同一 shot 重复声明人物 entity");
        continue;
      }
      seenEntities.add(entity.id);

      const performance = entity.attributes && entity.attributes.facial_performance;
      if (!performance || typeof performance !== "object") {
        issue(issues, "F03", shot.id, entity.id, "可见人物未声明 facial_performance");
        continue;
      }

      if (!["visible", "not_visible"].includes(performance.face_visibility) ||
          !ROLES.has(performance.acting_role)) {
        issue(issues, "F09", shot.id, entity.id, "face_visibility 或 acting_role 不合法");
        continue;
      }

      if (performance.face_visibility !== "visible" ||
          ["background", "none"].includes(performance.acting_role)) {
        continue;
      }

      if (!validateState(performance.entry_state) || !validateState(performance.exit_state)) {
        issue(issues, "F04", shot.id, entity.id, "关键表演人物的 entry_state/exit_state 缺少规范字段");
        continue;
      }

      const beats = Array.isArray(performance.beats) ? performance.beats : [];
      if (performance.beats !== undefined && !Array.isArray(performance.beats)) {
        issue(issues, "F08", shot.id, entity.id, "beats 必须为数组");
      }
      for (const beat of beats) {
        if (!beat || !eventExists(shots, shotIndex, shotIndex, beat.trigger_event_id)) {
          issue(issues, "F07", shot.id, entity.id, "段内表演 beat 未引用本镜真实 event.id");
        }
        if (!beat || !validateState(beat.state_after)) {
          issue(issues, "F04", shot.id, entity.id, "beat.state_after 缺少规范面部状态字段");
        }
      }

      const continuity = performance.continuity;
      const previous = lastPerformance.get(entity.id);
      if (!continuity || typeof continuity !== "object") {
        issue(issues, "F05", shot.id, entity.id, "缺少 continuity 声明");
      } else if (!previous) {
        if (continuity.mode !== "establish") {
          issue(issues, "F05", shot.id, entity.id, "首次可见表演状态必须使用 establish");
        }
        if (continuity.from_shot_id) {
          issue(issues, "F05", shot.id, entity.id, "establish 不应伪造 from_shot_id");
        }
        if (continuity.segment_boundary === true) {
          issue(issues, "F05", shot.id, entity.id, "首次表演状态不能声明跨段继承");
        }
        if (stateSignature(performance.entry_state) !== stateSignature(performance.exit_state)) {
          if (beats.length === 0 ||
              stateSignature(beats[beats.length - 1].state_after) !== stateSignature(performance.exit_state)) {
            issue(issues, "F08", shot.id, entity.id, "首次镜头内 entry/exit 不同，必须记录真实 beat 并与 exit_state 对齐");
          }
        }
      } else {
        const currentSegment = segmentByShot.get(shot.id) || shot.generation_segment_id || null;
        const boundary = previous.segmentId !== currentSegment;
        if (continuity.from_shot_id !== previous.shotId ||
            continuity.segment_boundary !== boundary) {
          issue(issues, "F05", shot.id, entity.id, "from_shot_id 或 segment_boundary 未准确继承最近一次可见表演状态");
        }

        if (continuity.mode === "inherit") {
          if (stateSignature(performance.entry_state) !== stateSignature(previous.state)) {
            issue(issues, "F06", shot.id, entity.id, "inherit 的 entry_state 与上一可见表演镜头 exit_state 不一致");
          }
          if (stateSignature(performance.entry_state) !== stateSignature(performance.exit_state) || beats.length > 0) {
            issue(issues, "F08", shot.id, entity.id, "inherit 不得无事件改变表演状态；有变化时应使用 change");
          }
        } else if (continuity.mode === "change") {
          const triggerId = continuity.trigger_event_id;
          if (!eventExists(shots, previous.shotIndex + 1, shotIndex, triggerId) ||
              typeof continuity.reason !== "string" || !continuity.reason.trim()) {
            issue(issues, "F07", shot.id, entity.id, "change 必须引用上一可见表演镜头之后的真实事件并说明变化原因");
          }
          if (stateSignature(performance.entry_state) !== stateSignature(performance.exit_state)) {
            if (beats.length === 0 ||
                stateSignature(beats[beats.length - 1].state_after) !== stateSignature(performance.exit_state)) {
              issue(issues, "F08", shot.id, entity.id, "镜头内表演变化必须记录 beats，最后状态须等于 exit_state");
            }
          } else if (beats.length > 0 &&
              stateSignature(beats[beats.length - 1].state_after) !== stateSignature(performance.exit_state)) {
            issue(issues, "F08", shot.id, entity.id, "最后一个 beat.state_after 必须等于 exit_state");
          }
        } else {
          issue(issues, "F05", shot.id, entity.id, "存在上一表演状态时只能使用 inherit 或 change");
        }
      }

      lastPerformance.set(entity.id, {
        state: performance.exit_state,
        shotId: shot.id,
        shotIndex,
        segmentId: segmentByShot.get(shot.id) || shot.generation_segment_id || null
      });
    }
  }

  return issues;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("usage: node validate-facial-performance-continuity.cjs cases.json");
    process.exit(2);
  }
  const data = JSON.parse(fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, ""));
  let mismatches = 0;
  for (const testCase of data.cases || []) {
    const issues = validateScene(testCase.scene || {});
    const actualErrors = [...new Set(issues.map((item) => item.code))].sort();
    const expectedErrors = [...new Set(testCase.expected_errors || [])].sort();
    const actualOk = issues.length === 0;
    const expectationMatch = actualOk === (testCase.expected_ok === true) &&
      JSON.stringify(actualErrors) === JSON.stringify(expectedErrors);
    if (!expectationMatch) mismatches += 1;
    console.log(JSON.stringify({
      case_id: testCase.case_id,
      actual_ok: actualOk,
      actual_errors: actualErrors,
      expectation_match: expectationMatch,
      issues
    }));
  }
  const total = (data.cases || []).length;
  console.log(JSON.stringify({ summary: { total, passed: total - mismatches, failed: mismatches } }));
  process.exit(mismatches ? 1 : 0);
}

if (require.main === module) main();
