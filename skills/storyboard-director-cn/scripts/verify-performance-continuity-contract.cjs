#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const read = (p) => fs.readFileSync(p, "utf8");
const fail = (message) => {
  console.error("FAIL: " + message);
  process.exitCode = 1;
};
const pass = (message) => console.log("PASS: " + message);

function gitBlobSha(bytes) {
  const header = Buffer.from("blob " + bytes.length + "\0", "utf8");
  return crypto.createHash("sha1").update(Buffer.concat([header, bytes])).digest("hex");
}

const rootMasterPath = "剧本转分镜指令";
const rootQaPath = "剧本转分镜自检指令";
const packageRoot = "skills/storyboard-director-cn";
const packageMasterPath = path.join(packageRoot, "references/剧本转分镜指令.md");
const packageQaPath = path.join(packageRoot, "references/剧本转分镜自检指令.md");
const skillPath = path.join(packageRoot, "SKILL.md");
const readmePath = path.join(packageRoot, "README.md");
const lockPath = path.join(packageRoot, "SOURCE_LOCK.json");
const scgPath = path.join(packageRoot, "references/分镜SCG数据契约-V1.md");
const facialValidatorPath = path.join(packageRoot, "scripts/validate-facial-performance-continuity.cjs");
const facialFixturePath = path.join(packageRoot, "tests/面部表演连续性回归样例-V1.json");
const packageBuilderPath = path.join(packageRoot, "scripts/package-offline-skill-regression.cjs");
const ruleIndexPath = "分镜规则清单.json";

const rootMaster = read(rootMasterPath);
const rootQa = read(rootQaPath);
const packageMaster = read(packageMasterPath);
const packageQa = read(packageQaPath);
const skill = read(skillPath);
const readme = read(readmePath);
const scg = read(scgPath);
const facialValidator = read(facialValidatorPath);
const facialFixture = JSON.parse(read(facialFixturePath));
const lock = JSON.parse(read(lockPath));
const ruleIndex = JSON.parse(read(ruleIndexPath));

if (rootMaster !== packageMaster) fail("packaged authoring rule differs from authoritative source");
else pass("authoring rule exactly matches authoritative source");
if (rootQa !== packageQa) fail("packaged QA rule differs from authoritative source");
else pass("QA rule exactly matches authoritative source");

const masterMarkers = [
  "## V2.10.6 分镜补充：跨镜头与跨生成段落面部表演连续性（强制）",
  "入镜表情/承接状态",
  "本镜表演变化",
  "持续/结束状态",
  "不无依据恢复中性脸",
  "上一段尾帧",
  "生成前的表演连续性放行",
  "扑克脸"
];
for (const marker of masterMarkers) {
  if (!rootMaster.includes(marker)) fail("authoring rule missing marker: " + marker);
}
if (masterMarkers.every((marker) => rootMaster.includes(marker))) {
  pass("authoring rule contains all facial-performance contract markers");
}

const qaMarkers = [
  "### 6. 面部表演连续性与“僵尸脸”专项",
  "入段状态 → 表演推进 → 出段状态 → 下一段首态",
  "不无依据恢复中性脸",
  "P1",
  "P0",
  "不适用"
];
for (const marker of qaMarkers) {
  if (!rootQa.includes(marker)) fail("QA rule missing marker: " + marker);
}
if (qaMarkers.every((marker) => rootQa.includes(marker))) {
  pass("QA rule contains all cross-segment facial-performance checks");
}

if (lock.package !== "storyboard-director-cn" ||
    lock.version !== "1.3.7" ||
    lock.source_version !== "V2.10.6") {
  fail("SOURCE_LOCK package/version/source_version is stale");
} else {
  pass("SOURCE_LOCK release metadata is current");
}

if (!skill.includes('version: "1.3.7"') ||
    !skill.includes('source_version: "V2.10.6"') ||
    !skill.includes("validate-facial-performance-continuity.cjs")) {
  fail("SKILL metadata or facial preflight execution contract is stale");
} else {
  pass("SKILL metadata and facial preflight route are current");
}

if (!readme.includes("V1.3.7") ||
    !readme.includes("validate-facial-performance-continuity.cjs")) {
  fail("offline README is stale or missing the facial preflight command");
} else {
  pass("offline README matches Skill 1.3.7");
}

if (!scg.includes("## 8. V1.1 面部表演与生成段落连续性扩展") ||
    !facialValidator.includes("change_timing") ||
    !facialValidator.includes("duration_limit_evidence") ||
    facialFixture.cases?.length < 20) {
  fail("SCG V1.1 contract, validator or 20+ regression fixtures are incomplete");
} else {
  pass("SCG V1.1 contract and facial preflight regression suite are present");
}

const requiredEntries = [
  "references/分镜SCG数据契约-V1.md",
  "scripts/validate-facial-performance-continuity.cjs",
  "tests/面部表演连续性回归样例-V1.json",
  "scripts/package-offline-skill-regression.cjs",
  "scripts/verify-performance-continuity-contract.cjs",
  "SKILL.md",
  "README.md"
];
const entries = new Map((lock.files || []).map((entry) => [entry.package_path, entry]));
for (const packagePath of requiredEntries) {
  if (!entries.has(packagePath)) fail("SOURCE_LOCK missing package file: " + packagePath);
}
if (requiredEntries.every((packagePath) => entries.has(packagePath))) {
  pass("SOURCE_LOCK contains all facial preflight and release files");
}

const indexedValidator = (ruleIndex.structured_validators || []).find((entry) =>
  entry.path === "skills/storyboard-director-cn/scripts/validate-facial-performance-continuity.cjs"
);
if (ruleIndex.source_version === "V2.10.6" &&
    ruleIndex.skill?.version === "1.3.7" &&
    indexedValidator?.version === "V1.1" &&
    indexedValidator?.tests === "skills/storyboard-director-cn/tests/面部表演连续性回归样例-V1.json") {
  pass("root rule index routes structured facial SCG to the V1.1 validator");
} else {
  fail("root rule index has stale Skill or facial validator routing");
}

for (const entry of lock.files || []) {
  const filePath = path.join(packageRoot, entry.package_path);
  if (!fs.existsSync(filePath)) {
    fail("SOURCE_LOCK package file missing: " + entry.package_path);
    continue;
  }
  const bytes = fs.readFileSync(filePath);
  const actualSha = gitBlobSha(bytes);
  if (actualSha !== entry.git_blob_sha) {
    fail("SOURCE_LOCK Git blob mismatch: " + entry.package_path);
  }
  if (entry.characters !== undefined && bytes.toString("utf8").length !== entry.characters) {
    fail("SOURCE_LOCK character-count mismatch: " + entry.package_path);
  }
}
if (process.exitCode !== 1) pass("all SOURCE_LOCK Git blob and character-count pins match");
if (process.exitCode === 1) process.exit(1);
