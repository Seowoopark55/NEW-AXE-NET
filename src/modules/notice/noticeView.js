import { escapeHtml } from '../fund/fundUtils.js';

export function renderNoticeView(root, state, actions = {}) {
  const notice = state.notice ?? {};
  const tab = notice.tab || 'general';
  const admin = Boolean(state.auth?.admin);
  const selectedNotice = (notice.notices ?? []).find((item) => Number(item.id) === Number(notice.selectedNoticeId)) ?? null;

  root.innerHTML = `
    <section class="ops-notice">
      <header class="ops-notice__header">
        <div>
          <h1>공지사항</h1>
          <p>AXE의 주요 공지와 운영기준을 확인합니다.</p>
        </div>
        <div class="ops-notice__header-actions">
          <button class="ops-notice__refresh" type="button" data-notice-refresh ${notice.loading ? 'disabled' : ''}>↻ 새로고침</button>
          ${admin ? `<button class="ops-notice__primary" type="button" data-notice-new="${tab === 'operations' ? 'operation' : 'notice'}">+ ${tab === 'operations' ? '기준 등록' : '공지 등록'}</button>` : ''}
        </div>
      </header>

      <nav class="ops-notice-tabs" aria-label="공지 구분">
        ${tabButton('general', '일반공지', tab)}
        ${tabButton('patch', '패치노트', tab)}
        ${tabButton('operations', '운영기준', tab)}
      </nav>

      ${notice.error ? `<div class="ops-notice__error">${escapeHtml(notice.error)}</div>` : ''}
      ${notice.loading && !notice.initialized ? '<div class="ops-notice__loading">공지 데이터를 불러오는 중입니다.</div>' : ''}

      ${tab === 'operations'
        ? renderOperations(notice, admin)
        : selectedNotice
          ? renderNoticeDetail(selectedNotice, admin)
          : renderNoticeList(notice, tab)}

      ${notice.editor?.open ? renderEditor(notice, tab) : ''}
    </section>
  `;

  bindNoticeEvents(root, actions);
}

function tabButton(value, label, activeTab) {
  return `<button class="ops-notice-tabs__item ${activeTab === value ? 'is-active' : ''}" type="button" data-notice-tab="${value}">${label}</button>`;
}

function renderNoticeList(notice, tab) {
  const type = tab === 'patch' ? '패치노트' : '일반공지';
  const items = (notice.notices ?? [])
    .filter((item) => normalizeNoticeType(item.notice_type) === type)
    .slice()
    .sort((a, b) => Number(Boolean(b.important)) - Number(Boolean(a.important)) || dateValue(b.published_at) - dateValue(a.published_at));

  return `
    <section class="ops-notice-board" aria-label="${escapeHtml(type)} 목록">
      <div class="ops-notice-board__head">
        <span>제목</span>
        <span>작성일</span>
      </div>
      <div class="ops-notice-board__body">
        ${items.length ? items.map(renderNoticeRow).join('') : `<div class="ops-notice-empty">등록된 ${escapeHtml(type)}가 없습니다.</div>`}
      </div>
    </section>
  `;
}

function renderNoticeRow(item) {
  return `
    <button class="ops-notice-row" type="button" data-notice-open="${Number(item.id)}">
      <span class="ops-notice-row__title">
        ${item.important ? '<em>중요</em>' : ''}
        <strong>${escapeHtml(item.title || '제목 없음')}</strong>
        ${item.writer ? `<small>${escapeHtml(item.writer)}</small>` : ''}
      </span>
      <time>${escapeHtml(formatDate(item.published_at))}</time>
    </button>
  `;
}

function renderNoticeDetail(item, admin) {
  return `
    <article class="ops-notice-detail">
      <div class="ops-notice-detail__toolbar">
        <button class="ops-notice__text-action" type="button" data-notice-back>← 목록</button>
        ${admin ? `
          <div class="ops-notice-detail__admin">
            <button class="ops-notice__text-action" type="button" data-notice-edit="${Number(item.id)}">수정</button>
            <button class="ops-notice__text-action is-danger" type="button" data-notice-delete="${Number(item.id)}">삭제</button>
          </div>
        ` : ''}
      </div>
      <header class="ops-notice-detail__head">
        <div class="ops-notice-detail__meta">
          <span>${escapeHtml(normalizeNoticeType(item.notice_type))}</span>
          ${item.important ? '<b>중요</b>' : ''}
        </div>
        <h2>${escapeHtml(item.title || '제목 없음')}</h2>
        <p>${escapeHtml(formatDate(item.published_at))}${item.writer ? ` · ${escapeHtml(item.writer)}` : ''}</p>
      </header>
      <div class="ops-notice-detail__content">${escapeHtml(item.content || '')}</div>
    </article>
  `;
}

function renderOperations(notice, admin) {
  const operations = notice.operations ?? [];
  const categories = [...new Set(operations.map((item) => String(item.category || '').trim()).filter(Boolean))];
  const category = notice.operationCategory || 'all';
  const filtered = operations.filter((item) => category === 'all' || String(item.category || '') === category);
  const selected = operations.find((item) => Number(item.id) === Number(notice.selectedOperationId)) ?? null;

  return `
    <div class="ops-operation-filter" aria-label="운영기준 분류">
      <button class="${category === 'all' ? 'is-active' : ''}" type="button" data-operation-category="all">전체</button>
      ${categories.map((item) => `<button class="${category === item ? 'is-active' : ''}" type="button" data-operation-category="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('')}
    </div>

    <section class="ops-operation-workspace">
      <div class="ops-operation-list" aria-label="운영기준 목록">
        ${filtered.length
          ? filtered.map((item) => `
            <button class="ops-operation-row ${selected && Number(selected.id) === Number(item.id) ? 'is-active' : ''}" type="button" data-operation-open="${Number(item.id)}">
              <strong>${escapeHtml(item.title || '제목 없음')}</strong>
              <span>${escapeHtml(item.category || '기본')}</span>
            </button>
          `).join('')
          : '<div class="ops-notice-empty">등록된 운영기준이 없습니다.</div>'}
      </div>

      <div class="ops-operation-detail">
        ${selected ? `
          <div class="ops-operation-detail__top">
            <span>${escapeHtml(selected.category || '기본')}</span>
            ${admin ? `
              <div>
                <button class="ops-notice__text-action" type="button" data-operation-edit="${Number(selected.id)}">수정</button>
                <button class="ops-notice__text-action is-danger" type="button" data-operation-delete="${Number(selected.id)}">내리기</button>
              </div>
            ` : ''}
          </div>
          <h2>${escapeHtml(selected.title || '제목 없음')}</h2>
          <div class="ops-operation-detail__content">${escapeHtml(selected.content || '')}</div>
        ` : '<div class="ops-operation-detail__empty">목록에서 운영기준을 선택하세요.</div>'}
      </div>
    </section>
  `;
}

function renderEditor(notice, currentTab) {
  const editor = notice.editor;
  const isOperation = editor.kind === 'operation';
  const item = isOperation
    ? (notice.operations ?? []).find((value) => Number(value.id) === Number(editor.itemId))
    : (notice.notices ?? []).find((value) => Number(value.id) === Number(editor.itemId));
  const defaultNoticeType = currentTab === 'patch' ? '패치노트' : '일반공지';

  return `
    <div class="ops-notice-modal" data-notice-modal>
      <form class="ops-notice-editor" data-notice-editor data-editor-kind="${isOperation ? 'operation' : 'notice'}">
        <div class="ops-notice-editor__head">
          <div>
            <h2>${item ? '수정' : '등록'} · ${isOperation ? '운영기준' : '공지'}</h2>
            <p>${isOperation ? '분류와 노출 순서, 기준 내용을 관리합니다.' : '일반공지와 패치노트를 같은 형식으로 관리합니다.'}</p>
          </div>
          <button type="button" data-notice-editor-close aria-label="닫기">×</button>
        </div>

        <div class="ops-notice-editor__body">
          <input type="hidden" name="id" value="${item ? Number(item.id) : ''}" />

          ${isOperation ? `
            <div class="ops-notice-editor__row ops-notice-editor__row--split">
              <label>
                <span>분류</span>
                <input name="category" value="${escapeHtml(item?.category || '')}" placeholder="예: 기본규정" autocomplete="off" />
              </label>
              <label>
                <span>정렬 순서</span>
                <input name="sort_order" type="number" min="0" step="1" value="${Number(item?.sort_order ?? 0)}" />
              </label>
            </div>
          ` : `
            <div class="ops-notice-editor__row ops-notice-editor__row--split">
              <label>
                <span>구분</span>
                <select name="notice_type">
                  ${option('일반공지', item?.notice_type || defaultNoticeType)}
                  ${option('패치노트', item?.notice_type || defaultNoticeType)}
                </select>
              </label>
              <label class="ops-notice-editor__check">
                <input name="important" type="checkbox" ${item?.important ? 'checked' : ''} />
                <span>중요 공지</span>
              </label>
            </div>
          `}

          <label class="ops-notice-editor__field">
            <span>제목</span>
            <input name="title" value="${escapeHtml(item?.title || '')}" autocomplete="off" />
          </label>

          <label class="ops-notice-editor__field">
            <span>내용</span>
            <textarea name="content">${escapeHtml(item?.content || '')}</textarea>
          </label>

          ${editor.error ? `<div class="ops-notice-editor__error">${escapeHtml(editor.error)}</div>` : ''}
        </div>

        <div class="ops-notice-editor__actions">
          <button class="ops-notice__text-action" type="button" data-notice-editor-close>취소</button>
          <button class="ops-notice__primary" type="submit" ${editor.saving ? 'disabled' : ''}>${editor.saving ? '저장 중…' : '저장'}</button>
        </div>
      </form>
    </div>
  `;
}

function option(value, selected) {
  return `<option value="${value}" ${normalizeNoticeType(selected) === value ? 'selected' : ''}>${value}</option>`;
}

function bindNoticeEvents(root, actions) {
  root.querySelectorAll('[data-notice-tab]').forEach((button) => {
    button.addEventListener('click', () => actions.onTabChange?.(button.dataset.noticeTab));
  });

  root.querySelector('[data-notice-refresh]')?.addEventListener('click', () => actions.onRefresh?.());
  root.querySelector('[data-notice-new]')?.addEventListener('click', (event) => actions.onOpenEditor?.(event.currentTarget.dataset.noticeNew));
  root.querySelector('[data-notice-back]')?.addEventListener('click', () => actions.onBackNotice?.());

  root.querySelectorAll('[data-notice-open]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenNotice?.(button.dataset.noticeOpen));
  });
  root.querySelectorAll('[data-notice-edit]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenEditor?.('notice', button.dataset.noticeEdit));
  });
  root.querySelectorAll('[data-notice-delete]').forEach((button) => {
    button.addEventListener('click', () => actions.onDeleteNotice?.(button.dataset.noticeDelete));
  });

  root.querySelectorAll('[data-operation-category]').forEach((button) => {
    button.addEventListener('click', () => actions.onOperationCategoryChange?.(button.dataset.operationCategory));
  });
  root.querySelectorAll('[data-operation-open]').forEach((button) => {
    button.addEventListener('click', () => actions.onSelectOperation?.(button.dataset.operationOpen));
  });
  root.querySelectorAll('[data-operation-edit]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenEditor?.('operation', button.dataset.operationEdit));
  });
  root.querySelectorAll('[data-operation-delete]').forEach((button) => {
    button.addEventListener('click', () => actions.onDeleteOperation?.(button.dataset.operationDelete));
  });

  root.querySelectorAll('[data-notice-editor-close]').forEach((button) => {
    button.addEventListener('click', () => actions.onCloseEditor?.());
  });

  const modal = root.querySelector('[data-notice-modal]');
  modal?.addEventListener('mousedown', (event) => {
    if (event.target === modal) actions.onCloseEditor?.();
  });

  root.querySelector('[data-notice-editor]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const kind = form.dataset.editorKind;
    const values = Object.fromEntries(data.entries());
    values.id = values.id ? Number(values.id) : null;
    if (kind === 'notice') values.important = data.get('important') === 'on';
    if (kind === 'operation') values.sort_order = Number(values.sort_order || 0);
    actions.onSaveEditor?.(kind, values);
  });
}

function normalizeNoticeType(value) {
  return String(value || '').trim() === '패치노트' ? '패치노트' : '일반공지';
}

function dateValue(value) {
  const time = new Date(value || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).replace(/\.$/, '');
}
