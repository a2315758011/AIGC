#!/usr/bin/env node
"use strict";
// SCG关系级骨骼/接触结构校验；不运行真实IK。
const fs=require("node:fs"),isObj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v),finite=Number.isFinite;
const EFFECTORS=new Set(["left_foot","right_foot","left_hand","right_hand","pelvis","torso","back","left_knee","right_knee","left_elbow","right_elbow","left_shoulder","right_shoulder"]);
const MODES={support:["sitting_on","resting_on"],grasp:["held_by"],brace:["resting_on","attached_to"]};
function run(scene){
 const errors=[],warnings=[];if(!isObj(scene)||!Array.isArray(scene.shots)||!scene.shots.length)return {ok:false,errors:[{code:"CONTACT-DATA-01"}],warnings};
 let prev=new Map();
 for(let i=0;i<scene.shots.length;i++){
  const s=scene.shots[i],sid=s.id||s.shot_id||String(i),entities=new Map((s.entities||[]).filter(e=>e&&e.id).map(e=>[e.id,e])),events=s.events||[],byEvent=new Map(events.map(e=>[e.id||e.event_id,e]).filter(x=>x[0])),curr=new Map(),wins=[];
  for(const r of s.relations||[]){const c=r&&r.contact_constraint;if(!c)continue;const fail=(code,msg)=>errors.push({code,shot:sid,contact:c.id||null,message:msg});
   if(!isObj(c)||typeof c.id!=="string"||!c.id.trim()){fail("CONTACT-DATA-02","缺少 contact id");continue;}
   if(curr.has(c.id)){fail("CONTACT-DATA-03","contact id 重复");continue;}curr.set(c.id,c);
   const actor=entities.get(c.actor_id),sub=entities.get(r.subject),obj=entities.get(r.object),grasp=c.mode==="grasp",targetId=grasp?r.subject:r.object;
   if(!sub||!obj)fail("CONTACT-DATA-04","relation endpoint 不存在");
   if(!actor)fail("CONTACT-DATA-05","actor 不存在");
   if(!MODES[c.mode])fail("CONTACT-DATA-06","未知 contact mode");
   else if(!MODES[c.mode].includes(r.predicate))fail("CONTACT-DATA-07","mode/predicate 不匹配");
   if(c.actor_id!==(grasp?r.object:r.subject))fail("CONTACT-DATA-08","actor 与 relation 方向不匹配");
   if(!EFFECTORS.has(c.effector))fail("CONTACT-DATA-09","effector 类别无效");
   const a=actor&&actor.attributes||{},rig=a.skeletal_rig,pose=a.skeletal_pose;
   if(!isObj(rig)||!rig.rig_id||!rig.skeleton_profile)fail("CONTACT-DATA-10","缺少 rig_id/skeleton_profile");
   else if(!isObj(rig.effectors)||typeof rig.effectors[c.effector]!=="string"||!rig.effectors[c.effector].trim())fail("CONTACT-DATA-11","effector 未映射骨骼/控制器");
   if(!isObj(pose)||!pose.pose_id||!pose.clip_id||!pose.pose_state||pose.root_motion_separate!==true)fail("CONTACT-DATA-12","姿态片段字段缺失或 root_motion_separate 未启用");
   if(typeof c.target_anchor_id!=="string"||!c.target_anchor_id.trim())fail("CONTACT-DATA-13","缺少 target_anchor_id");
   else{const t=entities.get(targetId),anchors=t&&t.attributes&&t.attributes.contact_anchors;if(!Array.isArray(anchors)||!anchors.some(x=>x&&x.id===c.target_anchor_id))fail("CONTACT-DATA-14","目标锚点不存在");}
   if(!finite(c.start_ms)||!finite(c.end_ms)||c.end_ms<=c.start_ms)fail("CONTACT-DATA-15","接触时间无效");
   if(finite(s.time_start_ms)&&finite(s.time_end_ms)&&finite(c.start_ms)&&finite(c.end_ms)&&(c.start_ms<s.time_start_ms||c.end_ms>s.time_end_ms))fail("CONTACT-DATA-16","接触时间超出镜头");
   if(!finite(c.tolerance_m)||c.tolerance_m<=0)fail("CONTACT-DATA-17","容差必须为正数");
   if(!["baseline","event","inherited"].includes(c.origin))fail("CONTACT-DATA-18","origin 无效");
   if(c.origin==="baseline"&&i!==0)fail("CONTACT-DATA-19","baseline 仅允许首镜");
   if(c.origin==="inherited"&&!prev.has(c.id))fail("CONTACT-DATA-20","继承接触上一镜不存在");
   if(c.origin==="event"){const e=byEvent.get(c.source_event_id);if(!e||e.action!=="contact_begin"||e.contact_id!==c.id)fail("CONTACT-DATA-21","缺少匹配 contact_begin 事件");}
   if(c.status==="planned")warnings.push({code:"CONTACT-NOT-SOLVED",shot:sid,contact:c.id});
   else if(c.status==="solver_reported"){
    if(!c.solver||!c.solver_version||!c.evidence_ref||!finite(c.measured_error_m)||c.measured_error_m<0)fail("CONTACT-DATA-22","求解报告字段缺失");
    else{warnings.push({code:"CONTACT-SOLVER-CLAIM",shot:sid,contact:c.id});if(finite(c.tolerance_m)&&c.measured_error_m>c.tolerance_m)fail("CONTACT-DATA-23","接触误差超过容差");}
   }else fail("CONTACT-DATA-24","status 无效");
   if(c.actor_id&&c.effector&&finite(c.start_ms)&&finite(c.end_ms))wins.push({actor:c.actor_id,effector:c.effector,target:targetId,start:c.start_ms,end:c.end_ms,id:c.id});
  }
  for(let x=0;x<wins.length;x++)for(let y=x+1;y<wins.length;y++){const a=wins[x],b=wins[y];if(a.actor===b.actor&&a.effector===b.effector&&a.target!==b.target&&Math.max(a.start,b.start)<Math.min(a.end,b.end))errors.push({code:"CONTACT-DATA-25",shot:sid,contact:a.id+" / "+b.id});}
  for(const id of prev.keys())if(!curr.has(id)&&!events.some(e=>e&&e.action==="contact_end"&&e.contact_id===id))errors.push({code:"CONTACT-DATA-26",shot:sid,contact:id});
  prev=curr;
 }
 return {ok:!errors.length,errors,warnings};
}
const f=process.argv[2];if(!f){console.error("用法：node validate-scg-skeletal-contact.cjs <SCG JSON>");process.exit(2);}
let d;try{d=JSON.parse(fs.readFileSync(f,"utf8").replace(/^\\uFEFF/,""));}catch(e){console.error(e.message);process.exit(2);}
const cases=Array.isArray(d.cases)?d.cases:[{case_id:"input",scene:d}];let bad=0;
for(const c of cases){const r=run(c.scene||{}),codes=[...new Set(r.errors.map(x=>x.code))],expected=c.expected_contact_errors||[],ok=codes.length===expected.length&&expected.every(x=>codes.includes(x))&&(c.expected_contact_ok===undefined||r.ok===c.expected_contact_ok);if(!ok)bad++;console.log(JSON.stringify({case_id:c.case_id,ok:r.ok,errors:codes,warnings:r.warnings,expectation_match:ok}));}
console.log(JSON.stringify({summary:{total:cases.length,mismatch:bad}}));process.exit(bad?1:0);
