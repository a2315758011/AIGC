#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const read = (p) => fs.readFileSync(p, 'utf8');
const fail = (message) => {
  console.error('FAIL: ' + message);
  process.exitCode = 1;
};
const pass = (message) => console.log('PASS: ' + message);

function gitBlobSha(bytes) {
  const header = Buffer.from('blob ' + bytes.length + '\0', 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header, bytes])).digest('hex');
}

const rootMasterPath = '剧本转分镜指令';
const rootQaPath = '剧本转分镜自检指令';
const packageMasterPath = 'skills/storyboard-director-cn/references/剧本转分镜指令.md';
const packageQaPath = 'skills/storyboard-director-cn/references/剧本转分镜自检指令.md';
const skillPath = 'skills/storyboard-director-cn/SKILL.md';
const lockPath = 'skills/storyboard-director-cn/SOURCE_LOCK.json';

const rootMaster = read(rootMasterPath);
const rootQa = read(rootQaPath);
const packageMaster = read(packageMasterPath);
const packageQa = read(packageQaPath);
const skill = read(skillPath);
const lock = JSON.parse(read(lockPath));

if (rootMaster !== packageMaster) fail('packaged authoring rule differs from authoritative source');
else pass('authoring rule exactly matches authoritative source');
if (rootQa !== packageQa) fail('packaged QA rule differs from authoritative source');
else pass('QA rule exactly matches authoritative source');

const masterMarkers = [
  '## V2.10.6 分镜补充：跨镜头与跨生成段落面部表演连续性（强制）',
  '入镜表情/承接状态',
  '本镜表演变化',
  '持续/结束状态',
  '不无依据恢复中性脸',
  '上一段尾帧',
  '生成前的表演连续性放行',
  '有意扑克脸'
];
for (const marker of masterMarkers) {
  if (!rootMaster.includes(marker)) fail('authoring rule missing marker: ' + marker);
}
if (masterMarkers.every((m) => rootMaster.includes(m))) pass('authoring rule contains all facial-performance contract markers');

const qaMarkers = [
  '### 6. 面部表演连续性与“僵尸脸”专项',
  '入段状态 → 表演推进 → 出段状态 → 下一段首态',
  '不无依据恢复中性脸',
  'P1',
  'P0',
  '不适用'
];
for (const marker of qaMarkers) {
  if (!rootQa.includes(marker)) fail('QA rule missing marker: ' + marker);
}
if (qaMarkers.every((m) => rootQa.includes(m))) pass('QA rule contains all cross-segment facial-performance checks');

if (!skill.includes('version: "1.3.6"') ||
    !skill.includes('source_version: "V2.10.6"') ||
    !skill.includes('跨 10 秒或 15 秒生成段落的表演尾态继承')) {
  fail('SKILL metadata or execution contract is stale');
} else {
  pass('SKILL metadata and execution contract are current');
}

const requiredEntries = [
  'references/剧本转分镜指令.md',
  'references/剧本转分镜自检指令.md',
  'SKILL.md',
  'scripts/verify-performance-continuity-contract.cjs'
];
const entries = new Map((lock.files || []).map((entry) => [entry.package_path, entry]));
for (const packagePath of requiredEntries) {
  if (!entries.has(packagePath)) fail('SOURCE_LOCK missing package file: ' + packagePath);
}
if (requiredEntries.every((p) => entries.has(p))) pass('SOURCE_LOCK contains all required package files');

for (const entry of lock.files || []) {
  const bytes = fs.readFileSync(path.join('skills/storyboard-director-cn', entry.package_path));
  const actualSha = gitBlobSha(bytes);
  if (actualSha !== entry.git_blob_sha) fail('SOURCE_LOCK Git blob mismatch: ' + entry.package_path);
  if (entry.characters !== undefined && bytes.toString('utf8').length !== entry.characters) {
    fail('SOURCE_LOCK character count mismatch: ' + entry.package_path);
  }
}
if (process.exitCode !== 1) pass('all SOURCE_LOCK Git blob and character-count pins match');
if (process.exitCode === 1) process.exit(1);
