#!/usr/bin/env node
'use strict';
// 分镜事件时长校验器 V1：镜头时码 + 人物/道具事件区间的可执行审计。
// 输入是人工/AI从已确认分镜提取的结构化事件；兼容主线 SCG 的 time_* 字段与旧版 start_ms/end_ms，不自动解析普通中文稿。
const fs=require('fs');
function normalizeData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.episodes)) return raw;
  return {
    ...raw,
    episodes: raw.episodes.map(ep => {
      if (!ep || typeof ep !== 'object' || Array.isArray(ep)) return ep;
      const rawShots = ep.shots;
      const shots = Array.isArray(rawShots) ? rawShots.map(s => {
        if (!s || typeof s !== 'object' || Array.isArray(s)) return s;
        return {
          ...s,
          id: s.id ?? s.shot_id,
          start_ms: s.time_start_ms ?? s.start_ms,
          end_ms: s.time_end_ms ?? s.end_ms,
          events_visible: s.events_visible ?? s.visible_event_ids ?? s.event_ids_visible
        };
      }) : rawShots;
      const rawEvents = ep.events;
      const events = Array.isArray(rawEvents) ? rawEvents.map(e => {
        if (!e || typeof e !== 'object' || Array.isArray(e)) return e;
        return {
          ...e,
          id: e.id ?? e.event_id,
          start_ms: e.event_start_ms ?? e.time_start_ms ?? e.start_ms,
          end_ms: e.event_end_ms ?? e.time_end_ms ?? e.end_ms,
          actor_ids: e.actor_ids ?? e.character_ids ?? (e.actor_id ? [e.actor_id] : []),
          exclusive_resources: e.exclusive_resources ?? e.exclusive_resource_ids,
          requires: e.requires ?? e.depends_on
        };
      }) : rawEvents;
      return {
        ...ep,
        id: ep.id ?? ep.episode_id,
        start_ms: ep.time_start_ms ?? ep.start_ms,
        end_ms: ep.time_end_ms ?? ep.end_ms,
        shots,
        events
      };
    })
  };
}

function validate(rawData) {
  const data = normalizeData(rawData);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {ok:false, errors:[{code:'T00',at:'root',detail:'输入必须为 JSON 对象'}], warnings:[], episodes_checked:0};
  }
  const errors=[], warnings=[];
  const fail=(code,at,detail)=>errors.push({code,at,detail});
  const warn=(code,at,detail)=>warnings.push({code,at,detail});
  const num=(v)=>Number.isFinite(v);
  const episodes=Array.isArray(data.episodes)?data.episodes:[];
  if (!Array.isArray(data.episodes)||episodes.length===0) fail('T00','root','缺 episodes[] 或 episodes 不是非空数组');
  for (const ep of episodes) {
    if (!ep || typeof ep !== 'object' || Array.isArray(ep)) { fail('T00','root','episode 必须是对象'); continue; }
    const id=ep.id||'?';const start=ep.start_ms,end=ep.end_ms;
    if (!num(start)||!num(end)||end<=start){fail('T01',id,'集时间区间非法');continue;}
    const shots=ep.shots||[], events=ep.events||[];
    if (!Array.isArray(shots)||!Array.isArray(events)){fail('T00',id,'shots/events 应为数组');continue;}
    const seenShot=new Set(),seenEvent=new Set();
    let cursor=start;
    let timelineReliable=true;
    for (const s of shots) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) { fail('T00', id, 'shot 必须是对象'); timelineReliable=false; continue; }
      const tag=id+'/'+s.id;
      if(seenShot.has(s.id))fail('T02',tag,'重复镜号');seenShot.add(s.id);
      if(!num(s.start_ms)||!num(s.end_ms)||s.end_ms<=s.start_ms) {fail('T01',tag,'镜头时间无效');timelineReliable=false;continue;}
      if(s.start_ms!==cursor)fail('T03',tag,'镜头有空档/重叠，预计起点 '+cursor+' 实际 '+s.start_ms);
      if(s.start_ms<start||s.end_ms>end)fail('T04',tag,'镜头超出集范围');
      cursor=s.end_ms;
    }
    if(timelineReliable && cursor!==end)fail('T03',id,'末镜时间 '+cursor+' 不等于集结束 '+end);
    const byId=new Map();
    for(const e of events){
      if (!e || typeof e !== 'object' || Array.isArray(e)) { fail('T00', id, 'event 必须是对象'); continue; }
      const tag=id+'/'+e.id;
      if(!e.id||seenEvent.has(e.id))fail('T02',tag,'事件ID缺失/重复');
      seenEvent.add(e.id);byId.set(e.id,e);
      if(!num(e.start_ms)||!num(e.end_ms)||e.end_ms<=e.start_ms){fail('T01',tag,'事件区间非法');continue;}
      if(e.start_ms<start||e.end_ms>end)fail('T04',tag,'事件超出集范围');
      if(num(e.min_duration_ms)&&e.end_ms-e.start_ms<e.min_duration_ms){
        if(e.duration_status==='measured'||e.duration_status==='hard_constraint')fail('T05',tag,'事件'+(e.end_ms-e.start_ms)+'ms 小于已测量/硬约束最小时长 '+e.min_duration_ms+'ms');
        else warn('W04',tag,'事件短于估算阈值；转 NEEDS_REVIEW，不把估算冒充硬性实测失败');
      }
      if(e.duration_status!=='measured'&&e.duration_status!=='hard_constraint'&&e.min_duration_ms!==undefined)warn('W01',tag,'最小时长未标 measured；此数值只能用于候选预估，不能视为实测');
      if(e.requires_visible===true){
        const covers=shots.some(s=>s.events_visible?.includes(e.id)&&s.start_ms<e.end_ms&&s.end_ms>e.start_ms);
        if(!covers)fail('T06',tag,'关键事件未有可观察镜头证据');
      }
      if(num(e.shown_count)&&num(e.min_per_person_ms)&&e.presentation==='sequential_visible'){
        const required=e.shown_count*e.min_per_person_ms;
        if(e.end_ms-e.start_ms<required){
          if(e.duration_status==='measured'||e.duration_status==='hard_constraint')fail('T07',tag,'逐人可见动作需要至少 '+required+'ms；当前 '+(e.end_ms-e.start_ms)+'ms');
          else warn('W05',tag,'逐人可见展示负载超过估算窗口；转 NEEDS_REVIEW，需实测/导演改为蒙太奇或群像锚点');
        }
      }
      if(e.presentation==='montage'&&e.shown_count>1 && !e.montage_explanation)warn('W02',tag,'蒙太奇需说明其是省略展示，不代表逐人完整拍摄');
    }
    for(const e of events){
      if (!e || typeof e !== 'object' || Array.isArray(e)) continue;
      for(const dep of e.requires||[]){
        const prior=byId.get(dep);
        if(!prior){fail('T08',id+'/'+e.id,'缺依赖事件 '+dep);continue;}
        if(num(prior.end_ms)&&num(e.start_ms)&&prior.end_ms>e.start_ms)fail('T09',id+'/'+e.id,'前置事件 '+dep+' 未完成；结束 '+prior.end_ms+'，本事件开始 '+e.start_ms);
      }
    }
    const overlaps=(a,b)=>a.start_ms<b.end_ms&&b.start_ms<a.end_ms;
    for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length;j++){
      const a=events[i],b=events[j];
      if (!a || !b || typeof a !== 'object' || typeof b !== 'object') continue;
      if(!num(a.start_ms)||!num(a.end_ms)||!num(b.start_ms)||!num(b.end_ms)||!overlaps(a,b))continue;
      const common=(a.actor_ids||[]).filter(x=>(b.actor_ids||[]).includes(x));
      if(common.length && (a.exclusive===true||b.exclusive===true) &&
         !(a.compatible_with||[]).includes(b.id) && !(b.compatible_with||[]).includes(a.id)){
        fail('T10',id+'/'+a.id+'+'+b.id,'人物 '+common.join(',')+' 的排他事件重叠');
      }
      const shared=(a.exclusive_resources||[]).filter(x=>(b.exclusive_resources||[]).includes(x));
      if(shared.length)fail('T11',id+'/'+a.id+'+'+b.id,'独占道具/机构 '+shared.join(',')+' 同时被占用');
    }
    for(const e of events.filter(e=>e && typeof e === 'object' && e.continuous_hold===true)){
      if(!(e.exclusive===true||e.hold_can_coexist===true))warn('W03',id+'/'+e.id,'持续操作应声明是否排他，不能默认可同时战斗');
      if(e.engagement_event_id){
        const latch=byId.get(e.engagement_event_id);
        if(!latch)fail('T08',id+'/'+e.id,'未找到机关接合事件');
        else if(num(latch.end_ms)&&latch.end_ms>e.start_ms)fail('T12',id+'/'+e.id,'持续压闸开始早于接合完成');
      }
    }
  }
  return {ok:errors.length===0,errors,warnings,episodes_checked:episodes.length};
}
if(require.main===module){
  const file=process.argv[2];if(!file){console.error('用法: node 分镜事件时长校验器-V1.js <事件账本.json>');process.exit(2);}
  try {const x=JSON.parse(fs.readFileSync(file,'utf8'));const tests=Array.isArray(x.cases)?x.cases:[{id:'input',data:x}];let mismatch=0;
    for(const t of tests){const got=validate(t.data||t),codes=[...new Set(got.errors.map(e=>e.code))].sort();
      const expected=(t.expected_errors||[]).slice().sort();
      const pass=!('expected_errors' in t)||JSON.stringify(codes)===JSON.stringify(expected);
      if(!pass || (!('expected_errors' in t) && !got.ok)) mismatch++;
      console.log(JSON.stringify({case:t.id||'input',pass,ok:got.ok,codes,expected:('expected_errors' in t)?expected:undefined,errors:got.errors,warnings:got.warnings},null,2));
    }process.exit(mismatch?1:0);
  }catch(e){console.error('校验异常: '+e.message);process.exit(2);}
}
module.exports={validate};