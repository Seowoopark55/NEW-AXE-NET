export function renderCookingControlView(root, state, actions = {}) {
  const cooking = state.cookingControl || {};
  const isAdmin = Boolean(state.auth?.admin);

  if (!isAdmin) {
    root.innerHTML = `
      <section class="ops-cooking-control">
        <div class="ops-cooking-denied">
          <strong>접근 권한이 없습니다.</strong>
          <p>요리 주문 설정은 관리자만 사용할 수 있습니다.</p>
        </div>
      </section>
    `;
    return;
  }

  const config = cooking.config || {};
  const search = normalize(cooking.search);
  const filter = cooking.filter || 'all';
  const types = (cooking.types || [])
    .slice()
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.type_key || '').localeCompare(String(b.type_key || '')))
    .filter((row) => {
      if (filter === 'enabled' && row.enabled === false) return false;
      if (filter === 'disabled' && row.enabled !== false) return false;
      if (!search) return true;
      return normalize(`${row.label || ''} ${row.short_label || ''} ${row.detail || ''} ${row.type_key || ''}`).includes(search);
    });
  const activeCount = (cooking.types || []).filter((row) => row.enabled !== false).length;

  root.innerHTML = `
    <section class="ops-cooking-control" aria-label="요리 주문 설정">
      <header class="ops-cooking-control__head">
        <div>
          <span>COOKING ORDER</span>
          <h1>요리 주문 설정</h1>
          <p>Discord 주문 메뉴와 가격, 표시 순서, 주문 안내를 직접 관리합니다.</p>
        </div>
        <button type="button" class="ops-cooking-btn" data-cooking-refresh ${cooking.loading ? 'disabled' : ''}>${cooking.loading ? '확인 중' : '새로고침'}</button>
      </header>

      ${cooking.error ? `<div class="ops-cooking-alert is-error">${h(cooking.error)}</div>` : ''}
      ${cooking.message ? `<div class="ops-cooking-alert is-success">${h(cooking.message)}</div>` : ''}

      <form class="ops-cooking-guide" data-cooking-guide-form>
        <div class="ops-cooking-section-head">
          <div><strong>Discord 주문 안내</strong><small>주문판의 일정과 추가 안내문에 반영됩니다.</small></div>
          <button class="ops-cooking-btn is-gold" type="submit" ${cooking.savingGuide ? 'disabled' : ''}>${cooking.savingGuide ? '저장 중' : '안내 저장'}</button>
        </div>
        <div class="ops-cooking-guide__fields">
          <label><span>운영 일정</span><input name="schedule_text" maxlength="120" value="${a(config.schedule_text || '')}" placeholder="예: 매주 화요일 / 목요일 / 토요일" /></label>
          <label><span>추가 안내</span><textarea name="extra_guide" maxlength="1200" rows="5" placeholder="재료 수령 방식, 1 SET 기준 등 주문 안내를 입력하세요.">${h(config.extra_guide || '')}</textarea></label>
        </div>
      </form>

      <section class="ops-cooking-board">
        <div class="ops-cooking-section-head">
          <div><strong>주문 메뉴</strong><small>사용 ${activeCount} · 전체 ${(cooking.types || []).length}</small></div>
          <button class="ops-cooking-btn is-gold" type="button" data-cooking-new>메뉴 추가</button>
        </div>

        ${cooking.editor?.open ? renderEditor(cooking.editor) : ''}

        <div class="ops-cooking-toolbar">
          <label class="ops-cooking-search"><span>검색</span><input type="search" value="${a(cooking.search || '')}" placeholder="메뉴명, 설명 검색" data-cooking-search /></label>
          <label class="ops-cooking-filter"><span>상태</span><select data-cooking-filter><option value="all" ${filter === 'all' ? 'selected' : ''}>전체</option><option value="enabled" ${filter === 'enabled' ? 'selected' : ''}>사용 중</option><option value="disabled" ${filter === 'disabled' ? 'selected' : ''}>숨김</option></select></label>
        </div>

        <div class="ops-cooking-columns" aria-hidden="true"><span>메뉴</span><span>설명</span><span>가격 / SET</span><span>순서</span><span>상태</span><span>관리</span></div>
        <div class="ops-cooking-list">
          ${types.length ? types.map(renderRow).join('') : `<div class="ops-cooking-empty"><strong>표시할 요리 메뉴가 없습니다.</strong><span>검색 조건을 바꾸거나 새 메뉴를 추가해 주세요.</span></div>`}
        </div>
      </section>

      <div class="ops-cooking-note"><strong>안전 동작</strong><span>메뉴를 OFF로 바꿔도 기존 주문 기록은 유지됩니다. 내부 키는 기존 주문 연결을 위해 생성 후 변경하지 않습니다.</span></div>
    </section>
  `;

  root.querySelector('[data-cooking-refresh]')?.addEventListener('click', () => actions.onRefresh?.());
  root.querySelector('[data-cooking-new]')?.addEventListener('click', () => actions.onOpenNew?.());
  root.querySelector('[data-cooking-search]')?.addEventListener('input', (event) => actions.onSearch?.(event.target.value));
  root.querySelector('[data-cooking-filter]')?.addEventListener('change', (event) => actions.onFilter?.(event.target.value));
  root.querySelector('[data-cooking-guide-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    actions.onSaveGuide?.({ scheduleText: data.get('schedule_text'), extraGuide: data.get('extra_guide') });
  });
  root.querySelector('[data-cooking-editor-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    actions.onSaveMenu?.({
      typeKey: data.get('type_key'),
      label: data.get('label'),
      shortLabel: data.get('short_label'),
      detail: data.get('detail'),
      pricePerSet: data.get('price_per_set'),
      sortOrder: data.get('sort_order'),
      enabled: data.get('enabled') === 'on',
    });
  });
  root.querySelector('[data-cooking-editor-close]')?.addEventListener('click', () => actions.onCloseEditor?.());
  root.querySelectorAll('[data-cooking-edit]').forEach((button) => button.addEventListener('click', () => actions.onEdit?.(button.dataset.cookingEdit)));
  root.querySelectorAll('[data-cooking-toggle]').forEach((button) => button.addEventListener('click', () => {
    const next = button.dataset.nextEnabled === 'true';
    actions.onToggle?.(button.dataset.cookingToggle, next);
  }));
}

function renderEditor(editor) {
  const editing = Boolean(editor.typeKey);
  return `
    <form class="ops-cooking-editor" data-cooking-editor-form>
      <input type="hidden" name="type_key" value="${a(editor.typeKey || '')}" />
      <div class="ops-cooking-editor__title"><div><strong>${editing ? '메뉴 수정' : '새 메뉴 추가'}</strong>${editing ? `<small>내부 키 ${h(editor.typeKey)}</small>` : '<small>저장하면 내부 키가 자동 생성됩니다.</small>'}</div></div>
      ${editor.error ? `<div class="ops-cooking-editor__error">${h(editor.error)}</div>` : ''}
      <div class="ops-cooking-editor__grid">
        <label><span>메뉴 이름</span><input name="label" maxlength="100" required value="${a(editor.label || '')}" placeholder="예: 고기 O + 재료 O" /></label>
        <label><span>짧은 이름</span><input name="short_label" maxlength="50" value="${a(editor.shortLabel || '')}" placeholder="예: 1번" /></label>
        <label class="is-wide"><span>설명</span><input name="detail" maxlength="100" value="${a(editor.detail || '')}" placeholder="예: 고기 + 재료 지참" /></label>
        <label><span>가격 / SET</span><input name="price_per_set" type="number" min="0" max="1000000000" step="1" value="${Number(editor.pricePerSet || 0)}" /></label>
        <label><span>표시 순서</span><input name="sort_order" type="number" min="0" max="9999" step="1" value="${Number(editor.sortOrder || 0)}" /></label>
        <label class="ops-cooking-check"><input name="enabled" type="checkbox" ${editor.enabled !== false ? 'checked' : ''} /><span><strong>Discord 주문창에 사용</strong><small>OFF면 신규 선택지에서만 숨깁니다.</small></span></label>
      </div>
      <div class="ops-cooking-editor__actions"><button type="button" class="ops-cooking-btn" data-cooking-editor-close ${editor.saving ? 'disabled' : ''}>취소</button><button type="submit" class="ops-cooking-btn is-gold" ${editor.saving ? 'disabled' : ''}>${editor.saving ? '저장 중' : '저장'}</button></div>
    </form>
  `;
}

function renderRow(row) {
  const enabled = row.enabled !== false;
  return `
    <article class="ops-cooking-row ${enabled ? '' : 'is-disabled'}">
      <div class="ops-cooking-cell is-name" data-label="메뉴"><strong>${h(row.label || row.type_key)}</strong><small>${h(row.short_label || row.type_key)}</small></div>
      <div class="ops-cooking-cell" data-label="설명">${h(row.detail || '—')}</div>
      <div class="ops-cooking-cell is-price" data-label="가격 / SET">${money(row.price_per_set)}</div>
      <div class="ops-cooking-cell" data-label="순서">${Number(row.sort_order || 0)}</div>
      <div class="ops-cooking-cell" data-label="상태"><button type="button" class="ops-cooking-power ${enabled ? 'is-on' : 'is-off'}" data-cooking-toggle="${a(row.type_key)}" data-next-enabled="${enabled ? 'false' : 'true'}">${enabled ? 'ON' : 'OFF'}</button></div>
      <div class="ops-cooking-cell" data-label="관리"><button type="button" class="ops-cooking-edit" data-cooking-edit="${a(row.type_key)}">수정</button></div>
    </article>
  `;
}

function normalize(value) { return String(value || '').trim().toLowerCase(); }
function money(value) { const n = Math.max(0, Math.floor(Number(value || 0))); return n ? `${n.toLocaleString('ko-KR')}원` : '무료'; }
function h(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function a(value) { return h(value).replaceAll('`', '&#096;'); }
