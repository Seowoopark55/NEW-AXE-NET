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
  ['feeRules', '요율관리'],
  ['exemptions', '면제관리'],
  ['integrity', '정합성점검'],
  ['fundMembers', '멤버관리'],
];

export function renderFundNav(section, isAdmin, pendingCount = 0) {
  const items = [
    ...PUBLIC_ITEMS,
    ...(isAdmin ? ADMIN_ITEMS : []),
  ];

  return `
    <div class="fund-tabs" aria-label="공금 메뉴">
      ${items.map(([value, label]) => renderItem(
        value,
        label,
        section,
        value === 'review' && pendingCount > 0 ? pendingCount : null,
      )).join('')}
    </div>
  `;
}

function renderItem(value, label, section, count = null) {
  return `
    <button
      class="${section === value ? 'active' : ''}"
      type="button"
      data-fund-section="${escapeHtml(value)}"
    >
      <span>${escapeHtml(label)}</span>
      ${count !== null ? `<b class="fund-tab-count">${count}</b>` : ''}
    </button>
  `;
}
