import { getAvailableShortcutTargets, getShortcutTarget } from './shortcutTargets.js';

export function renderShortcutsView(root, state, actions) {
  const shortcuts = state.shortcuts ?? {};
  const identity = state.auth?.member ?? state.auth?.admin ?? null;

  if (!identity) {
    root.innerHTML = '';
    return;
  }

  const items = Array.isArray(shortcuts.items) ? shortcuts.items : [];
  const editing = shortcuts.editingId
    ? items.find((item) => Number(item.id) === Number(shortcuts.editingId)) ?? null
    : null;

  root.innerHTML = `
    <div class="ops-quick ${shortcuts.open ? 'is-open' : ''}">
      <button class="ops-quick__trigger" type="button" data-quick-toggle aria-expanded="${shortcuts.open ? 'true' : 'false'}">
        <span aria-hidden="true">⚡</span>
        <span>바로가기</span>
        ${items.length ? `<b>${items.length}</b>` : ''}
      </button>

      ${shortcuts.open ? `
        <div class="ops-quick__menu" role="menu">
          <div class="ops-quick__menu-head">
            <strong>바로가기</strong>
            <button type="button" data-quick-manage>관리</button>
          </div>
          <div class="ops-quick__list">
            ${shortcuts.loading
              ? '<div class="ops-quick__empty">불러오는 중...</div>'
              : items.length
                ? items.map((item) => renderShortcutItem(item)).join('')
                : '<div class="ops-quick__empty">등록된 바로가기가 없습니다.<br>관리에서 자주 쓰는 기능을 추가하세요.</div>'}
          </div>
        </div>
      ` : ''}
    </div>

    ${shortcuts.managerOpen ? renderManager(shortcuts, items, editing, state) : ''}
  `;

  bindShortcutEvents(root, actions);
}

function renderShortcutItem(item) {
  const target = getShortcutTarget(item.target_key);
  return `
    <button class="ops-quick__link" type="button" data-quick-open="${escapeAttr(item.target_key)}" role="menuitem">
      <span>${escapeHtml(item.label)}</span>
      <small>${escapeHtml(target?.label || item.target_key)}</small>
    </button>
  `;
}

function renderManager(shortcuts, items, editing, state) {
  const targets = getAvailableShortcutTargets(state);
  const grouped = groupTargets(targets);
  const maxReached = items.length >= 6 && !editing;

  return `
    <div class="ops-quick-modal" data-quick-modal-backdrop>
      <section class="ops-quick-modal__panel" role="dialog" aria-modal="true" aria-label="바로가기 관리">
        <header class="ops-quick-modal__head">
          <div>
            <span>QUICK ACCESS</span>
            <h2>바로가기 관리</h2>
          </div>
          <button type="button" data-quick-manager-close aria-label="닫기">×</button>
        </header>

        <div class="ops-quick-modal__body">
          <div class="ops-quick-manager-list">
            ${items.length ? items.map((item, index) => renderManagerRow(item, index, items.length)).join('') : '<div class="ops-quick-manager-empty">아직 등록된 바로가기가 없습니다.</div>'}
          </div>

          <form class="ops-quick-form" data-quick-form>
            <div class="ops-quick-form__head">
              <strong>${editing ? '바로가기 수정' : '새 바로가기'}</strong>
              <span>${items.length}/6</span>
            </div>

            <label>
              <span>표시 이름</span>
              <input name="label" maxlength="24" placeholder="예: 공금내기" value="${escapeAttr(editing?.label || '')}" ${maxReached ? 'disabled' : ''} required />
            </label>

            <label>
              <span>이동 위치</span>
              <select name="target_key" ${maxReached ? 'disabled' : ''} required>
                <option value="">이동할 기능 선택</option>
                ${Object.entries(grouped).map(([group, groupTargets]) => `
                  <optgroup label="${escapeAttr(group)}">
                    ${groupTargets.map((target) => `
                      <option value="${escapeAttr(target.key)}" ${editing?.target_key === target.key ? 'selected' : ''}>${escapeHtml(target.label)}</option>
                    `).join('')}
                  </optgroup>
                `).join('')}
              </select>
            </label>

            ${shortcuts.error ? `<div class="ops-quick-form__error">${escapeHtml(shortcuts.error)}</div>` : ''}

            <div class="ops-quick-form__actions">
              ${editing ? '<button class="ops-quick-form__ghost" type="button" data-quick-edit-cancel>취소</button>' : ''}
              <button class="ops-quick-form__save" type="submit" ${maxReached || shortcuts.saving ? 'disabled' : ''}>
                ${shortcuts.saving ? '저장 중...' : editing ? '수정 저장' : maxReached ? '최대 6개' : '+ 추가'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  `;
}

function renderManagerRow(item, index, total) {
  const target = getShortcutTarget(item.target_key);
  return `
    <div class="ops-quick-manager-row">
      <div class="ops-quick-manager-row__copy">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(target?.label || item.target_key)}</span>
      </div>
      <div class="ops-quick-manager-row__actions">
        <button type="button" data-quick-move="up" data-quick-id="${Number(item.id)}" ${index === 0 ? 'disabled' : ''} aria-label="위로">↑</button>
        <button type="button" data-quick-move="down" data-quick-id="${Number(item.id)}" ${index === total - 1 ? 'disabled' : ''} aria-label="아래로">↓</button>
        <button type="button" data-quick-edit="${Number(item.id)}">수정</button>
        <button type="button" data-quick-delete="${Number(item.id)}">삭제</button>
      </div>
    </div>
  `;
}

function bindShortcutEvents(root, actions) {
  root.querySelector('[data-quick-toggle]')?.addEventListener('click', () => actions.onToggle?.());
  root.querySelector('[data-quick-manage]')?.addEventListener('click', () => actions.onOpenManager?.());
  root.querySelector('[data-quick-manager-close]')?.addEventListener('click', () => actions.onCloseManager?.());
  root.querySelector('[data-quick-edit-cancel]')?.addEventListener('click', () => actions.onEdit?.(null));

  root.querySelectorAll('[data-quick-open]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenShortcut?.(button.dataset.quickOpen));
  });

  root.querySelectorAll('[data-quick-edit]').forEach((button) => {
    button.addEventListener('click', () => actions.onEdit?.(Number(button.dataset.quickEdit)));
  });

  root.querySelectorAll('[data-quick-delete]').forEach((button) => {
    button.addEventListener('click', () => actions.onDelete?.(Number(button.dataset.quickDelete)));
  });

  root.querySelectorAll('[data-quick-move]').forEach((button) => {
    button.addEventListener('click', () => actions.onMove?.(Number(button.dataset.quickId), button.dataset.quickMove));
  });

  root.querySelector('[data-quick-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    actions.onSave?.({
      label: String(form.get('label') || '').trim(),
      target_key: String(form.get('target_key') || '').trim(),
    });
  });

  root.querySelector('[data-quick-modal-backdrop]')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) actions.onCloseManager?.();
  });
}

function groupTargets(targets) {
  return targets.reduce((groups, target) => {
    (groups[target.group] ||= []).push(target);
    return groups;
  }, {});
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
