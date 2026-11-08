# AI 漫剧题材模板（21 类）

本目录收录第三方开源项目 `zhanghao123vip/ai-manju-skills` 的 21 个题材化 AI 漫剧创作模板。它们是可直接读取/粘贴使用的题材工作流，不是本仓库影视分镜、专业漫画出版 Skill 的替代品。

## 题材索引

| 分类 | 题材 | 技能文件 |
|---|---|---|
| 幻想 | 玄幻修仙 | [xuanhuan-manju](./xuanhuan-manju/SKILL.md) |
| 幻想 | 西幻魔法 | [xihuan-manju](./xihuan-manju/SKILL.md) |
| 幻想 | 星际机甲 | [xingji-manju](./xingji-manju/SKILL.md) |
| 幻想 | 系统无限流 | [xitong-manju](./xitong-manju/SKILL.md) |
| 幻想 | 末日废土 | [moshi-manju](./moshi-manju/SKILL.md) |
| 古代 | 穿越重生 | [chuanyue-manju](./chuanyue-manju/SKILL.md) |
| 古代 | 宫斗 | [gongdou-manju](./gongdou-manju/SKILL.md) |
| 古代 | 宅斗 | [zhaidou-manju](./zhaidou-manju/SKILL.md) |
| 古代 | 权谋朝堂 | [quanmou-manju](./quanmou-manju/SKILL.md) |
| 古代 | 武侠江湖 | [wuxia-manju](./wuxia-manju/SKILL.md) |
| 古代 | 种田经商 | [zhongtian-manju](./zhongtian-manju/SKILL.md) |
| 现代 | 都市逆袭 | [dushi-manju](./dushi-manju/SKILL.md) |
| 现代 | 总裁甜宠 | [tianchong-manju](./tianchong-manju/SKILL.md) |
| 现代 | 家庭伦理 | [jiating-manju](./jiating-manju/SKILL.md) |
| 现代 | 重生复仇 | [chongsheng-manju](./chongsheng-manju/SKILL.md) |
| 现代 | 职场商战 | [shangzhan-manju](./shangzhan-manju/SKILL.md) |
| 现代 | 年代文 | [niandai-manju](./niandai-manju/SKILL.md) |
| 现代 | 娱乐圈 | [yule-manju](./yule-manju/SKILL.md) |
| 现代 | 大学校园青春 | [xiaoyuan-manju](./xiaoyuan-manju/SKILL.md) |
| 类型片 | 悬疑刑侦 | [xuanyi-manju](./xuanyi-manju/SKILL.md) |
| 类型片 | 民俗怪谈 | [minsu-manju](./minsu-manju/SKILL.md) |

## 使用方式

- DeepSeek 等聊天工具：打开单个题材的 `SKILL.md`，复制全文到新对话，再提供故事点子。一个项目/剧集建议使用独立对话，避免题材设定串线。
- Claude Code 等支持 Skills 的客户端：按客户端规范导入所需题材文件夹。
- 不需要安装依赖。各工具的参考图占位符、上传方式和视频模型语法可能不同，使用前需按目标工具调整。

## 与本仓库其他技能的边界

- 本目录：题材化企划、资产提示词、分集剧本、导演手册和发布包模板。
- `manju-director-cn`：漫剧资产与分镜生产主流程。
- `storyboard-director-cn`：正式影视/漫剧分镜、空间调度与连续性。
- `comic-production-director-cn`：漫画页面、分格、对白排字、修复与出版。

题材模板可作为创意/叙事输入；进入正式分镜或漫画页面生产时，按需转交对应专业 Skill，不复制其规则。

## 来源与验证边界

- 上游：https://github.com/zhanghao123vip/ai-manju-skills
- 上游许可证：MIT，版权声明保留在本目录 `LICENSE`。
- 21 个 `SKILL.md` 按原文导入；`SOURCE_LOCK.json` 记录各文件 Git Blob SHA。
- 上游 README 声明：WorkBuddy 已实测；此前玄幻修仙版经过实际使用测试；部分题材做过安装校验或阶段试跑；其余题材未逐一实测。该声明是上游自述，不代表本仓库已完成独立实测。
- 本仓库当前只完成文件迁移与来源完整性核验；尚未完成 DeepSeek/Claude Code/WorkBuddy 的逐题材端到端验证。
