#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),obj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v),num=Number.isFinite;
const EFFECTORS=new Set(["left_foot","right_foot","left_hand","right_hand","pelvis","torso","back","left_knee","right_knee","left_elbow","right_elbow","left_shoulder","right_shoulder"]);
const MODES={support:["sitting_on","resting_on"],grasp:["held_by"],brace:["resting_on","attached_to"]};
function run(scene){
 const errors=[],warnings=[];if(!obj(scene)||!Array.isArray(scene.shots)||!scene.shots.length)return{ok:false,errors:[{code:"CONTACT-DATA-01"}],warnings};
 let prev=new Map();
 for(let i=0;i<scene.shots.length;i++){
  const s=scene.shots[i],sid=s.id||s.shot_id||String(i),entities=new Map((s.entities||[]).filter(e=>e&&e.id).map(e=>[e.id,e])),events=Array.isArray(s.events)?s.events:[],eventMap=new Map(),curr=new Map(),wins=[];
  const fail=(code,id,msg)=>errors.push({code,shot:sid,contact:id||null,message:msg});
  for(const e of events){const id=e&&(e.id||e.event_id);if(id){if(eventMap.has(id))fail("CONTACT-DATA-30",id,"事件 ID 重复");eventMap.set(id,e);}}
  for(const r of(s.relations||[])){const c=r&&r.contact_constraint;if(!c)continue;
   if(!obj(c)||typeof c.id!=="string"||!c.id.trim()){fail("CONTACT-DATA-02",null,"缺少 contact id");continue;}
   if(curr.has(c.id)){fail("CONTACT-DATA-03",c.id,"contact id 重复");continue;}curr.set(c.id,{relation:r,constraint:c});
   const grasp=c.mode==="grasp",targetId=grasp?r.subject:r.object,actor=entities.get(c.actor_id);
   if(!entities.has(r.subject)||!entities.has(r.object))fail("CONTACT-DATA-04",c.id,"关系端点不存在");
   if(!actor)fail("CONTACT-DATA-05",c.id,"人物不存在");
   if(!MODES[c.mode])fail("CONTACT-DATA-06",c.id,"接触模式无效");else if(!MODES[c.mode].includes(r.predicate))fail("CONTACT-DATA-07",c.id,"接触模式与关系谓词不匹配");
   if(c.actor_id!==(grasp?r.object:r.subject))fail("CONTACT-DATA-08",c.id,"人物与关系方向不匹配");
   if(!EFFECTORS.has(c.effector))fail("CONTACT-DATA-09",c.id,"末端类别无效");
   const a=actor&&actor.attributes||{},rig=a.skeletal_rig,pose=a.skeletal_pose;
   if(!obj(rig)||!rig.rig_id||!rig.skeleton_profile)fail("CONTACT-DATA-10",c.id,"骨骼绑定缺失");
   else if(!obj(rig.effectors)||typeof rig.effectors[c.effector]!=="string"||!rig.effectors[c.effector].trim())fail("CONTACT-DATA-11",c.id,"末端未映射到骨骼/控制器");
   if(!obj(pose)||!pose.pose_id||!pose.clip_id||!pose.pose_state||pose.root_motion_separate!==true)fail("CONTACT-DATA-12",c.id,"姿态片段字段缺失");
   if(typeof c.target_anchor_id!=="string"||!c.target_anchor_id.trim())fail("CONTACT-DATA-13",c.id,"目标锚点 ID 缺失");
   else{const target=entities.get(targetId),anchors=target&&target.attributes&&target.attributes.contact_anchors,anchor=Array.isArray(anchors)&&anchors.find(x=>x&&x.id===c.target_anchor_id);
    if(!anchor)fail("CONTACT-DATA-14",c.id,"目标锚点不存在");
    else if(!obj(anchor.transform)||!Array.isArray(anchor.transform.position)||anchor.transform.position.length!==3||!anchor.transform.position.every(num)||!["local","world"].includes(anchor.transform.coordinate_space)||!["m","cm","mm","normalized"].includes(anchor.transform.unit))warnings.push({code:"CONTACT-ANCHOR-TRANSFORM-UNRESOLVED",shot:sid,contact:c.id});
   }
   if(!num(c.start_ms)||!num(c.end_ms)||c.end_ms<=c.start_ms)fail("CONTACT-DATA-15",c.id,"接触时间无效");
   if(num(s.time_start_ms)&&num(s.time_end_ms)&&num(c.start_ms)&&num(c.end_ms)&&(c.start_ms<s.time_start_ms||c.end_ms>s.time_end_ms))fail("CONTACT-DATA-16",c.id,"接触时间超出镜头");
   if(!num(c.tolerance_m)||c.tolerance_m<=0)fail("CONTACT-DATA-17",c.id,"容差无效");
   if(!["baseline","event","inherited"].includes(c.origin))fail("CONTACT-DATA-18",c.id,"origin 无效");
   const before=prev.get(c.id);
   if(c.origin==="baseline"&&i!==0)fail("CONTACT-DATA-19",c.id,"baseline 只能出现在首镜");
   if(c.origin==="inherited"&&!before)fail("CONTACT-DATA-20",c.id,"继承接触上一镜不存在");
   if(c.origin==="event"){const e=eventMap.get(c.source_event_id);if(!e||e.action!=="contact_begin"||e.contact_id!==c.id)fail("CONTACT-DATA-21",c.id,"缺少匹配 contact_begin");else if(e.actor&&e.actor!==c.actor_id)fail("CONTACT-DATA-30",c.id,"contact_begin 人物不匹配");}
   if(!before&&i>0&&c.origin!=="event")fail("CONTACT-DATA-27",c.id,"新接触必须由事件建立");
   if(before&&c.origin!=="inherited")fail("CONTACT-DATA-27",c.id,"持续接触必须继承");
   if(before){const p=before.constraint,pr=before.relation,pt=p.mode==="grasp"?pr.subject:pr.object;if(p.actor_id!==c.actor_id||pt!==targetId||p.effector!==c.effector||p.target_anchor_id!==c.target_anchor_id||p.mode!==c.mode)fail("CONTACT-DATA-27",c.id,"跨镜人物/目标/末端/锚点/模式漂移");}
   if(c.status==="planned")warnings.push({code:"CONTACT-NOT-SOLVED",shot:sid,contact:c.id});else if(c.status==="solver_reported"){if(!c.solver||!c.solver_version||!c.evidence_ref||!num(c.measured_error_m)||c.measured_error_m<0)fail("CONTACT-DATA-22",c.id,"求解报告字段缺失");else{warnings.push({code:"CONTACT-SOLVER-CLAIM",shot:sid,contact:c.id});if(num(c.tolerance_m)&&c.measured_error_m>c.tolerance_m)fail("CONTACT-DATA-23",c.id,"接触误差超过容差");}}else fail("CONTACT-DATA-24",c.id,"status 无效");
   if(c.actor_id&&c.effector&&num(c.start_ms)&&num(c.end_ms))wins.push({actor:c.actor_id,effector:c.effector,target:targetId,start:c.start_ms,end:c.end_ms,id:c.id});
  }
  for(let x=0;x<wins.length;x++)for(let y=x+1;y<wins.length;y++){const a=wins[x],b=wins[y];if(a.actor===b.actor&&a.effector===b.effector&&a.target!==b.target&&Math.max(a.start,b.start)<Math.min(a.end,b.end))fail("CONTACT-DATA-25",a.id+" / "+b.id,"同一末端重叠约束到不同目标");}
  for(const[id,old]of prev){const ends=events.filter(e=>e&&e.action==="contact_end"&&e.contact_id===id);if(!curr.has(id)&&!ends.length)fail("CONTACT-DATA-26",id,"接触消失但没有 contact_end");if(curr.has(id)&&ends.length)fail("CONTACT-DATA-28",id,"接触仍持续却出现 contact_end");for(const e of ends)if(e.actor&&e.actor!==old.constraint.actor_id)fail("CONTACT-DATA-30",id,"contact_end 人物不匹配");}
  for(const e of events){if(!e||!["contact_begin","contact_end"].includes(e.action))continue;if(e.action==="contact_begin"){if(!curr.has(e.contact_id)||prev.has(e.contact_id))fail("CONTACT-DATA-29",e.contact_id,"孤立或重复 contact_begin");}else if(!prev.has(e.contact_id)||curr.has(e.contact_id))fail("CONTACT-DATA-29",e.contact_id,"孤立或未释放 contact_end");}
  prev=curr;
 }
 return{ok:!errors.length,errors,warnings};
}
const f=process.argv[2];if(!f){console.error("用法：node validate-scg-skeletal-contact.cjs <SCG JSON>");process.exit(2);}
let d;try{d=JSON.parse(fs.readFileSync(f,"utf8").replace(/^\\uFEFF/,""));}catch(e){console.error(e.message);process.exit(2);}
const cases=Array.isArray(d.cases)?d.cases:[{case_id:"input",scene:d}];let bad=0;
for(const c of cases){const r=run(c.scene||{}),codes=[...new Set(r.errors.map(x=>x.code))],expected=c.expected_contact_errors||[],ok=codes.length===expected.length&&expected.every(x=>codes.includes(x))&&(c.expected_contact_ok===undefined||r.ok===c.expected_contact_ok);if(!ok)bad++;console.log(JSON.stringify({case_id:c.case_id,ok:r.ok,errors:codes,warnings:r.warnings,expectation_match:ok}));}
console.log(JSON.stringify({summary:{total:cases.length,mismatch:bad}}));process.exit(bad?1:0);
