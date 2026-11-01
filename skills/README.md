# 技能目录

本仓库的 Skills 统一遵循 [SKILL_UPDATE_PROTOCOL.md](./SKILL_UPDATE_PROTOCOL.md)。

**版本维护顺序：先修订和验收权威指令 → 冻结源文件 SHA → 更新对应 Skill 与 references → 检查一致性 → 验收后发布。**

## 知识体系与路由

跨领域分类、依赖关系、共享事实合同和统一质量门禁以 [AIGC知识结构总图与跨技能调用规范](../docs/知识体系/AIGC知识结构总图与跨技能调用规范-V1.md) 为准。本目录只维护专业技能，不复制总索引中的跨域规则。

## 场景真实性专项

- [scene-realism-director-cn](./scene-realism-director-cn/)：场景图真实性控制、建筑拓扑、功能布局、透视尺度、接触遮挡、光照/色彩/曝光、物体级形状纹理、局部编辑物理副作用、参考图保真、全景检查与独立质检；包含 8 场景空间基准和 5 项光色物理专项回归。

## 专业漫画制作专项
- 第二批外部工具与读者测试：见 [第二批研究](../docs/Deepresearch/2026-11-02_漫画专业工具第二批研究与工作流验证.md) 和 [读者测试/页面质检清单](./comic-production-director-cn/references/读者测试与页面质检清单-V1.md)。

- [comic-production-director-cn](./comic-production-director-cn/) V1.2.0：独立漫画生产总控，覆盖漫画脚本、页面节奏、分格、角色/场景连续性、逐格返工、源画格保真修复、独立排字、平台规则和网漫/分页出版。
- [漫画专业制作与出版总规范](../docs/漫画专业制作与出版总规范-V1.md)：漫画生产权威规范。
- [外部专业漫画项目研究](../docs/Deepresearch/2026-11-02_专业漫画制作外部项目与技能研究.md)：OpenManga、agent-comic-kit、manga-text-removal、Comic Pipeline、Manga Editor Desu、Sloom Studio 等外部来源审查与许可证记录。
- [第二批上色/翻译/排字研究](../docs/Deepresearch/2026-11-02_漫画上色翻译与排字工具第二批.md)：Comtexia、MangaColorAI、Speech Bubble Editor、Free Comic Panel Maker 等工具的授权和适用性审查。
- [MOONKEEP 第一话实物基准](../docs/Deepresearch/2026-11-02_MOONKEEP第一话无文字修复与排字工具实物基准测试.md)：源画格/重生成图区分、气泡遮罩、OCR 预检和工具运行限制。
- [漫画平台规格与 AI 商业化规则](../docs/Deepresearch/2026-11-02_欧美漫画平台规格与AI商业化规则研究.md)：Tapas、WEBTOON、GlobalComix、KDP 的官方规格、AI 披露、变现门槛与提现规则。
- [平台导出配置登记表](./comic-production-director-cn/references/平台导出配置登记表-V1.json)：机器可读的平台导出参数、AI 披露和商业化状态。
- [专业欧美漫画排字与页面阅读规则](../docs/专业欧美漫画排字与页面阅读规则-V1.md)：对白阅读顺序、气泡尾巴、字数密度、字体、SFX 和移动端检查。

## 分镜专项

- [storyboard-director-cn](./storyboard-director-cn/)：分镜导演与独立自检技能，保留原有版本和程序校验资产。

## 漫剧专项

- [manju-director-cn](./manju-director-cn/)：AI 漫剧专用，剧本转分镜、独立自检、自动修复、重新输出完整修订终稿及人物/场景/道具资产规则。

## 跨专业导演与制作能力

- [director-previs-cn](./director-previs-cn/)：导演意图、共享事实底稿、专业技能路由、跨域冲突消解和场面预演；不替代下游专业技能。
- [camera-motion-director-cn](./camera-motion-director-cn/)：摄影机运动、图生视频源画面可行性、运镜执行单、模型适配与审片。
- [fight-impact-vfx-cn](./fight-impact-vfx-cn/)：打斗动作因果、受击反馈、打击节奏、命中特效、环境反馈、声画同步与特效审片。

**说明：** 错误创建的跨领域 `ai-production-director-cn` 已撤回；不得在漫剧 Skill 中混入小游戏或通用软件工程规则。场景真实性是独立技能，与人物站位/运镜技能协作，不替代它们。

已安装在学员设备上的 Skills 属于快照；仓库更新不会自动替换本地技能。
