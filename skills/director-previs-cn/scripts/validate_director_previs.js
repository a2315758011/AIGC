#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const skillRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(skillRoot, "../..");
let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    process.stdout.write(`PASS ${label}\n`);
  } else {
    failed += 1;
    process.stderr.write(`FAIL ${label}${detail ? `: ${detail}` : ""}\n`);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function gitBlobSha(content) {
  const bytes = Buffer.from(content, "utf8");
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return crypto.createHash("sha1").update(Buffer.concat([header, bytes])).digest("hex");
}

const skillText = read("skills/director-previs-cn/SKILL.md");
const readmeText = read("skills/director-previs-cn/README.md");
const changelogText = read("skills/director-previs-cn/CHANGELOG.md");
const rootReadme = read("README.md");
const rootAgents = read("AGENTS.md");
const regressionText = read("skills/director-previs-cn/tests/导演统筹回归用例.md");
const integrationText = read("skills/director-previs-cn/tests/教室跨技能导演统筹集成测试.md");
const lock = JSON.parse(read("skills/director-previs-cn/SOURCE_LOCK.json"));
const classroom = JSON.parse(read("skills/director-previs-cn/tests/fixtures/教室跨技能导演统筹夹具.json"));
const routes = JSON.parse(read("skills/director-previs-cn/tests/fixtures/导演统筹路由回归.json"));

const frontmatter = skillText.match(/^---\n([\s\S]*?)\n---/);
check("frontmatter exists", Boolean(frontmatter));
check("skill name is correct", Boolean(frontmatter && /^name:\s*director-previs-cn$/m.test(frontmatter[1])));
check("skill version matches source lock", Boolean(frontmatter && /version:\s*"1\.2\.0"/.test(frontmatter[1])) && lock.version === "1.2.0");
check("source lock targets current branch", lock.branch === "feat/director-orchestration-cn-20261101-v3");
check("source lock pins reviewed main commit", lock.verified_main_commit === "5170ef3fba501bf08fd7dd628cc15bcd20234ec6");

const specialists = [
  "scene-realism-director-cn",
  "storyboard-director-cn",
  "camera-motion-director-cn",
  "fight-impact-vfx-cn"
];
check("all four specialist routes exist", specialists.every(name => skillText.includes(name)));
check("single-domain task bypasses orchestrator", skillText.includes("单一专业任务直接调用对应技能"));
check("cross-domain task uses orchestrator", skillText.includes("同时跨越两个或多个专业领域"));
check("root README exposes orchestrator", rootReadme.includes("./skills/director-previs-cn/SKILL.md"));
check("root AGENTS routes orchestrator", rootAgents.includes("./skills/director-previs-cn/SKILL.md"));
check("skill README documents all specialists", specialists.every(name => readmeText.includes(name)));
check("changelog records 1.2.0", changelogText.includes("## 1.2.0"));
check("root README has no escaped newline corruption", !rootReadme.includes("\\n- ["));

check("three upstream sources are pinned", Array.isArray(lock.upstream_references) && lock.upstream_references.length === 3);
for (const source of lock.upstream_references || []) {
  check(`upstream commit SHA: ${source.repository}`, /^[0-9a-f]{40}$/.test(source.commit_sha || ""));
  check(`upstream license recorded: ${source.repository}`, Boolean(source.license));
  check(`upstream files include license: ${source.repository}`, Array.isArray(source.files_reviewed) && source.files_reviewed.some(file => file.path === "LICENSE"));
  check(`upstream file SHAs valid: ${source.repository}`, (source.files_reviewed || []).every(file => /^[0-9a-f]{40}$/.test(file.blob_sha || "")));
}

check("local dependency list exists", Array.isArray(lock.local_dependencies) && lock.local_dependencies.length >= 6);
for (const dep of lock.local_dependencies || []) {
  check(`dependency exists: ${dep.package}`, exists(dep.path));
  if (exists(dep.path)) {
    const actual = gitBlobSha(read(dep.path));
    check(`dependency SHA matches: ${dep.package}`, actual === dep.git_blob_sha, `expected ${dep.git_blob_sha}, actual ${actual}`);
  }
  if (dep.source_lock_path) {
    check(`dependency source lock exists: ${dep.package}`, exists(dep.source_lock_path));
    if (exists(dep.source_lock_path)) {
      const depLock = JSON.parse(read(dep.source_lock_path));
      check(`dependency source lock version: ${dep.package}`, depLock.version === dep.source_lock_version);
      check(`dependency source lock SHA: ${dep.package}`, gitBlobSha(read(dep.source_lock_path)) === dep.source_lock_git_blob_sha);
    }
  }
}

check("classroom has exactly 3 reference assets", classroom.source_assets.length === 3);
check("desk grid is 4x6=24", classroom.scene_truth.desks.columns * classroom.scene_truth.desks.rows === 24 && classroom.scene_truth.desks.count === 24);
check("desk layout source is unique", classroom.scene_truth.layout_source === "阳光洒落的整洁教室.png");
check("room measurements are marked estimates", classroom.scene_truth.dimensions_m.measurement_status === "reference_estimate_not_survey");
check("classroom door connects to corridor", classroom.scene_truth.door.connects_to === "school_corridor");
check("grass doorway is explicitly forbidden", classroom.scene_truth.door.must_not_connect_to === "grass");
check("male seat and body facing are locked", classroom.blocking_constraints.male_lead.seat_row_from_front === 4 && classroom.blocking_constraints.male_lead.body_facing === "blackboard");
check("teacher remains at podium", classroom.blocking_constraints.teacher.anchor === "teacher_podium");
check("all specialist handoffs exist", ["scene_realism", "storyboard", "camera_motion", "fight_impact_vfx"].every(key => Array.isArray(classroom.specialist_handoffs[key])));
check("classroom correctly skips fight skill", classroom.specialist_handoffs.fight_impact_vfx.some(item => item.includes("不调用")));
check("visual acceptance is a hard invariant", classroom.integration_invariants.some(item => item.includes("不得报告视觉验收通过")));

check("ten route regression cases exist", routes.cases.length === 10);
const ids = routes.cases.map(test => test.id);
check("route regression IDs are unique", new Set(ids).size === ids.length);
check("route regression IDs cover DO-01..DO-10", ["DO-01","DO-02","DO-03","DO-04","DO-05","DO-06","DO-07","DO-08","DO-09","DO-10"].every(id => ids.includes(id)));
const byId = Object.fromEntries(routes.cases.map(test => [test.id, test]));
check("DO-01 routes only to scene realism", JSON.stringify(byId["DO-01"].expected_route) === JSON.stringify(["scene-realism-director-cn"]));
check("DO-02 routes only to storyboard", JSON.stringify(byId["DO-02"].expected_route) === JSON.stringify(["storyboard-director-cn"]));
check("DO-03 routes only to camera motion", JSON.stringify(byId["DO-03"].expected_route) === JSON.stringify(["camera-motion-director-cn"]));
check("DO-04 routes in specialist order", JSON.stringify(byId["DO-04"].expected_route) === JSON.stringify(["director-previs-cn","scene-realism-director-cn","storyboard-director-cn","camera-motion-director-cn"]));
check("DO-08 visual acceptance remains NOT_RUN", byId["DO-08"].visual_acceptance === "NOT_RUN");
check("DO-09 fight-only task routes directly", JSON.stringify(byId["DO-09"].expected_route) === JSON.stringify(["fight-impact-vfx-cn"]));
check("DO-10 cross-domain fight route is ordered", JSON.stringify(byId["DO-10"].expected_route) === JSON.stringify(["director-previs-cn","scene-realism-director-cn","fight-impact-vfx-cn","storyboard-director-cn","camera-motion-director-cn"]));
check("markdown covers all ten IDs", ["DO-01","DO-02","DO-03","DO-04","DO-05","DO-06","DO-07","DO-08","DO-09","DO-10"].every(id => regressionText.includes(id)));
check("integration test contains controlled A/B", integrationText.includes("A组") && integrationText.includes("B组") && integrationText.includes("控制变量"));
check("visual A/B is not falsely marked complete", lock.verification.real_image_video_ab === "not_run");
check("fight impact dependency remains pending review", lock.verification.fight_impact_skill_status === "authored_pending_review");
check("stale manju package is explicitly excluded", Array.isArray(lock.excluded_candidates) && lock.excluded_candidates.some(item => item.package === "manju-director-cn" && item.source_version === "V2.10.1"));
check("manual route dry run is 10/10 but not independent", lock.verification.manual_route_dry_run.status === "passed" && lock.verification.manual_route_dry_run.pass_count === 10 && lock.verification.independent_route_review === "not_run");
check("workflow A/B and real image/video A/B remain unrun", lock.verification.workflow_integration_ab === "not_run" && lock.verification.real_image_video_ab === "not_run");

process.stdout.write(`\n结果：${passed} PASS / ${failed} FAIL\n`);
if (failed > 0) process.exitCode = 1;
