(() => {
  const profiles = window.FE_GAMERSKY_PROFILES || [];
  const entries = window.FE_REFERENCE_ENTRIES || [];
  const characters = window.FE_CHARACTERS || [];
  const alternateGrowth = window.FE_ALTERNATE_GROWTH || {};
  const officialNotes = window.FE_OFFICIAL_CHARACTER_NOTES || [];
  const byName = new Map(characters.map(item => [item.name_zh, item]));
  const stats = [['hp', '生命'], ['str', '力量'], ['mag', '魔力'], ['spd', '速度'], ['dex', '技巧'], ['def', '防御'], ['res', '魔防'], ['lck', '幸运'], ['cha', '魅力']];
  const q = selector => document.querySelector(selector);
  const escape = value => String(window.FE_t?.(value) ?? value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const sourceUrl = value => /^https:\/\//.test(value || '') ? escape(value) : '#';
  const sourceNames = {official: '游戏机制', guide: '培养策略', player: '实验记录'};
  let selectedPage = 1;
  let sourceFilter = 'all';

  function comparison(profile, character) {
    if (!character) return {kind: 'unknown', differences: []};
    const differences = stats.filter(([key]) => character.growth?.[key] !== profile.growth?.[key]);
    const effective = alternateGrowth.mu_effective;
    if (character.id === 'mu' && effective && stats.every(([key]) => effective.growth?.[key] === profile.growth?.[key])) {
      return {kind: 'mu_effective', differences};
    }
    return {kind: differences.length ? 'different' : 'same', differences};
  }

  function setTab(tab) {
    q('#libraryProfilesPanel').hidden = tab !== 'profiles';
    q('#libraryOverseasPanel').hidden = tab !== 'overseas';
    q('#libraryEntriesPanel').hidden = tab !== 'entries';
    q('#libraryQueryPanel').hidden = tab !== 'query';
    document.querySelectorAll('[data-library-tab]').forEach(button => {
      const active = button.dataset.libraryTab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function profileMatches(profile, search) {
    if (!search) return true;
    const character = byName.get(profile.name_zh);
    const haystack = [profile.name_zh, character?.name_en, profile.personal_ability_zh,
      ...profile.preferred_skills, ...profile.blood_marks.map(mark => mark.effect),
      ...profile.recruitment.flatMap(item => [item.route, item.timing, item.condition])].join(' ').toLowerCase();
    return haystack.includes(search);
  }

  function renderProfiles() {
    const search = q('#profileSearch').value.trim().toLowerCase();
    const visible = profiles.filter(profile => profileMatches(profile, search));
    q('#profileResultCount').textContent = `${visible.length} / ${profiles.length} 条`;
    if (!visible.some(profile => profile.page === selectedPage)) selectedPage = visible[0]?.page || 0;
    q('#libraryProfileList').innerHTML = visible.length ? visible.map(profile => {
      const character = byName.get(profile.name_zh);
      const status = comparison(profile, character).kind;
      return `<button type="button" class="profile-row ${profile.page === selectedPage ? 'active' : ''}" data-profile-page="${profile.page}" aria-pressed="${profile.page === selectedPage}">
        ${character ? window.renderCharacterAvatar?.(character) || '' : ''}<span><strong>${escape(profile.name_zh)}</strong><small>${escape(character?.name_en || '')} · ${escape(profile.preferred_skills.join(' / ') || '擅长技能待补')}</small></span>
        ${status === 'different' ? '<span class="profile-status">数值待核</span>' : status === 'mu_effective' ? '<span class="profile-status">技能生效</span>' : ''}
      </button>`;
    }).join('') : '<div class="library-empty">没有找到对应角色资料。</div>';
    q('#libraryProfileList').querySelectorAll('[data-profile-page]').forEach(button => button.addEventListener('click', () => {
      selectedPage = Number(button.dataset.profilePage);
      const p=profiles.find(item=>item.page===selectedPage),c=byName.get(p?.name_zh);
      if(c){location.hash='character/'+c.id;return;}
      renderProfiles();
      if (window.matchMedia('(max-width:680px)').matches) { q('#libraryProfileDetail').focus({preventScroll:true}); q('#libraryProfileDetail').scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start'}); }
    }));
    renderProfileDetail();
  }

  function renderProfileDetail() {
    const profile = profiles.find(item => item.page === selectedPage);
    const root = q('#libraryProfileDetail');
    if (!profile) { root.innerHTML = '<p class="library-empty">请选择一名角色。</p>'; return; }
    const character = byName.get(profile.name_zh);
    const result = comparison(profile, character);
    const official = officialNotes.find(item => item.character_id === character?.id);
    const difference = result.kind === 'mu_effective'
      ? '<div class="source-difference"><strong>穆的成长值有两种口径</strong><p>这组成长值与“成长的征兆生效后”记录一致；人物页默认显示技能生效前的基础值。两组数值都保留。</p></div>'
      : result.kind === 'different'
        ? `<div class="source-difference"><strong>与站内原有成长表不一致，待游戏内核对</strong><p>${result.differences.map(([key, name]) => `${name}：基础表 ${character.growth[key]}% / 对照表 ${profile.growth[key]}%`).join('；')}</p></div>`
        : result.kind === 'same' ? '<div class="source-difference"><strong>成长值与站内原有资料一致</strong><p>两组记录目前相同；仍以游戏内显示为准。</p></div>' : '';
    root.innerHTML = `<button type="button" class="profile-back">← 返回角色列表</button><span class="mono small-label">人物档案 ${String(profile.page).padStart(2, '0')}</span>
      <div class="profile-identity">${character ? window.renderCharacterAvatar?.(character) || '' : ''}<div><h2>${escape(profile.name_zh)}</h2><div class="name-en">${escape(character?.name_en || '英文名待核')}</div></div></div>
      <div class="profile-meta"><span>人物档案 · 技能与招募</span>${profile.gender ? `<span>性别：${escape(profile.gender)}</span>` : ''}</div>
      <h3>角色成长率</h3><div class="growth-grid">${stats.map(([key, label]) => `<div class="growth-cell stat-${key}"><small>${label}</small><strong>${profile.growth[key] ?? '—'}%</strong></div>`).join('')}</div>
      ${difference}
      ${official ? `<div class="official-character-note"><strong>人物背景</strong><p>${escape(official.summary)}</p></div>` : ''}
      <h3>擅长技能</h3><p>${escape(profile.preferred_skills.join(' · ') || '暂未收录')}</p>
      <h3>个人技能与血印</h3><ul class="profile-fact-list">${profile.personal_ability_zh ? `<li>个人技能：${escape(profile.personal_ability_zh)}</li>` : ''}${profile.blood_marks.map(mark => `<li>${escape(mark.label)}：${escape(mark.effect)}</li>`).join('') || '<li>暂未收录血印</li>'}</ul>
      <h3>各路线加入信息</h3>${profile.recruitment.length ? profile.recruitment.map(item => `<div class="profile-recruitment"><span>${escape(item.route)}</span><span>${escape(item.timing)} · ${escape(item.condition)}</span></div>`).join('') : '<p>其他路线的招募条件暂未收录。</p>'}
      <p class="library-caution">译名与部分招募条件仍在核对，以游戏内显示为准。</p>`;
    root.querySelector('.profile-back').addEventListener('click',()=>{
      const list=q('#libraryProfileList');list.scrollIntoView({behavior:'instant',block:'start'});
      (list.querySelector('.profile-row.active') || list).focus({preventScroll:true});
    });
  }

  function renderEntries() {
    const search = q('#entrySearch').value.trim().toLowerCase();
    const visible = entries.filter(entry => {
      if (sourceFilter !== 'all' && entry.source_type !== sourceFilter) return false;
      const haystack = [entry.title, entry.publisher, entry.summary, ...entry.topics, ...entry.facts, entry.note].join(' ').toLowerCase();
      return !search || haystack.includes(search);
    });
    q('#libraryEntryList').innerHTML = visible.length ? visible.map(entry => `<article class="reference-card">
      <div class="reference-top"><span class="source-badge">${sourceNames[entry.source_type] || '资料'}</span><small>${escape(entry.published)}</small></div>
      <h2>${escape(entry.title)}</h2><p>${escape(entry.summary)}</p>
      <ul>${entry.facts.map(fact => `<li>${escape(fact)}</li>`).join('')}</ul>
      <div class="topics">${entry.topics.map(topic => `<span>${escape(topic)}</span>`).join('')}</div>
      ${entry.note ? `<p class="note">${escape(entry.note)}</p>` : ''}

    </article>`).join('') : '<div class="library-empty">没有找到对应资料。</div>';
  }

  window.renderCharacterSource = character => {
    const profile = profiles.find(item => item.name_zh === character.name_zh);
    const root = q('#characterDetail .drawer-inner');
    if (!root) return;
    const block = document.createElement('section');
    block.className = 'drawer-source';
    const official = officialNotes.find(item => item.character_id === character.id);
    block.innerHTML = `<h4>人物档案</h4><p>成长值、擅长技能、支援与加入条件可在资料库集中查阅。</p>
      ${official ? `<p>${escape(official.summary)}</p>` : ''}
      ${profile ? '<button type="button" class="open-source-profile">查看技能与招募条件 →</button>' : `<a href="#library" class="source-link">浏览资料库 →</a>`}`;
    root.appendChild(block);
    block.querySelector('.open-source-profile')?.addEventListener('click', () => {
      window.closeCharacterDetail?.(false);
      window.openLibraryProfile(profile.name_zh);
    });
  };

  window.openLibraryProfile = name => {
    const direct=byName.get(name);if(direct){location.hash='character/'+direct.id;return;}
    const profile = profiles.find(item => item.name_zh === name);
    q('#profileSearch').value = profile?.name_zh || name;
    if (profile) selectedPage = profile.page;
    setTab('profiles');
    renderProfiles();
    location.hash = 'library';
  };

  q('#libraryProfileCount').textContent = profiles.length;
  q('#libraryEntryCount').textContent = entries.length;
  q('#profileSearch').addEventListener('input', renderProfiles);
  q('#entrySearch').addEventListener('input', renderEntries);
  document.querySelectorAll('[data-library-tab]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.libraryTab)));
  document.querySelectorAll('[data-source-filter]').forEach(button => button.addEventListener('click', () => {
    sourceFilter = button.dataset.sourceFilter;
    document.querySelectorAll('[data-source-filter]').forEach(item => item.classList.toggle('active', item === button));
    renderEntries();
  }));
  renderProfiles();
  renderEntries();
  setTab('query');
})();
