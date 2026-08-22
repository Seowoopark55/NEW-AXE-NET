import { escapeHtml } from '../fundUtils.js';

const PUBLIC_ITEMS = [
  ['overview', '월별현황'],
  ['payment', '공금납부'],
  ['submissions', '내 제출'],
];

const ADMIN_ITEMS = [
  ['review', '검수대기'],
  ['history', '공금내역'],
  ['balance', '잔액점검'],
  ['settings', '공금설정'],
];

export function renderFundNav(section, isAdmin, pendingCount = 0) {
  return `
    <div class="fund-workspace-nav" aria-label="공금 메뉴">
      <div class="fund-workspace-nav__group">
        ${PUBLIC_ITEMS.map(([value, label]) => renderItem(value, label, section)).join('')}
      </div>

      ${
        isAdmin
          ? `
            <div class="fund-workspace-nav__divider"></div>
            <div class="fund-workspace-nav__group fund-workspace-nav__group--admin">
              <span class="fund-workspace-nav__admin-label">관리자</span>
              ${ADMIN_ITEMS.map(([value, label]) => renderItem(
                value,
                label,
                section,
                value === 'review' && pendingCount > 0 ? pendingCount : null,
              )).join('')}
            </div>
          `
          : ''
      }
    </div>
  `;
}

function renderItem(value, label, section, count = null) {
  return `
    <button
      class="fund-workspace-nav__item ${section === value ? 'fund-workspace-nav__item--active' : ''}"
      type="button"
      data-fund-section="${escapeHtml(value)}"
    >
      <span>${escapeHtml(label)}</span>
      ${count !== null ? `<b>${count}</b>` : ''}
    </button>
  `;
}
