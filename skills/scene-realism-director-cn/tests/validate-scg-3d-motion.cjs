#!/usr/bin/env node
"use strict";
// SCG三维代理碰撞检查；无第三方依赖。
// 用法：node validate-scg-3d-motion.cjs <SCG JSON> [固定场景数据库JSON]
const fs=require("node:fs");
const obj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const n=Number.isFinite;
const xyz=p=>obj(p)&&n(p.x)&&n(p.y)&&n(p.z);
function slab(a,b,r){
 let lo=0,hi=1;const d=[b.x-a.x,b.y-a.y,b.z-a.z],mn=[r.minX,r.minY,r.minZ],mx=[r.maxX,r.maxY,r.maxZ],v=[a.x,a.y,a.z];
 for(let i=0;i<3;i++){if(d[i]===0){if(v[i]<mn[i]||v[i]>mx[i])return false;continue;}
 let t1=(mn[i]-v[i])/d[i],t2=(mx[i]-v[i])/d[i];if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return false;}
 return hi>=0&&lo<=1;
}
function volume(e){
 const a=e&&e.attributes||{},v=a.collision_volume;
 if(!obj(v)||!["box","capsule","sphere"].includes(v.shape))return null;
 if(v.shape==="box"&&[v.width,v.depth,v.height].every(x=>n(x)&&x>0))return {shape:"box",x:v.width/2,y:v.depth/2,z:v.height};
 if(v.shape==="capsule"&&n(v.radius)&&v.radius>0&&n(v.height)&&v.height>=2*v.radius)return {shape:"capsule",x:v.radius,y:v.radius,z:v.height};
 if(v.shape==="sphere"&&n(v.radius)&&v.radius>0)return {shape:"sphere",x:v.radius,y:v.radius,z:v.radius};
 return null;
}
function obstacleBox(e){
 const p=e&&e.attributes&&e.attributes.world_position,v=volume(e);
 if(!xyz(p)||!v)return null;
 return {minX:p.x-v.x,maxX:p.x+v.x,minY:p.y-v.y,maxY:p.y+v.y,minZ:p.z,maxZ:p.z+v.z};
}
function movingBoundsAtRoot(root,v){
 // 根节点定义：box/capsule底面中心；sphere中心。将障碍按代理体积作Minkowski扩张。
 if(v.shape==="sphere")return {minX:root.x-v.x,maxX:root.x+v.x,minY:root.y-v.y,maxY:root.y+v.y,minZ:root.z-v.z,maxZ:root.z+v.z};
 return {minX:root.x-v.x,maxX:root.x+v.x,minY:root.y-v.y,maxY:root.y+v.y,minZ:root.z-v.z,maxZ:root.z+v.z};
}
function expandedObstacle(o,v){
 if(v.shape==="sphere")return {minX:o.minX-v.x,maxX:o.maxX+v.x,minY:o.minY-v.y,maxY:o.maxY+v.y,minZ:o.minZ-v.z,maxZ:o.maxZ+v.z};
 return {minX:o.minX-v.x,maxX:o.maxX+v.x,minY:o.minY-v.y,maxY:o.maxY+v.y,minZ:o.minZ-v.z,maxZ:o.maxZ};
}
function equal(a,b){return xyz(a)&&xyz(b)&&Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-6;}
function run(doc,sceneDb){
 const errors=[],warnings=[];let previous=null;
 const fixed=new Map(),fixedUnknown=[];
 if(sceneDb&&sceneDb.coordinate_system&&sceneDb.coordinate_system.units==="normalized_0_to_1")warnings.push({code:"UNRESOLVED",message:"场景坐标为归一化值；仅能做相对碰撞检查，不能证明真实尺寸/净空"});
 if(sceneDb&&Array.isArray(sceneDb.objects))for(const o of sceneDb.objects){
  if(!o||!o.id)continue;
  const p=o.position&&{x:o.position.x,y:o.position.y,z:o.position.z};
  const fp=o.footprint,cv=o.collision_volume;
  if(xyz(p)&&obj(cv)&&cv.shape==="box"&&[cv.width,cv.depth,cv.height].every(x=>n(x)&&x>0)){
   fixed.set(o.id,{id:o.id,exists:true,attributes:{world_position:p,collision_volume:cv,collision_role:"obstacle"}});
  }else if(xyz(p)&&obj(fp)&&n(fp.width)&&n(fp.depth)&&n(o.height)&&o.height>0){
   fixed.set(o.id,{id:o.id,exists:true,attributes:{world_position:p,collision_volume:{shape:"box",width:fp.width,depth:fp.depth,height:o.height},collision_role:"obstacle"}});
  }else if(o.mobility==="fixed"||o.clearance_required===true)fixedUnknown.push(o.id);
 }
 for(const shot of doc.shots||[]){
  const entities=new Map((shot.entities||[]).map(e=>[e.id,e]));
  for(const [id,e] of fixed){const old=entities.get(id);if(!old)entities.set(id,e);else{const a=old.attributes||{},g=e.attributes||{};entities.set(id,{...old,attributes:{...g,...a,world_position:a.world_position||g.world_position,collision_volume:a.collision_volume||g.collision_volume,collision_role:a.collision_role||g.collision_role||"obstacle"}});}}
  for(const ev of shot.events||[]){
   const m=ev.motion;if(!m)continue;
   const id=m.entity_id||ev.actor,actor=entities.get(id);
   if(!actor){errors.push({code:"3D-MOTION-01",shot:shot.id,message:"移动对象未找到："+id});continue;}
   const v=volume(actor);
   if(!v){warnings.push({code:"UNRESOLVED",shot:shot.id,message:id+" 缺少有效 collision_volume"});continue;}
   const pts=[m.from,...(Array.isArray(m.waypoints)?m.waypoints:[]),m.to];
   if(!pts.every(xyz)){errors.push({code:"3D-MOTION-01",shot:shot.id,message:id+" 路径点必须包含有效 XYZ"});continue;}
   if(!n(m.start_ms)||!n(m.end_ms)||m.end_ms<=m.start_ms)errors.push({code:"3D-MOTION-02",shot:shot.id,message:id+" 时间区间无效"});
   const prevEntity=previous&&previous.get(id);
   if(prevEntity&&prevEntity.attributes&&prevEntity.attributes.world_position&&!equal(m.from,prevEntity.attributes.world_position))
    errors.push({code:"3D-MOTION-05",shot:shot.id,message:id+" 起点与上一镜位置不一致"});
   const current=entities.get(id),cp=current&&current.attributes&&current.attributes.world_position;
   if(cp&&!equal(m.to,cp))errors.push({code:"3D-MOTION-06",shot:shot.id,message:id+" 终点与本镜位置不一致"});
   let unresolved=false;
   for(const oid of fixedUnknown){warnings.push({code:"UNRESOLVED",shot:shot.id,message:"固定障碍 "+oid+" 缺少完整三维几何，不能证明路径无碰撞"});unresolved=true;}
   for(const [oid,ob] of entities){
    if(oid===id||!ob.exists||!(ob.attributes&&ob.attributes.collision_role==="obstacle"))continue;
    const box=obstacleBox(ob);if(!box){warnings.push({code:"UNRESOLVED",shot:shot.id,message:"障碍 "+oid+" 缺少完整XYZ/体积"});unresolved=true;continue;}
    const expanded=expandedObstacle(box,v);
    for(let i=0;i<pts.length-1;i++)if(slab(pts[i],pts[i+1],expanded)){
     errors.push({code:"3D-MOTION-03",shot:shot.id,message:id+" 的代理体积路径与障碍 "+oid+" 相交"});break;
    }
    const end=m.to;
    if(end.x>=expanded.minX&&end.x<=expanded.maxX&&end.y>=expanded.minY&&end.y<=expanded.maxY&&end.z>=expanded.minZ&&end.z<=expanded.maxZ)
     errors.push({code:"3D-MOTION-04",shot:shot.id,message:id+" 终点代理体积进入障碍 "+oid});
   }
   if(unresolved)warnings.push({code:"UNRESOLVED",shot:shot.id,message:id+" 的路径结果不完整，不能放行"});
  }
  previous=new Map((shot.entities||[]).map(e=>[e.id,e]));
 }
 return {ok:errors.length===0&&warnings.length===0,errors,warnings};
}
const file=process.argv[2];if(!file){console.error("用法：node validate-scg-3d-motion.cjs <SCG JSON> [固定场景数据库JSON]");process.exit(2);}
let doc,db=null;try{doc=JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,""));if(process.argv[3])db=JSON.parse(fs.readFileSync(process.argv[3],"utf8").replace(/^\uFEFF/,""));}catch(e){console.error("JSON读取/解析失败："+e.message);process.exit(2);}
const cases=Array.isArray(doc.cases)?doc.cases:[{case_id:"input",scene:doc}];let mismatch=0;
for(const c of cases){const r=run(c.scene||{},db);const codes=[...new Set(r.errors.map(e=>e.code))];const expected=c.expected_3d_errors||[];const match=expected.every(x=>codes.includes(x))&&(c.expected_3d_ok===undefined||r.ok===c.expected_3d_ok);if(!match)mismatch++;console.log(JSON.stringify({case_id:c.case_id,ok:r.ok,errors:codes,warnings:r.warnings,expectation_match:match}));}
console.log(JSON.stringify({summary:{total:cases.length,mismatch}}));process.exit(mismatch?1:0);
