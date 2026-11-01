#!/usr/bin/env node
"use strict";

// 依赖：Node.js 内置模块，无第三方依赖。
// 用法：node validate-scene-database.cjs <场景JSON文件路径>
const fs = require("node:fs");
const path = require("node:path");

function fail(errors, message) { errors.push(message); }
function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function finite(v) { return typeof v === "number" && Number.isFinite(v); }

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("用法：node validate-scene-database.cjs <场景JSON文件路径>");
    process.exit(2);
  }
  const absolute = path.resolve(file);
  let data;
  try { data = JSON.parse(fs.readFileSync(absolute, "utf8")); }
  catch (e) { console.error("JSON读取/解析失败：" + e.message); process.exit(2); }

  const errors = [];
  const warnings = [];
  const required = ["schema_version","scene_id","scene_name","status","source_of_truth","coordinate_system","fixed_facts","objects","unknowns","camera_views"];
  for (const k of required) if (!(k in data)) fail(errors, "缺少必需字段：" + k);
  if (data.schema_version !== "1.0") fail(errors, "schema_version 必须为 1.0");
  if (typeof data.scene_id !== "string" || !/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(data.scene_id)) fail(errors, "scene_id 格式不合法");
  if (!["draft","reviewed","locked","deprecated"].includes(data.status)) fail(errors, "status 不合法");
  if (!isObj(data.coordinate_system)) fail(errors, "coordinate_system 必须为对象");
  else if (!["meter","centimeter","normalized_0_to_1","unknown"].includes(data.coordinate_system.units)) fail(errors, "coordinate_system.units 不合法");

  if ("dynamic_state" in data && !Array.isArray(data.dynamic_state)) fail(errors, "dynamic_state 若保留必须为数组（旧版兼容字段）");

  for (const k of ["fixed_facts","objects","unknowns","camera_views"]) {
    if (!Array.isArray(data[k])) fail(errors, k + " 必须为数组");
  }

  const ids = new Set();
  const addId = (id, where) => {
    if (typeof id !== "string" || !id.trim()) fail(errors, where + " 缺少有效 id");
    else if (ids.has(id)) fail(errors, "重复 id：" + id);
    else ids.add(id);
  };

  if (Array.isArray(data.fixed_facts)) data.fixed_facts.forEach((x,i) => {
    if (!isObj(x)) return fail(errors, "fixed_facts[" + i + "] 必须为对象");
    addId(x.id, "fixed_facts[" + i + "]");
    if (!["architecture","opening","fixed_furniture","fixed_equipment","layout_rule"].includes(x.category)) fail(errors, "固定事实分类非法：" + x.id);
    if (!["user_confirmed","reference_observed","measured","logical_assumption"].includes(x.authority)) fail(errors, "固定事实 authority 非法：" + x.id);
    if (!("location" in x)) fail(errors, "固定事实必须显式提供 location（未知时填 null）：" + x.id);
  });

  if (Array.isArray(data.objects)) data.objects.forEach((x,i) => {
    if (!isObj(x)) return fail(errors, "objects[" + i + "] 必须为对象");
    addId(x.id, "objects[" + i + "]");
    if (typeof x.kind !== "string" || !x.kind.trim()) fail(errors, "对象 kind 缺失：" + x.id);
    if (!Number.isInteger(x.count) || x.count < 1) fail(errors, "对象 count 必须为正整数：" + x.id);
    if (!["fixed","movable","unknown"].includes(x.mobility)) fail(errors, "对象 mobility 非法：" + x.id);
    if (!["confirmed","provisional","unknown"].includes(x.status)) fail(errors, "对象 status 非法：" + x.id);
    if (!("position" in x) || !("orientation" in x)) fail(errors, "对象必须显式声明 position/orientation，未知时填 null：" + x.id);
    if (x.position !== null && isObj(x.position) && data.coordinate_system.units === "normalized_0_to_1") {
      for (const axis of ["x","y","z"]) if (axis in x.position && (!finite(x.position[axis]) || x.position[axis] < 0 || x.position[axis] > 1)) fail(errors, "归一化坐标超出 0..1：" + x.id + "." + axis);
    }
  });

  if (Array.isArray(data.dynamic_state) && data.dynamic_state.length > 0) warnings.push("dynamic_state 是旧版兼容字段；逐镜动态状态请迁移至 SCG，不得作为第二权威事实源。");
  if (Array.isArray(data.dynamic_state)) data.dynamic_state.forEach((x,i) => {
    if (!isObj(x)) return fail(errors, "dynamic_state[" + i + "] 必须为对象");
    if (typeof x.entity_id !== "string" || !x.entity_id.trim()) fail(errors, "动态状态缺少 entity_id");
    if (!isObj(x.state)) fail(errors, "动态状态 state 必须为对象：" + x.entity_id);
    if (typeof x.as_of !== "string" || !x.as_of.trim()) fail(errors, "动态状态缺少 as_of：" + x.entity_id);
  });

  if (Array.isArray(data.camera_views)) data.camera_views.forEach((x,i) => {
    if (!isObj(x)) return fail(errors, "camera_views[" + i + "] 必须为对象");
    if (typeof x.view_id !== "string" || !x.view_id.trim()) fail(errors, "camera view 缺少 view_id");
    if (!isObj(x.camera_position) || !isObj(x.look_at)) fail(errors, "camera view 必须有 camera_position/look_at：" + x.view_id);
    if (!["perspective","orthographic","unknown"].includes(x.projection)) fail(errors, "camera projection 非法：" + x.view_id);
    if (x.output_contract !== "one_image_one_camera") fail(errors, "每个视角必须声明 one_image_one_camera：" + x.view_id);
  });

  const objectIds = new Set((data.objects || []).map(x => x && x.id).filter(Boolean));
  for (const x of data.objects || []) {
    if (x && x.paired_with && !objectIds.has(x.paired_with)) fail(errors, "paired_with 指向不存在对象：" + x.id + " -> " + x.paired_with);
  }

  // 占地碰撞：只有明确提供 footprint 时才进行几何判断；未知尺寸绝不猜测。
  const placed = (data.objects || []).filter(x => x && isObj(x.position) && isObj(x.footprint) &&
    finite(x.footprint.width) && finite(x.footprint.depth) &&
    finite(x.position.x) && finite(x.position.y));
  const rectOf = x => ({
    minX: x.position.x - x.footprint.width / 2,
    maxX: x.position.x + x.footprint.width / 2,
    minY: x.position.y - x.footprint.depth / 2,
    maxY: x.position.y + x.footprint.depth / 2
  });
  const overlaps = (a,b) => a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
  if (Array.isArray(data.objects)) data.objects.forEach(x => {
    if (x && x.clearance_required && (!isObj(x.footprint) ||
      !finite(x.footprint.width) || !finite(x.footprint.depth))) {
      warnings.push("占地尺寸未知，无法验证碰撞/通道净空：" + x.id);
    }
  });
  for (let i=0;i<placed.length;i++) for (let j=i+1;j<placed.length;j++) {
    const a=placed[i], b=placed[j];
    if (a.paired_with === b.id || b.paired_with === a.id) continue;
    if (overlaps(rectOf(a),rectOf(b))) fail(errors,"物体占地发生重叠："+a.id+" 与 "+b.id);
  }
  if (Array.isArray(data.clearance_zones)) {
    for (const zone of data.clearance_zones) {
      if (!isObj(zone) || !isObj(zone.bounds)) { fail(errors,"通行区域定义无效"); continue; }
      const b=zone.bounds;
      if (![b.x_min,b.x_max,b.y_min,b.y_max].every(finite) ||
          b.x_min>=b.x_max || b.y_min>=b.y_max) {
        fail(errors,"通行区域边界无效："+zone.id); continue;
      }
      for (const obj of placed) {
        if (overlaps(rectOf(obj),{minX:b.x_min,maxX:b.x_max,minY:b.y_min,maxY:b.y_max})) {
          fail(errors,"物体占地侵入通行区域："+obj.id+" -> "+zone.id);
        }
      }
    }
  }

  if (data.coordinate_system && data.coordinate_system.units === "normalized_0_to_1" &&
      data.source_of_truth && data.source_of_truth.source_type !== "measured_plan") {
    warnings.push("坐标为归一化相对坐标，不代表真实米制尺寸；不得宣称通过建筑尺寸/规范净空验收。");
  }
  if ((data.unknowns || []).length === 0) warnings.push("unknowns 为空；请确认是否错误地把未知尺寸/门扇方向等写成已知事实。");
  if (data.status === "locked" && (data.unknowns || []).length > 0) warnings.push("场景标记为 locked，但仍存在未知项；请确认锁定范围仅覆盖已确认事实。");

  const report = { file: absolute, scene_id: data.scene_id || null, status: errors.length ? "FAILED" : "PASSED_WITH_WARNINGS", error_count: errors.length, warning_count: warnings.length, errors, warnings };
  console.log(JSON.stringify(report, null, 2));
  process.exit(errors.length ? 1 : 0);
}
main();
