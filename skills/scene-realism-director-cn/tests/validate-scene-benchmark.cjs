#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const file = process.argv[2] || path.join(__dirname, "../references/场景真实性原创中文配对基准集-V1.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const errors = [];
if (data.schemaVersion !== "1.0.0") errors.push("schemaVersion must be 1.0.0");
if (!Array.isArray(data.cases) || data.cases.length < 6) errors.push("at least 6 cases required");
const ids = new Set();
for (const c of data.cases || []) {
  if (!c.id || ids.has(c.id)) errors.push("missing or duplicate case id: " + c.id);
  ids.add(c.id);
  for (const k of ["scene","view","baselinePrompt","controlledPrompt"]) if (!String(c[k] || "").trim()) errors.push(c.id + ": missing " + k);
  if (!Array.isArray(c.constraints) || c.constraints.length < 4) errors.push(c.id + ": insufficient constraints");
  if (!Array.isArray(c.questions) || c.questions.length < 8) errors.push(c.id + ": at least 8 QA items required");
  for (const q of c.questions || []) {
    if (!Array.isArray(q) || q.length !== 2 || !q[0] || !["是","否"].includes(q[1])) errors.push(c.id + ": invalid QA item " + JSON.stringify(q));
  }
  if (c.baselinePrompt === c.controlledPrompt) errors.push(c.id + ": A/B prompts must differ");
}
if (!Array.isArray(data.protocol?.controls) || data.protocol.controls.length < 4) errors.push("missing paired controls");
if (errors.length) {
  process.stderr.write(errors.join("\n") + "\n");
  process.exit(1);
}
process.stdout.write(JSON.stringify({
  ok: true,
  caseCount: data.cases.length,
  questionCount: data.cases.reduce((n,c)=>n+c.questions.length,0),
  uniqueIds: ids.size,
  pairedPrompts: data.cases.length * 2
}, null, 2) + "\n");
