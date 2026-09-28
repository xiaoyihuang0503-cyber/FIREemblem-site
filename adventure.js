(() => {
  const db = window.FE_ADVENTURE;
  if (!db) return;
  const q = s => document.querySelector(s);
  const esc = v => String(window.FE_t?.(v) ?? v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names = new Map((window.FE_CHARACTERS || []).map(c => [c.name_en,c.name_zh]));
  const name = en => names.get(en) || en;
  const kinds = {waypoint:'路点',port:'港口',search:'探索地点',dungeon:'迷宫',feast:'野餐点',oasis:'绿洲',checkpoint:'关卡',exit:'区域出口'};
  const savedKey = 'fe-adventure-progress-v1';
  let progress = {nodes:[],chapters:[],paralogues:[]};
  try { const p=JSON.parse(localStorage.getItem(savedKey)); if(p) for(const k of Object.keys(progress)) if(Array.isArray(p[k])) progress[k]=p[k].filter(x=>typeof x==='string'); } catch {}
  let storageFailed=false;
  function save() { try {localStorage.setItem(savedKey,JSON.stringify(progress));storageFailed=false;} catch {storageFailed=true;} }
  function toggle(k,id) {progress[k]=progress[k].includes(id)?progress[k].filter(x=>x!==id):[...progress[k],id];save();}
  let region=db.regions[0], zoom=100, selected=region.nodes.find(n=>n.kind==='oasis')?.id || region.nodes[0].id, routeEdges=[], pathNodes=[];
  let chapterId=db.chapters.find(c=>c.route==='Cai')?.id;
  const nodeName = n => n.label || `路点 ${region.nodes.indexOf(n)+1}`;
  const nodeById = id => region.nodes.find(n=>n.id===id);
  const directed = e => e.directed ?? e.kind !== 'permanent';
  const namedNodes = () => region.nodes.filter(n=>n.kind!=='waypoint');
  q('#mapRoute').value='Dietrich';
  function setTab(tab) {
    for(const id of ['regions','chapters','paralogues']) q('#'+id+'Panel').hidden=id!==tab;
    document.querySelectorAll('[data-adventure-tab]').forEach(b=>{const active=b.dataset.adventureTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
  }
  document.querySelectorAll('[data-adventure-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.adventureTab)));
  function available() {return q('#mapPart').value==='3' || region.access.includes(q('#mapRoute').value);}
  function enabled(e) {
    if(e.kind!=='conditional')return true;
    if(e.condition==='oasis_unlocked')return q('#mapCondition').checked;
    return q('#mapPart').value==='1' && q('#mapRoute').value==='Dietrich' && q('#mapCondition').checked;
  }
  function renderRegionTabs() {
    q('#mapRegionTabs').innerHTML=db.regions.map(m=>`<button type="button" data-region="${m.id}" aria-pressed="${m.id===region.id}" class="${m.id===region.id?'active':''}"><span class="mono">0${db.regions.indexOf(m)+1}</span><strong>${esc(m.title)}</strong><small>${m.nodes.filter(n=>n.kind!=='waypoint').length} 个地点</small></button>`).join('');
    q('#mapRegionTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>switchRegion(b.dataset.region));
  }
  function switchRegion(id) {
    region=db.regions.find(m=>m.id===id);selected=region.nodes.find(n=>n.kind==='oasis')?.id || region.nodes.find(n=>n.kind==='port')?.id || region.nodes[0].id;
    routeEdges=[];pathNodes=[];zoom=100;q('#mapCondition').checked=false;
    q('#mapPathResult').innerHTML='';q('#mapViewport').scrollLeft=0;q('#mapViewport').scrollTop=0;
    const options=namedNodes().map(n=>`<option value="${n.id}">${esc(nodeName(n))}</option>`).join('');
    q('#mapFrom').innerHTML=options;q('#mapTo').innerHTML=options;
    q('#mapFrom').value=region.id==='nysiades'?'gorbea':region.id==='lir'?'port':'danann';q('#mapTo').value=selected;
    q('#mapTitle').textContent=region.title;q('#mapEnglish').textContent='区域探索';q('#mapSubtitle').textContent=region.subtitle;
    q('#mapNotes').innerHTML=region.notes.map(n=>`<li>${esc(n)}</li>`).join('');
    const isDesert=region.id==='nysiades',isSea=region.id==='lir';
    q('#mapCondition').parentElement.hidden=!isDesert&&!isSea;
    q('#mapConditionLabel').textContent=isDesert?'已从东面抵达拜纳绿洲':'迪托利希第 8 章事件进行中';
    renderRegionTabs();renderMap();renderLocation();access();
  }
  function access() {
    const part=q('#mapPart').value,who=q('#mapRoute').value;
    const text=!available()?`当前路线在第一部无法进入${region.title}；第三部可探索。`:region.id==='lir'&&part==='1'&&who==='Dietrich'?'迪托利希仅在第 8 章海兽事件期间可以航行；绿色路线需该事件进行中。':`当前设置可探索${region.title}。`;
    q('#mapAccess').textContent=text;q('#mapAccess').classList.toggle('unavailable',!available());q('#findMapPath').disabled=!available();
    q('#mapCondition').disabled=region.id==='lir'&&(part!=='1'||who!=='Dietrich');
  }
  function renderMap() {
    const colors={permanent:'#53626b',temporary:'#c43c30',conditional:'#2f6b50'};
    const activeEdges=new Set(routeEdges);const activeNodes=new Set(pathNodes);
    const edgeHtml=region.edges.map((e,i)=>{
      const a=nodeById(e.a),b=nodeById(e.b),ok=enabled(e),active=activeEdges.has(i);
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),gap=directed(e)?20:12;
      return `<line class="map-edge ${active?'highlighted':''} ${ok?'':'locked'}" x1="${a.x+dx/len*12}" y1="${a.y+dy/len*12}" x2="${b.x-dx/len*gap}" y2="${b.y-dy/len*gap}" stroke="${active?'#24374f':colors[e.kind]}" stroke-width="${active?5:2.5}" ${e.kind==='conditional'?'stroke-dasharray="7 5"':''} ${directed(e)?`marker-end="url(#${active?'arrow-active':'arrow-'+e.kind})"`:''}/>`;
    }).join('');
    const nodeHtml=region.nodes.map(n=>{
      const visited=progress.nodes.includes(region.id+':'+n.id),isNamed=!!n.label,isSelected=n.id===selected;
      const fill=isSelected?'#c43c30':activeNodes.has(n.id)?'#24374f':visited?'#2f6b50':'#faf8f2';
      const shape=['port','oasis'].includes(n.kind)?`<path d="M0 -13 L12 -6 L12 7 L0 14 L-12 7 L-12 -6 Z"/>`:n.kind==='dungeon'?'<path d="M0 -14 L14 11 L-14 11 Z"/>':n.kind==='search'?'<rect x="-10" y="-10" width="20" height="20" rx="2"/>':`<circle r="${isNamed?11:6}"/>`;
      const labelY=n.id==='oasis'&&region.id==='nysiades'?34:n.y<50?34:-22;
      return `<g class="map-node ${isSelected?'selected':''}" transform="translate(${n.x} ${n.y})" role="button" tabindex="0" data-node="${n.id}" aria-label="${esc(nodeName(n))}${visited?'，已探索':''}"><title>${esc(nodeName(n))}${n.name_en?' / '+esc(n.name_en):''}</title><circle r="22" fill="transparent"/><g fill="${fill}" stroke="${isSelected?'#c43c30':'#53626b'}" stroke-width="2">${shape}</g>${visited?'<text y="4" text-anchor="middle" fill="#fff" font-size="12" aria-hidden="true">✓</text>':''}${isNamed?`<text y="${labelY}" text-anchor="middle" class="map-node-label">${esc(n.label)}</text>`:''}</g>`;
    }).join('');
    const svg=`<svg viewBox="-30 -25 1220 755" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="${esc(region.title)}地点与方向图"><defs>${['temporary','conditional','active'].map(k=>`<marker id="arrow-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${k==='active'?'#24374f':colors[k]}"/></marker>`).join('')}<pattern id="map-grid" width="35" height="35" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#c9c4b8"/></pattern></defs><rect x="-30" y="-25" width="1220" height="755" fill="url(#map-grid)"/><text x="22" y="710" class="map-watermark">${esc(region.name_en.toUpperCase())}</text><g>${edgeHtml}</g><g>${nodeHtml}</g></svg>`;
    q('#mapCanvas').innerHTML=svg;
    q('#mapCanvas').querySelectorAll('[data-node]').forEach(el=>{const select=()=>{selected=el.dataset.node;if(nodeById(selected).label)q('#mapTo').value=selected;routeEdges=[];pathNodes=[];q('#mapPathResult').innerHTML='';renderMap();renderLocation();q(`#mapCanvas [data-node="${selected}"]`)?.focus({preventScroll:true});};el.onclick=select;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};});
    const count=namedNodes().filter(n=>progress.nodes.includes(region.id+':'+n.id)).length;
    q('#mapProgress').textContent=storageFailed?'保存失败，当前进度仅临时保留':`${count} / ${namedNodes().length} 地点已探索`;
    applyZoom();
  }
  function applyZoom(){const base=Math.max(q('#mapViewport').clientWidth,900);q('#mapCanvas').style.width=(base*zoom/100)+'px';q('#mapZoomLevel').textContent=Math.round(zoom)+'%';}
  q('#mapZoomIn').onclick=()=>{zoom=Math.min(250,zoom+25);applyZoom();};q('#mapZoomOut').onclick=()=>{zoom=Math.max(25,zoom-25);applyZoom();};
  q('#mapZoomReset').onclick=()=>{zoom=Math.max(25,Math.min(100,(q('#mapViewport').clientWidth||900)/900*100));applyZoom();q('#mapViewport').scrollLeft=0;};
  window.addEventListener('resize',applyZoom);
  function renderLocation(){
    const n=nodeById(selected),visited=progress.nodes.includes(region.id+':'+n.id);
    const hint=n.id==='passage'?'第一部没有敌人或宝箱；第三部留意砂之宫殿。':n.id==='oasis'?'首次从东面抵达后，可勾选上方选项启用永久捷径。':n.kind==='checkpoint'?'沙漠边缘的关卡需名声 Lv.5。':n.id==='screams'?'迪托利希第 8 章的目标地点。先完成另外三个海域的搜索。':n.kind==='dungeon'?'进入前确认队伍状态与探索时间。':n.kind==='search'?'可搜索素材或调查地点，行动会推进回合。':n.kind==='feast'?'准备食材后可以恢复队伍状态并提升支援。':'';
    q('#mapLocationDetail').innerHTML=`<span class="small-label mono">${esc(kinds[n.kind])}</span><h3>${esc(nodeName(n))}</h3>${n.name_en?`<p class="location-en">${esc(n.name_en)}</p>`:''}${hint?`<p>${hint}</p>`:''}<button type="button" id="markMapNode" class="secondary-btn" aria-pressed="${visited}">${visited?'✓ 已探索 · 取消标记':'标记为已探索'}</button>`;
    q('#markMapNode').onclick=()=>{toggle('nodes',region.id+':'+n.id);renderLocation();renderMap();};
  }
  function findPath(){
    if(!available())return;
    const from=q('#mapFrom').value,to=q('#mapTo').value,queue=[from],seen=new Set([from]),parents=new Map();
    while(queue.length){const here=queue.shift();if(here===to)break;
      region.edges.forEach((e,i)=>{if(!enabled(e))return;const next=e.a===here?e.b:!directed(e)&&e.b===here?e.a:null;if(next&&!seen.has(next)){seen.add(next);parents.set(next,{prev:here,edge:i});queue.push(next);}});
    }
    routeEdges=[];pathNodes=[];
    if(!seen.has(to)){q('#mapPathResult').innerHTML='<p class="path-warning">当前条件下没有可达路线。检查单向箭头、已解锁的捷径，或更换出发地点。</p>';renderMap();return;}
    let at=to;pathNodes=[at];while(at!==from){const step=parents.get(at);routeEdges.unshift(step.edge);at=step.prev;pathNodes.unshift(at);}
    selected=to;const locations=pathNodes.map(nodeById).filter(n=>n.label);
    q('#mapPathResult').innerHTML=`<p class="path-success"><strong>${routeEdges.length} 段路径</strong> · ${esc(nodeName(nodeById(from)))} → ${esc(nodeName(nodeById(to)))}</p><ol>${locations.map(n=>`<li>${esc(nodeName(n))}</li>`).join('')}</ol><p class="path-caption">按初始连接寻找最短路线。走过的临时通路会消失，请自行避开；节点数不换算成回合数。</p>`;
    renderMap();renderLocation();
  }
  q('#findMapPath').onclick=findPath;q('#mapFrom').onchange=()=>{routeEdges=[];pathNodes=[];q('#mapPathResult').innerHTML='';renderMap();};
  q('#mapTo').onchange=()=>{selected=q('#mapTo').value;routeEdges=[];pathNodes=[];q('#mapPathResult').innerHTML='';renderMap();renderLocation();};
  [q('#mapRoute'),q('#mapPart'),q('#mapCondition')].forEach(el=>el.onchange=()=>{routeEdges=[];pathNodes=[];q('#mapPathResult').innerHTML='';access();renderMap();});

  function gameText(v){
    let t=String(v||'').replace(/\\u30fb/g,'・').replace(/\\u25[a-z0-9]{2}/gi,'').replace(/・/g,'\n').trim();
    const facts={
      'Defeat All of the Enemy Units':'击败所有敌人','Defeat all of the enemy units.':'击败所有敌人','Defeat all enemy units.':'击败所有敌人',
      'Get Theodora to the target destination.':'让赛奥朵拉抵达指定地点','Hold more orbs than the enemy after 12 turns pass.':'12 回合结束时，占有的宝珠数量多于敌军',
      'The enemy holds more orbs than you after 12 turns.':'12 回合结束时，敌军占有的宝珠数量多于我方',
      'The number of blue flames exceeds the number of red flames after 10 turns pass.':'10 回合结束时，蓝色火焰数量多于红色火焰',
      'The number of red flames exceeds the number of blue flames after 10 turns pass.':'10 回合结束时，红色火焰数量多于蓝色火焰',
      'The Caravan is Destroyed':'商队被摧毁','Seize the Red Jewel':'夺取红宝石','Seize the epimenium.':'夺取 epimenium','Use all of the levers':'启动所有机关','Flame Lord':'烈焰君主'};
    for(const [a,b] of Object.entries(facts).sort((a,b)=>b[0].length-a[0].length))t=t.replaceAll(a,b);
    t=t.replace(/(\d+) turns pass/gi,'经过 $1 回合').replace(/Defeat /gi,'击败 ').replace(/falls in battle\.?/gi,'阵亡').replace(/\bor\b/gi,'或').replace(/\band\b/gi,'与');
    for(const [en,zh] of [...names,['Nero','尼罗'],['Dyan','迪安'],['Dagda','达古达'],['Cetus','刻托斯'],['Mars','玛尔斯'],['Hong Hua','红华'],['Troy','特洛伊'],['Nathan','内森'],['Creek','克里克']].sort((a,b)=>b[0].length-a[0].length))t=t.replaceAll(en,zh);
    return t.split('\n').filter(Boolean).map(x=>x.trim()).join('；');
  }
  q('#chapterRoute').innerHTML=Object.entries(db.routes).map(([id,title])=>`<option value="${id}">${esc(title)}</option>`).join('');q('#chapterRoute').value='Cai';
  function renderChapters(){
    const route=q('#chapterRoute').value,search=q('#chapterSearch').value.trim().toLowerCase();
    const all=db.chapters.filter(c=>c.route===route);const shown=all.filter(c=>[c.title,c.name_en,...c.battles.flatMap(b=>[b.name,b.location])].join(' ').toLowerCase().includes(search));
    if(!shown.some(c=>c.id===chapterId))chapterId=shown[0]?.id;
    q('#chapterProgress').textContent=storageFailed?'保存失败':`${all.filter(c=>progress.chapters.includes(c.id)).length} / ${all.length} 已通关`;
    q('#chapterList').innerHTML=shown.map(c=>`<button type="button" data-chapter="${c.id}" class="chapter-row ${c.id===chapterId?'active':''}" aria-pressed="${c.id===chapterId}"><span class="mono">${c.route==='Prologue'?'序':String(c.number).padStart(2,'0')}</span><strong>${esc(c.title)}</strong><small>${progress.chapters.includes(c.id)?'✓ 已通关':c.battles.length+' 场战斗'}</small></button>`).join('') || '<p class="library-empty">没有匹配的章节。</p>';
    q('#chapterList').querySelectorAll('button').forEach(b=>b.onclick=()=>{chapterId=b.dataset.chapter;renderChapters();if(window.matchMedia('(max-width:680px)').matches){q('#chapterDetail').focus({preventScroll:true});q('#chapterDetail').scrollIntoView({block:'start',behavior:'instant'});}});renderChapterDetail();
  }
  function renderChapterDetail(){
    const c=db.chapters.find(c=>c.id===chapterId);if(!c){q('#chapterDetail').innerHTML='<p>选择章节查看关卡目标。</p>';return;}
    const done=progress.chapters.includes(c.id);const extra=db.paralogues.filter(p=>p.availability.some(a=>a.route===c.route&&a.chapter===c.number));
    const chars=(window.FE_GAMERSKY_PROFILES||[]).filter(p=>p.recruitment.some(a=>a.route.replace('蕾妲','蕾达')===db.routes[c.route] && new RegExp(`(?:第|章|Chapter\\s*)?${c.number}(?:章|\\b)`).test(a.timing)));
    q('#chapterDetail').innerHTML=`<span class="mono small-label">${esc(db.routes[c.route])} / ${c.route==='Prologue'?'序章':'第 '+c.number+' 章'}</span><h2>${esc(c.title)}</h2><p class="chapter-original">${esc(c.name_en)}</p><p class="chapter-translation-note">中文章节名为对照译名，可同时按英文名称查询。</p><button type="button" id="markChapter" class="secondary-btn" aria-pressed="${done}">${done?'✓ 已通关 · 取消标记':'标记为已通关'}</button>
      <div class="battle-list">${c.battles.length?c.battles.map((b,i)=>`<section class="battle-card"><span class="small-label mono">BATTLE ${i+1}</span><h3>${esc(b.name)}</h3><p class="battle-location">地点 · ${esc(b.location||'待补')}</p><div class="battle-objectives"><div><strong>胜利条件</strong><p>${esc(gameText(b.victory)||'待补')}</p></div><div><strong>失败条件</strong><p>${esc(gameText(b.defeat)||'待补')}</p></div></div></section>`).join(''):'<p class="missing-fact">本章战斗目标暂未收录。</p>'}</div>
      ${extra.length?`<section class="chapter-related"><h3>本章关联外传</h3>${extra.map(p=>`<button type="button" data-open-paralogue="${p.id}">${esc(name(p.character))} · ${esc(p.title)} →</button>`).join('')}</section>`:''}
      ${chars.length?`<section class="chapter-related"><h3>留意这些人物的加入时间</h3>${chars.map(p=>`<button type="button" data-recruit-profile="${esc(p.name_zh)}">${esc(p.name_zh)} · 查看招募条件 →</button>`).join('')}</section>`:''}
      ${c.id==='624303'?'<div class="chapter-related"><h3>海上路径</h3><p>本章需要先搜索三个海域，再寻找刻托斯。区域地图保留了单向洋流和事件专用路线。</p><button type="button" id="chapterSeaMap">打开利尔海地图 →</button></div>':''}`;
    q('#markChapter').onclick=()=>{toggle('chapters',c.id);renderChapters();};
    q('#chapterDetail').querySelectorAll('[data-recruit-profile]').forEach(b=>b.onclick=()=>window.openLibraryProfile(b.dataset.recruitProfile));
    q('#chapterDetail').querySelectorAll('[data-open-paralogue]').forEach(b=>b.onclick=()=>{q('#paralogueRoute').value=c.route;setTab('paralogues');renderParalogues();const el=document.getElementById('paralogue-'+b.dataset.openParalogue);el?.focus({preventScroll:true});el?.scrollIntoView({block:'center',behavior:'instant'});});
    q('#chapterSeaMap')?.addEventListener('click',()=>{setTab('regions');q('#mapRoute').value='Dietrich';q('#mapPart').value='1';switchRegion('lir');q('#mapCondition').checked=true;access();renderMap();});
  }
  q('#chapterRoute').onchange=renderChapters;q('#chapterSearch').oninput=renderChapters;
  function renderParalogues(){
    const route=q('#paralogueRoute').value;const shown=db.paralogues.filter(p=>route==='all'||p.availability.some(a=>a.route===route));
    q('#paralogueList').innerHTML=shown.map(p=>{const done=progress.paralogues.includes(p.id);return `<article class="paralogue-card" id="paralogue-${p.id}" tabindex="-1"><div class="reference-top"><span class="source-badge">${esc(name(p.character))}</span>${done?'<span>✓ 已完成</span>':''}</div><h2>${esc(p.title)}</h2><p>触发地点 · ${esc(gameText(p.trigger))}</p><div class="paralogue-windows">${p.availability.filter(a=>route==='all'||a.route===route).map(a=>`<div><strong>${esc(db.routes[a.route])} · 第 ${a.chapter} 章</strong><span>接受期 ${esc(a.window)}</span></div>`).join('')}</div>${p.forced_start?`<p class="deadline-warning">接受后将在 ${esc(p.forced_start)} 自动开始，提前安排队伍与行程。</p>`:''}<p class="paralogue-rewards"><strong>报酬</strong><br>${esc(gameText(p.rewards).replace(' Gold',' 金币').replace(' Renown',' 名声'))}</p><button type="button" data-complete-paralogue="${p.id}" class="secondary-btn" aria-pressed="${done}">${done?'✓ 已完成 · 取消标记':'标记为已完成'}</button></article>`;}).join('') || '<p class="library-empty">这条路线的外传时间暂未收录。</p>';
    q('#paralogueList').querySelectorAll('[data-complete-paralogue]').forEach(b=>b.onclick=()=>{toggle('paralogues',b.dataset.completeParalogue);renderParalogues();});
  }
  q('#paralogueRoute').onchange=renderParalogues;
  function openChapterRoute(){
    const parts=location.hash.slice(1).split('/');
    if(parts[0]!=='maps'||parts[1]!=='chapters')return;
    const route=decodeURIComponent(parts[2]||'Cai');
    if(!Object.hasOwn(db.routes,route))return;
    q('#chapterRoute').value=route;q('#chapterSearch').value='';setTab('chapters');
    const candidate=parts[3]?decodeURIComponent(parts[3]):null;
    chapterId=db.chapters.find(c=>c.route===route&&c.id===candidate)?.id||db.chapters.find(c=>c.route===route)?.id;
    renderChapters();
  }
  window.addEventListener('hashchange',openChapterRoute);
  switchRegion(region.id);renderChapters();renderParalogues();openChapterRoute();
})();
