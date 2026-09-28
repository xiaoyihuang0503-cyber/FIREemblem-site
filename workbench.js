import {KnowledgeStore} from './harness-core.js';
const q=s=>document.querySelector(s);
const raw=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=v=>raw(window.FE_t?.(v)??v);
const labels={hp:'生命',str:'力量',mag:'魔力',spd:'速度',dex:'技巧',def:'防御',res:'魔防',lck:'幸运',cha:'魅力',hit:'命中',avo:'回避',ddg:'必杀回避',bld:'体格',mov:'移动',as:'攻击速度',shld:'护盾',atk:'攻击',crit:'必杀',rng:'射程'};
const excluded=new Set(['sources','map_edges','map_nodes','ingestion_pages']);
let pending,store,offset=0,total=0,selectedId,queryGeneration=0,libraryGeneration=0;
const status=text=>q('#knowledgeStatus').textContent=text;
async function load(){
  if(store)return store;
  if(!pending)pending=(async()=>{
    status('正在载入资料……');
    const read=async file=>{const response=await fetch(file,{cache:'no-cache'});if(!response.ok)throw new Error('Load failed');return response.json();};
    const [db,manifest]=window.FE_OFFLINE_DATABASE?[window.FE_OFFLINE_DATABASE,window.FE_OFFLINE_MANIFEST]:await Promise.all([read('database.json'),read('manifest.json')]);
    store=new KnowledgeStore(db,manifest);
    q('#knowledgeCollection').innerHTML=store.catalog().collections.filter(c=>!excluded.has(c.id)).map(c=>`<option value="${c.id}">${esc(c.label)} · ${c.count}</option>`).join('');
    renderCatalog();
    return store;
  })().catch(e=>{pending=null;throw e;});
  return pending;
}
window.FEGetStore=load;
const knownName=en=>store.database.characters.find(c=>c.name_en===en)?.name_zh||en;
function stats(values){return `<div class="knowledge-stats">${Object.entries(values??{}).map(([key,v])=>`<div class="stat-${key}"><span>${esc(labels[key]||key)}</span><strong>${esc(v??'待补')}</strong></div>`).join('')}</div>`;}
function section(title,text){return text!==null&&text!==undefined&&text!==''?`<section><h3>${esc(title)}</h3><p>${esc(text)}</p></section>`:'';}
function recruitment(r){
  const route=store.database.adventure.routes[r.route]||r.route;
  if(r.availability==='not_recruitable')return `${route} · 该路线不可招募`;
  const conditions=[route,r.chapter==null?'章节待补':`第 ${r.chapter} 章`,`支援 ${r.support_level??'待补'}`,`名声 ${r.renown_level??'待补'}`];
  if(r.automatic_unlock===true)conditions.push('自动解锁招募');
  else if(r.unlock_method==='story_progression')conditions.push('随剧情开放招募');
  if(r.gold_cost!=null)conditions.push(`${r.gold_cost} 金币`);
  if(r.required_items)conditions.push(r.required_items.map(i=>`${i.name} × ${i.quantity}`).join('、'));
  if(r.required_story_chapter!=null)conditions.push(`实际招募需推进至第 ${r.required_story_chapter} 章`);
  if(r.special_requirement&&!r.required_items&&!/^Give \d[\d,]* Gold to /i.test(r.special_requirement))conditions.push(r.special_requirement);
  return conditions.join(' · ');
}
function classRequirements(r){
  const names={swords:'剑',spears:'枪',axes:'斧',bows:'弓',gauntlets:'拳套',white_magic:'白魔法',black_magic:'黑魔法',riding:'骑术',flying:'飞行',armor:'重装'};
  return section('推荐等级',r.ideal_level??'未列出')+section('名声等级',r.renown_level??'未列出')+section('资格证',r.license_type||r.license_item||'未列出')+section('额外解锁条件',r.unlock_condition||'未列出')+
    r.skill_requirement_groups.map(g=>section(g.group==='primary'?'主要熟练度要求':'次要熟练度要求',g.requirements.map(v=>`${names[v.skill]||'技能身份待补'} ${v.rank}`).join(' · '))).join('')+
    section('精通技能',r.mastery_ability_names.join('、'))+section('职业技能',r.class_ability_names.join('、'))+
    '<p class="knowledge-note">推荐等级与考试等级分别记录。主要、次要分组按已核对资料保留，组合规则与技能效果仍待核对。</p>';
}
const skillNames={swords:'剑',spears:'枪',axes:'斧',bows:'弓',gauntlets:'拳套',white_magic:'白魔法',black_magic:'黑魔法',infantry:'步兵',riding:'骑术',flying:'飞行',armor:'重装',authority:'指挥'};
function classProfile(r){
  return section('职业层级',r.tier||'待补')+section('兵种',r.unit_type||'待补')+section('移动力',r.movement??'待补')+
    section('可用武器',r.weapons.map(k=>skillNames[k]||'待补').join('、'))+
    section('推荐等级',r.ideal_level??'未列出')+section('名声等级',r.renown_level??'未列出')+section('资格证',r.license_type||'未列出')+
    r.skill_requirement_groups.map(g=>section(g.group==='primary'?'主要熟练度要求':'次要熟练度要求',g.requirements.map(v=>`${skillNames[v.skill]||'技能身份待补'} ${v.rank}`).join(' · '))).join('')+
    section('职业可用技能',r.all_skills.map(v=>skillNames[v.skill]||'技能身份待补').join('、'))+
    `<section><h3>属性加成</h3>${stats(r.stat_bonus)}</section><section><h3>成长修正</h3>${stats(r.growth_bonus)}</section>`+
    section('技能经验加成',r.skill_exp_bonuses.map(v=>`${skillNames[v.skill]||'技能身份待补'} +${v.bonus}`).join(' · '))+
    section('额外解锁条件',r.unlock_conditions.map(v=>v.summary_zh).join('；')||'本页未列出，完整解锁机制待补')+
    (r.source_application_rules?section('属性与成长说明',Object.values(r.source_application_rules).map(v=>v.summary_zh).join(' ')):'')+
    '<p class="knowledge-note">属性加成与成长修正分别记录。成长列的数值口径仍需核对，尚未应用到培养计算；推荐等级不视为考试最低等级。</p>';
}
function classAbility(r){
  return section(r.kind==='mastery'?'精通技能':'职业技能',r.ability)+section('效果',r.effect_zh||'效果待补');
}
function detail(collection,id){
  selectedId=id;const item=store.get(collection,id);if(!item)return;
  const r=item.record;let content='';
  const person=store.resolveCharacter(['personal_ability_catalog','level_ability_catalog','bloodmark_ability_catalog'].includes(collection)?r.character_id||r.supplemental_character_name:r.character_id||r.name_en||r.character||r.name);
  if(person)content+=`<a class="secondary-btn" href="#character/${encodeURIComponent(person.id||person.name_en.toLowerCase().replace(/[^a-z0-9]+/g,'_'))}">进入人物专页 →</a>`;
  if(collection==='characters'||collection==='supplemental_characters'){
    const c=store.characterContext(r.id||r.name_en);
    content+=`${c.portrait?`<img class="knowledge-portrait" src="${raw(c.portrait.path)}" alt="${esc(item.title)}头像" />`:''}<p>${esc(r.name_en)}</p>`;
    content+=section('个人技能',c.profile?.personal_ability_zh||r.personal_ability?.description||c.reference_profile?.personal_ability);
    content+=c.growth_variants.map(v=>`<section><h3>${esc({base:'基础成长',profile:'成长对照 A',reference:'成长对照 B',reference_update:'新增成长记录',skill_effective:'技能生效后的成长'}[v.variant])}</h3>${stats(v.growth)}</section>`).join('');
    if(c.growth_conflicts.length)content+='<p class="knowledge-note">成长记录存在差异，已保留各组数值供对照。</p>';
    content+=section('擅长技能',(c.profile?.preferred_skills||c.reference_profile?.preferred_skills||[]).join('、'));
    if(Array.isArray(c.recruitment))content+=section('招募条件',c.recruitment.map(a=>`${a.route||''} ${a.timing||''} ${a.condition||a.note||''}`).join('；'));
    else if(c.recruitment)content+=section('加入信息',Object.values(c.recruitment).join('；'));
    content+=section('按路线加入条件',c.route_recruitment.map(recruitment).join('；'));
    content+=section('等级习得技能',c.level_abilities.map(a=>`${a.ability} · Lv.${a.level}`).join('；'));
    content+=section('生日',c.reference_update?.birthday);
    content+=`<section><h3>关联资料</h3><p>支援 ${c.supports.length} 条 · 法术 ${c.spells.length} 条 · 礼物 ${c.gifts.length} 条 · 培养示例 ${c.build_presets.length} 条</p><p class="knowledge-note">未列出的关联内容可能尚未收录。</p></section>`;
  }else if(collection==='character_reference_profiles'){
    content+=section('人物',r.name_zh||r.name_en)+section('生日',r.birthday)+section('个人技能名称',r.personal_ability_name);
    content+=`<section><h3>成长记录</h3>${stats(r.growth)}</section>`;
    content+=section('擅长技能',r.preferred_skills?.join('、')||'待补')+section('不擅长技能',r.non_ideal_skills===null?'待补':r.non_ideal_skills.join('、')||'无');
    content+=section('技能名称',r.skill_ability_names.join('、'));
    content+='<p class="knowledge-note">记录已收录，技能效果与部分条件仍待补全。</p>';
  }else if(collection==='recruitment_conditions'){
    content+=section('加入条件',recruitment(r))+section('所属部分',r.part?`第 ${r.part} 部`:'待补');
    if(r.requires_separate_quest_or_event===false)content+=section('招募解锁','无需另做任务或独立事件；实际入队方式尚未核实。');
    if(r.required_paralogue)content+=section('前置外传',r.required_paralogue);
    if(r.required_request)content+=section('人物委托',`${knownName(r.required_request.character)}${r.required_request.count?` · ${r.required_request.count} 项战斗任务`:''}`);
    if(r.required_correct_answers!=null)content+=section('问答条件',`需答对 ${r.required_correct_answers} 题`);
    if(r.chapter_conflict)content+=section('章节记录差异',`招募表记为第 ${r.chapter_conflict.table_chapter} 章，补充条件要求第 ${r.chapter_conflict.additional_gate} 章。两项记录均已保留。`);
    content+='<p class="knowledge-note">标为“待补”的条件尚未收录，不能据此认定无需满足。</p>';
  }else if(collection==='level_abilities'){
    content+=section('人物',knownName(r.character))+section('技能',r.ability)+section('习得等级',`Lv.${r.level}`)+section('效果',r.effect||'待补');
  }else if(collection==='spell_unlocks'){
    content+=section('人物',knownName(r.character))+section('法术',r.spell)+section('熟练度',r.skill_level)+section('魔法类别',r.magic==='black'?'黑魔法':'白魔法');
  }else if(collection==='classes'){
    const c=store.classContext(id);content+=section('资格要求',Object.entries(r.requirements).map(([k,v])=>`${k} ${v}`).join(' · ')||'熟练度条件待补');content+=section('解锁',r.unlock)+section('精通',typeof r.mastery==='object'?r.mastery?.name||r.mastery?.skill:r.mastery);if(c.growth_reference?.growth_bonus)content+=`<section><h3>成长加成</h3>${stats(c.growth_reference.growth_bonus)}</section>`;
    if(c.requirements_variants.length)content+=`<details><summary>查看已核对的资格与技能记录</summary>${c.requirements_variants.map((v,i)=>`<h3>记录 ${i+1}</h3>${classRequirements(v)}`).join('')}${c.reference_conflicts.length?'<p class="knowledge-note">各记录有差异，已并列保留。</p>':''}</details>`;
    if(c.reference_profiles.length)content+=`<section><h3>职业数值档案</h3>${c.reference_profiles.map(classProfile).join('')}${c.growth_conflicts.length?'<p class="knowledge-note">成长数值与已有记录存在差异，均已保留。</p>':''}</section>`;
    if(c.class_abilities.length)content+=`<section><h3>技能效果</h3>${c.class_abilities.map(classAbility).join('')}</section>`;
    const supplements=c.ability_catalog.filter(r=>!c.class_abilities.some(a=>a.kind===r.kind&&a.ability===r.ability&&JSON.stringify(a.effect_facts)===JSON.stringify(r.effect_facts)));
    if(supplements.length)content+=section('技能效果补充',supplements.map(r=>`${r.name_zh}：${r.effect_zh||'效果待补'}`).join('；'));
    if(c.divine_chambers.length)content+=section('职业道具取得',c.divine_chambers.map(r=>r.summary_zh).join('；'));
    if(c.class_change_rules.length)content+=section('路线解锁',c.class_change_rules.map(r=>r.summary_zh).join('；'));
  }else if(collection==='class_requirements'){
    content+=classRequirements(r);
  }else if(collection==='class_profiles'){
    content+=classProfile(r);
    content+=store.classContext(r.class_id).class_abilities.filter(a=>a.source_id===r.source_id).map(classAbility).join('');
  }else if(collection==='class_abilities'){
    content+=section('所属职业',r.name_en)+classAbility(r);
    content+=`<button type="button" class="secondary-btn" data-related-class="${raw(r.class_id)}">查看职业数值与资格 →</button>`;
  }else if(collection==='certification_requirements'){
    content+=section('考试等级',r.exam_level??(r.level_status==='not_applicable_in_source'?'不适用':'未列出'))+section('名声等级',r.renown_level??'未列出')+section('资格证',r.license_name)+section('消耗数量',r.license_quantity??'未列出');
  }else if(collection==='bloodmark_ability_catalog'){
    content+=section('血印效果',r.effect_zh||'效果待补')+section('纹章标识',r.crest_name_zh);
    content+=`<section><h3>列出的持有人</h3>${r.holders.map(h=>{
      const c=h.character_identity_status==='unresolved'?null:store.resolveCharacter(h.character_id||h.supplemental_character_name);
      return c?`<a class="secondary-btn" href="#character/${encodeURIComponent(c.id||c.name_en.toLowerCase().replace(/[^a-z0-9]+/g,'_'))}">${esc(knownName(h.character))}的档案 →</a>`:`<p>${esc(knownName(h.character))} · 档案待核对</p>`;
    }).join('')}</section>`;
    const values=r.effect_facts?.stat_bonuses;
    if(values)content+=`<section><h3>按上述条件生效的数值</h3>${stats(values)}</section>`;
    content+='<p class="knowledge-note">持有人清单仍可能不完整；未列出不代表无法持有。</p>';
  }else if(['personal_ability_catalog','level_ability_catalog'].includes(collection)){
    content+=section(collection==='level_ability_catalog'?'等级技能效果':'个人技能效果',r.effect_zh||'效果待补')+section('列出人物',knownName(r.character));
    if(collection==='level_ability_catalog')content+=section('习得等级',r.required_level??'待补');
    const ref=r.effect_facts?.referenced_ability;
    if(ref){content+=section('关联技能',ref.name_en);if(ref.record_id)content+=`<button type="button" class="secondary-btn" data-related-ability="${raw(ref.record_id)}" data-related-collection="${raw(ref.collection)}">查看关联技能 →</button>`;else content+=section('关联状态','技能身份与完整效果待核对。');}
    if(r.character_identity_status==='unresolved')content+=section('人物关联','该人物尚未建立独立档案，身份待核对。');
    content+=section('单位限制',({cavalry:'骑兵',infantry:'步兵',flying:'飞行'})[r.unit_type_restriction]||'未列出');
    const facts=r.effect_facts,values=facts?.stat_bonuses||(facts?.stat&&facts.bonus!=null?{[facts.stat]:facts.bonus}:null);
    if(values)content+=`<section><h3>${({adjacent_allies:'对相邻友军的影响',adjacent_foes:'对相邻敌军的影响',allies_in_radius:'对范围内友军的影响'})[facts.target]||'按上述条件生效的数值'}</h3>${stats(values)}</section>`;
  }else if(['proficiency_abilities','mount_abilities'].includes(collection)){
    content+=section('效果',r.effect_zh||'效果待补');
    content+=section('单位限制',({infantry:'步兵',cavalry:'骑兵',flying:'飞行'})[r.unit_type_restriction]||'未列出');
    if(collection==='proficiency_abilities'){
      if(r.ability_series_level!=null)content+=section('技能等级',r.ability_series_level);
      content+=section('习得熟练度',r.required_skill?`${skillNames[r.required_skill]} ${r.required_skill_rank}`:'待补');
      if(r.character_id)content+=section('关联人物',knownName(r.character));
    }else content+=section('关联坐骑',r.mount_name_zh||'待补')+section('习得羁绊等级',r.required_bond_level??'待补');
    const values=r.effect_facts?.stat_bonuses||(r.effect_facts?.stat&&r.effect_facts.bonus!=null?{[r.effect_facts.stat]:r.effect_facts.bonus}:null);
    if(values)content+=`<section><h3>${r.effect_facts.target==='adjacent_foes'?'对相邻敌军的影响':'按上述条件生效的数值'}</h3>${stats(values)}</section>`;
    if(r.review_notes_zh.length)content+=section('数值核对',r.review_notes_zh.join('；'));
  }else if(collection==='weapon_profiles'){
    content+=section('类型',skillNames[r.weapon_type]);
    const weaponRules=store.database.guide_facts.item_usage_rules.filter(v=>v.effect_facts?.item_name_en===r.name_en&&v.category==='weapon_acquisition'&&v.effect_status==='parsed');
    content+='<section><h3>获得途径</h3>'+(weaponRules.length?weaponRules.map(v=>`<p>${esc(v.summary_zh)}</p><button type="button" class="secondary-btn" data-related-ability="${raw(v.id)}" data-related-collection="item_usage_rules">${esc(v.title_zh)} · 查看详情 →</button>`).join(''):'<p>逐件获得途径尚未收录。</p>')+'</section>';
    const variants=store.weaponVariants(r.name_en);
    const individual=variants.assertions.find(v=>Object.hasOwn(v,'hit'));
    if(!individual)content+=section('资料情况','目前只有目录数值；命中、必杀、回避、具体取得条件与适用职业待补。');
    else if(!Object.hasOwn(r,'hit'))content+=section('资料情况','本条为目录数值；同名武器的独立档案另列命中、必杀、回避及取得条件。');
    const range=r.range_min==null?'待补':r.range_min===r.range_max?String(r.range_min):`${r.range_min}–${r.range_max}`;
    content+=`<div class="knowledge-stats">${[[r.weapon_type.includes('magic')?'mag':'str','威力',r.might],['hp','耐久',r.durability],['dex','射程',range],['spd','重量',r.weight]].map(([color,label,value])=>`<div class="stat-${color}"><span>${esc(label)}</span><strong>${esc(value??'待补')}</strong></div>`).join('')}</div>`;
    if(Object.hasOwn(r,'hit'))content+=`<div class="knowledge-stats">${[['dex','命中',r.hit],['lck','必杀',r.crit],['spd','回避',r.avoid]].map(([color,label,value])=>`<div class="stat-${color}"><span>${esc(label)}</span><strong>${esc(value??'待补')}</strong></div>`).join('')}</div>`;
    if(Object.hasOwn(r,'price_gold'))content+=section('标价',r.price_gold==null?'待补':`${r.price_gold} 金币（不代表所有商贩售价）`)+section('熟练度要求',`${skillNames[r.required_skill]} ${r.required_skill_rank}`);
    for(const classId of r.class_ids??[])content+=`<button type="button" class="secondary-btn" data-related-class="${raw(classId)}">${esc(store.translate(store.classContext(classId).class.name_en))}职业 →</button>`;
    if(variants.assertions.length>1){
      content+=section('资料核对',variants.conflicting_fields.length?'数值存在冲突，各条资料分别保留。':'已保留独立数值记录；部分记录的字段尚未列全。');
      content+=variants.assertions.filter(v=>v.id!==r.id).map(v=>`<button type="button" class="secondary-btn" data-related-ability="${raw(v.id)}" data-related-collection="weapon_profiles">${esc(v.title_zh)}${Object.hasOwn(v,'hit')?' · 完整数值与职业要求':' · 目录数值'} →</button>`).join('');
    }
    content+=section('特效对象',r.effective_against.length?r.effective_against.map(e=>`${({armor:'重装',cavalry:'骑兵',flying:'飞行',beast:'兽类',undead:'亡灵'})[e.target]}${e.source_plus?'（增强标记，倍率待补）':''}`).join('、'):'未列出');
    const rules=store.database.guide_facts.weapon_type_rules.filter(v=>v.weapon_type===r.weapon_type||v.weapon_type==='magic'&&r.weapon_type.includes('magic'));
    content+=section('类别规则',rules.map(v=>v.summary_zh).join('；'));
    if(r.missing_fields_zh.length)content+=section('待补数值',r.missing_fields_zh.join('、'));
  }else if(collection==='ability_catalog'){
    content+=section('技能类别',r.kind==='mastery'?'精通技能':'职业技能')+section('效果',r.effect_zh||'效果待补');
    content+=section('关联职业',r.class_ids.length?r.class_ids.map(id=>store.classContext(id).class.name_en).join('、'):'未列出');
    for(const classId of r.class_ids)content+=`<button type="button" class="secondary-btn" data-related-class="${raw(classId)}">查看${esc(store.classContext(classId).class.name_en)}职业 →</button>`;
  }else if(['other_item_profiles','item_usage_rules'].includes(collection)){
    if(collection==='other_item_profiles')content+=section('类型',r.category_zh);
    content+=section('说明',r.effect_zh||r.summary_zh);
    for(const h of r.character_relations){
      const c=h.character_identity_status==='unresolved'?null:store.resolveCharacter(h.character_id||h.supplemental_character_name);
      content+=section(({signature_item:'专属物品关联人物',delivery_recipient:'交付给',route_user:'使用人物',support_target:'支援关系人物',mount_capture_user:'捕获坐骑的人物'})[h.relation_kind],knownName(h.character));
      if(c)content+=`<a class="secondary-btn" href="#character/${encodeURIComponent(c.id||c.name_en.toLowerCase().replace(/[^a-z0-9]+/g,'_'))}">${esc(knownName(h.character))}的档案 →</a>`;
    }
    if(r.route)content+=section('路线条件',store.database.adventure.routes[r.route]||r.route);
    if(r.effect_facts?.stat_bonuses)content+=stats(r.effect_facts.stat_bonuses);
    if(r.effect_facts?.spell_record_id)content+=`<button type="button" class="secondary-btn" data-related-ability="${raw(r.effect_facts.spell_record_id)}" data-related-collection="weapon_profiles">查看对应法术 →</button>`;
    if(r.missing_fields_zh?.length)content+=section('待补资料',r.missing_fields_zh.join('、'));
  }else if(collection==='gift_profiles'){
    content+=section('礼物说明',r.summary_zh)+section('具体售价',r.price??'待补')+section('支援点数',r.support_points??'待补')+section('逐项取得方式',r.acquisition_status==='individual_conditions_not_listed'?'尚未收录；下方送礼条件是通用规则，不代表这件礼物的取得地点。':'待补')+section('取得数量',r.quantity??'待补');
    content+='<section><h3>人物送礼偏好</h3>'+(item.preference_variants.length?item.preference_variants.map(v=>{
      const c=store.resolveCharacter(v.character_id||v.supplemental_character_name);
      const levels=v.levels.map(x=>({liked:'喜欢',loved:'非常喜欢'}[x])).join(' / ');
      return `<p>${c?`<a href="#character/${encodeURIComponent(c.id||c.name_en.toLowerCase().replace(/[^a-z0-9]+/g,'_'))}">${esc(c.name_zh||c.name_en)}</a>`:esc(v.character)} · ${esc(levels)}${v.preference_comparison_status==='conflicting'?' · 偏好强度有差异，保留全部记录':''}</p>`;
    }).join(''):'<p>人物偏好尚未列出，不能推断为没有喜欢的对象。</p>')+'</section>';
    content+='<section><h3>送礼条件</h3>'+store.database.guide_facts.item_usage_rules.filter(v=>v.category==='gift_rule'&&v.source_id==='en_623690').map(v=>`<button type="button" class="secondary-btn" data-related-ability="${raw(v.id)}" data-related-collection="item_usage_rules">${esc(v.title_zh)} →</button>`).join('')+'</section>';
  }else if(collection==='gift_preferences'){
    content+=section('人物',knownName(r.character))+section('礼物',r.gift_name_zh)+section('偏好强度',r.preference_zh)+section('支援点数',r.support_points??'待补');
    if(item.preference_variants.some(v=>v.preference_comparison_status==='conflicting'))content+=section('偏好记录差异','同一人物与礼物存在喜欢、非常喜欢两种强度记录；全部保留，未选择其中一项覆盖。');
    content+=`<button type="button" class="secondary-btn" data-related-ability="${raw(r.gift_profile_id)}" data-related-collection="gift_profiles">查看礼物档案 →</button>`;
  }else if(collection==='material_profiles'){
    content+=section('类型',r.category_zh);
    const materialRules=store.database.guide_facts.item_usage_rules.filter(v=>v.effect_facts?.item_name_en===r.name_en&&v.effect_status==='parsed');
    const acquisitionRules=materialRules.filter(v=>v.category?.endsWith('_acquisition'));
    content+='<section><h3>获得途径</h3>'+(acquisitionRules.length?acquisitionRules.map(v=>`<p>${esc(v.summary_zh)}</p><button type="button" class="secondary-btn" data-related-ability="${raw(v.id)}" data-related-collection="item_usage_rules">${esc(v.title_zh)} · 查看详情 →</button>`).join(''):'<p>逐件获得途径尚未收录。</p>')+'</section>';
    content+=section('说明',r.effect_zh);
    const variants=store.materialVariants(r.name_en);
    content+=section('记录对照',({same:'已记录的用途与环境事实一致；具体数值仍待补。',missing_in_some_sources:'同名记录有资料缺项，保留各条记录；缺项不代表没有用途。',conflicting:'同名记录的已知事实存在差异，待核对。',single_source:'当前仅有一份已知事实记录。'})[variants.effect_comparison_status]);
    if(r.possible_alias_names.length)content+=section('名称待核对','可能与'+r.possible_alias_names.map(n=>store.translate(n)).join('、')+'为名称变体；保留独立条目，尚未合并。');
    if(r.effect_facts?.related_item_name)content+=section('关联物品',store.translate(r.effect_facts.related_item_name));
    const useRules=materialRules.filter(v=>!v.category?.endsWith('_acquisition'));
    if(useRules.length){
      content+='<section><h3>使用条件</h3></section>';
      for(const rule of useRules)content+=`<button type="button" class="secondary-btn" data-related-ability="${raw(rule.id)}" data-related-collection="item_usage_rules">${esc(rule.title_zh)} →</button>`;
    }
    content+=section('待补资料',r.missing_fields_zh.join('、'));
    content+='<p class="knowledge-note">类别使用规则不代表每件材料都适用同一配方、恢复量或诱饵条件。</p>';
  }else if(collection==='item_profiles'){
    content+=section('类型',r.category_zh)+section('获得途径','逐件获得途径尚未收录。')+section('效果',r.effect_zh||'效果待补');
    if(r.category!=='consumable')content+=section('重量',r.weight??'待补');
    if(r.effect_facts?.stat_bonuses&&!r.effect_facts.condition)content+=stats(r.effect_facts.stat_bonuses);
    if(r.missing_fields_zh.length)content+=section('待补资料',r.missing_fields_zh.join('、'));
  }else if(collection==='weapon_type_rules'){
    content+=section('规则',r.summary_zh);
  }else if(['certification_items','diadem_key_locations','divine_chambers','class_change_rules'].includes(collection)){
    content+=section('说明',r.summary_zh);
    if(r.missing_fields_zh?.length)content+=section('待补资料',r.missing_fields_zh.join('、'));
    if(r.class_id)content+=`<button type="button" class="secondary-btn" data-related-class="${raw(r.class_id)}">查看对应职业 →</button>`;
    if(r.class_ids)content+=section('关联职业',r.class_ids.map(id=>store.classContext(id)?.class.name_en||id).join('、'));
  }else if(collection==='maps'){
    content+=section('探索提醒',r.notes.join('；'));content+=`<p>${r.nodes.length} 个节点 · ${r.edges.length} 条连接</p><button type="button" data-open-knowledge-map="${raw(id)}" class="secondary-btn">在地图页查看 →</button>`;
  }else if(collection==='chapters'){
    content+=section('路线',store.database.adventure.routes[r.route]);content+=section('章节名称',r.name_en);for(const b of r.battles)content+=section('战斗',b.name)+section('胜利条件',b.victory)+section('失败条件',b.defeat);
  }else if(collection==='paralogues'){
    content+=section('人物',knownName(r.character))+section('触发地点',r.trigger)+section('报酬',r.rewards);content+=section('接受期限',r.availability.map(a=>`${store.database.adventure.routes[a.route]} · 第 ${a.chapter} 章 · ${a.window}`).join('；'));content+=section('自动开始日期',r.forced_start);
  }else{
    if(r.growth||r.growth_bonus)content+=stats(r.growth||r.growth_bonus);
    const fields={name:'人物',partner:'支援对象',rank:'支援等级',skill_level:'所需熟练度',magic:'魔法类型',spell:'法术',gift:'礼物',skill:'技能',kind:'偏好',personal_ability:'个人技能',personal_ability_zh:'个人技能',art:'战技',range:'射程',blaze:'炎消耗',learned:'习得条件',mark:'血印',holders:'持有者',summary:'说明',why:'培养说明',target_class:'目标职业',window:'接受期',route:'路线',character:'人物',title:'标题',note:'说明'};
    for(const [key,label]of Object.entries(fields)){const value=r[key];if(typeof value==='string')content+=section(label,['name','partner','character'].includes(key)?knownName(value):key==='route'?store.database.adventure.routes[value]||value:value);}
    if(Array.isArray(r.facts))content+=section('要点',r.facts.join('；'));
    if(Array.isArray(r.recruitment))content+=section('招募条件',r.recruitment.map(a=>`${a.route||''} ${a.timing||''} ${a.condition||a.note||''}`).join('；'));
    if(r.path&&collection==='portraits')content+=`<img class="knowledge-portrait" src="${raw(r.path)}" alt="${esc(item.title)}头像" /><p>${esc(r.width)} × ${esc(r.height)}</p>`;
  }
  q('#knowledgeDetail').innerHTML=`<span class="small-label">${esc(store.collection(collection).label)}</span><h2>${esc(item.title)}</h2>${content||'<p>该条资料目前只有名称，详细字段待补。</p>'}`;
  q('#knowledgeDetail').querySelectorAll('[data-related-ability]').forEach(b=>b.addEventListener('click',()=>window.openKnowledgeRecord(b.dataset.relatedCollection,b.dataset.relatedAbility)));
  q('[data-related-class]')?.addEventListener('click',e=>window.openKnowledgeRecord('classes',e.currentTarget.dataset.relatedClass));
  q('#knowledgeResults').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.recordId===id));
  q('[data-open-knowledge-map]')?.addEventListener('click',e=>{location.hash='#maps';document.querySelector('[data-adventure-tab="regions"]').click();document.querySelector(`[data-region="${e.currentTarget.dataset.openKnowledgeMap}"]`).click();});
}
function browseRecords(collection,category='',needle=''){
  const rows=[];let skip=0,page;
  do{page=store.search({collection,q:needle,limit:100,offset:skip});rows.push(...page.records);skip+=100;}while(page.has_more);
  const filtered=category?rows.filter(r=>r.record.category===category):rows;
  if(!['material_profiles','weapon_profiles'].includes(collection))return filtered;
  const grouped=new Map();
  for(const row of filtered){
    const key=row.record.name_en,previous=grouped.get(key);
    if(!previous||row.record.acquisition_status==='specific_article_rules_available'||Object.hasOwn(row.record,'hit'))grouped.set(key,row);
  }
  return [...grouped.values()];
}
const categoryHref=c=>'#library?'+new URLSearchParams({collection:c.collection,...(c.category?{category:c.category}:{})});
function renderCatalog(){
  const categories=window.FE_CATALOG_CATEGORIES;
  q('#libraryCatalogCards').innerHTML=categories.map(c=>`<a data-catalog="${c.id}" href="${categoryHref(c)}"><div><strong>${esc(c.title)}</strong><span>${browseRecords(c.collection,c.category).length} ${['fish','ore','ingredients','weapons','gifts','items','battle-items','licenses'].includes(c.id)?'种':'条'}</span></div><p>${esc(c.description)}</p></a>`).join('');
  const gifts=browseRecords('gift_profiles').length,fish=browseRecords('material_profiles','fish').length;
  q('#homeCatalogLinks').innerHTML=[['gifts','礼物'],['fish','鱼类'],['ore','矿石'],['ingredients','食材'],['weapons','武器与法术']].map(([id,title])=>{const c=categories.find(c=>c.id===id);return `<a data-home-catalog="${id}" href="${categoryHref(c)}">${title}<span>${browseRecords(c.collection,c.category).length}</span></a>`;}).join('')+'<a href="#library">全部资料 →</a>';
  const date=new Date(store.database.updated_at).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'});
  q('#libraryInventory').textContent=`已收录 ${gifts} 件礼物 · ${fish} 种鱼类 · ${store.database.classes.length} 个职业 · 资料更新 ${date}`;
}
async function search(reset=true){
  if(reset)offset=0;
  const token=++queryGeneration;
  try{
    await load();if(token!==queryGeneration)return;
    const collection=q('#knowledgeCollection').value,category=collection==='material_profiles'?q('#knowledgeCategory').value:'';
    q('#knowledgeCategoryLabel').hidden=collection!=='material_profiles';
    const matching=window.FE_CATALOG_CATEGORIES.find(c=>c.collection===collection&&(c.category||'')===category);
    q('#knowledgeHeading').textContent=matching?.title||store.collection(collection).label;
    q('#libraryCatalogCards').querySelectorAll('a').forEach(a=>{const active=a.dataset.catalog===matching?.id;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
    const rows=browseRecords(collection,category,q('#knowledgeSearch').value);total=rows.length;
    const records=rows.slice(offset,offset+12),hasMore=offset+12<total;
    status(`共 ${total} ${['material_profiles','weapon_profiles','gift_profiles'].includes(collection)?'种':'条'}资料${total?` · 当前 ${offset+1}–${Math.min(offset+12,total)}`:''}`);
    q('#knowledgeResults').innerHTML=records.map(r=>`<button type="button" data-record-id="${raw(r.id)}"><strong>${esc(r.title)}</strong><span>${esc(r.summary)}</span></button>`).join('')||'<p>没有找到匹配资料，换一个关键词试试。</p>';
    q('#knowledgeResults').querySelectorAll('button').forEach(b=>b.onclick=()=>{detail(collection,b.dataset.recordId);if(matchMedia('(max-width:680px)').matches){q('#knowledgeDetail').focus({preventScroll:true});q('#knowledgeDetail').scrollIntoView({block:'start',behavior:'instant'});}});
    q('#knowledgePrev').disabled=offset===0;q('#knowledgeNext').disabled=!hasMore;
    if(records.length)detail(collection,records[0].id);else q('#knowledgeDetail').innerHTML='<p>选择一条资料查看内容。</p>';
  }catch{if(token===queryGeneration)status('资料暂未载入，请重试。');}
}
q('#knowledgeForm').onsubmit=e=>{e.preventDefault();search();};
q('#knowledgeCollection').onchange=()=>{q('#knowledgeCategory').value='';search();};q('#knowledgeCategory').onchange=()=>search();
q('#knowledgePrev').onclick=()=>{offset=Math.max(0,offset-12);search(false);};q('#knowledgeNext').onclick=()=>{offset+=12;search(false);};
q('[data-library-tab="query"]').addEventListener('click',()=>{if(!store)search();});
async function libraryRoute(){
  const token=++libraryGeneration;
  try{
    await load();if(token!==libraryGeneration)return;
    if(!location.hash.startsWith('#library'))return;
    const params=new URLSearchParams(location.hash.split('?')[1]||''),collection=params.get('collection')||'gift_profiles';
    q('[data-library-tab="query"]').click();
    if(excluded.has(collection)||!store.collections.has(collection)){status('没有找到这个资料分类。');return;}
    q('#knowledgeCollection').value=collection;q('#knowledgeCategory').value=collection==='material_profiles'?params.get('category')||'':'';q('#knowledgeSearch').value=params.get('q')||'';
    await search();if(token!==libraryGeneration)return;
    if(params.get('record'))detail(collection,params.get('record'));
  }catch{status('资料暂未载入，请重试。');}
}
window.openKnowledgeRecord=async(collection,id)=>{
  const next='#library?'+new URLSearchParams({collection,record:id});
  if(location.hash!==next)location.hash=next;
  await libraryRoute();
};
window.addEventListener('hashchange',libraryRoute);
load().then(()=>{if(location.hash.startsWith('#library'))libraryRoute();}).catch(()=>{q('#libraryInventory').innerHTML='资料暂未载入。<button id="catalogRetry" type="button" class="secondary-btn">重新载入</button>';q('#catalogRetry').onclick=()=>load().then(libraryRoute);});
