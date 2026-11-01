#!/usr/bin/env node
"use strict";
// 直接读取 SCG scene.shots；不创建独立镜头/实体数据结构。
// 用法：node validate-scg-spatial-motion.cjs <SCG回归JSON>
const fs=require("node:fs");
const isObj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const finite=Number.isFinite;
function segmentHitsRect(a,b,r){
  let t0=0,t1=1,dx=b.x-a.x,dy=b.y-a.y;
  const tests=[[-dx,a.x-r.minX],[dx,r.maxX-a.x],[-dy,a.y-r.minY],[dy,r.maxY-a.y]];
  for(const [p,q] of tests){
    if(p===0){if(q<0)return false;continue;}
    const t=q/p;
    if(p<0){if(t>t1)return false;if(t>t0)t0=t;}
    else{if(t<t0)return false;if(t<t1)t1=t;}
  }
  return true;
}
function pos(e){return e&&e.attributes&&e.attributes.world_position;}
function footprint(e){return e&&e.attributes&&e.attributes.footprint;}
function rectAt(e,p,extra={width:0,depth:0}){
  const f=footprint(e);
  return {minX:p.x-(f.width+extra.width)/2,maxX:p.x+(f.width+extra.width)/2,
    minY:p.y-(f.depth+extra.depth)/2,maxY:p.y+(f.depth+extra.depth)/2};
}
function near(a,b){return isObj(a)&&isObj(b)&&finite(a.x)&&finite(a.y)&&finite(b.x)&&finite(b.y)&&Math.hypot(a.x-b.x,a.y-b.y)<1e-6;}
function run(scene){
 const errors=[],warnings=[];let prev=null;
 for(const shot of scene.shots||[]){
  const em=new Map((shot.entities||[]).map(e=>[e.id,e]));
  const held=new Map();
  for(const r of shot.relations||[])if(r.predicate==="held_by"){
    const a=held.get(r.subject)||[];a.push(r.object);held.set(r.subject,a);
  }
  for(const [id,holders] of held){
    const entity=em.get(id),multi=entity&&entity.attributes&&entity.attributes.allow_multiple_holders===true;
    if(holders.length>1&&!multi)errors.push({code:"PROP-01",shot:shot.id,message:id+" 同时有多个持有人："+holders.join(",")});
  }
  for(const ev of shot.events||[]){
    const m=ev.motion;
    if(!m)continue;
    const who=m.entity_id||ev.actor;
    const actor=em.get(who)||(prev&&new Map((prev.entities||[]).map(e=>[e.id,e])).get(who));
    if(!actor){errors.push({code:"MOTION-00",shot:shot.id,message:"移动对象不存在："+who});continue;}
    if(!finite(m.start_ms)||!finite(m.end_ms)||m.end_ms<=m.start_ms)
      errors.push({code:"MOTION-03",shot:shot.id,message:"移动事件时间区间无效："+(ev.id||"无ID")});
    const from=m.from,to=m.to,way=Array.isArray(m.waypoints)?m.waypoints:[];
    if(!isObj(from)||!isObj(to)||![from,to,...way].every(p=>isObj(p)&&finite(p.x)&&finite(p.y))){
      errors.push({code:"MOTION-00",shot:shot.id,message:"路径坐标缺失或非法："+(ev.id||"无ID")});continue;
    }
    const prior=prev&&new Map((prev.entities||[]).map(e=>[e.id,e])).get(who);
    if(prior&&pos(prior)&&!near(from,pos(prior)))errors.push({code:"MOTION-01",shot:shot.id,message:who+" 路径起点与上一镜世界位置不一致"});
    const current=em.get(who);
    if(current&&pos(current)&&!near(to,pos(current)))errors.push({code:"MOTION-02",shot:shot.id,message:who+" 路径终点与本镜世界位置不一致"});
    if(!footprint(actor)||!finite(footprint(actor).width)||!finite(footprint(actor).depth))
      warnings.push({code:"UNRESOLVED",shot:shot.id,message:who+" 占地尺寸未知，无法进行人物身体宽度碰撞检查"});
    const points=[from,...way,to];
    for(const obstacle of shot.entities||[]){
      if(obstacle.id===who||!obstacle.exists||!(obstacle.attributes&&obstacle.attributes.collision_role==="obstacle"))continue;
      const op=pos(obstacle),of=footprint(obstacle);
      if(!op||!of||!finite(of.width)||!finite(of.depth)){
        warnings.push({code:"UNRESOLVED",shot:shot.id,message:"障碍物 "+obstacle.id+" 缺少坐标或占地尺寸"});continue;
      }
      const af=footprint(actor)||{width:0,depth:0};
      const r=rectAt(obstacle,op,af);
      for(let i=0;i<points.length-1;i++)if(segmentHitsRect(points[i],points[i+1],r)){
        errors.push({code:"MOTION-04",shot:shot.id,message:who+" 路径与障碍物 "+obstacle.id+" 相交"});break;
      }
    }
    const atEnd=shot.entities&&shot.entities.find(e=>e.id===who);
    if(atEnd&&pos(atEnd)&&footprint(atEnd)){
      const r=rectAt(atEnd,to);
      for(const obstacle of shot.entities||[]){
        if(obstacle.id===who||!obstacle.exists||!(obstacle.attributes&&obstacle.attributes.collision_role==="obstacle"))continue;
        const op=pos(obstacle),of=footprint(obstacle);if(!op||!of)continue;
        if(to.x>=op.x-(of.width+footprint(atEnd).width)/2&&to.x<=op.x+(of.width+footprint(atEnd).width)/2&&
           to.y>=op.y-(of.depth+footprint(atEnd).depth)/2&&to.y<=op.y+(of.depth+footprint(atEnd).depth)/2)
          errors.push({code:"MOTION-05",shot:shot.id,message:who+" 路径终点落在障碍物 "+obstacle.id+" 内"});
      }
    }
  }
  prev=shot;
 }
 return {ok:errors.length===0,errors,warnings};
}
const file=process.argv[2];if(!file){console.error("用法：node validate-scg-spatial-motion.cjs <SCG回归JSON>");process.exit(2);}
let data;try{data=JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,""));}catch(e){console.error("JSON解析失败："+e.message);process.exit(2);}
let fail=0,total=0;
for(const c of data.cases||[]){const r=run(c.scene||{});const codes=[...new Set(r.errors.map(x=>x.code))];const expected=c.expected_motion_errors||[];const match=expected.every(x=>codes.includes(x))&&(c.expected_motion_ok===undefined||r.ok===c.expected_motion_ok);if(!match)fail++;total++;console.log(JSON.stringify({case_id:c.case_id,actual_ok:r.ok,errors:codes,warnings:r.warnings,expectation_match:match}));}
console.log(JSON.stringify({summary:{total,mismatch:fail}}));process.exit(fail?1:0);
