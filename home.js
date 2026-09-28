(() => {
  const q=s=>document.querySelector(s);
  const escape=v=>String(window.FE_t?.(v)??v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.FE_CATALOG_CATEGORIES=[
    {id:'gifts',title:'礼物图鉴',collection:'gift_profiles',description:'查看喜欢与非常喜欢的赠礼对象'},
    {id:'fish',title:'鱼类图鉴',collection:'material_profiles',category:'fish',description:'查栖息、取得和使用条件'},
    {id:'ore',title:'矿石',collection:'material_profiles',category:'ore',description:'查矿石与锻造材料'},
    {id:'ingredients',title:'食材',collection:'material_profiles',category:'ingredient',description:'查食材与取得途径'},
    {id:'weapons',title:'武器与法术',collection:'weapon_profiles',description:'查数值、职业要求与购买条件'},
    {id:'items',title:'探索与交付道具',collection:'other_item_profiles',description:'查道具用途及关联人物'},
    {id:'battle-items',title:'战斗道具',collection:'item_profiles',description:'查恢复、护盾与数值效果'},
    {id:'rules',title:'取得与使用条件',collection:'item_usage_rules',description:'查购买、搜索、捕获与恢复条件'},
    {id:'skills',title:'职业技能',collection:'ability_catalog',description:'查职业与精通技能效果'},
    {id:'recruitment',title:'人物招募',collection:'recruitment_conditions',description:'查四条路线的招募门槛'},
    {id:'licenses',title:'转职道具',collection:'certification_items',description:'查资格证与职业道具'},
    {id:'chapters',title:'章节攻略',collection:'chapters',description:'查路线、战斗目标与地点'}
  ];
  const db=window.FE_ADVENTURE;
  const routes=['Cai','Dietrich','Theodora','Leda'];
  q('#homeRouteCards').innerHTML=routes.map(route=>{
    const person=window.FE_CHARACTERS.find(c=>c.name_en===route),chapters=db.chapters.filter(c=>c.route===route);
    return `<article class="home-route-card route-${route.toLowerCase()}"><a class="home-route-title" href="#maps/chapters/${route}">${window.renderCharacterAvatar(person)}<span><strong>${escape(db.routes[route])}线</strong><small>${chapters.length} 个章节档案</small></span></a><div class="home-route-chapters">${chapters.slice(0,2).map(c=>`<a href="#maps/chapters/${route}/${encodeURIComponent(c.id)}"><span>第 ${c.number} 章</span>${escape(c.title)}</a>`).join('')}</div><a class="home-route-all" href="#maps/chapters/${route}">查看路线攻略 <span aria-hidden="true">→</span></a></article>`;
  }).join('');
  // Independent modules use real local routes. Future question answering can be registered
  // here only after a retrieval provider is connected to the shared knowledge store.
  const modules=[
    {id:'maps',name:'区域地图',description:'查地点、探索路线与外传期限',href:'#maps',icon:'◎'},
    {id:'characters',name:'人物图鉴',description:'查看成长、技能和招募条件',href:'#characters',icon:'人'},
    {id:'classes',name:'职业图鉴',description:'查资格要求、精通和成长修正',href:'#classes',icon:'职'},
    {id:'library',name:'资料库',description:'集中查询所有已收录资料',href:'#library',icon:'库'}
  ];
  const key='fe-home-modules-v1';let selected=['maps','library'],storageFailed=false;
  try{const saved=JSON.parse(localStorage.getItem(key));if(Array.isArray(saved))selected=[...new Set(saved)].filter(id=>modules.some(m=>m.id===id));}catch{}
  function renderModules(){
    q('#homeShortcutCards').innerHTML=modules.filter(m=>selected.includes(m.id)).map(m=>`<a class="home-shortcut" href="${m.href}"><span class="home-shortcut-icon" aria-hidden="true">${m.icon}</span><div><strong>${m.name}</strong><p>${m.description}</p></div><span aria-hidden="true">→</span></a>`).join('');
    q('#homeModuleOptions').innerHTML=modules.map(m=>`<label><input type="checkbox" value="${m.id}" ${selected.includes(m.id)?'checked':''}><span>${m.name}</span></label>`).join('');
    q('#homeModuleStatus').textContent=storageFailed?'偏好暂时无法保存，下次打开会恢复默认。':selected.length?'功能选择保存在当前浏览器。':'点击“添加功能”，选择常用入口。';
    q('#homeModuleOptions').querySelectorAll('input').forEach(input=>input.onchange=()=>{
      selected=input.checked?[...selected,input.value]:selected.filter(id=>id!==input.value);
      try{localStorage.setItem(key,JSON.stringify(selected));storageFailed=false;}catch{storageFailed=true;}
      const value=input.value;renderModules();q(`#homeModuleOptions input[value="${value}"]`).focus();
    });
  }
  renderModules();
  function route(){
    const home=!location.hash||location.hash==='#home';
    const search=location.hash.startsWith('#search');
    if(home||search){const container=home?q('#home'):q('#search .search-page');container.append(q('#homeModules'));}
  }
  window.addEventListener('hashchange',route);route();
})();
