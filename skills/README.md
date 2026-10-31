# 技能目录

本仓库的 Skills 统一遵循 [SKILL_UPDATE_PROTOCOL.md](./SKILL_UPDATE_PROTOCOL.md)。

**版本维护顺序：先修订和验收权威指令 → 冻结源文件 SHA → 更新对应 Skill 与 references → 检查一致性 → 验收后发布。**

## 漫剧专项

- [manju-director-cn](./manju-director-cn/)：AI 漫剧专用，剧本转分镜、独立自检、自动修复、重新输出完整修订终稿及人物/场景/道具资产规则。
- [storyboard-director-cn](./storyboard-director-cn/)：分镜导演与独立自检技能，保留原有版本和程序校验资产。
- [scene-realism-director-cn](./scene-realism-director-cn/)：AIGC 场景真实性导演与独立质检，覆盖建筑拓扑、生活常识、透视尺度、物理接触、光照材质、参考图保真、全景接缝及人工回归案例。

**说明：** 错误创建的跨领域 `ai-production-director-cn` 已撤回；不得在漫剧 Skill 中混入小游戏或通用软件工程规则。场景真实性是独立技能，与人物站位/运镜技能协作，不替代它们。

已安装在学员设备上的 Skills 属于快照；仓库更新不会自动替换本地技能。
