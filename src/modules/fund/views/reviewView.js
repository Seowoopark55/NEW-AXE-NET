import {
  escapeHtml,
  formatDateTime,
  formatMoney,
  formatPeriodLabel,
  requestStatusLabel,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderReviewView(state) {
  const admin = state.fund.admin;
  const filter = admin.requestFilter;
  const requests = filter === 'all'
    ? admin.requests
    : admin.requests.filter((item) => item.status === filter);
  const pendingCount = admin.requests.filter((item) => item.status === 'pending').length;

  return `
    ${renderPageHeader('검수대기', '멤버가 제출한 공금을 확인하고 승인 또는 거절합니다.')}
    ${renderAdminMessage(admin)}

    <div class="fund-review-toolbar">
      ${renderFilter('pending', '검수대기', filter, pendingCount)}
      ${renderFilter('approved', '승인완료', filter)}
      ${renderFilter('rejected', '거절', filter)}
      ${renderFilter('deleted', '삭제됨', filter)}
      ${renderFilter('all', '전체', filter)}
    </div>

    <div class="fund-review-list">
      ${requests.length ? requests.map(renderRequest).join('') : '<div class="fund-empty-state fund-empty-state--large">해당 상태의 제출이 없습니다.</div>'}
    </div>
  `;
}

function renderFilter(value, label, selected, count = null) {
  return `
    <button class="fund-filter-chip ${selected === value ? 'fund-filter-chip--active' : ''}" type="button" data-request-filter="${value}">
      ${label}${count !== null ? ` <b>${count}</b>` : ''}
    </button>
  `;
}

function renderRequest(item) {
  const pending = item.status === 'pending';

  return `
    <article class="fund-review-item ${pending ? 'fund-review-item--pending' : ''}">
      <div class="fund-review-item__head">
        <div>
          <div class="fund-review-item__title">
            <strong>${escapeHtml(item.nickname || '멤버')}</strong>
            <span class="fund-request-pill fund-request-pill--${item.status}">${requestStatusLabel(item.status)}</span>
          </div>
          <span>${formatPeriodLabel(item)} · ${escapeHtml(item.payment_mode || '공용계좌')}</span>
        </div>
        <b>${formatMoney(item.amount)}</b>
      </div>

      <div class="fund-review-item__meta">
        <span>${escapeHtml(item.discord_name || item.discord_user_id || 'Discord 정보 없음')}</span>
        <span>${formatDateTime(item.created_at)} 제출</span>
        ${item.reviewer_discord_name ? `<span>${escapeHtml(item.reviewer_discord_name)} 검수</span>` : ''}
      </div>

      ${item.memo ? `<p>메모 · ${escapeHtml(item.memo)}</p>` : ''}
      ${item.review_note ? `<p class="fund-review-item__review">검수 메모 · ${escapeHtml(item.review_note)}</p>` : ''}
      ${item.evidence_url ? `<a href="${escapeHtml(item.evidence_url)}" target="_blank" rel="noopener noreferrer">증빙 보기</a>` : ''}

      ${pending ? `
        <div class="fund-review-item__actions">
          <button class="fund-danger-button" type="button" data-reject-request="${item.id}">거절</button>
          <button class="fund-primary-button" type="button" data-approve-request="${item.id}">승인 · 납부완료</button>
        </div>
      ` : ''}
    </article>
  `;
}

function renderAdminMessage(admin) {
  return `
    ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
    ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}
  `;
}
