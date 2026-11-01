#!/usr/bin/env node
"use strict";
// 无第三方依赖。用法：node validate-shot-continuity.cjs <镜头序列JSON>
const fs=require("node:fs");
function isObj(v){return v!==null&&typeof v==="object"&&!Array.isArray(v);}
function stable(v){
  if(Array.isArray(v)) return v.map(stable);
  if(isObj(v)) return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
  return v;
}
function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
function main(){
  const file=process.argv[2];
  if(!file){console.error("用法：node validate-shot-continuity.cjs <镜头序列JSON>");process.exit(2);}
  let doc;
  try{doc=JSON.parse(fs.readFileSync(file,"utf8"));}catch(e){console.error("JSON读取/解析失败："+e.message);process.exit(2);}
  const errors=[],warnings=[];
  if(!isObj(doc)||typeof doc.scene_id!=="string"||!Array.isArray(doc.shots)||doc.shots.length===0){
    console.log(JSON.stringify({status:"FAILED",errors:["必须提供 scene_id 和非空 shots 数组"]},null,2));process.exit(1);
  }
  const ids=new Set(),eventIds=new Set();
  for(let i=0;i<doc.shots.length;i++){
    const s=doc.shots[i],where="shots["+i+"]";
    if(!isObj(s)){errors.push(where+" 必须为对象");continue;}
    if(typeof s.shot_id!=="string"||!s.shot_id.trim())errors.push(where+" 缺少 shot_id");
    else if(ids.has(s.shot_id))errors.push("shot_id 重复："+s.shot_id); else ids.add(s.shot_id);
    if(s.scene_id!==doc.scene_id)errors.push(where+" scene_id 与序列不一致");
    if(i===0){if(s.previous_shot_id!==null)errors.push("首镜 previous_shot_id 必须为 null");}
    else{
      const prev=doc.shots[i-1];
      if(s.previous_shot_id!==prev.shot_id)errors.push(s.shot_id+" previous_shot_id 未指向上一镜头");
      if(!same(prev.state_out,s.state_in))errors.push(s.shot_id+" state_in 与上一镜头 state_out 不一致（疑似瞬移/状态丢失）");
    }
    for(const k of ["state_in","state_out"])if(!isObj(s[k]))errors.push(where+" 缺少对象 "+k);
    if(!Array.isArray(s.events))errors.push(where+" events 必须为数组");
    else for(const e of s.events){
      if(!isObj(e)||typeof e.event_id!=="string"||!e.event_id.trim())errors.push(where+" 存在无效事件");
      else if(eventIds.has(e.event_id))errors.push("event_id 重复："+e.event_id);else eventIds.add(e.event_id);
    }
    if(isObj(s.state_in)&&isObj(s.state_out)&&!same(s.state_in,s.state_out)&&(!Array.isArray(s.events)||s.events.length===0)){
      errors.push(s.shot_id+" 状态发生变化但没有事件记录");
    }
    if(!isObj(s.camera))warnings.push(s.shot_id+" 未记录 camera 信息");
  }
  const report={scene_id:doc.scene_id,shot_count:doc.shots.length,status:errors.length?"FAILED":"PASSED",error_count:errors.length,warning_count:warnings.length,errors,warnings};
  console.log(JSON.stringify(report,null,2));process.exit(errors.length?1:0);
}
main();
