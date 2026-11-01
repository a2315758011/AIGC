"use strict";
const assert=require("node:assert/strict");
const {validateManifest,point,dimensions,convert}=require("../scripts/export-directordesk-neutral.cjs");
const manifest={
 version:1,source_units:"meter",source_handedness:"left",target_handedness:"right",
 source_axis_positive:{x:"right",y:"backward",z:"up"},
 target_axis_positive:{x:"left",y:"up",z:"forward"},
 target_axis_from_source:{x:{axis:"x",sign:-1},y:{axis:"z",sign:1},z:{axis:"y",sign:-1}},
 origin_offset_m:{x:0,y:0,z:0},approval:{reference:"测试夹具：左手源坐标（X右/Y后/Z上），右手目标坐标（X左/Y上/Z前）"}
};
assert.equal(validateManifest(manifest).determinant,-1);
assert.deepEqual(point({x:1,y:2,z:3},{...validateManifest(manifest),manifest}),{x:-1,y:3,z:-2});
assert.deepEqual(dimensions({x:2,y:4,z:6},{...validateManifest(manifest),manifest}),{x:2,y:6,z:4});
assert.throws(()=>validateManifest({...manifest,source_units:"normalized_0_to_1"}),e=>e.code==="UNITS_UNSUPPORTED");
assert.throws(()=>validateManifest({...manifest,target_axis_from_source:{...manifest.target_axis_from_source,z:{axis:"y",sign:1}}}),e=>e.code==="AXIS_SEMANTICS_CONFLICT"||e.code==="HANDEDNESS_MISMATCH");
assert.throws(()=>validateManifest({...manifest,source_axis_positive:{x:"right",y:"front",z:"up"}}),e=>e.code==="AXIS_SEMANTICS_CONFLICT");
const db={scene_id:"TEST-ROOM",scene_name:"测试房间",status:"reviewed",camera_views:[{view_id:"CAM-01",camera_position:{x:0,y:1,z:2},look_at:{x:1,y:0,z:0},projection:"perspective",output_contract:"one_image_one_camera"}],objects:[{id:"DESK-1",kind:"desk",position:{x:1,y:2,z:0},mobility:"fixed",status:"confirmed",collision_volume:{shape:"box",width:1,depth:2,height:.75}}]};
const scg={shots:[{id:"SH1",entities:[{id:"CHAR-1",exists:true,attributes:{world_position:{x:2,y:2,z:0},collision_role:"actor",collision_volume:{shape:"capsule",radius:.2,height:1.7}}}],events:[{id:"EV1",actor:"CHAR-1",motion:{entity_id:"CHAR-1",from:{x:2,y:2,z:0},to:{x:3,y:2,z:0},start_ms:0,end_ms:1000}}]}]};
const pkg=convert(db,scg,manifest);
assert.equal(pkg.fixed_objects.length,1);
assert.equal(pkg.camera_presets.length,1);
assert.deepEqual(pkg.camera_presets[0].position_m,{x:0,y:2,z:0});
assert.deepEqual(pkg.camera_presets[0].look_at_m,{x:-1,y:0,z:0});
assert.deepEqual(pkg.fixed_objects[0].position_m,{x:-1,y:0,z:-2});
assert.deepEqual(pkg.shots[0].events[0].motion.to_m,{x:-3,y:0,z:-2});
assert.equal(pkg.release_ready,true);
const dbBad={...db,objects:[{...db.objects[0],position:null}]};
assert.equal(convert(dbBad,scg,manifest).release_ready,false);
console.log("PASS 7/7 coordinate/export adapter tests");
