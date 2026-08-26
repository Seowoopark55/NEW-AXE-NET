import { bindImeSafeInput, captureImeSearchFocus, restoreImeSearchFocus } from '../../utils/dom.js';
import { MODBOOK_PRESETS, MODBOOK_PRESET_SLOT_ORDER } from './modbookPresets.js';

export function renderInfoView(root, state, actions = {}) {
  const info = state.info;
  const auth = state.auth || {};
  const searchFocus = captureImeSearchFocus(root);

  root.innerHTML = `
    <section class="ops-info">
      <header class="ops-info__header">
        <div>
          <h1>정보</h1>
          <p>제작, 생활직, 개조서, 추천 세팅과 스킬랭크 정보를 빠르게 조회합니다.</p>
        </div>
        <div class="ops-info__header-actions">
          <button class="ops-info-btn" type="button" data-info-refresh ${info.loading ? 'disabled' : ''}>새로고침</button>
        </div>
      </header>

      <nav class="ops-info-tabs" aria-label="정보 메뉴">
        ${tabButton('craft', '제작', info.tab)}
        ${tabButton('quest', '퀘스트', info.tab)}
        ${tabButton('process', '가공·재련', info.tab)}
        ${tabButton('modbook', '개조서', info.tab)}
        ${tabButton('preset', '추천세팅', info.tab)}
        ${tabButton('skill', '스킬랭크', info.tab)}
      </nav>

      ${info.error ? `<div class="ops-info__error">${h(info.error)}</div>` : ''}
      ${info.loading && !info.initialized ? '<div class="ops-info__loading">정보 데이터를 불러오는 중입니다.</div>' : ''}

      ${renderTab(info, auth)}
    </section>
    ${renderRequestModal(info, auth)}
    ${renderAdminRequestsModal(info, auth)}
    ${renderModbookEditorModal(info, auth)}
    ${renderPriceModal(info, auth)}
    ${renderPresetEditorModal(info, auth)}
  `;

  bindEvents(root, state, actions);
  restoreImeSearchFocus(root, searchFocus);
}

function tabButton(key, label, active) {
  return `<button class="ops-info-tabs__item ${active === key ? 'is-active' : ''}" type="button" data-info-tab="${key}">${h(label)}</button>`;
}

function renderTab(info, auth) {
  if (!info.initialized && info.loading) return '';
  if (info.tab === 'quest') return renderQuest(info);
  if (info.tab === 'process') return renderProcess(info);
  if (info.tab === 'modbook') return renderModbooks(info, auth);
  if (info.tab === 'preset') return renderModbookPresets(info, auth);
  if (info.tab === 'skill') return renderSkillRanks(info);
  return renderCraft(info);
}

function renderCraft(info) {
  const categories = unique(info.crafts.map((item) => item.category));
  const filter = info.filters.craftCategory;
  const keyword = normalized(info.filters.craftSearch);
  const materialsByCraft = groupBy(info.materials, 'craft_id');

  let list = info.crafts.filter((item) => filter === 'all' || item.category === filter);
  if (keyword) {
    list = list.filter((item) => {
      const materials = materialsByCraft[item.id] || [];
      return searchable([
        item.item_name, item.category, item.craft_rank, item.obtain_place, item.note,
        ...materials.flatMap((row) => [row.material_name, row.quantity]),
      ], keyword);
    });
  }

  const selected = list.find((item) => item.id === info.selectedCraftId) || list[0] || null;

  return `
    <section class="ops-info-workspace ops-info-workspace--craft">
      <div class="ops-info-toolbar">
        <label class="ops-info-field ops-info-field--select">
          <span>분류</span>
          <select data-info-filter="craftCategory">
            <option value="all">전체</option>
            ${categories.map((value) => `<option value="${a(value)}" ${filter === value ? 'selected' : ''}>${h(value)}</option>`).join('')}
          </select>
        </label>
        <label class="ops-info-field ops-info-field--search">
          <span>검색</span>
          <input type="search" value="${a(info.filters.craftSearch)}" placeholder="아이템명 또는 재료명" data-info-search="craftSearch" data-ime-search="info:craftSearch" />
        </label>
        <span class="ops-info-result">${list.length}건</span>
      </div>

      <div class="ops-info-split ops-info-split--craft">
        <div class="ops-info-list" role="list">
          ${list.length ? list.map((item) => `
            <button class="ops-info-list__row ${selected?.id === item.id ? 'is-active' : ''}" type="button" data-info-craft-id="${a(item.id)}">
              <strong>${h(item.item_name)}</strong>
              <span>${h(item.category)} · ${item.craft_rank ? `${h(item.craft_rank)}랭크` : '랭크 없음'}</span>
            </button>
          `).join('') : empty('검색 결과가 없습니다.')}
        </div>
        <div class="ops-info-detail">
          ${selected ? renderCraftDetail(selected, info, materialsByCraft[selected.id] || []) : empty('제작 아이템을 선택하세요.')}
        </div>
      </div>
    </section>
  `;
}

function renderCraftDetail(item, info, materials) {
  const recipeMap = new Map(info.materialRecipes.map((row) => [String(row.item_name), row]));
  const craftSkill = info.skillRanks.filter((row) => row.skill === '제작');

  return `
    <article class="ops-info-detail-card">
      <div class="ops-info-detail-card__head">
        <div>
          <span class="ops-info-kicker">${h(item.category)}</span>
          <h2>${h(item.item_name)}</h2>
        </div>
        <div class="ops-info-badges">
          ${item.craft_rank ? badge(`${item.craft_rank} 랭크`) : ''}
          ${item.success_rate != null ? badge(`성공률 ${formatPercent(item.success_rate)}`, 'gold') : ''}
        </div>
      </div>

      <dl class="ops-info-facts">
        <div><dt>획득처</dt><dd>${h(item.obtain_place || '—')}</dd></div>
        <div><dt>제작랭크</dt><dd>${h(item.craft_rank || '—')}</dd></div>
      </dl>

      <section class="ops-info-detail-section">
        <h3>필요 재료</h3>
        <div class="ops-info-materials">
          ${materials.length ? materials.map((row) => {
            const recipe = recipeMap.get(String(row.material_name));
            return `
              <div class="ops-info-material">
                <div class="ops-info-material__main"><strong>${h(row.material_name)}</strong><b>× ${formatNumber(row.quantity)}</b></div>
                ${recipe ? `<div class="ops-info-material__recipe"><span>재료 제작</span>${renderRecipeInline(recipe)}</div>` : ''}
              </div>
            `;
          }).join('') : empty('등록된 제작 재료가 없습니다.')}
        </div>
      </section>

      ${item.note ? `<div class="ops-info-note">${h(item.note)}</div>` : ''}
      ${craftSkill.length ? `
        <section class="ops-info-detail-section ops-info-detail-section--muted">
          <h3>제작 스킬랭크</h3>
          <div class="ops-info-rank-inline">${craftSkill.map((row) => `<span>${h(row.rank)} <b>${formatNumber(row.required_point)}${h(row.point_type || '')}</b></span>`).join('')}</div>
        </section>
      ` : ''}
    </article>
  `;
}

function renderRecipeInline(recipe) {
  const parts = [
    [recipe.input1, recipe.input1_qty],
    [recipe.input2, recipe.input2_qty],
    [recipe.input3, recipe.input3_qty],
  ].filter(([name]) => String(name || '').trim());
  return `<strong>${parts.map(([name, qty]) => `${h(name)} × ${formatNumber(qty)}`).join(' + ')}</strong>${recipe.note ? `<em>${h(recipe.note)}</em>` : ''}`;
}

function renderQuest(info) {
  const jobs = unique(info.quests.map((item) => item.job));
  const job = info.filters.questJob;
  const keyword = normalized(info.filters.questSearch);
  let list = info.quests.filter((item) => job === 'all' || item.job === job);
  if (keyword) list = list.filter((item) => searchable(Object.values(item), keyword));

  return `
    <section class="ops-info-workspace ops-info-workspace--table">
      ${filterBar('questJob', job, '직업', jobs, 'questSearch', info.filters.questSearch, '아이템, 랭크, 보상 검색', list.length)}
      <div class="ops-info-table ops-info-table--quest">
        <div class="ops-info-table__head"><span>아이템</span><span>필요수량</span><span>랭크</span><span>보상</span></div>
        ${list.length ? list.map((item) => `
          <div class="ops-info-table__row">
            <div><strong>${h(item.item_name)}</strong><small>${h(item.job)}${item.note ? ` · ${h(item.note)}` : ''}</small></div>
            <b>${formatNumber(item.required_qty)}</b>
            <span>${h(item.rank || '—')}</span>
            <span class="ops-info-reward">${formatQuestReward(item)}</span>
          </div>
        `).join('') : empty('검색 결과가 없습니다.')}
      </div>
    </section>
  `;
}

function formatQuestReward(item) {
  const parts = [];
  if (item.reward_money != null && String(item.reward_money).trim() !== '') {
    parts.push(`${formatMoney(item.reward_money)}$`);
  }
  if (item.reward_xp != null && String(item.reward_xp).trim() !== '') {
    parts.push(`${formatNumber(item.reward_xp)} XP`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

function renderProcess(info) {
  const jobs = unique(info.processes.map((item) => item.job));
  const job = info.filters.processJob;
  const keyword = normalized(info.filters.processSearch);
  let list = info.processes.filter((item) => job === 'all' || item.job === job);
  if (keyword) list = list.filter((item) => searchable(Object.values(item), keyword));

  return `
    <section class="ops-info-workspace ops-info-workspace--process">
      ${filterBar('processJob', job, '직업', jobs, 'processSearch', info.filters.processSearch, '아이템 또는 재료 검색', list.length)}
      <div class="ops-info-process-list">
        ${list.length ? list.map((item) => `
          <article class="ops-info-process-row">
            <div class="ops-info-process-row__title">
              <span>${h(item.process_type)}</span>
              <strong>${h(item.item_name)}</strong>
              ${item.rank ? `<small>${h(item.rank)}</small>` : ''}
            </div>
            <div class="ops-info-process-row__recipe">
              ${materialPair(item.input1, item.input1_qty)}
              ${item.input2 ? `<i>+</i>${materialPair(item.input2, item.input2_qty)}` : ''}
              <i>→</i><b>${formatNumber(item.output_qty)}개</b>
            </div>
            <div class="ops-info-process-row__quest">
              <span>퀘스트 ${formatNumber(item.quest_qty)}개</span>
              <strong>${formatMoney(item.reward_money)}$ · ${formatNumber(item.reward_xp)} XP</strong>
            </div>
            ${item.note ? `<div class="ops-info-note">${h(item.note)}</div>` : ''}
          </article>
        `).join('') : empty('검색 결과가 없습니다.')}
      </div>
    </section>
  `;
}

function materialPair(name, qty) {
  return `<span><strong>${h(name || '—')}</strong> × ${formatNumber(qty)}</span>`;
}

function renderModbooks(info, auth) {
  const types = ['접두', '접미'];
  const categories = unique(info.modbooks.map((item) => item.category));
  const parts = unique(info.modbooks.flatMap((item) => splitParts(item.parts)));
  const f = info.filters;
  const keyword = normalized(f.modbookSearch);

  let list = info.modbooks.filter((item) => (
    (f.modbookType === 'all' || item.type === f.modbookType)
    && (f.modbookCategory === 'all' || item.category === f.modbookCategory)
    && (f.modbookPart === 'all' || splitParts(item.parts).includes(f.modbookPart))
  ));
  if (keyword) {
    list = list.filter((item) => searchable([
      item.name, item.type, item.category, item.parts, item.option1, item.option2, item.option3, item.note,
    ], keyword));
  }
  list.sort((a, b) => String(a.type).localeCompare(String(b.type), 'ko') || String(a.category).localeCompare(String(b.category), 'ko') || Number(a.sort_order || 0) - Number(b.sort_order || 0));

  const selected = list.find((item) => Number(item.id) === Number(info.selectedModbookId)) || list[0] || null;
  const pending = (info.admin.requests || []).filter((item) => item.status === 'pending').length;

  return `
    <section class="ops-info-workspace ops-info-workspace--modbook">
      <div class="ops-info-modbook-actions">
        <div class="ops-info-toolbar ops-info-toolbar--modbook">
          ${selectField('modbookType', f.modbookType, '위치', types)}
          ${selectField('modbookCategory', f.modbookCategory, '분류', categories)}
          ${selectField('modbookPart', f.modbookPart, '부위', parts)}
          <label class="ops-info-field ops-info-field--search ops-info-field--search-wide">
            <span>검색</span>
            <input type="search" value="${a(f.modbookSearch)}" placeholder="개조서명 또는 옵션" data-info-search="modbookSearch" data-ime-search="info:modbookSearch" />
          </label>
          <span class="ops-info-result">${list.length}건</span>
        </div>
        <div class="ops-info-modbook-actions__buttons">
          <button class="ops-info-btn" type="button" data-info-request-open>등록신청</button>
          ${auth.admin ? `<button class="ops-info-btn" type="button" data-info-admin-requests>신청 검수${pending ? ` <b>${pending}</b>` : ''}</button><button class="ops-info-btn ops-info-btn--gold" type="button" data-info-modbook-new>직접 등록</button>` : ''}
        </div>
      </div>

      <div class="ops-info-split ops-info-split--modbook">
        <div class="ops-info-modbook-list">
          ${list.length ? list.map((item) => `
            <button class="ops-info-modbook-row ${selected?.id === item.id ? 'is-active' : ''}" type="button" data-info-modbook-id="${Number(item.id)}">
              <div><strong>${h(cleanModbookName(item.name))}</strong>${tier1(item.name) ? '<em>1티어</em>' : ''}</div>
              <span>${h(item.type)} · ${h(item.category)}</span>
              <small>${formatPercent(item.success_rate)}${item.recent_price != null ? ` · ${formatMoney(item.recent_price)}$` : ''}</small>
            </button>
          `).join('') : empty('검색 결과가 없습니다.')}
        </div>
        <div class="ops-info-modbook-detail">
          ${selected ? renderModbookDetail(selected, auth) : empty('개조서를 선택하세요.')}
        </div>
      </div>
    </section>
  `;
}

function renderModbookDetail(item, auth) {
  const options = [item.option1, item.option2, item.option3].filter((value) => String(value || '').trim());
  const canPrice = Boolean(auth.member || auth.admin);
  return `
    <article class="ops-info-detail-card ops-info-detail-card--modbook">
      <div class="ops-info-detail-card__head">
        <div>
          <span class="ops-info-kicker">${h(item.type)} · ${h(item.category)}</span>
          <h2>${h(cleanModbookName(item.name))}${tier1(item.name) ? '<em class="ops-info-tier">1티어</em>' : ''}</h2>
        </div>
        <div class="ops-info-badges">${badge(`성공률 ${formatPercent(item.success_rate)}`, 'gold')}</div>
      </div>

      <dl class="ops-info-facts ops-info-facts--single">
        <div><dt>적용 부위</dt><dd>${h(item.parts || '—')}</dd></div>
      </dl>

      <section class="ops-info-detail-section">
        <h3>옵션</h3>
        <div class="ops-info-options">
          ${options.length ? options.map((value, index) => `<div><span>${index + 1}</span><strong>${h(value)}</strong></div>`).join('') : empty('등록된 옵션이 없습니다.')}
        </div>
      </section>

      <section class="ops-info-price">
        <div class="ops-info-price__head">
          <div><span>최근 거래가</span><strong>${item.recent_price != null ? `${formatMoney(item.recent_price)}$` : '미등록'}</strong></div>
          <div class="ops-info-price__meta">${item.recent_date ? h(formatDate(item.recent_date)) : ''}${item.price_note ? `<small>${h(item.price_note)}</small>` : ''}</div>
        </div>
        ${canPrice ? `<button class="ops-info-btn ops-info-btn--small" type="button" data-info-price-open="${Number(item.id)}">가격 설정</button>` : '<small class="ops-info-price__hint">로그인 후 최근 거래가를 갱신할 수 있습니다.</small>'}
      </section>

      ${item.note ? `<div class="ops-info-note">${h(item.note)}</div>` : ''}
      ${auth.admin ? `<div class="ops-info-admin-actions"><button class="ops-info-btn" type="button" data-info-modbook-edit="${Number(item.id)}">정보 수정</button><button class="ops-info-btn ops-info-btn--danger" type="button" data-info-modbook-deactivate="${Number(item.id)}">목록에서 내리기</button></div>` : ''}
    </article>
  `;
}

function renderModbookPresets(info, auth) {
  if (!info.presetCommunityReady) {
    return `
      <section class="ops-info-workspace ops-info-workspace--preset">
        <div class="ops-info-preset-setup-required">
          <span class="ops-info-kicker">PRESET COMMUNITY</span>
          <h2>추천세팅 게시판 준비가 필요합니다.</h2>
          <p>Supabase에서 <code>047_modbook_preset_community.sql</code>을 한 번 실행하면 게시글 작성, 개조서 조합, 내 프리셋 저장 기능이 활성화됩니다.</p>
        </div>
      </section>
    `;
  }

  const favorites = new Set((info.presetFavorites || []).map(Number));
  const allPosts = (info.presetPosts || []).map(presetPostViewModel);
  const selected = allPosts.find((post) => Number(post.id) === Number(info.selectedModbookPresetId)) || null;

  if (selected) {
    return `
      <section class="ops-info-workspace ops-info-workspace--preset ops-info-workspace--preset-detail">
        <div class="ops-info-preset-detail-nav">
          <button class="ops-info-btn" type="button" data-info-preset-back>← 추천세팅 목록</button>
          <button class="ops-info-btn ops-info-btn--gold" type="button" data-info-preset-new ${auth.member ? '' : 'title="멤버 로그인 필요"'}>+ 세팅 작성</button>
        </div>
        ${renderPresetPostDetail(selected, info, auth, favorites)}
      </section>
    `;
  }

  const keyword = normalized(info.presetSearch);
  let posts = allPosts;

  if (info.presetFilter === 'favorites') {
    posts = posts.filter((post) => favorites.has(Number(post.id)));
  }
  if (keyword) {
    posts = posts.filter((post) => searchable([
      post.title,
      post.description,
      post.author_nickname,
      ...(Array.isArray(post.tags) ? post.tags : []),
      ...MODBOOK_PRESET_SLOT_ORDER.flatMap((slotKey) => {
        const slot = post.slots?.[slotKey];
        const resolved = resolvePresetSlot(slot, info.modbooks);
        return [slot?.note, ...resolved.mods.map((mod) => cleanModbookName(mod.name))];
      }),
    ], keyword));
  }

  return `
    <section class="ops-info-workspace ops-info-workspace--preset">
      <div class="ops-info-preset-head ops-info-preset-head--community">
        <div>
          <span class="ops-info-kicker">AXE MODBOOK BUILDS</span>
          <h2>추천세팅</h2>
          <p>팀원들이 직접 써본 개조서 조합을 게시글로 공유합니다. 원하는 글을 선택하면 해당 세팅만 집중해서 볼 수 있습니다.</p>
        </div>
        <button class="ops-info-btn ops-info-btn--gold" type="button" data-info-preset-new ${auth.member ? '' : 'title="멤버 로그인 필요"'}>+ 세팅 작성</button>
      </div>

      <div class="ops-info-preset-community-toolbar">
        <div class="ops-info-preset-filter" role="tablist" aria-label="추천세팅 필터">
          <button type="button" class="${info.presetFilter !== 'favorites' ? 'is-active' : ''}" data-info-preset-filter="all">전체</button>
          <button type="button" class="${info.presetFilter === 'favorites' ? 'is-active' : ''}" data-info-preset-filter="favorites" ${auth.member ? '' : 'disabled'}>★ 내 프리셋</button>
        </div>
        <label class="ops-info-preset-search">
          <span>검색</span>
          <input type="search" value="${a(info.presetSearch || '')}" placeholder="제목, 작성자, 태그, 개조서 검색" data-info-preset-search data-ime-search="info:presetSearch" />
        </label>
        <span class="ops-info-result">${posts.length}건</span>
      </div>

      <div class="ops-info-preset-board-list" role="list">
        ${posts.length ? `
          <div class="ops-info-preset-board-list__head" aria-hidden="true">
            <span>세팅</span>
            <span>태그</span>
            <span>작성자</span>
            <span>저장</span>
            <span>수정일</span>
          </div>
          ${posts.map((post) => renderPresetPostRow(post, null, favorites)).join('')}
        ` : renderPresetPostEmpty(info, auth)}
      </div>
    </section>
  `;
}

function presetPostViewModel(post) {
  const sourceSlots = Array.isArray(post?.slots) ? post.slots : [];
  const baseSlots = MODBOOK_PRESETS[0]?.slots || {};
  const slots = {};

  MODBOOK_PRESET_SLOT_ORDER.forEach((slotKey) => {
    const row = sourceSlots.find((item) => String(item.slot_key) === slotKey) || {};
    const base = baseSlots[slotKey] || {};
    slots[slotKey] = {
      label: base.label || presetSlotLabel(slotKey),
      image: base.image || '',
      prefixModbookId: row.prefix_modbook_id == null ? null : Number(row.prefix_modbook_id),
      suffixModbookId: row.suffix_modbook_id == null ? null : Number(row.suffix_modbook_id),
      note: String(row.note || ''),
    };
  });

  return { ...post, slots };
}

function presetSlotLabel(slotKey) {
  return ({ outer: '겉옷', top: '상의', bottom: '하의', shoes: '신발' })[slotKey] || slotKey;
}

function renderPresetPostRow(post, selected, favorites) {
  const active = Number(post.id) === Number(selected?.id);
  const favorite = favorites.has(Number(post.id));
  const tags = Array.isArray(post.tags) ? post.tags.slice(0, 3) : [];
  return `
    <button class="ops-info-preset-post-row ${active ? 'is-active' : ''}" type="button" data-info-preset-id="${Number(post.id)}">
      <div class="ops-info-preset-post-row__main">
        <div class="ops-info-preset-post-row__top">
          <strong>${h(post.title)}</strong>
          ${favorite ? '<span class="is-favorite" title="내 프리셋에 저장됨">★</span>' : ''}
        </div>
        <p>${h(post.description || '설명 없음')}</p>
      </div>
      <div class="ops-info-preset-post-row__tags">${tags.length ? tags.map((tag) => `<span>#${h(tag)}</span>`).join('') : '<span class="is-empty">—</span>'}</div>
      <span class="ops-info-preset-post-row__author">${h(post.author_nickname || 'AXE')}</span>
      <span class="ops-info-preset-post-row__favorite">★ ${Number(post.favorite_count || 0)}</span>
      <time>${h(formatPresetDate(post.updated_at || post.created_at))}</time>
    </button>
  `;
}

function renderPresetPostEmpty(info, auth) {
  if (info.presetFilter === 'favorites') {
    return `<div class="ops-info-preset-post-empty">${auth.member ? '내 프리셋에 저장한 세팅이 없습니다.' : '멤버 로그인 후 내 프리셋을 사용할 수 있습니다.'}</div>`;
  }
  return '<div class="ops-info-preset-post-empty">등록된 추천세팅 게시글이 없습니다.</div>';
}

function renderPresetPostDetail(post, info, auth, favorites) {
  const favorite = favorites.has(Number(post.id));
  const canEdit = Boolean(auth.member && (
    String(post.author_member_key || '') === String(auth.member.member_key || '')
    || String(auth.member.role || '').toLowerCase() === 'admin'
  ));
  const summary = summarizePreset(post, info.modbooks);
  const tags = Array.isArray(post.tags) ? post.tags : [];

  return `
    <article class="ops-info-preset-article">
      <header class="ops-info-preset-article__head">
        <div>
          <span class="ops-info-kicker">${post.system_key ? 'AXE OFFICIAL' : 'MEMBER BUILD'}</span>
          <h2>${h(post.title)}</h2>
          <div class="ops-info-preset-article__meta">
            <span>${h(post.author_nickname || 'AXE')}</span>
            <span>${h(formatPresetDate(post.updated_at || post.created_at))}</span>
            <span>★ ${Number(post.favorite_count || 0)}</span>
          </div>
        </div>
        <div class="ops-info-preset-article__actions">
          <button type="button" class="ops-info-btn ${favorite ? 'ops-info-btn--saved' : ''}" data-info-preset-favorite="${Number(post.id)}">${favorite ? '★ 저장됨' : '☆ 내 프리셋'}</button>
          ${auth.member ? `<button type="button" class="ops-info-btn" data-info-preset-clone="${Number(post.id)}">복제해서 작성</button>` : ''}
          ${canEdit ? `<button type="button" class="ops-info-btn" data-info-preset-edit="${Number(post.id)}">수정</button><button type="button" class="ops-info-btn ops-info-btn--danger" data-info-preset-delete="${Number(post.id)}">삭제</button>` : ''}
        </div>
      </header>

      ${tags.length ? `<div class="ops-info-preset-article__tags">${tags.map((tag) => `<span>#${h(tag)}</span>`).join('')}</div>` : ''}
      <div class="ops-info-preset-article__description">${formatPresetDescription(post.description)}</div>

      <div class="ops-info-preset-article__build-layout">
        <div class="ops-info-preset-inventory ops-info-preset-inventory--article">
          <div class="ops-info-preset-inventory__bar">
            <strong>인벤토리</strong>
            <span>장비 <b>1</b></span>
            <em>AXE BUILD</em>
          </div>
          <div class="ops-info-preset-board">
            ${renderPresetGhostSlots()}
            ${MODBOOK_PRESET_SLOT_ORDER.map((slotKey) => renderPresetSlot(
              post,
              slotKey,
              post.slots[slotKey],
              info.modbooks,
              info.selectedModbookPresetSlot,
            )).join('')}
          </div>
          <div class="ops-info-preset-mobile-detail">
            ${post.slots[info.selectedModbookPresetSlot]
              ? renderPresetTooltip(post, info.selectedModbookPresetSlot, post.slots[info.selectedModbookPresetSlot], info.modbooks, { mobile: true })
              : ''}
          </div>
        </div>

        <section class="ops-info-preset-aggregate ops-info-preset-aggregate--side">
          <div class="ops-info-preset-aggregate__head">
            <div><span class="ops-info-kicker">MAX ROLL SUMMARY</span><h3>전체 옵션 요약</h3></div>
            <small>최대값 합산</small>
          </div>
          <div class="ops-info-preset-summary__stats">
            ${summary.positive.length ? summary.positive.slice(0, 10).map((item) => `
              <div class="${item.label === '이동 속도 증가' ? 'is-primary' : ''}">
                <span>${h(item.label)}</span>
                <strong>+${item.unit === '%' ? `${formatCompactNumber(item.value)}%` : formatCompactNumber(item.value)}</strong>
              </div>
            `).join('') : '<div class="ops-info-preset-aggregate__empty">합산 가능한 옵션이 없습니다.</div>'}
          </div>
          ${summary.negative.length ? `
            <div class="ops-info-preset-warning">
              <strong>주의 옵션</strong>
              ${summary.negative.map((item) => `<span>${h(item.label)} ${h(item.range)}</span>`).join('')}
            </div>
          ` : ''}
          <p class="ops-info-preset-aggregate__hint">장비 부위에 마우스를 올리면 해당 부위의 접두·접미 옵션을 자세히 볼 수 있습니다.</p>
        </section>
      </div>

      ${renderPresetSlotNotes(post)}
    </article>
  `;
}

function renderPresetSlotNotes(post) {
  const notes = MODBOOK_PRESET_SLOT_ORDER
    .map((slotKey) => [presetSlotLabel(slotKey), String(post.slots?.[slotKey]?.note || '').trim()])
    .filter(([, note]) => note);
  if (!notes.length) return '';
  return `
    <section class="ops-info-preset-slot-notes">
      <h3>부위별 코멘트</h3>
      ${notes.map(([label, note]) => `<div><strong>${h(label)}</strong><p>${h(note)}</p></div>`).join('')}
    </section>
  `;
}

function formatPresetDescription(value) {
  const text = String(value || '').trim();
  if (!text) return '<p class="is-empty">작성된 설명이 없습니다.</p>';
  return text.split(/\n{2,}/).map((paragraph) => `<p>${h(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
}

function formatPresetDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).format(date);
}

function renderPresetGhostSlots() {
  const ghosts = [
    ['ghost-a', '좌측 슬롯'],
    ['ghost-b', '안경 슬롯'],
    ['ghost-c', '모자 슬롯'],
    ['ghost-d', '마스크 슬롯'],
    ['ghost-e', '목 슬롯'],
    ['ghost-f', '기타 슬롯'],
    ['ghost-g', '기타 슬롯'],
  ];
  return ghosts.map(([key, label]) => `
    <span class="ops-info-preset-ghost ops-info-preset-ghost--${key}" aria-hidden="true" title="${a(label)}"></span>
  `).join('');
}

function renderPresetSlot(preset, slotKey, slot, modbooks, selectedSlotKey) {
  if (!slot) return '';
  const resolved = resolvePresetSlot(slot, modbooks);
  const movement = sumMovement(resolved.mods);
  const selected = selectedSlotKey === slotKey;

  return `
    <div class="ops-info-preset-slot-wrap ops-info-preset-slot-wrap--${a(slotKey)} ${selected ? 'is-selected' : ''}">
      <button
        class="ops-info-preset-slot ${selected ? 'is-selected' : ''}"
        type="button"
        data-info-preset-slot="${a(slotKey)}"
        aria-label="${a(slot.label)} 추천 개조서"
      >
        <span class="ops-info-preset-slot__frame">
          <img src="${a(slot.image)}" alt="" loading="lazy" draggable="false" />
        </span>
        <span class="ops-info-preset-slot__label">${h(slot.label)}</span>
        ${movement > 0 ? `<em>+${formatCompactNumber(movement)}%</em>` : ''}
      </button>
      ${renderPresetTooltip(preset, slotKey, slot, modbooks)}
    </div>
  `;
}

function renderPresetTooltip(preset, slotKey, slot, modbooks, options = {}) {
  const resolved = resolvePresetSlot(slot, modbooks);
  const movement = sumMovement(resolved.mods);
  const missing = resolved.missing;
  const classes = [
    'ops-info-preset-tooltip',
    `ops-info-preset-tooltip--${slotKey}`,
    options.mobile ? 'is-mobile' : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="${classes}" role="${options.mobile ? 'region' : 'tooltip'}">
      <div class="ops-info-preset-tooltip__head">
        <div>
          <span>${h(preset.title)}</span>
          <strong>${h(slot.label)}</strong>
        </div>
        ${movement > 0 ? `<b>+${formatCompactNumber(movement)}%</b>` : ''}
      </div>

      ${resolved.mods.length ? resolved.mods.map((item) => renderPresetMod(item)).join('') : ''}
      ${slot.note ? `<div class="ops-info-preset-emptyhint">${h(slot.note)}</div>` : ''}
      ${missing.length ? `<div class="ops-info-preset-missing">현재 데이터에서 찾지 못함: ${missing.map((item) => h(`${item.type} ${item.name}`)).join(', ')}</div>` : ''}
      <small>표시 수치 = 해당 옵션의 최대값 · 괄호 = 실제 등장 범위</small>
    </div>
  `;
}

function renderPresetMod(item) {
  const typeClass = item.type === '접두' ? 'is-prefix' : 'is-suffix';
  const options = [item.option1, item.option2, item.option3]
    .filter((value) => String(value || '').trim())
    .map(parsePresetOption);

  return `
    <section class="ops-info-preset-mod ${typeClass}">
      <header>
        <strong>${h(cleanModbookName(item.name))}</strong>
        <span>${h(item.type)}</span>
      </header>
      <div class="ops-info-preset-mod__options">
        ${options.map((option) => `
          <div class="${option.negative ? 'is-negative' : ''}">
            <b>${h(option.bestDisplay || '—')}</b>
            <span>${h(option.label)}</span>
            ${option.range ? `<small>(${h(option.range)})</small>` : ''}
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function resolvePresetSlot(slot, modbooks) {
  const mods = [];
  const missing = [];
  if (!slot) return { mods, missing };

  const idRefs = [
    ['접두', slot.prefixModbookId],
    ['접미', slot.suffixModbookId],
  ].filter(([, id]) => Number.isInteger(Number(id)) && Number(id) > 0);

  if (idRefs.length) {
    idRefs.forEach(([type, id]) => {
      const match = (modbooks || []).find((item) => Number(item.id) === Number(id));
      if (match) mods.push(match);
      else missing.push({ type, name: `#${id}` });
    });
    return { mods, missing };
  }

  (slot.mods || []).forEach((ref) => {
    const match = findPresetModbook(modbooks, ref);
    if (match) mods.push(match);
    else missing.push(ref);
  });

  return { mods, missing };
}

function findPresetModbook(modbooks, ref) {
  const targetName = normalizePresetName(ref.name);
  return (modbooks || []).find((item) => (
    String(item.type || '').trim() === String(ref.type || '').trim()
    && normalizePresetName(cleanModbookName(item.name)) === targetName
  )) || null;
}

function normalizePresetName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function canonicalPresetOptionLabel(value) {
  const display = String(value || '').replace(/\s+/g, ' ').trim();
  const key = display.replace(/\s+/g, '').toLowerCase();
  const aliases = {
    '이동속도증가': '이동 속도 증가',
    '최대스태미나증가': '최대 스태미나 증가',
    '최대체력증가': '최대 체력 증가',
    '전력질주스태미나감소': '전력질주 스태미나 감소',
  };
  return aliases[key] || display;
}

function parsePresetOption(value) {
  const raw = String(value || '').trim();
  const negative = raw.startsWith('*');
  const clean = raw.replace(/^\*\s*/, '').trim();
  const match = clean.match(/^(.*?)\s*\(([^)]+)\)\s*$/);

  if (!match) {
    return { raw, negative, label: canonicalPresetOptionLabel(clean), range: '', value: null, unit: '', bestDisplay: '' };
  }

  const label = canonicalPresetOptionLabel(match[1]);
  const range = match[2].replace(/\s*~\s*/g, ' ~ ').trim();
  const tokens = [...range.matchAll(/-?\d+(?:\.\d+)?\s*%?/g)].map((entry) => entry[0].replace(/\s+/g, ''));
  const bestToken = tokens.length ? tokens[tokens.length - 1] : '';
  const unit = bestToken.endsWith('%') ? '%' : '';
  const numeric = Number(bestToken.replace('%', ''));

  return {
    raw,
    negative,
    label,
    range,
    value: Number.isFinite(numeric) ? numeric : null,
    unit,
    bestDisplay: bestToken,
  };
}

function sumMovement(mods) {
  return (mods || []).reduce((total, item) => {
    const options = [item.option1, item.option2, item.option3]
      .filter(Boolean)
      .map(parsePresetOption);
    const movement = options.find((option) => !option.negative && option.label === '이동 속도 증가' && option.value != null);
    return total + (movement?.value || 0);
  }, 0);
}

function summarizePreset(preset, modbooks) {
  const totals = new Map();
  const negative = [];
  let movement = 0;

  MODBOOK_PRESET_SLOT_ORDER.forEach((slotKey) => {
    const slot = preset.slots?.[slotKey];
    if (!slot) return;

    resolvePresetSlot(slot, modbooks).mods.forEach((item) => {
      [item.option1, item.option2, item.option3].filter(Boolean).forEach((value) => {
        const option = parsePresetOption(value);
        if (option.value == null) return;
        if (option.negative) {
          negative.push(option);
          return;
        }

        const key = `${option.label}|${option.unit}`;
        const current = totals.get(key) || { label: option.label, unit: option.unit, value: 0 };
        current.value += option.value;
        totals.set(key, current);

        if (option.label === '이동 속도 증가') movement += option.value;
      });
    });
  });

  return {
    movement,
    positive: [...totals.values()].sort((a, b) => {
      if (a.label === '이동 속도 증가') return -1;
      if (b.label === '이동 속도 증가') return 1;
      return b.value - a.value;
    }),
    negative,
  };
}

function formatCompactNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, '');
}


function renderSkillRanks(info) {
  const skills = unique(info.skillRanks.map((item) => item.skill));
  const skill = info.filters.skill;
  const keyword = normalized(info.filters.skillSearch);
  let list = info.skillRanks.filter((item) => skill === 'all' || item.skill === skill);
  if (keyword) list = list.filter((item) => searchable(Object.values(item), keyword));

  return `
    <section class="ops-info-workspace ops-info-workspace--skill">
      ${filterBar('skill', skill, '스킬', skills, 'skillSearch', info.filters.skillSearch, '스킬, 랭크, 포인트 검색', list.length)}
      <div class="ops-info-table ops-info-table--skill">
        <div class="ops-info-table__head"><span>스킬</span><span>랭크</span><span>필요 포인트</span></div>
        ${list.length ? list.map((item) => `
          <div class="ops-info-table__row">
            <strong>${h(item.skill)}</strong>
            <span>${formatRank(item.rank)}</span>
            <b>${formatNumber(item.required_point)}${h(item.point_type || '')}</b>
            ${item.note ? `<small>${h(item.note)}</small>` : ''}
          </div>
        `).join('') : empty('검색 결과가 없습니다.')}
      </div>
    </section>
  `;
}

function filterBar(selectKey, selected, label, values, searchKey, searchValue, placeholder, count) {
  return `
    <div class="ops-info-toolbar">
      ${selectField(selectKey, selected, label, values)}
      <label class="ops-info-field ops-info-field--search">
        <span>검색</span>
        <input type="search" value="${a(searchValue)}" placeholder="${a(placeholder)}" data-info-search="${a(searchKey)}" data-ime-search="info:${a(searchKey)}" />
      </label>
      <span class="ops-info-result">${count}건</span>
    </div>
  `;
}

function selectField(key, selected, label, values) {
  return `
    <label class="ops-info-field ops-info-field--select">
      <span>${h(label)}</span>
      <select data-info-filter="${a(key)}">
        <option value="all">전체</option>
        ${values.map((value) => `<option value="${a(value)}" ${selected === value ? 'selected' : ''}>${h(value)}</option>`).join('')}
      </select>
    </label>
  `;
}

function renderRequestModal(info, auth) {
  if (!info.modbookRequest.open) return '';
  const categories = unique(info.modbooks.map((item) => item.category));
  const parts = unique(info.modbooks.flatMap((item) => splitParts(item.parts)));
  const optionCandidates = unique(info.modbooks.flatMap((item) => [item.option1, item.option2, item.option3]));
  return `
    <div class="ops-info-modal-backdrop" data-info-modal-close="request">
      <section class="ops-info-modal ops-info-modal--request" role="dialog" aria-modal="true" aria-label="개조서 등록신청" data-info-modal-panel>
        <header><div><h2>개조서 등록신청</h2><p>${auth.member ? `${h(auth.member.nickname)} 이름으로 신청합니다.` : '팀원 로그인이 필요합니다.'}</p></div><button type="button" data-info-modal-close="request">×</button></header>
        ${info.modbookRequest.error ? `<div class="ops-info__error">${h(info.modbookRequest.error)}</div>` : ''}
        ${info.modbookRequest.message ? `<div class="ops-info__success">${h(info.modbookRequest.message)}</div>` : ''}
        ${auth.member ? `
          <form class="ops-info-form" data-info-request-form>
            <div class="ops-info-form__grid">
              <label><span>위치</span><select name="type" required><option value="접두">접두</option><option value="접미">접미</option></select></label>
              <label><span>분류</span><input name="category" list="info-category-list" required /></label>
              <label class="is-wide"><span>개조서 이름</span><input name="name" required /></label>
              <label class="is-wide"><span>적용 부위</span><input name="parts" list="info-parts-list" placeholder="예: 신발, 하의" required /></label>
              <label class="is-wide"><span>옵션 1</span><input name="option1" list="info-option-list" required /></label>
              <label class="is-wide"><span>옵션 2</span><input name="option2" list="info-option-list" /></label>
              <label class="is-wide"><span>옵션 3</span><input name="option3" list="info-option-list" /></label>
              <label><span>성공률 (%)</span><input name="success_rate" type="number" min="0" max="100" /></label>
              <label class="is-wide"><span>메모</span><textarea name="note" rows="3"></textarea></label>
            </div>
            <datalist id="info-category-list">${categories.map((value) => `<option value="${a(value)}"></option>`).join('')}</datalist>
            <datalist id="info-parts-list">${parts.map((value) => `<option value="${a(value)}"></option>`).join('')}</datalist>
            <datalist id="info-option-list">${optionCandidates.map((value) => `<option value="${a(value)}"></option>`).join('')}</datalist>
            <footer><button class="ops-info-btn" type="button" data-info-my-requests>내 신청 새로고침</button><button class="ops-info-btn ops-info-btn--gold" type="submit" ${info.modbookRequest.saving ? 'disabled' : ''}>${info.modbookRequest.saving ? '신청 중' : '등록신청'}</button></footer>
          </form>
          ${renderMyRequests(info.modbookRequest.myRequests, info.modbookRequest.loading)}
        ` : `<div class="ops-info-login-required"><strong>팀원 로그인이 필요합니다.</strong><span>상단 로그인에서 팀원 계정으로 로그인한 뒤 다시 신청하세요.</span></div>`}
      </section>
    </div>
  `;
}

function renderMyRequests(items, loading) {
  return `
    <section class="ops-info-my-requests">
      <h3>내 최근 신청</h3>
      ${loading ? '<div class="ops-info-mini-loading">불러오는 중...</div>' : ''}
      ${items?.length ? items.slice(0, 8).map((item) => `
        <div class="ops-info-request-row">
          <div><strong>${h(item.name)}</strong><span>${h(item.type)} · ${h(item.category)} · ${formatDateTime(item.created_at)}</span></div>
          ${requestStatus(item.status)}
          ${item.review_note ? `<small>${h(item.review_note)}</small>` : ''}
        </div>
      `).join('') : '<div class="ops-info-empty-mini">최근 신청이 없습니다.</div>'}
    </section>
  `;
}

function renderAdminRequestsModal(info, auth) {
  if (!auth.admin || !info.admin.requestsOpen) return '';
  const requests = info.admin.requests || [];
  const pending = requests.filter((item) => item.status === 'pending');
  return `
    <div class="ops-info-modal-backdrop" data-info-modal-close="adminRequests">
      <section class="ops-info-modal ops-info-modal--review" role="dialog" aria-modal="true" aria-label="개조서 신청 검수" data-info-modal-panel>
        <header><div><h2>개조서 신청 검수</h2><p>검수대기 ${pending.length}건</p></div><button type="button" data-info-modal-close="adminRequests">×</button></header>
        ${info.admin.error ? `<div class="ops-info__error">${h(info.admin.error)}</div>` : ''}
        <div class="ops-info-review-list">
          ${info.admin.loading ? '<div class="ops-info-mini-loading">신청을 불러오는 중입니다.</div>' : ''}
          ${pending.length ? pending.map((item) => `
            <article class="ops-info-review-card">
              <div class="ops-info-review-card__main">
                <div><strong>${h(item.name)}</strong><span>${h(item.type)} · ${h(item.category)} · ${h(item.parts)}</span></div>
                <small>${h(item.nickname)} · ${formatDateTime(item.created_at)}</small>
              </div>
              <div class="ops-info-review-card__options">${[item.option1,item.option2,item.option3].filter(Boolean).map((value) => `<span>${h(value)}</span>`).join('')}</div>
              <div class="ops-info-review-card__actions">
                <input type="text" placeholder="검수 메모 / 반려 사유" data-info-review-note="${Number(item.id)}" />
                <button class="ops-info-btn ops-info-btn--gold" type="button" data-info-review-action="approve" data-info-request-id="${Number(item.id)}">승인</button>
                <button class="ops-info-btn ops-info-btn--danger" type="button" data-info-review-action="reject" data-info-request-id="${Number(item.id)}">반려</button>
              </div>
            </article>
          `).join('') : '<div class="ops-info-empty-mini">검수대기 신청이 없습니다.</div>'}
        </div>
      </section>
    </div>
  `;
}

function renderModbookEditorModal(info, auth) {
  if (!auth.admin || !info.admin.editorOpen) return '';
  const item = info.modbooks.find((row) => Number(row.id) === Number(info.admin.editorId)) || {};
  const categories = unique(info.modbooks.map((row) => row.category));
  const parts = unique(info.modbooks.flatMap((row) => splitParts(row.parts)));
  const optionCandidates = unique(info.modbooks.flatMap((row) => [row.option1, row.option2, row.option3]));
  return `
    <div class="ops-info-modal-backdrop" data-info-modal-close="editor">
      <section class="ops-info-modal ops-info-modal--editor" role="dialog" aria-modal="true" aria-label="개조서 정보 편집" data-info-modal-panel>
        <header><div><h2>${item.id ? '개조서 정보 수정' : '개조서 직접 등록'}</h2><p>정식 개조서 목록에 바로 반영됩니다.</p></div><button type="button" data-info-modal-close="editor">×</button></header>
        ${info.admin.error ? `<div class="ops-info__error">${h(info.admin.error)}</div>` : ''}
        <form class="ops-info-form" data-info-editor-form>
          <input type="hidden" name="id" value="${item.id ? Number(item.id) : ''}" />
          <div class="ops-info-form__grid">
            <label><span>위치</span><select name="type"><option value="접두" ${item.type !== '접미' ? 'selected' : ''}>접두</option><option value="접미" ${item.type === '접미' ? 'selected' : ''}>접미</option></select></label>
            <label><span>분류</span><input name="category" list="info-editor-category-list" value="${a(item.category || '')}" required /></label>
            <label class="is-wide"><span>개조서 이름</span><input name="name" value="${a(cleanModbookName(item.name || ''))}" required /></label>
            <label class="is-wide"><span>적용 부위</span><input name="parts" list="info-editor-parts-list" value="${a(item.parts || '')}" required /></label>
            <label class="is-wide"><span>옵션 1</span><input name="option1" list="info-editor-option-list" value="${a(item.option1 || '')}" /></label>
            <label class="is-wide"><span>옵션 2</span><input name="option2" list="info-editor-option-list" value="${a(item.option2 || '')}" /></label>
            <label class="is-wide"><span>옵션 3</span><input name="option3" list="info-editor-option-list" value="${a(item.option3 || '')}" /></label>
            <label><span>성공률 (%)</span><input name="success_rate" type="number" min="0" max="100" value="${item.success_rate ?? ''}" /></label>
            <label class="is-wide"><span>메모</span><textarea name="note" rows="3">${h(item.note || '')}</textarea></label>
          </div>
          <datalist id="info-editor-category-list">${categories.map((value) => `<option value="${a(value)}"></option>`).join('')}</datalist>
          <datalist id="info-editor-parts-list">${parts.map((value) => `<option value="${a(value)}"></option>`).join('')}</datalist>
          <datalist id="info-editor-option-list">${optionCandidates.map((value) => `<option value="${a(value)}"></option>`).join('')}</datalist>
          <footer><button class="ops-info-btn ops-info-btn--gold" type="submit" ${info.admin.saving ? 'disabled' : ''}>${info.admin.saving ? '저장 중' : '저장'}</button></footer>
        </form>
      </section>
    </div>
  `;
}

function renderPriceModal(info, auth) {
  if (!info.admin.priceOpen) return '';
  const item = info.modbooks.find((row) => Number(row.id) === Number(info.admin.priceId));
  if (!item) return '';
  const canEdit = Boolean(auth.member || auth.admin);
  return `
    <div class="ops-info-modal-backdrop" data-info-modal-close="price">
      <section class="ops-info-modal ops-info-modal--price" role="dialog" aria-modal="true" aria-label="최근 거래가 설정" data-info-modal-panel>
        <header><div><h2>최근 거래가 설정</h2><p>${h(cleanModbookName(item.name))}</p></div><button type="button" data-info-modal-close="price">×</button></header>
        ${canEdit ? `
          <form class="ops-info-form" data-info-price-form>
            <input type="hidden" name="id" value="${Number(item.id)}" />
            <label class="ops-info-price-field"><span>거래가격</span><div><input name="recent_price" inputmode="numeric" value="${item.recent_price ?? ''}" placeholder="비우면 거래가 삭제" /><b>$</b></div></label>
            <p class="ops-info-form-hint">저장 시 거래일과 등록자명이 자동으로 갱신됩니다.</p>
            <footer><button class="ops-info-btn ops-info-btn--gold" type="submit" ${info.admin.saving ? 'disabled' : ''}>저장</button></footer>
          </form>
        ` : '<div class="ops-info-login-required">로그인이 필요합니다.</div>'}
      </section>
    </div>
  `;
}


function renderPresetEditorModal(info, auth) {
  const editor = info.presetEditor || {};
  if (!editor.open || !auth.member) return '';

  const sourceId = editor.postId ?? editor.cloneFromId;
  const rawSource = (info.presetPosts || []).find((post) => Number(post.id) === Number(sourceId)) || null;
  const source = rawSource ? presetPostViewModel(rawSource) : presetPostViewModel({ slots: [] });
  const cloning = editor.postId == null && editor.cloneFromId != null;
  const title = cloning && rawSource ? `${rawSource.title} - 내 버전` : (rawSource?.title || '');
  const description = rawSource?.description || '';
  const tags = Array.isArray(rawSource?.tags) ? rawSource.tags.join(', ') : '';

  return `
    <div class="ops-info-modal-backdrop" data-info-modal-close="presetEditor">
      <section class="ops-info-modal ops-info-modal--preset-editor" role="dialog" aria-modal="true" aria-label="추천세팅 작성" data-info-modal-panel>
        <header>
          <div>
            <h2>${editor.postId ? '추천세팅 수정' : cloning ? '추천세팅 복제 작성' : '추천세팅 작성'}</h2>
            <p>보유한 개조서 데이터에서 부위별 접두/접미를 선택합니다. 게시글에서는 최대 옵션 기준으로 표시됩니다.</p>
          </div>
          <button type="button" data-info-modal-close="presetEditor">×</button>
        </header>

        ${editor.error ? `<div class="ops-info__error">${h(editor.error)}</div>` : ''}

        <form class="ops-info-form ops-info-preset-editor-form" data-info-preset-editor-form>
          <div class="ops-info-preset-editor-main">
            <label class="is-wide"><span>제목</span><input name="title" maxlength="100" value="${a(title)}" placeholder="예: 이동속도 1티어 / 무법 생존 세팅" required /></label>
            <label class="is-wide"><span>태그</span><input name="tags" value="${a(tags)}" placeholder="이동속도, 무법, 밸런스 (쉼표 구분)" /></label>
            <label class="is-wide"><span>설명</span><textarea name="description" rows="5" maxlength="4000" placeholder="이 조합을 추천하는 이유, 실제 사용감, 주의점 등을 적어주세요.">${h(description)}</textarea></label>
          </div>

          <div class="ops-info-preset-editor-slots">
            ${MODBOOK_PRESET_SLOT_ORDER.map((slotKey) => renderPresetEditorSlot(
              slotKey,
              source.slots[slotKey],
              info.modbooks,
            )).join('')}
          </div>

          <div class="ops-info-preset-editor-guide">
            <strong>작성 기준</strong>
            <span>개조서 수치는 직접 입력하지 않습니다. AXE NET에 등록된 원본 개조서 옵션을 사용하고, 게시글에서는 해당 옵션의 최대값을 자동 표시합니다.</span>
          </div>

          <footer>
            <button class="ops-info-btn" type="button" data-info-modal-close="presetEditor">취소</button>
            <button class="ops-info-btn ops-info-btn--gold" type="submit" ${editor.saving ? 'disabled' : ''}>${editor.saving ? '저장 중' : '게시하기'}</button>
          </footer>
        </form>
      </section>
    </div>
  `;
}

function renderPresetEditorSlot(slotKey, slot, modbooks) {
  const label = presetSlotLabel(slotKey);
  const prefix = compatiblePresetModbooks(modbooks, label, '접두');
  const suffix = compatiblePresetModbooks(modbooks, label, '접미');
  const categories = unique([...prefix, ...suffix].map((item) => item.category));
  return `
    <section class="ops-info-preset-editor-slot" data-info-preset-editor-slot="${a(slotKey)}">
      <header>
        <div class="ops-info-preset-editor-slot__image"><img src="${a(slot?.image || '')}" alt="" /></div>
        <div><span>장비 부위</span><strong>${h(label)}</strong><small>사용 가능 ${prefix.length + suffix.length}개</small></div>
      </header>

      <div class="ops-info-preset-editor-filter" data-info-preset-mod-filter="${a(slotKey)}">
        <label>
          <span>분류</span>
          <select data-info-preset-mod-category>
            <option value="all">전체 분류</option>
            ${categories.map((category) => `<option value="${a(category)}">${h(category)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>검색</span>
          <input type="search" placeholder="개조서명 / 옵션 검색" data-info-preset-mod-search />
        </label>
      </div>

      ${presetEditorSelect(`${slotKey}_prefix_id`, '접두', prefix, slot?.prefixModbookId, slotKey)}
      ${presetEditorSelect(`${slotKey}_suffix_id`, '접미', suffix, slot?.suffixModbookId, slotKey)}
      <label class="ops-info-preset-editor-note"><span>부위 설명</span><textarea name="${a(slotKey)}_note" rows="2" maxlength="500" placeholder="이 부위 조합을 선택한 이유">${h(slot?.note || '')}</textarea></label>
    </section>
  `;
}

function presetPartCompatible(partsValue, part) {
  const groups = String(partsValue || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (part === '겉옷') {
    return groups.some((group) => group === '겉옷' || group.split('/').map((value) => value.trim()).includes('겉옷'));
  }
  return groups.includes(part);
}

function compatiblePresetModbooks(modbooks, part, type) {
  return (modbooks || [])
    .filter((item) => String(item.type || '').trim() === type && presetPartCompatible(item.parts, part))
    .sort((a, b) => {
      const categoryCompare = String(a.category || '').localeCompare(String(b.category || ''), 'ko');
      if (categoryCompare) return categoryCompare;
      return cleanModbookName(a.name).localeCompare(cleanModbookName(b.name), 'ko');
    });
}

function presetEditorSelect(name, type, items, selectedId, slotKey) {
  return `
    <label class="ops-info-preset-editor-select">
      <span>${h(type)} <small data-info-preset-mod-count="${a(type)}">${items.length}개</small></span>
      <select name="${a(name)}" data-info-preset-mod-select data-info-preset-mod-type="${a(type)}" data-info-preset-mod-slot="${a(slotKey)}">
        <option value="">선택 안 함</option>
        ${items.map((item) => {
          const summary = presetModbookOptionSummary(item);
          const searchText = [cleanModbookName(item.name), item.category, item.option1, item.option2, item.option3]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
          return `
            <option
              value="${Number(item.id)}"
              data-mod-id="${Number(item.id)}"
              data-mod-category="${a(item.category || '')}"
              data-mod-search="${a(searchText)}"
              ${Number(item.id) === Number(selectedId) ? 'selected' : ''}
              title="${a(summary)}"
            >
              [${h(item.category || '기타')}] ${h(cleanModbookName(item.name))}${summary ? ` · ${h(summary)}` : ''}
            </option>
          `;
        }).join('')}
      </select>
    </label>
  `;
}

function presetModbookOptionSummary(item) {
  const options = [item?.option1, item?.option2, item?.option3]
    .filter((value) => String(value || '').trim())
    .map(parsePresetOption)
    .filter((option) => option.label)
    .slice(0, 2);
  return options.map((option) => `${option.label}${option.range ? ` (${option.range})` : ''}`).join(' / ');
}

function bindEvents(root, state, actions) {
  root.querySelectorAll('[data-info-tab]').forEach((button) => {
    button.addEventListener('click', () => actions.onTabChange?.(button.dataset.infoTab));
  });
  root.querySelector('[data-info-refresh]')?.addEventListener('click', () => actions.onRefresh?.());

  root.querySelectorAll('[data-info-filter]').forEach((select) => {
    select.addEventListener('change', () => actions.onFilterChange?.(select.dataset.infoFilter, select.value));
  });

  root.querySelectorAll('[data-info-search]').forEach((input) => {
    bindImeSafeInput(
      input,
      (value) => actions.onFilterChange?.(input.dataset.infoSearch, value),
      { delay: 220 },
    );
  });

  root.querySelectorAll('[data-info-craft-id]').forEach((button) => {
    button.addEventListener('click', () => actions.onSelectCraft?.(button.dataset.infoCraftId));
  });
  root.querySelectorAll('[data-info-preset-id]').forEach((button) => {
    button.addEventListener('click', () => actions.onSelectModbookPreset?.(button.dataset.infoPresetId));
  });
  root.querySelector('[data-info-preset-back]')?.addEventListener('click', () => actions.onBackPresetList?.());

  root.querySelectorAll('[data-info-preset-filter]').forEach((button) => {
    button.addEventListener('click', () => actions.onPresetFilterChange?.(button.dataset.infoPresetFilter));
  });

  const presetSearch = root.querySelector('[data-info-preset-search]');
  if (presetSearch) {
    bindImeSafeInput(
      presetSearch,
      (value) => actions.onPresetSearchChange?.(value),
      { delay: 220 },
    );
  }

  root.querySelector('[data-info-preset-new]')?.addEventListener('click', () => actions.onOpenPresetEditor?.(null, false));
  root.querySelectorAll('[data-info-preset-favorite]').forEach((button) => {
    button.addEventListener('click', () => actions.onTogglePresetFavorite?.(Number(button.dataset.infoPresetFavorite)));
  });
  root.querySelectorAll('[data-info-preset-clone]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenPresetEditor?.(Number(button.dataset.infoPresetClone), true));
  });
  root.querySelectorAll('[data-info-preset-edit]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenPresetEditor?.(Number(button.dataset.infoPresetEdit), false));
  });
  root.querySelectorAll('[data-info-preset-delete]').forEach((button) => {
    button.addEventListener('click', () => actions.onDeletePresetPost?.(Number(button.dataset.infoPresetDelete)));
  });

  root.querySelectorAll('[data-info-preset-slot]').forEach((button) => {
    button.addEventListener('click', () => actions.onSelectModbookPresetSlot?.(button.dataset.infoPresetSlot));
  });

  root.querySelectorAll('[data-info-modbook-id]').forEach((button) => {
    button.addEventListener('click', () => actions.onSelectModbook?.(Number(button.dataset.infoModbookId)));
  });

  root.querySelector('[data-info-request-open]')?.addEventListener('click', () => actions.onOpenRequest?.());
  root.querySelector('[data-info-my-requests]')?.addEventListener('click', () => actions.onLoadMyRequests?.());
  root.querySelector('[data-info-admin-requests]')?.addEventListener('click', () => actions.onOpenAdminRequests?.());
  root.querySelector('[data-info-modbook-new]')?.addEventListener('click', () => actions.onOpenEditor?.(null));
  root.querySelectorAll('[data-info-modbook-edit]').forEach((button) => button.addEventListener('click', () => actions.onOpenEditor?.(Number(button.dataset.infoModbookEdit))));
  root.querySelectorAll('[data-info-modbook-deactivate]').forEach((button) => button.addEventListener('click', () => actions.onDeactivate?.(Number(button.dataset.infoModbookDeactivate))));
  root.querySelectorAll('[data-info-price-open]').forEach((button) => button.addEventListener('click', () => actions.onOpenPrice?.(Number(button.dataset.infoPriceOpen))));

  root.querySelectorAll('[data-info-modal-close]').forEach((element) => {
    element.addEventListener('click', (event) => {
      // 모달 바깥 영역은 의도치 않은 작성 내용 유실을 막기 위해 닫기 동작을 하지 않습니다.
      // 닫기 버튼 / 취소 버튼 / ESC / 브라우저 뒤로가기만 모달을 닫습니다.
      if (element.classList.contains('ops-info-modal-backdrop')) return;
      event.stopPropagation();
      actions.onCloseModal?.(element.dataset.infoModalClose);
    });
  });

  root.querySelector('[data-info-request-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.onSubmitRequest?.(formObject(event.currentTarget));
  });
  root.querySelector('[data-info-editor-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.onSaveModbook?.(formObject(event.currentTarget));
  });
  root.querySelector('[data-info-price-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.onSavePrice?.(formObject(event.currentTarget));
  });
  root.querySelectorAll('[data-info-preset-mod-filter]').forEach((filterRoot) => {
    const slotRoot = filterRoot.closest('[data-info-preset-editor-slot]');
    const category = filterRoot.querySelector('[data-info-preset-mod-category]');
    const search = filterRoot.querySelector('[data-info-preset-mod-search]');
    if (!slotRoot || !category || !search) return;

    const applyPresetModFilter = () => {
      const categoryValue = String(category.value || 'all');
      const query = String(search.value || '').trim().toLowerCase().replace(/\s+/g, ' ');

      slotRoot.querySelectorAll('[data-info-preset-mod-select]').forEach((select) => {
        let visible = 0;
        select.querySelectorAll('option[data-mod-id]').forEach((option) => {
          const categoryMatch = categoryValue === 'all' || option.dataset.modCategory === categoryValue;
          const searchMatch = !query || String(option.dataset.modSearch || '').includes(query);
          const keepSelected = option.selected;
          const show = (categoryMatch && searchMatch) || keepSelected;
          option.hidden = !show;
          option.disabled = !show;
          if (show) visible += 1;
        });
        const type = select.dataset.infoPresetModType;
        const count = slotRoot.querySelector(`[data-info-preset-mod-count="${type}"]`);
        if (count) count.textContent = `${visible}개`;
      });
    };

    category.addEventListener('change', applyPresetModFilter);
    search.addEventListener('input', applyPresetModFilter);
    applyPresetModFilter();
  });

  root.querySelector('[data-info-preset-editor-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.onSavePresetPost?.(formObject(event.currentTarget));
  });

  root.querySelectorAll('[data-info-review-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.infoRequestId);
      const note = root.querySelector(`[data-info-review-note="${id}"]`)?.value || '';
      actions.onReviewRequest?.(id, button.dataset.infoReviewAction, note);
    });
  });
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function badge(text, tone = '') {
  return `<span class="ops-info-badge ${tone ? `is-${tone}` : ''}">${h(text)}</span>`;
}

function requestStatus(status) {
  const labels = { pending: '검수대기', approved: '승인', rejected: '반려' };
  return `<span class="ops-info-request-status is-${a(status || 'pending')}">${labels[status] || h(status || '검수대기')}</span>`;
}

function formatRank(value) {
  return h(value || '—').replace(/\s*(→|->|~)\s*/g, ' <i class="ops-info-rank-arrow">→</i> ');
}

function splitParts(value) {
  return String(value || '').split(',').map((part) => part.trim()).filter(Boolean);
}

function tier1(name) {
  return /\(\s*1\s*\)|1티어/.test(String(name || ''));
}

function cleanModbookName(name) {
  return String(name || '').replace(/\s*\(\s*1\s*\)\s*$/, '').replace(/\s*1티어\s*$/, '').trim();
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
}

function groupBy(items, key) {
  return items.reduce((result, item) => {
    const value = String(item[key] ?? '');
    (result[value] ||= []).push(item);
    return result;
  }, {});
}

function searchable(values, keyword) {
  return values.filter((value) => value != null).join(' ').toLowerCase().includes(keyword);
}

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return h(value || '0');
  return Number.isInteger(number) ? number.toLocaleString('ko-KR') : number.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

function formatMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number).toLocaleString('ko-KR') : '0';
}

function formatPercent(value) {
  if (value == null || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? `${number}%` : h(value);
}

function formatDate(value) {
  if (!value) return '';
  const text = String(value);
  return text.slice(0, 10).replaceAll('-', '.');
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return h(String(value));
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function empty(text) {
  return `<div class="ops-info-empty">${h(text)}</div>`;
}

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function a(value) {
  return h(value).replace(/`/g, '&#96;');
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return CSS.escape(String(value));
  return String(value).replace(/["\\]/g, '\\$&');
}
