(() => {
  const db=window.FE_OVERSEAS_DATABASE;
  if(!db)return;
  const q=s=>document.querySelector(s);
  const escape=v=>String(window.FE_t?.(v)??v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stats={hp:'生命',str:'力量',mag:'魔力',spd:'速度',dex:'技巧',def:'防御',res:'魔防',lck:'幸运',cha:'魅力'};
  const known=new Map((window.FE_CHARACTERS||[]).map(c=>[c.name_en,c]));
  const skillNames={'Flying Skill':'飞行','Spear Skill':'枪术','Sword Skill':'剑术','Axe Skill':'斧术','Black Magic Skill':'黑魔法','White Magic Skill':'白魔法','Rider Skill':'骑术','Riding Skill':'骑术','Heavy Skill':'重装','Heavy Armor Skill':'重装','Infantry Skill':'步兵','Bow Skill':'弓术','Gauntlet Skill':'格斗'};
  const displayName=n=>known.get(n)?.name_zh || n;
  const skillName=n=>skillNames[n] || n;
  const link=url=>/^https:\/\//.test(url||'')?escape(url):'#';
  const list=(items,empty='暂未收录')=>items.length?`<div class="fact-chips">${items.map(x=>`<span>${escape(x)}</span>`).join('')}</div>`:`<p class="missing-fact">${empty}</p>`;
  q('#overseasCharacter').innerHTML=db.characters.map(c=>`<option value="${escape(c.name_en)}">${escape(displayName(c.name_en))}${known.has(c.name_en)?' / '+escape(c.name_en):' · 补充人物'}</option>`).join('');
  q('#overseasCharacter').value='Cai';
  q('#overseasCounts').textContent=`${db.characters.length} 人物 · ${db.classes.length} 职业 · ${db.supports.length} 支援记录`;
  function renderCharacter(){
    const c=db.characters.find(c=>c.name_en===q('#overseasCharacter').value);if(!c)return;
    const local=known.get(c.name_en);
    const differences=local?Object.keys(stats).filter(key=>local.growth?.[key]!=null&&c.growth?.[key]!=null&&local.growth[key]!==c.growth[key]):[];
    const supports=db.supports.filter(x=>x.name===c.name_en);
    const spells=db.spells.filter(x=>x.name===c.name_en);
    const gifts=db.gifts.filter(x=>x.name===c.name_en);
    const blaze=db.blaze_arts.filter(x=>x.name===c.name_en);
    const marks=db.bloodmarks.filter(x=>x.name===c.name_en);
    q('#overseasCharacterDetail').innerHTML=`<div class="profile-identity">${local?window.renderCharacterAvatar(local):''}<div><span class="small-label mono">支援与收集</span><h2>${escape(displayName(c.name_en))}</h2><p>${escape(c.name_en)} · ${escape(c.faction||'阵营待补')}</p></div></div>
      <p class="source-difference">人物关联资料。${local?'可查询支援、魔法与礼物偏好。':'暂作为补充人物档案；培养方案尚未开放。'}${c.name_en==='Mu'?' 穆的成长口径还需区分个人技能生效状态。':''}</p>
      <h3>人物成长率</h3><div class="growth-grid">${Object.entries(stats).map(([key,name])=>`<div class="growth-cell stat-${key}"><small>${name}</small><strong>${c.growth[key]??'—'}${c.growth[key]!=null?'%':''}</strong></div>`).join('')}</div>
      ${differences.length?`<div class="source-difference"><strong>与站内默认成长值不同</strong><p>${differences.map(key=>`${stats[key]}：站内 ${local.growth[key]}% / 对照表 ${c.growth[key]}%`).join('；')}。保留两组记录，待游戏内核对。</p></div>`:''}
      <div class="overseas-fact-grid"><section><h3>擅长技能</h3>${list(c.preferred_skills.map(skillName))}<h3>不擅长技能</h3>${list(c.nonideal_skills.map(skillName))}<h3>个人技能名</h3><p>${escape(c.personal_ability||'待补')}</p></section>
      <section><h3>支援对象与上限</h3>${list(supports.map(x=>`${displayName(x.partner)} · ${x.rank}`))}</section>
      <section><h3>习得法术</h3>${spells.length?`<ul class="overseas-fact-list">${spells.map(x=>`<li><strong>${escape(x.skill_level)}</strong><span>${escape(x.spell)} · ${escape(x.magic)}</span></li>`).join('')}</ul>`:'<p class="missing-fact">暂未收录</p>'}</section>
      <section><h3>偏好礼物</h3>${list(gifts.map(x=>x.gift))}</section></div>
      ${blaze.length?`<h3>炎之战技索引</h3><ul class="overseas-fact-list">${blaze.map(x=>`<li><strong>${escape(x.art)}</strong><span>范围 ${escape(x.range)} · 消耗 ${escape(x.blaze)} · 习得 ${escape(x.learned)}</span></li>`).join('')}</ul>`:''}
      ${marks.length?`<h3>血印索引</h3>${list(marks.map(x=>x.mark))}`:''}
`;
  }
  window.openOverseasCharacter=name=>{if(db.characters.some(c=>c.name_en===name)){q('#overseasCharacter').value=name;renderCharacter();document.querySelector('[data-library-tab="overseas"]').click();location.hash='library'}};
  const normalize=n=>String(n).toLowerCase().replace(/[\s_-]/g,'').replace('caldarius','caladrius');
  window.renderOverseasClassDetails=()=>{
    document.querySelectorAll('.class-row[data-class-id]').forEach(row=>{
      if(row.querySelector('.class-extra'))return;
      const local=(window.FE_CLASSES||[]).find(c=>c.id===row.dataset.classId);
      const c=db.classes.find(c=>normalize(c.name_en)===normalize(local?.name_en));if(!c)return;
      const details=document.createElement('details');details.className='class-extra';
      details.innerHTML=`<summary>成长加成与职业技能</summary><div class="class-extra-body"><p class="class-data-note">数值尚未逐项游戏内复核。成长修正使用百分点，加到人物基础成长上。</p><div class="class-growth-grid">${Object.entries(stats).map(([key,name])=>`<div class="stat-${key}"><small>${name}</small><strong>${c.growth_bonus[key]!=null?(c.growth_bonus[key]>0?'+':'')+c.growth_bonus[key]+'%':'—'}</strong></div>`).join('')}</div><p><strong>职业技能：</strong>${escape(c.class_ability||'待补')}<br><strong>精通技能：</strong>${escape(c.master_ability||'待补')}<br><strong>熟练度加成：</strong>${escape(c.skill_exp_bonus||'待补')}<br><strong>移动 / 类型：</strong>${escape(c.movement||'待补')} / ${escape(c.type||'待补')}</p></div>`;
      row.append(details);
    });
  };
  q('#overseasCharacter').addEventListener('change',renderCharacter);
  renderCharacter();window.renderOverseasClassDetails();
})();
