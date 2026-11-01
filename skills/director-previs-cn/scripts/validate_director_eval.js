#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../../..");
let passed = 0, failed = 0;
function check(name, ok) {
  if (ok) { passed++; console.log("PASS " + name); }
  else { failed++; console.error("FAIL " + name); }
}
function read(p) { return fs.readFileSync(path.join(root,p),"utf8"); }
function parse(p) { return JSON.parse(read(p)); }
const protocolPath="skills/director-previs-cn/tests/导演统筹工作流A-B实验协议-V1.md";
const rubricPath="skills/director-previs-cn/tests/导演统筹视觉评分量表-V1.json";
const datasetPath="skills/director-previs-cn/tests/fixtures/导演统筹A-B实验数据集-V1.json";
const templatePath="skills/director-previs-cn/tests/templates/导演统筹实验结果模板-V1.json";
const classroomPath="skills/director-previs-cn/tests/fixtures/教室跨技能导演统筹夹具.json";
const protocol=read(protocolPath);
const rubric=parse(rubricPath);
const dataset=parse(datasetPath);
const template=parse(templatePath);
const classroom=parse(classroomPath);
const lock=parse("skills/director-previs-cn/SOURCE_LOCK.json");
check("A/B protocol exists",protocol.length>1000);
check("A/B defines both arms",protocol.includes("A 组：直接专业技能工作流")&&protocol.includes("B 组：导演统筹工作流"));
check("A/B changes only orchestration",protocol.includes("唯一有意改变的变量是"));
check("protocol locks model and generation settings",["精确版本","随机种子","分辨率","参考图文件名","提示词版本"].every(x=>protocol.includes(x)));
check("protocol requires blind randomized review",protocol.includes("随机化左右/先后顺序")&&protocol.includes("至少 2 名独立评审"));
check("protocol separates process and visual metrics",protocol.includes("流程指标（主要）")&&protocol.includes("视觉指标（次要）"));
check("protocol forbids false visual acceptance",protocol.includes("真实工作流、图像/视频 A/B 仍为 NOT_RUN"));
check("director A/B is isolated from scene prompt A/B",protocol.includes("两类实验必须分开") && dataset.scene_realism_prompt_ab.status === "separate_experiment_not_combined");
check("protocol pins latest specialist versions",protocol.includes("scene-realism-director-cn V1.4.0") && protocol.includes("storyboard-director-cn V1.3.4") && protocol.includes("V1.9.0"));
check("protocol contains dynamic movement controls",protocol.includes("foot planting") && protocol.includes("摄影机位置路径与注视点/视线目标路径"));
check("protocol includes source research",["developers.openai.com","anthropic.com/research","proceedings.neurips.cc","proceedings.iclr.cc"].every(x=>protocol.includes(x)));
check("rubric has 8 P0 gates",rubric.p0_hard_gates.length===8);
check("rubric reuses 10 scene-realism dimensions",rubric.base_visual_dimensions.length===10);
check("rubric has 8 dynamic video checks",rubric.video_additional_checks.length===8);
check("rubric uses 1-5 scale",Boolean(rubric.scale["1"]&&rubric.scale["5"]));
check("rubric does not define conflicting weighted score",!rubric.still_image_weights && !rubric.video_weights);
check("video uses additional motion checks",rubric.video_additional_checks.some(x=>x.id==="MV-06"));
check("rubric requires two independent human reviewers",rubric.reviewer_requirements.minimum_independent_human_reviewers>=2);
check("rubric treats P0 failure as hard fail",rubric.scoring.hard_gate_rule.includes("FAIL"));
check("dataset contains 11 unique cases",dataset.cases.length===11&&new Set(dataset.cases.map(x=>x.id)).size===11);
check("dataset defines A and B arms",Boolean(dataset.arms.A&&dataset.arms.B));
check("single-domain cases bypass orchestrator",dataset.cases.filter(x=>["EVAL-01","EVAL-02","EVAL-03","EVAL-06","EVAL-08"].includes(x.id)).every(x=>x.orchestration_required===false&&!x.gold_route.includes("director-previs-cn")));
check("multi-domain classroom still routes through director",dataset.cases.find(x=>x.id==="EVAL-04").gold_route[0]==="director-previs-cn");
check("still test has five replicates per arm",dataset.cases.find(x=>x.id==="EVAL-04").replicates_per_arm===5);
check("video test is gated after still phase",dataset.cases.find(x=>x.id==="EVAL-05").visual_eval==="required_after_still_phase");
check("fight visual tests blocked until skill review",dataset.cases.filter(x=>x.id==="EVAL-08"||x.id==="EVAL-09").every(x=>x.visual_eval==="not_allowed_until_skill_review"));
check("result template remains NOT_RUN",template.status==="NOT_RUN"&&template.decision==="NOT_EVALUATED");
check("result template pins director V1.3.0",template.environment.workflow_version==="director-previs-cn@1.4.0");
check("dynamic movement case is routed across required specialists",dataset.cases.find(x=>x.id==="EVAL-11").gold_route.join(",")==="director-previs-cn,scene-realism-director-cn,storyboard-director-cn,camera-motion-director-cn" && dataset.cases.find(x=>x.id==="EVAL-11").route_case==="DO-11");
check("result template records PC blocker",template.blocked_reason.includes("运行时填写具体阻塞原因"));
check("classroom unique layout truth preserved",dataset.classroom_assets.layout_truth==="阳光洒落的整洁教室.png"&&classroom.scene_truth.layout_source===dataset.classroom_assets.layout_truth);
check("composite seating thumbnail is non-authoritative",dataset.classroom_assets.authority_rules.some(x=>x.includes("拼图内嵌座位示意不得覆盖")));
check("reference assets remain outside public repository",dataset.classroom_assets.asset_storage.includes("Library")&&protocol.includes("不复制到公开仓库"));
check("source lock records A/B as not run",lock.verification.workflow_integration_ab==="not_run"&&lock.verification.real_image_video_ab==="not_run");
check("source lock pins latest main commit",/^[0-9a-f]{40}$/.test(lock.verified_main_commit||"") && lock.branch==="main");
check("source lock records current scene and storyboard versions",lock.local_dependencies.some(x=>x.package==="scene-realism-director-cn"&&x.version==="1.4.0")&&lock.local_dependencies.some(x=>x.package==="storyboard-director-cn"&&x.version==="1.3.4"));
console.log("\n结果："+passed+" PASS / "+failed+" FAIL");
if(failed) process.exitCode=1;
