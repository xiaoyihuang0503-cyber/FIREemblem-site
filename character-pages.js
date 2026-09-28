const $=selector=>document.querySelector(selector);
const t=value=>window.FE_t(value);
const escape=value=>String(t(value)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stats={hp:'生命',str:'力量',mag:'魔力',spd:'速度',dex:'技巧',def:'防御',res:'魔防',lck:'幸运',cha:'魅力'};
const personId=c=>c.id||c.name_en.toLowerCase().replace(/[^a-z0-9]+/g,'_');
const personHref=c=>'#character/'+encodeURIComponent(personId(c));
const list=(rows,render)=>rows.length?`<ul class="person-facts">${rows.map(row=>`<li>${render(row)}</li>`).join('')}</ul>`:'<p class="missing-fact">暂未收录。</p>';
const block=(id,title,content)=>`<section id="person-${id}" class="person-section"><h2>${title}</h2>${content}</section>`;
const statGrid=g=>`<div class="person-stat-grid">${Object.entries(stats).map(([key,label])=>`<div class="stat-${key}"><span>${label}</span><strong>${g?.[key]??'—'}${g?.[key]!=null?'%':''}</strong></div>`).join('')}</div>`;
function growthMarkup(c,growth){
  const differences=c.growth_differences||[];
  const summary=differences.map(d=>`${stats[d.stat]||d.stat} ${d.values.join('% / ')}%`).join('；');
  const scope=c.growth_scope_note==='earlier_profile_matches_skill_effective_values_scope_unverified'?'<p>一份旧档案的数值与“个人技能生效后”记录相同，是否采用了技能加成口径仍待核对。</p>':'';
  const notice=differences.length?`<aside class="growth-audit" role="note"><strong>成长数值存在 ${differences.length} 项差异</strong><p>${escape(summary)}。上方暂显示基础档案记录；规划时请对照其他记录，尚未经游戏内核实。</p>${scope}</aside>`:'<p class="person-note">现有记录未发现成长数值差异，尚未经游戏内核实。</p>';
  return statGrid(growth?.growth)+notice;
}
const combatLabels={...stats,hit:'命中',avo:'回避',crit:'必杀',atk:'攻击',rng:'射程',ddg:'必杀回避',bld:'体格',mov:'移动',as:'攻击速度',shld:'护盾'};
function personalSupplement(rows){
  return rows.map(r=>{
    const f=r.effect_facts,v=f?.stat_bonuses||(f?.stat&&f.bonus!=null?{[f.stat]:f.bonus}:null);
    const target=({adjacent_allies:'对相邻友军的影响',adjacent_foes:'对相邻敌军的影响',allies_in_radius:'对范围内友军的影响'})[f?.target]||'按上述条件生效的数值';
    return `<article class="personal-ability personal-supplement"><h3>${escape(r.name_zh)}</h3><p>${escape(r.effect_zh||'效果待补')}</p>${r.crest_name_zh?`<p class="person-note">纹章标识：${escape(r.crest_name_zh)}</p>`:''}${r.required_level!==undefined?`<p class="person-note">习得等级：${r.required_level??'待补'}</p>`:''}${v?`<h4>${target}</h4><div class="knowledge-stats">${Object.entries(v).map(([key,n])=>`<div class="stat-${key}"><span>${combatLabels[key]}</span><strong>${escape(n)}</strong></div>`).join('')}</div>`:''}</article>`;
  }).join('');
}
const value=(n,suffix='')=>n==null?'待补':escape(n)+suffix;
let generation=0;
function recruitment(row){
  const route=escape(row.route);
  if(row.availability==='not_recruitable')return `<article class="recruitment-card unavailable"><h3>${route}</h3><p>该路线不可招募</p></article>`;
  const fields=[['开放章节',row.chapter==null?'待补':`第 ${row.chapter} 章`],['支援等级',value(row.support_level)],['名声等级',value(row.renown_level)]];
  if(row.gold_cost!=null)fields.push(['金币',value(row.gold_cost)]);
  if(row.required_items)fields.push(['交付道具',row.required_items.map(i=>escape(i.name)+' × '+i.quantity).join('、')]);
  if(row.required_paralogue)fields.push(['前置外传',escape(row.required_paralogue)]);
  if(row.required_request)fields.push(['人物委托',escape(row.required_request.character)+(row.required_request.count?` · ${row.required_request.count} 项战斗任务`:'')]);
  if(row.required_story_chapter!=null)fields.push(['实际剧情门槛',`第 ${row.required_story_chapter} 章`]);
  if(row.required_correct_answers!=null)fields.push(['问答',`答对 ${row.required_correct_answers} 题`]);
  if(row.required_payment_refusals!=null)fields.push(['付款前置',`先拒绝付款 ${row.required_payment_refusals} 次`]);
  if(row.automatic_unlock)fields.push(['开放方式','随剧情自动开放招募']);
  if(row.special_requirement)fields.push(['补充条件',escape(row.special_requirement)]);
  return `<article class="recruitment-card"><h3>${route}</h3><dl>${fields.map(([label,text])=>`<div><dt>${label}</dt><dd>${text}</dd></div>`).join('')}</dl>${row.chapter_conflict?'<p class="person-note">表格章节与补充剧情门槛不同，两项记录均保留。</p>':''}</article>`;
}
async function renderPerson(){
  const token=++generation,raw=location.hash.slice('#character/'.length);
  let id;try{id=decodeURIComponent(raw);}catch{id='';}
  $('#personPage').innerHTML='<p class="page-loading" role="status">正在载入人物资料…</p>';
  try{
    const store=await window.FEGetStore();if(token!==generation)return;
    const roster=[...store.database.characters,...store.database.overseas.characters.filter(c=>!store.database.characters.some(local=>local.name_en===c.name_en))];
    const character=roster.find(c=>personId(c)===id);
    if(!character){$('#personPage').innerHTML='<h1>人物未找到</h1><a class="secondary-btn" href="#characters">返回人物图鉴</a>';return;}
    let c=store.characterContext(character.id||character.name_en);
    if(!window.FE_OFFLINE_DATABASE){
      const response=await fetch('characters/'+encodeURIComponent(id)+'.json',{cache:'no-cache'});
      if(response.ok){const dossier=await response.json();if(dossier.page_id===id&&dossier.snapshot_id===store.manifest.snapshot_id)c=dossier;}
    }
    if(token!==generation)return;
    const name=escape(character.name_zh||character.name_en);
    const profile=c.profile,reference=c.reference_update;
    const personal=character.personal_ability;
    const skillText=personal?.description||profile?.personal_ability_zh||c.personal_ability_catalog?.[0]?.effect_zh||'技能效果待补。';
    const skillTitle=reference?.personal_ability_name||personal?.name||c.reference_profile?.personal_ability||'个人技能';
    const growth=c.growth_variants.find(g=>g.variant==='base')||c.growth_variants[0];
    const growthNames={base:'基础成长',profile:'成长对照 A',reference:'成长对照 B',reference_update:'新增成长记录',skill_effective:'个人技能生效后'};
    let saved;try{saved=JSON.parse(localStorage.getItem(`fe-build-v02:${character.id}`)||'null');}catch{}
    const savedClass=store.database.classes.find(x=>x.id===saved?.target);
    const planner=character.id?`<button class="primary-btn" type="button" data-plan-person="${character.id}">${saved?'继续人物规划':'规划这个人物'} →</button>`:'<p class="person-note">补充人物暂未开放培养规划。</p>';
    const relatedNotes=c.character_notes.map(n=>`<p>${escape(n.summary)}</p>`).join('');
    const joinInfo=c.route_recruitment.length?`<div class="recruitment-grid">${c.route_recruitment.map(recruitment).join('')}</div>`:Array.isArray(c.recruitment)?list(c.recruitment,r=>escape([r.route,r.timing,r.condition||r.note].filter(Boolean).join(' · '))):list(Object.entries(c.recruitment||{}),r=>escape(r.join('：')));
    const preferences=reference?.preferred_skills||profile?.preferred_skills||c.reference_profile?.preferred_skills||[];
    const spells=c.spell_unlocks.length?c.spell_unlocks:c.spells;
    const contextClasses=preferences.length?store.database.classes.filter(x=>Object.keys(x.requirements||{}).some(k=>preferences.some(p=>t(p).includes(t({swords:'Sword',spears:'Spear',axes:'Axe',bows:'Bow',gauntlets:'Gauntlet',black_magic:'Black Magic',white_magic:'White Magic',riding:'Riding',flying:'Flying',armor:'Heavy Armor'}[k]))))).slice(0,8):[];
    $('#personPage').innerHTML=`<div class="person-breadcrumb"><a href="#characters">人物图鉴</a><span> / ${name}</span></div>
      <header class="person-heading">${window.renderCharacterAvatar?.(character)||''}<div class="person-title"><span class="small-label">${character.id?'人物档案':'补充人物档案'}</span><h1>${name}</h1><p>${reference?.birthday?'生日 '+escape(reference.birthday)+' · ':''}${c.reference_profile?.faction?escape(c.reference_profile.faction):'阵营资料待补'}</p></div><div class="person-actions">${planner}</div></header>
      <nav class="person-nav" aria-label="人物资料章节">${[['overview','成长'],['recruitment','招募'],['abilities','技能'],['spells','法术'],['relations','支援与收集'],['planning','培养规划']].map(([id,label])=>`<button type="button" data-person-section="${id}">${label}</button>`).join('')}</nav>
      <div class="person-layout"><div class="person-main">
      ${block('overview','成长与个人技能',growthMarkup(c,growth)+`<article class="personal-ability"><h3>${escape(skillTitle)}</h3><p>${escape(skillText)}</p></article>`+(c.personal_ability_catalog?.length?`<h3>个人技能效果补充</h3>${personalSupplement(c.personal_ability_catalog)}`:'')+`${relatedNotes}`+(c.growth_variants.length>1?`<details class="growth-comparison" ${c.growth_conflicts.length?"open":""}><summary>查看其他成长记录${c.growth_conflicts.length?' · 存在差异':''}</summary>${c.growth_variants.filter(v=>v!==growth).map(v=>`<h3>${growthNames[v.variant]}</h3>${statGrid(v.growth)}`).join('')}</details>`:''))}
      ${block('recruitment','各路线招募',joinInfo+'<p class="person-note">待补表示尚未收录；未列金币或道具也不等于确认无需支付或交付。开放招募与自动入队分别记录。</p>')}
      ${block('abilities','擅长与习得技能',`<h3>擅长熟练度</h3><div class="person-chips">${preferences.map(p=>`<span>${escape(p)}</span>`).join('')||'待补'}</div><h3>等级习得</h3>`+list(c.level_abilities,r=>`<strong>${escape(r.ability)}</strong><span>等级 ${r.level}${r.effect?' · '+escape(r.effect):' · 效果待补'}</span>`)+(c.level_ability_catalog?.length?'<h3>等级技能效果补充</h3>'+personalSupplement(c.level_ability_catalog):'')+(c.proficiency_abilities.length?'<h3>熟练度技能补充</h3>'+list(c.proficiency_abilities,r=>`<strong>${escape(r.name_zh)}</strong><span>${escape(r.effect_zh||'效果待补')} · ${escape({authority:'指挥'}[r.required_skill]||r.required_skill)} ${escape(r.required_skill_rank||'待补')}</span>`):'')+(contextClasses.length?`<details><summary>与擅长熟练度有关的职业</summary><p class="person-note">按资格要求关联，不代表已经满足考试条件。</p><div class="person-chips">${contextClasses.map(x=>`<a href="#classes">${escape(x.name_en)}</a>`).join('')}</div></details>`:''))}
      ${block('spells','法术习得',list(spells,r=>`<strong>${escape(r.spell)}</strong><span>${escape(r.magic==='black'?'Black Magic':r.magic==='white'?'White Magic':r.magic)} · 熟练度 ${escape(r.skill_level)}</span>`))}
      ${block('relations','支援与收集',`<h3>支援对象</h3><div class="person-chips">${c.supports.map(r=>{const partner=r.name===character.name_en?r.partner:r.name;const p=store.resolveCharacter(partner);return p?`<a href="${personHref(p)}">${escape(partner)} · ${escape(r.rank)}</a>`:`<span>${escape(partner)} · ${escape(r.rank)}</span>`;}).join('')||'暂未收录'}</div><h3>偏好礼物</h3><div class="person-chips">${c.gifts.map(r=>`<span>${escape(r.gift)}</span>`).join('')||'暂未收录'}</div>`+(c.gift_preference_variants?.length?'<h3>送礼偏好</h3>'+list(c.gift_preference_variants,v=>`<button class="secondary-btn" data-person-gift="${v.gift_profile_id}">${escape(v.gift_name_zh)}</button><span>${v.levels.map(x=>({liked:'喜欢',loved:'非常喜欢'}[x])).join(' / ')}${v.preference_comparison_status==='conflicting'?' · 偏好强度有差异，保留全部记录':''} · 支援点数待补</span>`):'<p class="person-note">送礼偏好尚未列出，不能据此认定没有喜欢的礼物。</p>')+`<h3>炎之战技</h3>`+list(c.blaze_arts,r=>`<strong>${escape(r.art)}</strong><span>炎消耗 ${escape(r.blaze)} · ${escape(r.learned)}</span>`)+`<h3>血印</h3><div class="person-chips">${c.bloodmarks.map(r=>`<span>${escape(r.mark)}</span>`).join('')||'暂未收录'}</div>`+(c.bloodmark_ability_catalog?.length?'<h3>血印效果补充</h3>'+personalSupplement(c.bloodmark_ability_catalog):'')+(c.other_item_variants?.length?'<h3>人物相关道具</h3>'+personalSupplement(c.other_item_variants.map(v=>v.assertions[0])):'')+(c.item_usage_rules?.length?'<h3>道具使用条件</h3>'+list(c.item_usage_rules,r=>`<strong>${escape(r.title_zh)}</strong><span>${escape(r.summary_zh)}</span>`):''))}
      ${block('planning','这个人物的培养规划',`<p>${saved?`已保存等级 ${saved.level}，目标为 ${escape(savedClass?.name_en||'待选择')}。`:'选择当前职业、熟练度与目标职业后，生成分阶段培养路线。'}</p>${planner}`+list(c.build_presets,r=>`<strong>${escape(r.name_zh)}</strong><span>${escape(r.why)}</span>`))}
      </div><aside class="person-sidebar"><h2>培养重点</h2><p>${preferences.length?'优先结合擅长熟练度安排目标职业。':'擅长资料待补，先按当前熟练度规划。'}</p>${planner}<p class="person-note">保存进度只在当前浏览器生效，按人物分别保留。</p><h3>资料情况</h3><dl><div><dt>招募路线</dt><dd>${c.route_recruitment.length} 条</dd></div><div><dt>等级技能</dt><dd>${c.level_abilities.length} 条</dd></div><div><dt>法术习得</dt><dd>${spells.length} 条</dd></div></dl><p class="person-note">术语为站内对照译名。空白或未列出的资料仍待补充。</p></aside></div>`;
    document.title=name+'｜万缕千丝人物档案';
    $('#personPage').querySelectorAll('[data-person-gift]').forEach(b=>b.onclick=()=>window.openKnowledgeRecord('gift_profiles',b.dataset.personGift));
    $('#personPage').querySelectorAll('[data-plan-person]').forEach(b=>b.onclick=()=>{window.selectPlannerCharacter(b.dataset.planPerson);location.hash='planner';});
    $('#personPage').querySelectorAll('[data-person-section]').forEach(b=>b.onclick=()=>$('#person-'+b.dataset.personSection).scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  }catch{if(token===generation)$('#personPage').innerHTML='<h1>资料暂未载入</h1><button class="secondary-btn" id="personRetry">重新载入</button>';$('#personRetry')?.addEventListener('click',renderPerson);}
}
const filters={all:'全部',people:'人物',classes:'职业',skills:'技能与法术',maps:'地图与章节',items:'礼物与物品'};
const groups={people:['characters','supplemental_characters','character_profiles','character_reference_profiles','character_growth_variants','character_growth_reference','recruitment_conditions','character_notes','build_presets'],classes:['classes','class_change_rules','class_growth_reference','class_requirements','certification_requirements','class_profiles'],skills:['bloodmark_ability_catalog','level_ability_catalog','personal_ability_catalog','proficiency_abilities','mount_abilities','level_abilities','ability_catalog','class_abilities','spell_unlocks','spells','blaze_arts','bloodmarks'],maps:['maps','chapters','battles','paralogues','paralogue_windows','diadem_key_locations','divine_chambers'],items:['gift_profiles','gift_preferences','gifts','supports','references','skill_preferences','certification_items','material_profiles','other_item_profiles','item_usage_rules','item_profiles','weapon_profiles','weapon_type_rules']};
let filter='all',searchLimit=30,searchGeneration=0,results=[];
async function renderSearch(){
  const token=++searchGeneration,params=new URLSearchParams(location.hash.split('?')[1]||''),needle=params.get('q')||'';
  $('#siteSearchInput').value=needle;$('#globalSearchInput').value=needle;$('#siteSearchStatus').textContent='正在查询…';
  try{
    const store=await window.FEGetStore();if(token!==searchGeneration)return;
    // Keep concise fact collections before large aggregate profiles. Expanded
    // collections remain searchable/filterable without burying existing details.
    const secondary=new Set(['character_profiles','character_growth_variants','character_growth_reference','recruitment_conditions','character_notes','build_presets','class_growth_reference','class_requirements','certification_requirements','class_profiles','paralogue_windows']);
    const keys=[...new Set([...Object.values(groups).flat(),...store.catalog().collections.map(c=>c.id)])].filter(id=>!['sources','portraits','map_nodes','map_edges','ingestion_pages'].includes(id)).sort((a,b)=>Number(secondary.has(a))-Number(secondary.has(b)));
    results=needle.trim()?keys.flatMap(collection=>{
      const rows=[];let offset=0,page;
      do{page=store.search({collection,q:needle,limit:100,offset});rows.push(...page.records);offset+=100;}while(page.has_more);
      return rows;
    }):[];
    $('#searchFilters').innerHTML=Object.entries(filters).map(([key,label])=>`<button type="button" data-search-filter="${key}" class="${key===filter?'active':''}" aria-pressed="${key===filter}">${label}</button>`).join('');
    $('#searchFilters').querySelectorAll('button').forEach(b=>b.onclick=()=>{filter=b.dataset.searchFilter;searchLimit=30;renderSearch();});
    const shown=results.filter(r=>filter==='all'||groups[filter].includes(r.collection));
    $('#siteSearchStatus').textContent=needle.trim()?`找到 ${shown.length} 条匹配资料${results.length!==shown.length?' · 全部 '+results.length+' 条':''}`:'输入关键词，可以搜索人物、职业、技能、法术、礼物和地图资料。';
    $('#siteSearchResults').innerHTML=shown.slice(0,searchLimit).map(r=>{const c=store.resolveCharacter(['personal_ability_catalog','level_ability_catalog','bloodmark_ability_catalog'].includes(r.collection)?r.record.character_id||r.record.supplemental_character_name:r.record.character_id||r.record.name_en||r.record.character||r.record.name);const holderPeople=(r.collection==='bloodmark_ability_catalog'||['other_item_profiles','item_usage_rules'].includes(r.collection))?(r.record.holders||r.record.character_relations).filter(h=>h.character_identity_status!=='unresolved').map(h=>store.resolveCharacter(h.character_id||h.supplemental_character_name)).filter(Boolean):[];const person=holderPeople.length?holderPeople.map(p=>`<a class="result-person" href="${personHref(p)}">${escape(p.name_zh||p.name_en)}的档案 →</a>`).join(''):c?`<a class="result-person" href="${personHref(c)}">${escape(c.name_zh||c.name_en)}的档案 →</a>`:'';return `<article class="search-result"><span class="small-label">${store.collection(r.collection).label}</span>${['characters','supplemental_characters'].includes(r.collection)&&c?`<a class="result-title" href="${personHref(c)}">${escape(r.title)}</a>`:`<button class="result-title" data-search-collection="${r.collection}" data-search-id="${encodeURIComponent(r.id)}">${escape(r.title)}</button>`}<p>${escape(r.summary)}</p>${person}</article>`;}).join('')||(needle.trim()?'<p class="search-empty">没有找到匹配资料，试试人物名或更短的关键词。</p>':`<div class="search-suggestions"><h2>常用查询</h2>${['穆','凯伊','武僧','力量','治疗'].map(v=>`<a href="#search?q=${encodeURIComponent(v)}">${v}</a>`).join('')}</div>`);
    $('#siteSearchResults').querySelectorAll('[data-search-collection]').forEach(b=>b.onclick=()=>window.openKnowledgeRecord(b.dataset.searchCollection,decodeURIComponent(b.dataset.searchId)));
    $('#siteSearchMore').hidden=shown.length<=searchLimit;
  }catch{if(token===searchGeneration)$('#siteSearchStatus').textContent='查询暂不可用，请重试。';}
}
function submit(input){filter='all';searchLimit=30;const hash='search?q='+encodeURIComponent(input.value.trim());if(location.hash.slice(1)===hash)renderSearch();else location.hash=hash;}
$('#globalSearchForm').onsubmit=e=>{e.preventDefault();submit($('#globalSearchInput'));};
$('#homeSearchForm').onsubmit=e=>{e.preventDefault();submit($('#homeQuery'));};
$('#siteSearchForm').onsubmit=e=>{e.preventDefault();submit($('#siteSearchInput'));};
$('#siteSearchMore').onclick=()=>{searchLimit+=30;renderSearch();};
function route(){if(location.hash.startsWith('#character/'))renderPerson();else {generation++;document.title='万缕千丝｜搜索与人物规划';if(location.hash.startsWith('#search'))renderSearch();else searchGeneration++;}}
window.addEventListener('hashchange',route);route();
