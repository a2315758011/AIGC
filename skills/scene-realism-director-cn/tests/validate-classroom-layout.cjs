#!/usr/bin/env node
"use strict";

// 用户课堂专用布局校验：4列×6排，24桌/24椅。
// 只验证归一化逻辑布局，不把它解释为米制尺寸或真实净空。
const fs = require("node:fs");
const path = require("node:path");
const file = process.argv[2];
if (!file) {
  console.error("用法：node validate-classroom-layout.cjs <场景JSON文件路径>");
  process.exit(2);
}
const data = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
const errors = [];
const check = (ok, message) => { if (!ok) errors.push(message); };
const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps;
const desks = data.objects.filter(x => x.kind === "student_desk");
const chairs = data.objects.filter(x => x.kind === "student_chair");
const uniq = xs => [...new Set(xs.map(x => Number(x).toFixed(6)))].sort();
const cols = uniq(desks.map(x => x.position?.x));
const rows = uniq(desks.map(x => x.position?.y));
check(data.scene_id === "CLASSROOM-CN-4X6-001", "scene_id 必须为 CLASSROOM-CN-4X6-001");
check(data.coordinate_system?.units === "normalized_0_to_1", "坐标单位必须明确为归一化坐标");
check(desks.length === 24, "必须恰好有24张学生桌");
check(chairs.length === 24, "必须恰好有24把学生椅");
check(cols.length === 4, "桌子必须分布在恰好4列");
check(rows.length === 6, "桌子必须分布在恰好6排");
const cellKeys = desks.map(x => `${Number(x.position.x).toFixed(6)}|${Number(x.position.y).toFixed(6)}`);
check(new Set(cellKeys).size === 24, "每个行列单元格必须恰好一张桌子");
const chairById = new Map(chairs.map(x => [x.id, x]));
for (const d of desks) {
  const c = chairById.get(d.paired_with);
  check(!!c, `桌子 ${d.id} 缺少对应椅子`);
  if (c) {
    check(c.paired_with === d.id, `桌椅配对不对称：${d.id}`);
    check(near(c.position.x, d.position.x), `桌椅不在同一列轴线：${d.id}`);
    check(c.position.y > d.position.y, `椅子未位于桌子后侧：${d.id}`);
  }
}
const factIds = new Set(data.fixed_facts.map(x => x.id));
for (const id of ["WALL-FRONT","WALL-LEFT","WALL-RIGHT","DOOR-FRONT-RIGHT","BLACKBOARD-01","PODIUM-01","PASSAGE-1-2","PASSAGE-CENTER","PASSAGE-3-4"]) {
  check(factIds.has(id), `缺少固定空间事实：${id}`);
}
const zones = new Map(data.clearance_zones.map(x => [x.id, x.bounds]));
const facts = new Map(data.fixed_facts.map(x => [x.id, x]));
const door = facts.get("DOOR-FRONT-RIGHT");
const board = facts.get("BLACKBOARD-01");
const podium = facts.get("PODIUM-01");
const leftWall = facts.get("WALL-LEFT");
const rightWall = facts.get("WALL-RIGHT");
check(door?.location?.wall === "right" && near(door.location.position_y, 0.14), "教室门必须位于右侧前段");
check(board?.location?.wall === "front" && near(board.location.x, 0.5) && near(board.location.y, 0), "黑板必须位于前墙中央");
check(near(podium?.location?.x, 0.5) && near(podium?.location?.y, 0.12), "讲台必须位于前墙中央前方");
check(leftWall?.location?.wall === "left" && rightWall?.location?.wall === "right", "左右侧墙事实必须存在");
const left = zones.get("CLEARANCE-1-2");
const center = zones.get("CLEARANCE-CENTER");
const right = zones.get("CLEARANCE-3-4");
check(!!left && !!center && !!right, "必须存在左右相邻通道与中央通道");
if (left && center && right) {
  const widths = [left.x_max-left.x_min, center.x_max-center.x_min, right.x_max-right.x_min];
  check(widths[1] > widths[0] && widths[1] > widths[2], "中央通道逻辑宽度必须大于两侧列间通道");
  check(near(center.x_min, 0.46) && near(center.x_max, 0.54), "中央通道逻辑边界必须为0.46..0.54");
}
const report = {
  scene_id: data.scene_id,
  status: errors.length ? "FAILED" : "PASSED",
  error_count: errors.length,
  errors,
  verified: {
    desk_count: desks.length,
    chair_count: chairs.length,
    columns: cols.length,
    rows: rows.length,
    unique_cells: new Set(cellKeys).size,
    paired_chairs: desks.filter(d => chairById.has(d.paired_with)).length,
    central_aisle_wider: centralAisleWider
  },
  boundary: "仅验证归一化网格、对象关系和通道逻辑区间；真实尺寸、桌椅占地、碰撞与通道净宽仍未验证。"
};
console.log(JSON.stringify(report, null, 2));
process.exit(errors.length ? 1 : 0);
