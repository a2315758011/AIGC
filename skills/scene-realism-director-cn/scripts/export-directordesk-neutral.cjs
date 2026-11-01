#!/usr/bin/env node
"use strict";
// AIGC -> DirectorDesk中立三维预演包适配器；不伪造DirectorDesk原生 .director 格式。
const fs=require("node:fs");
const obj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const finite=v=>typeof v==="number"&&Number.isFinite(v);
const OPP={right:"left",left:"right",up:"down",down:"up",forward:"backward",backward:"forward"};
const UNITS={meter:1,centimeter:0.01};
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function parity(p){let inv=0;for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++)if(p[i]>p[j])inv++;return inv%2?-1:1;}
function validateManifest(m){
 if(!obj(m)||m.version!==1)fail("MANIFEST_VERSION","manifest.version 必须为 1");
 if(!obj(m.source_axis_positive)||!obj(m.target_axis_positive)||!obj(m.target_axis_from_source))fail("AXIS_UNDECLARED","必须明确声明源/目标坐标轴正方向及映射");
 if(!["right","left"].includes(m.source_handedness)||!["right","left"].includes(m.target_handedness))fail("HANDEDNESS_UNDECLARED","必须明确源和目标坐标系手性");
 if(!Object.hasOwn(UNITS,m.source_units))fail("UNITS_UNSUPPORTED","仅允许 meter/centimeter；归一化和未知单位禁止导出米制预演包");
 const targets=["x","y","z"],sources=[],signs=[];
 for(const t of targets){
  const r=m.target_axis_from_source[t];
  if(!obj(r)||!["x","y","z"].includes(r.axis)||![1,-1].includes(r.sign))fail("AXIS_MAPPING_INVALID","目标轴 "+t+" 的映射无效");
  sources.push(["x","y","z"].indexOf(r.axis));signs.push(r.sign);
  const src=m.source_axis_positive[r.axis],dst=m.target_axis_positive[t];
  if(typeof src!=="string"||typeof dst!=="string")fail("AXIS_SEMANTICS_MISSING","轴 "+r.axis+"/"+t+" 缺少正方向语义");
  const expected=r.sign===1?src:OPP[src];
  if(!expected||expected!==dst)fail("AXIS_SEMANTICS_CONFLICT","目标轴 "+t+" 的正方向与映射符号冲突");
 }
 if(new Set(sources).size!==3)fail("AXIS_MAPPING_NOT_PERMUTATION","轴映射必须是一一对应的置换");
 const det=parity(sources)*signs.reduce((a,b)=>a*b,1);
 const expected=m.source_handedness===m.target_handedness?1:-1;
 if(det!==expected)fail("HANDEDNESS_MISMATCH","轴映射行列式与源/目标坐标系手性不一致");
 const off=m.origin_offset_m||{x:0,y:0,z:0};
 if(!obj(off)||!targets.every(k=>finite(off[k])))fail("ORIGIN_OFFSET_INVALID","origin_offset_m 必须是有限 XYZ 米制数值");
 if(!m.approval||typeof m.approval.reference!=="string"||!m.approval.reference.trim())fail("AXIS_APPROVAL_REQUIRED","必须记录经确认的场景朝向/轴向依据");
 return {unitFactor:UNITS[m.source_units],offset:off,determinant:det};
}
function point(p,mv){
 if(!obj(p)||!["x","y","z"].every(k=>finite(p[k])))fail("POSITION_INVALID","位置必须包含有限 XYZ");
 const out={};
 for(const t of ["x","y","z"]){const r=mv.manifest.target_axis_from_source[t];out[t]=r.sign*p[r.axis]*mv.unitFactor+mv.offset[t];}
 return out;
}
function direction(v,mv){
 if(!obj(v)||!["x","y","z"].every(k=>finite(v[k])))fail("DIRECTION_INVALID","朝向向量必须包含有限 XYZ");
 const out={};for(const t of ["x","y","z"]){const r=mv.manifest.target_axis_from_source[t];const n=r.sign*v[r.axis];out[t]=Object.is(n,-0)?0:n;}return out;
}
function dimensions(d,mv){
 if(!obj(d)||!["x","y","z"].every(k=>finite(d[k])&&d[k]>0))return null;
 const out={};
 for(const t of ["x","y","z"]){const r=mv.manifest.target_axis_from_source[t];out[t]=d[r.axis]*mv.unitFactor;}
 return out;
}
function convert(db,scg,manifest){
 const mv={...validateManifest(manifest),manifest};
 if(!obj(db)||!obj(scg))fail("INPUT_INVALID","场景数据库与SCG必须是JSON对象");
 const unresolved=[],objects=[];
 for(const o of db.objects||[]){
  if(!o||!o.id)continue;
  if(!obj(o.position)||!["x","y","z"].every(k=>finite(o.position[k]))){unresolved.push({id:o.id,reason:"固定对象缺少完整位置"});continue;}
  const size=o.collision_volume&&o.collision_volume.shape==="box"
   ?dimensions({x:o.collision_volume.width,y:o.collision_volume.depth,z:o.collision_volume.height},mv)
   :o.footprint&&finite(o.height)?dimensions({x:o.footprint.width,y:o.footprint.depth,z:o.height},mv):null;
  if(!size){unresolved.push({id:o.id,reason:"固定对象缺少完整三维尺寸"});continue;}
  objects.push({id:o.id,kind:o.kind,position_m:point(o.position,mv),size_m:size,mobility:o.mobility,source_status:o.status});
 }
 const cameras=[];
 for(const cam of db.camera_views||[]){
  const valid=v=>obj(v)&&["x","y","z"].every(k=>finite(v[k]));
  if(!valid(cam.camera_position)||!valid(cam.look_at)){unresolved.push({id:cam.view_id||"CAMERA-UNKNOWN",reason:"摄影机预设缺少完整位置或注视点"});continue;}
  cameras.push({id:cam.view_id,position_m:point(cam.camera_position,mv),look_at_m:point(cam.look_at,mv),projection:cam.projection,output_contract:cam.output_contract});
 }
 const shots=[];
 for(const shot of scg.shots||[]){
  const entities=[];
  for(const e of shot.entities||[]){
   const a=e.attributes||{},x={id:e.id,exists:e.exists,collision_role:a.collision_role};
   if(a.world_position)x.position_m=point(a.world_position,mv);
   else if(e.exists&&a.collision_role!=="obstacle")unresolved.push({id:e.id,shot:shot.id,reason:"动态实体缺少世界坐标"});
   // 姿态标签和身体/头部朝向分开保存；不从单一朝向推断另一个。
   if(a.pose_state!==undefined)x.pose_state=a.pose_state;
   if(a.body_forward){try{x.body_forward=direction(a.body_forward,mv);}catch(err){unresolved.push({id:e.id,shot:shot.id,reason:"身体朝向无效："+err.message});}}
   if(a.head_forward){try{x.head_forward=direction(a.head_forward,mv);}catch(err){unresolved.push({id:e.id,shot:shot.id,reason:"头部朝向无效："+err.message});}}
   if(a.support_state!==undefined)x.support_state=a.support_state;
   if(a.collision_volume){const v=a.collision_volume;if(v.shape==="box")x.size_m=dimensions({x:v.width,y:v.depth,z:v.height},mv);else if(v.shape==="sphere"||v.shape==="capsule")x.proxy={shape:v.shape,radius_m:v.radius*mv.unitFactor,height_m:v.height===undefined?undefined:v.height*mv.unitFactor};}
   entities.push(x);
  }
  const events=[];
  for(const ev of shot.events||[]){
   if(!ev.motion){events.push({id:ev.id,source_id:ev.source_id,action:ev.action});continue;}
   const m=ev.motion;
   const motion={entity_id:m.entity_id||ev.actor};
   if(m.from)motion.from_m=point(m.from,mv);
   if(m.to)motion.to_m=point(m.to,mv);
   if(Array.isArray(m.waypoints))motion.waypoints_m=m.waypoints.map(p=>point(p,mv));
   // 摄影机注视点轨道是独立于光心位置轨道的方向目标通道。
   if(m.look_at_from)motion.look_at_from_m=point(m.look_at_from,mv);
   if(m.look_at_to)motion.look_at_to_m=point(m.look_at_to,mv);
   if(Array.isArray(m.look_at_waypoints))motion.look_at_waypoints_m=m.look_at_waypoints.map(p=>point(p,mv));
   motion.start_ms=m.start_ms;motion.end_ms=m.end_ms;
   events.push({id:ev.id,source_id:ev.source_id,action:ev.action,motion});
  }
  shots.push({id:shot.id,entities,events});
 }
 return {
  format:"aigc-directordesk-neutral-preview-v1",
  native_directordesk_project:false,
  scene:{id:db.scene_id,name:db.scene_name,status:db.status},
  transform:{source_units:manifest.source_units,target_units:"meter",source_axis_positive:manifest.source_axis_positive,target_axis_positive:manifest.target_axis_positive,target_axis_from_source:manifest.target_axis_from_source,source_handedness:manifest.source_handedness,target_handedness:manifest.target_handedness,origin_offset_m:mv.offset,approval:manifest.approval,determinant:mv.determinant},
  fixed_objects:objects,camera_presets:cameras,shots,unresolved,
  release_ready:unresolved.length===0,
  limitation:"中立交换包，不是DirectorDesk原生工程；导入前仍需按已安装版本的原生项目接口适配并做实际视口验收。"
 };
}
if(require.main===module){
 const [dbp,scgp,mp,out]=process.argv.slice(2);
 if(!out){console.error("用法：node export-directordesk-neutral.cjs <场景数据库.json> <SCG.json> <坐标manifest.json> <输出.json>");process.exit(2);}
 try{const result=convert(JSON.parse(fs.readFileSync(dbp,"utf8")),JSON.parse(fs.readFileSync(scgp,"utf8")),JSON.parse(fs.readFileSync(mp,"utf8")));fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify({output:out,objects:result.fixed_objects.length,shots:result.shots.length,unresolved:result.unresolved.length,release_ready:result.release_ready}));if(!result.release_ready)process.exitCode=1;}
 catch(e){console.error(JSON.stringify({error:e.code||"ERROR",message:e.message}));process.exit(1);}
}
module.exports={validateManifest,point,direction,dimensions,convert};
