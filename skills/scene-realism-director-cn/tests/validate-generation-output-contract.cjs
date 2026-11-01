#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const fixturePath = path.join(__dirname, "fixtures", "生成输出形态回归-V1.json");
const data = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
if (data.schemaVersion !== "1.0.0" || !Array.isArray(data.cases)) {
  throw new Error("INVALID_FIXTURE_SCHEMA");
}

function evaluate(test) {
  const request = test.request || {};
  const actual = test.actual || {};
  if (!request.mode) return { status: "FAIL", severity: "P0", reason: "REQUEST_MODE_MISSING" };

  if (test.promptBinding === "unknown" && !actual.mode) {
    return { status: "BLOCKED", severity: "none", reason: "PROMPT_BINDING_NOT_AUDITABLE" };
  }

  if (test.firstMismatch === true && test.retrySameCall === true) {
    return { status: "FAIL", severity: "P1", reason: "BLIND_RETRY_AFTER_OUTPUT_MISMATCH" };
  }

  if (request.mode === "single_scene_image" || request.mode === "single_orthographic_plan" || request.mode === "single_view_asset") {
    if (actual.mode !== request.mode ||
        actual.imageCount !== 1 ||
        actual.viewCount !== 1 ||
        (actual.panelCount ?? 1) !== 1 ||
        actual.containsPlanView === true ||
        actual.containsOtherView === true ||
        actual.containsStoryboard === true ||
        actual.containsInfographic === true) {
      return { status: "FAIL", severity: "P0", reason: "OUTPUT_MODE_MISMATCH" };
    }
    if (request.mode === "single_orthographic_plan" && actual.projection !== "orthographic") {
      return { status: "FAIL", severity: "P0", reason: "ORTHOGRAPHIC_PROJECTION_MISMATCH" };
    }
    if (request.allowText !== true &&
        (actual.containsText === true || actual.containsScoreboard === true || actual.containsRatings === true)) {
      return { status: "FAIL", severity: "P1", reason: "UNREQUESTED_TEXT_OR_SCOREBOARD" };
    }
    if (actual.containsSelfCertification === true) {
      return { status: "FAIL", severity: "P1", reason: "MODEL_SELF_CERTIFICATION_NOT_EVIDENCE" };
    }
  }

  if (request.mode === "multi_view_set") {
    if (actual.mode !== "multi_view_set" || actual.imageCount < 2 ||
        actual.viewCount < 2 || actual.sharedSceneReference !== true) {
      return { status: "FAIL", severity: "P0", reason: "MULTIVIEW_CONTINUITY_UNPROVEN" };
    }
  }

  if (request.mode === "multi_panel_infographic") {
    if (request.explicitUserRequest !== true) {
      return { status: "FAIL", severity: "P0", reason: "MULTIPANEL_NOT_EXPLICITLY_REQUESTED" };
    }
    if (actual.mode !== "multi_panel_infographic" || actual.panelCount < 2) {
      return { status: "FAIL", severity: "P0", reason: "REQUESTED_MULTIPANEL_OUTPUT_MISSING" };
    }
  }

  return { status: "PASS", severity: "none", reason: "OUTPUT_CONTRACT_SATISFIED" };
}

const errors = [];
const counts = { PASS: 0, FAIL: 0, BLOCKED: 0 };
const seen = new Set();

for (const test of data.cases) {
  if (!test.id || seen.has(test.id)) {
    errors.push("MISSING_OR_DUPLICATE_CASE_ID:" + String(test.id));
    continue;
  }
  seen.add(test.id);
  const result = evaluate(test);
  counts[result.status] = (counts[result.status] || 0) + 1;
  if (result.status !== test.expected?.status || result.severity !== test.expected?.severity) {
    errors.push(test.id + ": expected " + JSON.stringify(test.expected) + ", got " + JSON.stringify(result));
  }
}

if (data.cases.length < 8) errors.push("INSUFFICIENT_REGRESSION_CASES");
if (!data.cases.some(x => x.request?.mode === "single_scene_image" && x.expected?.status === "PASS")) errors.push("MISSING_SINGLE_SCENE_POSITIVE");
if (!data.cases.some(x => x.request?.mode === "single_scene_image" && x.actual?.mode === "multi_panel_infographic" && x.expected?.severity === "P0")) errors.push("MISSING_UNSOLICITED_MULTIPANEL_NEGATIVE");
if (!data.cases.some(x => x.promptBinding === "unknown" && x.expected?.status === "BLOCKED")) errors.push("MISSING_UNAUDITABLE_PROMPT_BOUNDARY");

if (errors.length) {
  process.stderr.write(errors.join("\n") + "\n");
  process.exit(1);
}
process.stdout.write(JSON.stringify({
  ok: true,
  caseCount: data.cases.length,
  classificationCounts: counts,
  assertionsPassed: data.cases.length,
  note: "静态合同回归，不是图像模型真实服从率测试。"
}, null, 2) + "\n");
