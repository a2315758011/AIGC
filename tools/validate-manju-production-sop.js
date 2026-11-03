#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
function read(rel){return fs.readFileSync(path.join(root,rel),'utf8').replace(/^\uFEFF/,'');}
function gitBlobSha(text){const b=Buffer.from(text,'utf8');return crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');}
let passed=0,failed=0;
function check(name,ok,detail=''){if(ok){passed++;console.log('PASS '+name);}else{failed++;console.error('FAIL '+name+(detail?': '+detail:''));}}
const sop=read('docs/知识体系/漫剧资产与分镜生产SOP-空间先行-V1.md');
const route=read('docs/知识体系/按需能力调用与任务范围路由-V1.md');
const execution=read('docs/知识体系/剧本预演与分镜创作调用清单-V1.md');
const map=read('docs/知识体系/AIGC知识结构总图与跨技能调用规范-V1.md');
const agents=read('AGENTS.md'),rootReadme=read('README.md');
const manjuSkill=read('skills/manju-director-cn/SKILL.md'),manjuReadme=read('skills/manju-director-cn/README.md');
const manjuLock=JSON.parse(read('skills/manju-director-cn/SOURCE_LOCK.json'));
const ruleIndex=JSON.parse(read('分镜规则清单.json')),offline=read('学员分镜双规则完整版.md');
const writing=read('剧本转分镜指令'),selfCheck=read('剧本转分镜自检指令');
const storyboardReadme=read('skills/storyboard-director-cn/README.md');
const order=['剧本事实锁定','资产需求总账','场景空间基线先行','角色与关键道具母版制作','导演场面调度','正式分镜编写','独立质检'];
const positions=order.map(x=>sop.indexOf(x));
check('SOP includes every production gate',positions.every(x=>x>=0));
check('scene baseline precedes formal storyboard',positions[2]>=0&&positions[2]<positions[5]);
check('SOP distinguishes asset inventory from asset generation',sop.includes('先盘点，不先批量生图')&&sop.includes('空间基线锁定后'));
check('SOP requires SPACE_BASELINE_LOCKED',sop.includes('SPACE_BASELINE_LOCKED'));
check('SOP preserves partial-scope routing',sop.includes('只做一个角色/道具资产')&&sop.includes('只写/审查正式分镜'));
check('SOP assigns complete asset+storyboard to manju',sop.includes('manju-director-cn')&&sop.includes('完整人物/场景/道具资产 + 正式分镜'));
check('director-previs is not a duplicate storyboard writer',sop.includes('不另写一份竞争性分镜稿'));
check('root AGENTS enforces SOP',agents.includes('漫剧资产与分镜生产SOP-空间先行-V1.md')&&agents.includes('SPACE_BASELINE_LOCKED'));
check('manju skill loads offline SOP',manjuSkill.includes('references/漫剧资产与分镜生产SOP-空间先行-V1.md')&&manjuSkill.includes('SPACE_BASELINE_LOCKED'));
check('root README exposes SOP',rootReadme.includes('漫剧资产与分镜生产SOP-空间先行-V1.md'));
check('scope router exposes full asset+storyboard route',route.includes('完整漫剧人物/场景/道具资产 + 正式分镜')&&route.includes('manju-director-cn'));
check('execution card uses space-first order',execution.includes('场景空间基线（空间先行）')&&execution.indexOf('SPACE_BASELINE_LOCKED')<execution.indexOf('## 阶段五：正式分镜'));
check('knowledge map distinguishes knowledge layers from production order',map.includes('知识架构图表达能力分类，不等于每次生产的执行先后'));
check('manju package version and source version are current',manjuLock.version==='1.1.2'&&manjuLock.source_version==='V2.10.6');
check('storyboard rule index is V2.10.6',ruleIndex.source_version==='V2.10.6'&&ruleIndex.rules.every(x=>x.version==='V2.10.6'));
check('storyboard rule index points to current source blobs',ruleIndex.rules.find(x=>x.path==='剧本转分镜指令')?.git_blob_sha===gitBlobSha(writing)&&ruleIndex.rules.find(x=>x.path==='剧本转分镜自检指令')?.git_blob_sha===gitBlobSha(selfCheck));
check('offline bundle header and source blobs are current',offline.includes('2026-11-03 V2.10.6')&&offline.includes(gitBlobSha(writing))&&offline.includes(gitBlobSha(selfCheck)));
check('offline bundle contains both full current rules',offline.includes(writing)&&offline.includes(selfCheck));
for(const item of manjuLock.files||[]){const src=read(item.source_path),pkg=read(path.posix.join('skills/manju-director-cn',item.package_path));check('manju source SHA: '+item.package_path,gitBlobSha(src)===item.git_blob_sha);check('manju package SHA: '+item.package_path,gitBlobSha(pkg)===item.git_blob_sha);check('manju source character count: '+item.package_path,src.length===item.characters);check('manju package character count: '+item.package_path,pkg.length===item.characters);}
check('storyboard README documents current rule version',storyboardReadme.includes('编写规则：V2.10.6')&&storyboardReadme.includes('独立自检规则：V2.10.6'));
check('manju README documents space-first production',manjuReadme.includes('V1.1.2')&&manjuReadme.includes('场景空间基线'));
console.log('结果：'+passed+' PASS / '+failed+' FAIL');if(failed)process.exitCode=1;
