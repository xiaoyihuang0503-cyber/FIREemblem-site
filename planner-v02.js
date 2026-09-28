(() => {
  const chars = window.FE_CHARACTERS || [];
  const classes = window.FE_CLASSES || [];
  const sources = window.FE_SOURCES || {};
  const q = selector => document.querySelector(selector);
  const ranks = ['E', 'E+', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S'];
  const labels = {swords:'剑术',spears:'枪术',axes:'斧术',bows:'弓术',gauntlets:'格斗',white_magic:'白魔法',black_magic:'黑魔法',riding:'骑术',flying:'飞行',armor:'重装'};
  const directions = {
    speed:{label:'高速输出',core:['str','spd','dex'],secondary:['hp','def'],words:'力量、速度、技巧'},
    burst:{label:'物理爆发',core:['str','dex','hp'],secondary:['spd','def'],words:'力量、技巧、生命'},
    tank:{label:'前排坦克',core:['hp','def','res'],secondary:['str','spd'],words:'生命、防御、魔防'},
    balanced:{label:'均衡培养',core:['str','spd','hp'],secondary:['dex','def'],words:'力量、速度、生命'}
  };
  const statLabels = {hp:'生命',str:'力量',mag:'魔力',spd:'速度',dex:'技巧',def:'防御',res:'魔防',lck:'幸运',cha:'魅力'};
  const html = value => String(window.FE_t?.(value) ?? value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ix = rank => Math.max(0, ranks.indexOf(rank));
  const cls = id => classes.find(item => item.id === id);
  const complete = req => Object.entries(req || {}).every(([key, need]) => ix(q(`[data-skill="${key}"]`)?.value || 'E') >= ix(need));
  const reqText = req => Object.entries(req || {}).map(([key, rank]) => `${labels[key] || key} ${rank}`).join(' / ') || '无技能门槛';
  const skillAdvice = key => {
    if (['riding','flying','armor'].includes(key)) return `把每周可用训练优先分给${labels[key]}，并检查当前职业是否能加快这项熟练度。`;
    if (['white_magic','black_magic'].includes(key)) return `在实战中使用${labels[key]}，空闲训练也优先投到这项短板。`;
    return `实战尽量使用${labels[key]}对应武器；训练机会留给这一阶段最难补的等级。`;
  };
  const rankGaps = (req, from) => Object.entries(req || {}).filter(([key, need]) => ix(from?.[key] || 'E') < ix(need)).map(([key, need]) => ({key, have:from?.[key] || 'E', need}));
  const currentRanks = () => Object.fromEntries(Object.keys(labels).map(key => [key, q(`[data-skill="${key}"]`)?.value || 'E']));
  const classSource = sources.gamixo_classes?.url || '#';
  let growthAuditGeneration = 0;
  async function showGrowthAudit(characterId) {
    const token = ++growthAuditGeneration;
    q('.planner-data-note')?.remove();
    try {
      if (!window.FEGetStore) await new Promise(resolve => setTimeout(resolve, 0));
      if (!window.FEGetStore) return;
      const store = await window.FEGetStore();
      if (token !== growthAuditGeneration || q('#plannerCharacter').value !== characterId) return;
      const context = store.characterContext(characterId);
      if (!context?.growth_differences?.length) return;
      const fields = context.growth_differences.map(d => statLabels[d.stat] || d.stat).join('、');
      const note = document.createElement('p');
      note.className = 'planner-data-note';
      note.textContent = `${context.character.name_zh || context.character.name_en}的${fields}成长记录存在差异。当前路线按熟练度资格规划，不根据有争议的成长值计算收益；请在人物档案对照数值。`;
      q('#routeSummary').insertAdjacentElement('afterend', note);
    } catch { /* The qualification route remains usable when the catalog is unavailable. */ }
  }

  function stageClass(id, exit, why, masteryNote, next, extra) {
    return {kind:'class', classId:id, exit, why, masteryNote, next, extra};
  }
  function cavalryStages(direction) {
    const speed = direction === 'speed';
    if (direction === 'tank') return [
      stageClass('ornius_rider',{riding:'D',axes:'C',spears:'C'},'先取得骑兵基础，再把枪与斧练到重骑支线所需等级。','Offense Basics 若顺路精通可以拿；赶重骑资格可跳过。','Armored Ornius Rider'),
      stageClass('armored_ornius_rider',{riding:'D',axes:'B',spears:'B',armor:'E+'},'这一站把斧、枪、骑术一起练；重装是后续 Cataphract 的额外成本。','Sense Threat 偏生存；计划长期站前排时可考虑精通。','Cataphract'),
      stageClass('cataphract',{riding:'D',axes:'A',spears:'A',armor:'D'},'把斧推进到 A，继续积累防护向职业经验，同时核对任务门槛。','Pavise 偏物理防护；愿意付出停留时间时可拿。','Great Knight'),
      stageClass('great_knight',{riding:'A',axes:'S',spears:'S',swords:'S'},'斧枪主线到位后补剑；终点仍要求骑 A 与三武器 S。','Fierce Shield 可选；拿完资格后是否停留取决于前排需求。','The Cavalier')
    ];
    return [
      stageClass('ornius_rider',{riding:'D',spears:'C',swords:'C'},'先拿骑兵移动框架，并开始练终点需要的骑术与枪术。','Offense Basics 有已列出的精通效果；若顺路练满可以拿，赶进度可直接走。','Light Cavalry'),
      stageClass('light_cavalry',{riding:'C',spears:'B',swords:'B'},'同时补剑、枪和骑术，避免后期把三项短板集中硬刷。','Bolster Health 增加 生命；追求耐久可拿，最快路线可跳过。','Bardinger'),
      stageClass('bardinger',{riding:'B',spears:'A',swords:'A'},'这一站让剑、枪和骑术继续一起推进，是通往 Orichaldia 的顺路中转。','Aegis 偏防护；前排长期使用时可考虑精通，追求成型速度可跳过。','Orichaldia'),
      stageClass('orichaldia',{riding:'A',spears:'A',swords:'A'},'骑术与剑枪主线在这里基本成形；现在开始把注意力转向斧术。','精通收益由职业数据页核对；不把精通当作转 The Cavalier 的硬前置。','补斧分支'),
      {kind:'branch',title:'补斧｜选择一条适合你的支线',exit:{axes:'S',swords:'S',spears:'S',riding:'A'},why:speed?'高速方向优先保证力量、速度、技巧的升级质量，同时把斧术补到终点要求。':'斧术是终点的主要短板，重骑支线可以把斧术与耐久培养放在一起。',next:'The Cavalier',options:[
        '直接补斧：少练一项重装，职业绕路较短；具体练多久取决于当前熟练度。',
        '重骑支线：Armored Ornius Rider → Cataphract → Great Knight。顺路练斧并拿防护向精通；代价是额外练重装，且部分职业有路线或任务门槛。'
      ]}
    ];
  }
  function scoreCandidate(candidate, target) {
    const own = candidate.requirements || {}, goal = target.requirements || {};
    const shared = Object.keys(own).filter(key => key in goal && ix(own[key]) <= ix(goal[key]));
    const extra = Object.keys(own).filter(key => !(key in goal));
    return shared.length * 5 - extra.length * 4 - Object.keys(own).length * .25;
  }
  function genericStages(target, mode) {
    const goal = target.requirements || {};
    if (mode === 'fastest') return [{kind:'training',title:'资格训练｜先补终点的硬条件',exit:goal,why:`${target.name_en} 可通过资格考试进入；中间职业不自动成为硬前置。`,next:target.name_en}];
    const targetTier = ['base','beginner','specialty','advanced','master','divine'].indexOf(target.tier);
    const tiers = ['beginner','specialty','advanced','master'].filter(t => ['base','beginner','specialty','advanced','master','divine'].indexOf(t) < targetTier);
    const picks = tiers.map(tier => classes.filter(item => item.tier === tier && item.id !== target.id && !item.restriction)
      .map(item => ({item,score:scoreCandidate(item,target)})).filter(x => x.score >= 4)
      .sort((a,b) => b.score-a.score)[0]?.item).filter(Boolean).slice(-3);
    const list = picks.map((item,index) => stageClass(item.id,picks[index+1]?.requirements || goal,
      `这项职业与 ${target.name_en} 共用部分技能要求，可作为顺路训练候选；是否考试取决于当前资格和解锁条件。`,
      item.mastery ? `精通 ${item.mastery} 可作为可选目标；若只求最终职业资格，可以不等精通。` : '未记录可核准的精通收益，不把停留时间写死。',
      picks[index+1]?.name_en || target.name_en));
    if (!list.length) list.push({kind:'training',title:'资格训练｜从当前状态补短板',exit:goal,why:'资料里没有足够可靠的顺路中转，先按终点资格训练。',next:target.name_en});
    return list;
  }
  function state() {
    const char = chars.find(c => c.id === q('#plannerCharacter').value);
    return {char,target:cls(q('#targetClass').value),currentClass:cls(q('#currentClass').value),level:Number(q('#currentLevel').value) || 1,
      route:q('#currentRoute').value,part:Number(q('#currentPart').value),direction:q('#buildDirection').value,
      mode:q('.mode-tab.active')?.dataset.mode || 'fastest',ranks:currentRanks()};
  }
  function selectedStages(s) {
    const base = s.target.id === 'the_cavalier' && s.mode !== 'fastest' ? cavalryStages(s.direction) : genericStages(s.target,s.mode);
    return base.filter(item => !complete(item.exit) || (item.classId && s.currentClass?.id === item.classId));
  }
  function stageMarkup(item,index,s,previous) {
    const c = item.classId ? cls(item.classId) : null;
    const entry = c?.requirements || {};
    const remaining = rankGaps(item.exit,s.ranks);
    const milestone = Object.entries(item.exit || {}).map(([key,need]) => `<span class="pill ${ix(s.ranks[key]) >= ix(need) ? 'ok':'missing'}">${html(labels[key] || key)} ${html(s.ranks[key])} → ${html(need)}</span>`).join('');
    const practical = remaining.length ? remaining.map(({key}) => skillAdvice(key)).join(' ') : '这一阶段的熟练度目标已达成；若精通也已拿到，可以继续下一站。';
    const direction = directions[s.direction] || directions.speed;
    const source = `职业资格与熟练度要求已整理；培养建议供路线规划使用。`;
    const unlock = c?.unlock && !['automatic','starting class','story tier unlock'].includes(c.unlock) ? `<p class="stage-caveat">解锁条件：${html(c.unlock)}</p>` : '';
    const options = item.options?.length ? `<div class="stage-options">${item.options.map(o => `<p>${html(o)}</p>`).join('')}</div>` : '';
    return `<article class="route-node stage-card" style="animation-delay:${index*45}ms">
      <span class="step mono">阶段 ${String(index+1).padStart(2,'0')} / ${c ? html(c.tier.toUpperCase()) : '训练'}</span>
      <h3>${html(item.title || (c ? c.name_en : '训练阶段'))}</h3>
      <p class="stage-why">${html(item.why)}</p>
      <div class="stage-grid">
        <div><h4>进入条件</h4><p>${html(c ? reqText(entry) : '按当前状态直接训练')}</p>${unlock}</div>
        <div><h4>这一段练什么</h4><div class="reqs">${milestone || '<span class="pill ok">已达成</span>'}</div></div>
        <div><h4>怎么练</h4><p>${html(practical)}</p></div>
        <div><h4>升级时看什么</h4><p>${html(direction.words)}优先；职业成长修正未核准，暂不承诺具体加点。</p></div>
        <div><h4>精通要不要拿</h4><p>${html(item.masteryNote || (c?.mastery ? `可选：${c.mastery}。赶终点资格时不必为了精通停留。` : '无已核准的必拿精通。'))}</p></div>
        <div><h4>什么时候离开</h4><p>${html(remaining.length ? `达到 ${reqText(item.exit)} 后，检查下一站 ${item.next || s.target.name_en} 的等级、任务和考试条件。` : `熟练度已满足，可检查 ${item.next || s.target.name_en} 的解锁条件。`)}</p></div>
      </div>${options}<div class="stage-source mono">${source}</div>
    </article>`;
  }
  function completeMarkup(s) {
    if (s.mode !== 'complete') return '';
    const direction = directions[s.direction] || directions.speed;
    return `<article class="route-node stage-card complete-card"><span class="step mono">多路线 / 可选</span><h3>多路线分工</h3>
      <div class="stage-grid"><div><h4>主路线</h4><p>先把 ${html(s.target.name_en)} 的资格练齐，围绕${html(direction.words)}升级。</p></div>
      <div><h4>另一条路线</h4><p>选择不同职业拿另一组属性或精通，避免重复培养同一方向。</p></div>
      <div><h4>合并前核对</h4><p>记录各路线属性、熟练度、精通和战技。公开攻略称合并后逐项取较高值，具体以游戏内结果为准。</p></div></div>
      <div class="stage-source mono">因果合并 · 仍需游戏内核对</div></article>`;
  }
  function renderTraining(s) {
    const req = s.target.requirements || {};
    q('#trainingPlan').innerHTML = `<div class="extra-head"><span class="mono small-label">熟练度训练</span><h2>熟练度训练清单</h2></div>
      <p>按当前输入计算目标等级差距。尚无可验证的 经验 阈值，因此不估算周数或竞技场次数。</p>
      <div class="training-list">${Object.entries(req).map(([key,need]) => {
        const have = s.ranks[key] || 'E', done = ix(have) >= ix(need);
        return `<div class="training-row"><strong>${html(labels[key] || key)}</strong><span class="mono">${html(have)} → ${html(need)}</span><span>${done ? '已满足' : html(skillAdvice(key))}</span></div>`;
      }).join('') || '<p>这个职业没有技能等级门槛。</p>'}</div>`;
  }
  function renderMastery(stages) {
    const named = stages.map(x => cls(x.classId)).filter(c => c?.mastery);
    q('#masteryPlan').innerHTML = `<div class="extra-head"><span class="mono small-label">精通取舍</span><h2>精通取舍</h2></div>
      <p>职业精通不是默认的转职前置。决定拿精通时，在游戏里确认进度后再切职。</p>
      <div class="mastery-list">${named.map(c => `<div><strong>${html(c.name_en)}</strong><span>${html(c.mastery)}</span><small>可选；以当前培养方案 的用途决定是否停留</small></div>`).join('') || '<p>当前路线没有必须停留的中转职业精通。</p>'}</div>`;
  }
  function renderRoute() {
    const s = state(); if (!s.char || !s.target) return;
    const stages = selectedStages(s);
    const gaps = rankGaps(s.target.requirements,s.ranks);
    const focus = directions[s.direction] || directions.speed;
    q('#routeSummary').className = 'route-summary show';
    q('#routeSummary').innerHTML = `<div class="metric"><span>当前角色</span><strong>${html(s.char.name_zh || s.char.name_en)}</strong></div>
      <div class="metric"><span>培养方向</span><strong>${html(focus.label)}</strong></div>
      <div class="metric"><span>终点资格缺口</span><strong>${gaps.length} 项</strong></div>`;
    showGrowthAudit(s.char.id);
    q('#routeTimeline').innerHTML = `<article class="route-node current"><span class="step mono">当前状态</span><h3>${html(s.currentClass?.name_en || '当前职业')} · 等级 ${s.level}</h3><p>${html(s.char.name_zh || s.char.name_en)} / ${html(s.route)} / 第 ${s.part} 部。路线从这份输入重新计算。</p></article>`
      + stages.map((item,index) => stageMarkup(item,index,s)).join('') + completeMarkup(s)
      + `<article class="route-node target"><span class="step mono">目标职业</span><h3>${html(s.target.name_en)}</h3><p>资格：${html(reqText(s.target.requirements))}。${s.target.unlock ? `解锁：${html(s.target.unlock)}。` : ''}${s.target.restriction ? `限制：${html(s.target.restriction)}。` : ''}</p><div class="reqs">${Object.entries(s.target.requirements || {}).map(([key,need]) => `<span class="pill ${ix(s.ranks[key]) >= ix(need) ? 'ok':'missing'}">${html(labels[key] || key)} ${html(need)}</span>`).join('')}</div></article>`;
    renderTraining(s); renderMastery(stages); checkLevel();
  }
  function checkLevel() {
    const selected = [...document.querySelectorAll('#levelStats input:checked')].map(input => input.value);
    const focus = directions[q('#buildDirection').value] || directions.speed;
    const core = selected.filter(key => focus.core.includes(key)).length;
    const strictness = q('#rerollStrictness').value;
    let verdict = '先勾选本次升级实际增加的属性。';
    if (selected.length) {
      if (strictness === 'light') verdict = selected.length <= 1 ? '可以考虑重试：这次总加点较少。' : '建议接受：轻度策略优先减少反复凹点。';
      if (strictness === 'normal') verdict = selected.length <= 2 && core === 0 ? `建议重试：只加了 ${selected.length} 项，且没有${focus.words}。` : selected.length >= 3 ? '建议接受：本次总加点较多。' : '看个人取舍：总加点不多，但包含当前方向的重点属性。';
      if (strictness === 'hard') verdict = core >= 2 ? '建议接受：至少两项重点属性得到提升。' : `建议重试：当前方向优先${focus.words}，本次只命中 ${core} 项。`;
    }
    q('#levelResult').textContent = verdict + (selected.length ? ' 这只是培养策略；实际重试方式与结果请以游戏内验证为准。' : '');
  }
  function saveProgress() {
    const s = state(); if (!s.char) return;
    const record = {currentClass:s.currentClass?.id,level:s.level,route:s.route,part:s.part,direction:s.direction,mode:s.mode,target:s.target?.id,ranks:s.ranks};
    try { localStorage.setItem(`fe-build-v02:${s.char.id}`,JSON.stringify(record)); q('#progressStatus').textContent = `已保存 ${s.char.name_zh || s.char.name_en} 的进度到当前浏览器。`; }
    catch { q('#progressStatus').textContent = '当前浏览器没有允许本地保存，请继续手动填写。'; }
  }
  function loadProgress() {
    const id = q('#plannerCharacter').value; let record;
    try { record = JSON.parse(localStorage.getItem(`fe-build-v02:${id}`) || 'null'); } catch { record = null; }
    if (!record) {
      q('#currentClass').value='commoner';q('#currentLevel').value=1;q('#currentRoute').value='Cai';q('#currentPart').value='1';
      q('#buildDirection').value='speed';q('#targetClass').value='war_monk';
      Object.keys(labels).forEach(key=>q(`[data-skill="${key}"]`).value='E');
      document.querySelectorAll('.mode-tab').forEach(b=>b.classList.toggle('active',b.dataset.mode==='fastest'));
      q('#progressStatus').textContent = '这个角色尚未保存进度；只会保存在当前浏览器。'; renderRoute(); return;
    }
    const set = (selector,value) => { const el=q(selector); if (el && value != null && [...el.options || []].some(option => option.value === String(value))) el.value=value; };
    set('#currentClass',record.currentClass); q('#currentLevel').value = record.level || 1;
    set('#currentRoute',record.route); set('#currentPart',record.part); set('#buildDirection',record.direction); set('#targetClass',record.target);
    Object.entries(record.ranks || {}).forEach(([key,value]) => set(`[data-skill="${key}"]`,value));
    document.querySelectorAll('.mode-tab').forEach(button => button.classList.toggle('active',button.dataset.mode === record.mode));
    q('#progressStatus').textContent = '已读取这个角色保存在当前浏览器的进度。'; renderRoute();
  }
  q('#levelStats').innerHTML = Object.entries(statLabels).map(([key,label]) => `<label class="stat-${key}"><input type="checkbox" value="${key}"><span>${label}</span></label>`).join('');
  q('#saveProgress').addEventListener('click',saveProgress);
  q('#plannerCharacter').addEventListener('change',loadProgress);
  q('#generateRoute').onclick = renderRoute;
  q('#checkLevel').addEventListener('click',checkLevel);
  q('#rerollStrictness').addEventListener('change',checkLevel);
  q('#buildDirection').addEventListener('change',renderRoute);
  document.querySelectorAll('.mode-tab').forEach(button => button.addEventListener('click',renderRoute));
  document.querySelectorAll('.preset-card').forEach(card => card.onclick = () => {
    const preset = (window.FE_PRESETS || []).find(p => p.id === card.dataset.preset);
    const mu = chars.find(c => c.name_en === 'Mu'); if (!preset || !mu) return;
    q('#plannerCharacter').value = mu.id; q('#plannerCharacter').dispatchEvent(new Event('change'));
    const target = classes.find(c => c.name_en.toLowerCase() === preset.target_class.toLowerCase());
    if (target) q('#targetClass').value = target.id;
    location.hash = 'planner'; renderRoute();
  });
  loadProgress();
})();
