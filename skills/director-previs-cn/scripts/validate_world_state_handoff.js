#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const fixturePath = path.resolve(__dirname, "../tests/fixtures/导演世界状态交接基准-V1.json");
const contractPath = path.resolve(__dirname, "../references/导演世界状态交接数据契约-V1.md");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
if (!fs.existsSync(contractPath)) throw new Error("missing world-state handoff contract");
function validate(h) {
 const errors=[];
 const err=(code,message)=>errors.push({code,message});
 const isObj=v=>v&&typeof v==="object"&&!Array.isArray(v);
 const arr=v=>Array.isArray(v);
 const uniq=(items,key,code,label)=>{const seen=new Set();for(const item of items||[]){const v=item&&item[key];if(!v||seen.has(v))err(code, label+" missing/duplicate: "+String(v));seen.add(v);}};
 if(!isObj(h)) return {ok:false,errors:[{code:"H00",message:"handoff must be object"}]};
 if(h.schema_version!=="1.0.0"||!h.handoff_id||!h.project_id)err("H01","schema_version/handoff_id/project_id required");
 if(!isObj(h.source_script)||!h.source_script.script_id||!h.source_script.revision||!arr(h.source_script.scene_source_ids)||!h.source_script.scene_source_ids.length)err("H02","source_script incomplete");
 const s=h.scene||{};
 if(!s.scene_id||!s.world_revision||!s.static_world_revision)err("H03","scene identity/revisions required");
 if(!isObj(h.timebase)||h.timebase.unit!=="ms"||!["scene_start","episode_start","project_start"].includes(h.timebase.origin)||(h.timebase.frame_rate!==null&&h.timebase.frame_rate!==undefined&&(!Number.isFinite(h.timebase.frame_rate)||h.timebase.frame_rate<=0)))err("H03","timebase must explicitly use ms and a valid origin/frame rate");
 const assets=arr(h.canonical_assets)?h.canonical_assets:[];
 uniq(assets,"asset_id","H04","asset_id");
 const assetIds=new Set(assets.map(a=>a&&a.asset_id).filter(Boolean));
 if(!assets.length||assets.some(a=>!a.asset_type||!a.revision))err("H04","canonical assets require type and revision");
 const refs=arr(h.reference_map)?h.reference_map:[];
 uniq(refs,"reference_id","H04","reference_id");
 const authority=new Map();
 for(const r of refs){
  if(!assetIds.has(r.asset_id))err("H04","reference "+r.reference_id+" points to undeclared asset "+r.asset_id);
  if(!r.role||!arr(r.authority_fields)||!r.authority_fields.length||!Number.isFinite(r.priority)||!arr(r.may_override_fields))err("H04","reference mapping incomplete: "+r.reference_id);
  for(const field of r.authority_fields||[]){const key=field+"|"+r.priority;if(authority.has(key))err("H05","conflicting authority for "+field+" at priority "+r.priority);else authority.set(key,r.reference_id);}
 }
 const invariants=arr(h.invariants)?h.invariants:[];
 uniq(invariants,"invariant_id","H06","invariant_id");
 for(const v of invariants)if(!v.owner||!v.field||!["locked","derived","unknown"].includes(v.status)||!v.source_id)err("H06","invariant incomplete: "+v.invariant_id);
 const shots=arr(h.shot_chain)?h.shot_chain:[];
 if(!shots.length)err("H06","shot_chain must not be empty");
 uniq(shots,"shot_id","H06","shot_id");
 uniq(shots,"scg_shot_id","H06","scg_shot_id");
 const sorted=[...shots].sort((a,b)=>(a.order||0)-(b.order||0));
 let lastEnd=-Infinity;
 sorted.forEach((shot,i)=>{
  if(!shot.scene_id||shot.scene_id!==s.scene_id||shot.static_world_revision!==s.static_world_revision)err("H07","shot scene/static world revision drift: "+shot.shot_id);
  if(shot.order!==i+1)err("H08","shot order must be contiguous starting at 1");
  const expectedPrev=i===0?null:sorted[i-1].shot_id;
  if((shot.predecessor_shot_id??null)!==expectedPrev)err("H08","predecessor mismatch at "+shot.shot_id);
  if(!Number.isFinite(shot.time_start_ms)||!Number.isFinite(shot.time_end_ms)||shot.time_start_ms<0||shot.time_end_ms<=shot.time_start_ms||shot.time_start_ms<lastEnd)err("H08","invalid/overlapping shot time: "+shot.shot_id);
  lastEnd=shot.time_end_ms;
 });
 const p=h.continuity_policy||{};
 if(p.state_change_authority!=="scg_events_only"||p.static_world_change_requires_approved_revision!==true||p.locked_invariants_may_be_overridden!==false)err("H09","SCG events must be the only state mutation path; static changes require approved revision; locked invariants cannot be silently overridden");
 if(p.actor_and_camera_tracks_separate!==true||shots.some(x=>Object.prototype.hasOwnProperty.call(x,"camera_world_position")||Object.prototype.hasOwnProperty.call(x,"actor_camera_path")))err("H10","actor and camera tracks must be separate");
 if(shots.some(x=>["entities","relations","events","crowd_actions"].some(k=>Object.prototype.hasOwnProperty.call(x,k)))||["entities","relations","events","crowd_actions"].some(k=>Object.prototype.hasOwnProperty.call(h,k)))err("H11","handoff must reference SCG snapshots; do not duplicate entities/relations/events");
 return {ok:errors.length===0,errors};
}
function clone(v){return JSON.parse(JSON.stringify(v));}
function setPath(o,p,v){const a=p.split(".");let x=o;for(let i=0;i<a.length-1;i++)x=x[a[i]];x[a[a.length-1]]=v;}
function applyMutation(base,m){const h=clone(base);if(m.type==="set")setPath(h,m.path,m.value);else if(m.type==="append"){const a=m.path.split(".").reduce((x,k)=>x[k],h);a.push(m.value);}return h;}
let passed=0,failed=0;
function check(label,condition,detail=""){if(condition){passed++;console.log("PASS "+label);}else{failed++;console.error("FAIL "+label+(detail?": "+detail:""));}}
const base=fixture.valid_handoff;
const good=validate(base);
check("valid classroom handoff accepted",good.ok,JSON.stringify(good.errors));
check("one stable scene and world revision",base.shot_chain.every(s=>s.scene_id===base.scene.scene_id&&s.static_world_revision===base.scene.static_world_revision));
check("shot chain references SCG IDs, not copied entity snapshots",base.shot_chain.every(s=>s.scg_shot_id)&&!base.shot_chain.some(s=>s.entities||s.relations||s.events));
check("reference roles are explicit",base.reference_map.every(r=>r.role&&r.authority_fields.length&&Number.isFinite(r.priority)));
for(const c of fixture.negative_cases){const result=validate(applyMutation(base,c.mutation));const actual=new Set(result.errors.map(e=>e.code));const missing=(c.expected_errors||[]).filter(code=>!actual.has(code));check(c.id+" rejected with expected code",!result.ok&&missing.length===0,"missing="+missing.join(",")+" actual="+[...actual].join(","));}
console.log("\n结果："+passed+" PASS / "+failed+" FAIL");
if(failed)process.exitCode=1;
