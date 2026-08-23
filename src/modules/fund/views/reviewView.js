import { escapeAttribute, escapeHtml, formatDateTime, formatMoney, formatPeriodLabel } from '../fundUtils.js';

export function renderReviewView(state) {
  const admin = state.fund.admin;
  const rows = (admin.requests ?? [])
    .filter((item) => isOpenRequest(item.status))
    .slice()
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  return `
    ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
    ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}
    ${rows.length ? `${renderBulkToolbar(rows.length)}<div class="fund-review-list fund-review-list--legacy">${rows.map(renderRequest).join('')}</div>` : '<div class="fund-empty-state fund-empty-state--large">검수대기 중인 공금 신청이 없습니다.</div>'}
  `;
}

function renderBulkToolbar(count) {
  return `
    <div class="fund-review-toolbar fund-review-toolbar--legacy">
      <div class="fund-review-toolbar__left">
        <label class="fund-review-select-all">
          <input type="checkbox" data-review-select-all />
          <span>전체 선택</span>
        </label>
        <div class="fund-review-bulk__copy">
          <strong>검수대기 ${count}건 · 선택 <b data-review-selected-count>0</b>건</strong>
          <span>증빙을 확인한 항목만 선택해 일괄승인하세요.</span>
        </div>
      </div>
      <div class="fund-review-toolbar__actions">
        <button class="fund-primary-button fund-review-bulk__approve" type="button" data-review-bulk-approve disabled>선택 일괄승인</button>
        <button class="fund-secondary-button" type="button" data-fund-refresh>현재 화면 새로고침</button>
      </div>
    </div>`;
}

function renderRequest(item) {
  const memoParts = [
    `납부방식 ${paymentDetail(item)}`,
    `제출일 ${formatDateTime(item.created_at)}`,
    item.memo || '',
  ].filter(Boolean);

  return `
    <article class="fund-review-card" data-review-request-id="${item.id}">
      <label class="fund-review-checkline"><input type="checkbox" data-review-select="${item.id}" /> 검수 선택</label>
      <div class="fund-review-card__head">
        <div class="fund-review-card__copy">
          <div class="fund-review-card__title">${escapeHtml(item.nickname || '멤버')} · ${escapeHtml(formatPeriodLabel(item))} · ${formatMoney(item.amount)}</div>
          <div class="fund-review-card__meta">${memoParts.map(escapeHtml).join(' · ')}</div>
          ${item.status === 'hold' && item.review_note ? `<div class="fund-review-card__hold">보류 메모 · ${escapeHtml(item.review_note)}</div>` : ''}
          ${item.proxy_admin_name ? `<div class="fund-review-card__proxy">관리자 대리제출 · ${escapeHtml(item.proxy_admin_name)}</div>` : ''}
        </div>
        <div class="fund-review-card__evidence">
          ${item.evidence_url ? `<button class="fund-evidence-link-button" type="button" data-evidence-preview="${escapeAttribute(item.evidence_url)}" data-evidence-label="${escapeAttribute(`${item.nickname || '멤버'} · ${formatPeriodLabel(item)} 증빙`)}">증빙 보기</button>` : '<span class="fund-admin-muted">증빙 없음</span>'}
        </div>
      </div>
      <div class="fund-review-card__actions">
        <input class="fund-review-note" type="text" maxlength="300" value="${escapeAttribute(item.review_note || '')}" placeholder="검수 메모/반려 사유" data-review-note="${item.id}" />
        <button class="fund-primary-button" type="button" data-approve-request="${item.id}">승인</button>
        <button class="fund-secondary-button fund-review-hold-button" type="button" data-hold-request="${item.id}">보류</button>
        <button class="fund-danger-button" type="button" data-reject-request="${item.id}">반려</button>
      </div>
    </article>`;
}

function paymentDetail(item) {
  if (item.payment_mode === '분할납부') return `분할 · 공용 ${formatMoney(item.public_amount)} + 잔고 ${formatMoney(item.company_amount)}`;
  return item.payment_mode || '공용계좌';
}

function isOpenRequest(status) {
  return status === 'pending' || status === 'hold';
}
