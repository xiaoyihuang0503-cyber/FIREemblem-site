const t=window.FE_t||String;
const CHARACTERS=window.FE_CHARACTERS||[];const CLASSES=window.FE_CLASSES||[];const PRESETS=window.FE_PRESETS||[];
const rankOrder=['E','E+','D','D+','C','C+','B','B+','A','A+','S'];
const skills=[['swords','剑术'],['spears','枪术'],['axes','斧术'],['bows','弓术'],['gauntlets','格斗'],['white_magic','白魔法'],['black_magic','黑魔法'],['riding','骑术'],['flying','飞行'],['armor','重装']];
const statNames={hp:'生命',str:'力量',mag:'魔力',spd:'速度',dex:'技巧',def:'防御',res:'魔防',lck:'幸运',cha:'魅力'};
const tierZh={base:'基础',beginner:'初级',specialty:'中级',advanced:'上级',master:'最上级',divine:'神将'};
const tierOrder=['base','beginner','specialty','advanced','master','divine'];
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
function initials(c){return (c.name_zh||c.name_en||'?').slice(0,2)}
function characterAvatar(c,extra=''){
  const portrait=c?.portrait || window.FE_PORTRAITS?.[c?.id];
  return `<div class="avatar ${extra}">${portrait ? `<img class="avatar-image" src="${portrait.path}" alt="" width="${portrait.width}" height="${portrait.height}" loading="lazy" decoding="async"><span hidden>${initials(c)}</span>` : initials(c)}</div>`;
}
window.renderCharacterAvatar=characterAvatar;
document.addEventListener('error',e=>{if(e.target.matches?.('.avatar-image')){e.target.hidden=true;const fallback=e.target.nextElementSibling;if(fallback)fallback.hidden=false}},true);
function getChar(id){return CHARACTERS.find(c=>c.id===id)||CHARACTERS.find(c=>c.name_en===id)}
function getClass(idOrName){return CLASSES.find(c=>c.id===idOrName||c.name_en===idOrName)}
let drawerScrollY=0, drawerPreviousFocus=null, drawerInertElements=[];
function closeCharacterDetail(restoreFocus=true){
  const drawer=$('#characterDetail');if(!drawer?.classList.contains('open'))return;
  drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');drawer.inert=true;
  $('.drawer-backdrop').hidden=true;document.body.classList.remove('drawer-open');document.body.style.top='';
  drawerInertElements.forEach(el=>el.inert=false);drawerInertElements=[];
  window.scrollTo({top:drawerScrollY,behavior:'instant'});
  if(restoreFocus&&drawerPreviousFocus?.isConnected)drawerPreviousFocus.focus({preventScroll:true});
}
window.closeCharacterDetail=closeCharacterDetail;
function revealCharacterDetail(){
  drawerScrollY=window.scrollY;drawerPreviousFocus=document.activeElement;
  const drawer=$('#characterDetail');drawer.inert=false;drawer.setAttribute('aria-hidden','false');drawer.scrollTop=0;
  drawerInertElements=$$('.topbar,.footer,.view:not(#characters),#characters > :not(#characterDetail)').filter(el=>!el.inert);
  drawerInertElements.forEach(el=>el.inert=true);
  document.body.style.top=`-${drawerScrollY}px`;document.body.classList.add('drawer-open');
  $('.drawer-backdrop').hidden=false;drawer.classList.add('open');$('.drawer-close').focus({preventScroll:true});
}
$('.drawer-backdrop').onclick=()=>closeCharacterDetail();
document.addEventListener('keydown',event=>{
  const drawer=$('#characterDetail');
  if(drawer.classList.contains('open')){
    if(event.key==='Escape'){event.preventDefault();closeCharacterDetail();}
    if(event.key==='Tab'){
      const elements=[...drawer.querySelectorAll('button,a[href],input,select,[tabindex="0"]')];
      const first=elements[0],last=elements.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  }else if(['Enter',' '].includes(event.key)&&event.target.matches('.character-card,.compact-row,.preset-card')){
    event.preventDefault();event.target.click();
  }
});
function hashRoute(){const id=(location.hash||'#home').slice(1).split(/[/?]/)[0];return ['home','characters','planner','classes','maps','library','character','search'].includes(id)?id:'home'}
function showView(){const id=hashRoute();document.body.dataset.view=id;closeCharacterDetail(false);$$('.nav a').forEach(a=>{const active=a.hash===`#${id==='character'?'characters':id}`;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));window.scrollTo({top:0,behavior:'instant'});if(id==='characters')renderCharacters();if(id==='classes')renderClasses();}
window.addEventListener('hashchange',showView);
document.addEventListener('mousemove',e=>{const el=$('#pointerMeta');if(el)el.textContent=`[X] ${String(e.clientX).padStart(4,'0')}  [Y] ${String(e.clientY).padStart(4,'0')}`});
$('#characterCount').textContent=CHARACTERS.length;$('#classCount').textContent=CLASSES.length;
function compactRows(list,el){el.innerHTML=list.slice(0,8).map(c=>`<div class="compact-row" role="button" tabindex="0" data-id="${c.id}">${characterAvatar(c)}<div><strong>${t(c.name_zh||c.name_en)}</strong><br><small>成长总计 ${c.growth_total??'待补'}</small></div><small>规划 →</small></div>`).join('');el.querySelectorAll('.compact-row').forEach(r=>r.onclick=()=>{selectPlannerCharacter(r.dataset.id);location.hash='planner'})}
compactRows(CHARACTERS,$('#homeCharacterList'));
$('#homeSearch').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();compactRows(CHARACTERS.filter(c=>!q||`${c.name_zh||''} ${c.name_en||''} ${t(c.name_zh||c.name_en)}`.toLowerCase().includes(q)),$('#homeCharacterList'))});
$('#muPresetCards').innerHTML=PRESETS.map((p,i)=>`<article class="preset-card" role="button" tabindex="0" data-preset="${p.id}"><span class="mono">0${i+1} / ${t(p.target_class)}</span><h3>${p.name_zh}</h3><p>${p.why}</p></article>`).join('');
$$('.preset-card').forEach(card=>card.onclick=()=>{const p=PRESETS.find(x=>x.id===card.dataset.preset);selectPlannerCharacter(CHARACTERS.find(c=>c.name_en==='Mu')?.id);setTargetByName(p.target_class);location.hash='planner';setTimeout(()=>generateRoute(p.id),50)});
let charSort='default';
function renderCharacters(){let list=[...CHARACTERS];const q=($('#characterSearch')?.value||'').trim().toLowerCase();if(q)list=list.filter(c=>`${c.name_zh||''} ${c.name_en||''} ${t(c.name_zh||c.name_en)}`.toLowerCase().includes(q));if(charSort==='growth')list.sort((a,b)=>(b.growth_total||0)-(a.growth_total||0));if(charSort==='speed')list.sort((a,b)=>(b.growth?.spd||0)-(a.growth?.spd||0));if(charSort==='strength')list.sort((a,b)=>(b.growth?.str||0)-(a.growth?.str||0));$('#characterGrid').innerHTML=list.map(c=>`<article class="character-card" role="button" tabindex="0" data-id="${c.id}">${characterAvatar(c)}<h3>${t(c.name_zh||c.name_en)}</h3><p>${c.name_en}</p><div class="growth-total mono">成长总计 <strong>${c.growth_total??'—'}</strong></div></article>`).join('');$$('.character-card').forEach(el=>el.onclick=()=>openCharacter(el.dataset.id));}
$('#characterSearch').addEventListener('input',renderCharacters);$('#characterSort').addEventListener('change',e=>{charSort=e.target.value;renderCharacters()});
function openCharacter(id){location.hash='character/'+encodeURIComponent(id);}
function openLegacyCharacter(id){const c=getChar(id);if(!c)return;const g=c.growth||{};const recruitment=c.recruitment||{};const presets=PRESETS.filter(p=>p.character===c.name_en);$('#characterDetail').innerHTML=`<div class="drawer-inner"><div class="drawer-top"><span class="mono">[CHARACTER PROFILE]</span><button class="drawer-close" aria-label="关闭">×</button></div><div class="drawer-profile">${characterAvatar(c)}<div><h2 id="drawerName" class="drawer-name">${t(c.name_zh||c.name_en)}</h2><div class="drawer-en">${c.name_en}</div></div></div><div class="growth-grid">${Object.entries(statNames).map(([k,n])=>`<div class="growth-cell stat-${k}"><small>${n}</small><strong>${g[k]??'—'}${g[k]!=null?'%':''}</strong></div>`).join('')}</div><div class="drawer-block"><h4>个人技能</h4><p>${c.personal_ability?`<strong>${c.personal_ability.name}</strong><br>${c.personal_ability.description}`:'公开数据待补'}</p></div><div class="drawer-block"><h4>各路线加入 / 招募</h4><p>${Object.entries(recruitment).map(([k,v])=>`${k}: ${v}`).join('<br>')||'待补'}</p></div><div class="drawer-block"><h4>推荐成品</h4><p>${presets.length?presets.map(p=>`<button class="text-btn preset-jump" data-target="${p.target_class}">${p.name_zh}</button>`).join(' / '):'个性化成品方案待补；仍可直接选择任意目标职业生成资格导航。'}</p></div><button class="primary-btn full drawer-plan" data-id="${c.id}">用这个角色规划 →</button></div>`;window.renderCharacterSource?.(c);revealCharacterDetail();$('.drawer-close').onclick=()=>closeCharacterDetail();$('.drawer-plan').onclick=()=>{selectPlannerCharacter(c.id);closeCharacterDetail(false);location.hash='planner'};$$('.preset-jump').forEach(b=>b.onclick=()=>{selectPlannerCharacter(c.id);setTargetByName(b.dataset.target);closeCharacterDetail(false);location.hash='planner'});}
function fillSelect(el,options,valueFn,labelFn){el.innerHTML=options.map(o=>`<option value="${valueFn(o)}">${labelFn(o)}</option>`).join('')}
fillSelect($('#plannerCharacter'),CHARACTERS,c=>c.id,c=>t(c.name_zh||c.name_en));
fillSelect($('#currentClass'),CLASSES,c=>c.id,c=>`${t(c.name_en)} · ${tierZh[c.tier]||c.tier}`);
fillSelect($('#targetClass'),CLASSES.filter(c=>c.tier!=='base'),c=>c.id,c=>`${t(c.name_en)} · ${tierZh[c.tier]||c.tier}`);
function renderPlannerCharacterPreview(){const c=getChar($('#plannerCharacter').value);if(c)$('#plannerCharacterPreview').innerHTML=`${characterAvatar(c)}<div><strong>${t(c.name_zh||c.name_en)}</strong><a href="#character/${c.id}">查看人物档案 →</a></div>`}
$('#plannerCharacter').addEventListener('change',renderPlannerCharacterPreview);renderPlannerCharacterPreview();
function selectPlannerCharacter(id){$('#plannerCharacter').value=id;$('#plannerCharacter').dispatchEvent(new Event('change'))}
function setTargetByName(name){const c=CLASSES.find(x=>x.name_en.toLowerCase()===String(name).toLowerCase());if(c)$('#targetClass').value=c.id}
const rankInputs={};function renderRankInputs(){
  const root=$('#rankInputs');root.innerHTML='';
  for(const [k,n] of skills){
    const field=document.createElement('div');field.className='rank-field';
    const label=document.createElement('label');label.textContent=n;label.htmlFor=`rank-${k}`;
    const sel=document.createElement('select');sel.id=`rank-${k}`;sel.className='select-input';sel.dataset.skill=k;
    sel.innerHTML=rankOrder.map(r=>`<option>${r}</option>`).join('');sel.value='E';
    field.append(label,sel);root.append(field);rankInputs[k]=sel;
  }
}renderRankInputs();$('#resetRanks').onclick=()=>Object.values(rankInputs).forEach(s=>s.value='E');
$$('.mode-tab').forEach(b=>b.onclick=()=>{$$('.mode-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active')});
function rankIndex(r){return rankOrder.indexOf(r)>=0?rankOrder.indexOf(r):0}function missingReqs(target){const req=target.requirements||{};return Object.entries(req).map(([skill,need])=>({skill,need,have:rankInputs[skill]?.value||'E',missing:Math.max(0,rankIndex(need)-rankIndex(rankInputs[skill]?.value||'E'))}));}
function skillZh(k){return Object.fromEntries(skills)[k]||k.replaceAll('_',' ')}
function intermediateClasses(target,reqs){const useful=CLASSES.filter(c=>c.id!==target.id&&['beginner','specialty','advanced'].includes(c.tier));return useful.map(c=>{let score=0;const cr=c.requirements||{};for(const r of reqs){if(cr[r.skill])score+=2;if(cr[r.skill]&&rankIndex(cr[r.skill])<=rankIndex(r.need))score+=1}return {c,score}}).filter(x=>x.score>=3).sort((a,b)=>b.score-a.score||tierOrder.indexOf(a.c.tier)-tierOrder.indexOf(b.c.tier)).slice(0,3).map(x=>x.c)}
function currentState(){return {char:getChar($('#plannerCharacter').value),currentClass:getClass($('#currentClass').value),level:+$('#currentLevel').value||1,route:$('#currentRoute').value,part:+$('#currentPart').value,mode:$('.mode-tab.active')?.dataset.mode||'fastest',target:getClass($('#targetClass').value)}}
function presetFor(char,target){return PRESETS.find(p=>p.character===char?.name_en&&p.target_class.toLowerCase()===target?.name_en.toLowerCase())}
function generateRoute(forcePreset){const s=currentState();if(!s.char||!s.target)return;const reqs=missingReqs(s.target);const missing=reqs.filter(r=>r.missing>0);const preset=forcePreset?PRESETS.find(p=>p.id===forcePreset):presetFor(s.char,s.target);let nodes=[];nodes.push({type:'current',title:`${s.char.name_zh||s.char.name_en} · ${s.currentClass.name_en}`,body:`Lv.${s.level} / ${s.route} / Part ${s.part}。路线从你当前状态重新计算。`,reqs:[]});
if(s.mode==='fastest'){for(const r of missing)nodes.push({title:`把${skillZh(r.skill)}练到 ${r.need}`,body:`当前 ${r.have}。这是 ${s.target.name_en} 的资格要求。先补硬条件，不强制经过某个中间职业。`,reqs:[{t:`${skillZh(r.skill)} ${r.have} → ${r.need}`,ok:false}]});if(s.target.unlock&&s.target.unlock!=='automatic'&&s.target.unlock!=='story tier unlock')nodes.push({title:'完成职业解锁条件',body:s.target.unlock,reqs:[]});}
if(s.mode==='optimized'){const inter=intermediateClasses(s.target,reqs);if(inter.length)nodes.push({title:'选择一个顺路的中间职业',body:`可以优先考虑 ${inter.map(c=>c.name_en).join(' / ')}。它们和目标职业共享部分熟练度要求，中途拿精通时不至于完全绕路。`,reqs:inter.map(c=>({t:c.name_en,ok:true}))});for(const r of missing)nodes.push({title:`继续补${skillZh(r.skill)}到 ${r.need}`,body:`围绕目标定位补资格。职业成长完整表仍在核对，当前版本不输出“待 X 级会多几点属性”这类假精度。`,reqs:[{t:`TARGET ${r.need}`,ok:false}]});if(preset?.optional_detours?.length)nodes.push({title:'这个角色还有可选绕路',body:preset.optional_detours.join('；'),reqs:[]});if(s.target.unlock&&s.target.unlock!=='automatic')nodes.push({title:'完成职业解锁',body:s.target.unlock,reqs:[]});}
if(s.mode==='complete'){nodes.push({title:'路线 A：主属性 / 主职业',body:`先用一条路线把 ${s.target.name_en} 的硬资格练齐，作为主成型版本。`,reqs:[]});nodes.push({title:'路线 B：补另一组属性与精通',body:'同一角色在不同路线可以走不同职业。尽量避免四条线复制同一套培养。',reqs:[]});nodes.push({title:'路线 C：补稀缺熟练度 / 职业精通',body:preset?.optional_detours?.join('；')||'优先选择与目标角色个人技能或擅长方向相容、但主路线没拿到的职业精通。',reqs:[]});nodes.push({title:'第三部：因果合并',body:'按当前公开实测规则，各项属性取不同培养版本中的更高值，同时继承可合并的熟练度、职业、精通和战技。',reqs:[]});}
nodes.push({type:'target',title:`${s.target.name_en} 成型`,body:`${Object.entries(s.target.requirements||{}).map(([k,v])=>`${skillZh(k)} ${v}`).join(' / ')||'无额外熟练度要求'}${s.target.restriction?`；限制：${s.target.restriction}`:''}`,reqs:reqs.map(r=>({t:`${skillZh(r.skill)} ${r.need}`,ok:r.missing===0}))});
const totalGap=missing.reduce((a,b)=>a+b.missing,0);const earliest=s.target.recommended_level||'—';$('#routeSummary').className='route-summary show';$('#routeSummary').innerHTML=`<div class="metric"><span>SKILL GAP</span><strong>${totalGap}</strong></div><div class="metric"><span>RECOMMENDED LV</span><strong>${earliest}</strong></div><div class="metric"><span>DATA CONFIDENCE</span><strong>${preset?.confidence?.toUpperCase()||'RULE'}</strong></div>`;$('#routeTimeline').innerHTML=nodes.map((n,i)=>`<article class="route-node ${n.type||''}" style="animation-delay:${i*55}ms"><span class="step mono">STEP ${String(i).padStart(2,'0')}</span><h3>${n.title}</h3><p>${n.body}</p>${n.reqs?.length?`<div class="reqs">${n.reqs.map(r=>`<span class="pill ${r.ok?'ok':'missing'}">${r.t}</span>`).join('')}</div>`:''}</article>`).join('');}
$('#generateRoute').onclick=()=>generateRoute();
function renderTierFilters(){const root=$('#tierFilters');root.innerHTML=`<button class="tier-filter active" data-tier="all">全部</button>`+tierOrder.map(t=>`<button class="tier-filter" data-tier="${t}">${tierZh[t]}</button>`).join('');root.querySelectorAll('button').forEach(b=>b.onclick=()=>{root.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderClasses()})}renderTierFilters();
function renderClasses(){const q=($('#classSearch')?.value||'').trim().toLowerCase();const tier=$('.tier-filter.active')?.dataset.tier||'all';let list=CLASSES.filter(c=>(tier==='all'||c.tier===tier)&&(!q||`${c.name_en} ${c.mastery||''} ${t(c.name_en)} ${t(c.mastery||'')}`.toLowerCase().includes(q)));list.sort((a,b)=>tierOrder.indexOf(a.tier)-tierOrder.indexOf(b.tier)||a.name_en.localeCompare(b.name_en));$('#classTable').innerHTML=`<div class="class-row header"><div>职业</div><div>层级</div><div>资格要求</div><div>解锁条件</div><div>精通技能</div></div>`+list.map(c=>`<article class="class-row" data-class-id="${c.id}"><div class="class-name"><strong>${t(c.name_en)}</strong><small>参考等级 ${c.recommended_level??'待补'}</small></div><div data-label="职业层级">${tierZh[c.tier]||c.tier}</div><div class="req-list" data-label="资格要求">${Object.entries(c.requirements||{}).map(([k,v])=>`<span class="pill">${skillZh(k)} ${v}</span>`).join('')||'<span class="pill">无</span>'}</div><div data-label="解锁条件">${t(c.unlock||'—')}${c.restriction?`<br><small>${t(c.restriction)}</small>`:''}</div><div data-label="职业精通">${t(c.mastery||'—')}</div></article>`).join('');window.renderOverseasClassDetails?.()}
$('#classSearch').addEventListener('input',renderClasses);renderCharacters();renderClasses();
// default demo: Mu -> War Monk if available
const mu=CHARACTERS.find(c=>c.name_en==='Mu');if(mu){selectPlannerCharacter(mu.id);setTargetByName('War Monk')}

showView();
