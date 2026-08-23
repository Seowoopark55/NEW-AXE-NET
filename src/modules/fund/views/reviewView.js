import { escapeAttribute, escapeHtml, formatDateTime, formatMoney, formatPeriodLabel } from '../fundUtils.js';

export function renderReviewView(state) {
  const admin = state.fund.admin;
  const rows = (admin.requests ?? [])
    .filter((item) => isOpenRequest(item.status))
    .slice()
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  return `
    <div class="ops-review">
      <header class="ops-view-head">
        <div>
          <h2>검수대기</h2>
          <p>오래된 신청부터 증빙을 확인하고 승인·보류·반려합니다.</p>
        </div>
        <span class="ops-toolbar__summary">${rows.length}건</span>
      </header>

      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      ${rows.length ? `
        <section class="ops-surface">
          ${renderBulkToolbar(rows.length)}
          <div class="ops-review__queue">
            ${rows.map(renderRequest).join('')}
          </div>
        </section>
      ` : '<div class="fund-empty-state fund-empty-state--large">검수대기 중인 공금 신청이 없습니다.</div>'}
    </div>
  `;
}

function renderBulkToolbar(count) {
  return `
    <div class="ops-toolbar ops-review__toolbar">
      <div class="ops-toolbar__group">
        <label class="ops-review__select-all">
          <input type="checkbox" data-review-select-all />
          <span>전체 선택</span>
        </label>
        <span class="ops-toolbar__summary">대기 ${count}건 · 선택 <b data-review-selected-count>0</b>건</span>
      </div>
      <div class="ops-toolbar__group">
        <button class="ops-primary-button" type="button" data-review-bulk-approve disabled>선택 일괄승인</button>
      </div>
    </div>
  `;
}

function renderRequest(item) {
  const mode = paymentDetail(item);
  const sub = [
    formatDateTime(item.created_at),
    item.memo || '',
  ].filter(Boolean).join(' · ');

  return `
    <article class="ops-review__item" data-review-request-id="${item.id}">
      <div class="ops-review__top">
        <label class="ops-review__check" aria-label="검수 선택">
          <input type="checkbox" data-review-select="${item.id}" />
        </label>

        <div class="ops-review__identity">
          <strong>${escapeHtml(item.nickname || '멤버')} · ${escapeHtml(formatPeriodLabel(item))}</strong>
          <span>${escapeHtml(sub || '제출 정보 없음')}</span>
        </div>

        <div class="ops-review__payment">
          <strong>${formatMoney(item.amount)}</strong>
          <span>${escapeHtml(mode)}</span>
        </div>

        <div class="ops-review__state">
          <span class="${item.status === 'hold' ? 'is-hold' : ''}">${item.status === 'hold' ? '보류' : '대기'}</span>
        </div>

        <div>
          ${item.evidence_url
            ? `<button class="ops-icon-button is-gold" type="button" data-evidence-preview="${escapeAttribute(item.evidence_url)}" data-evidence-label="${escapeAttribute(`${item.nickname || '멤버'} · ${formatPeriodLabel(item)} 증빙`)}">증빙</button>`
            : '<span class="ops-toolbar__summary">없음</span>'}
        </div>
      </div>

      ${item.status === 'hold' && item.review_note ? `<div class="ops-review__hold-note">보류 메모 · ${escapeHtml(item.review_note)}</div>` : ''}
      ${item.proxy_admin_name ? `<div class="ops-review__proxy">관리자 대리제출 · ${escapeHtml(item.proxy_admin_name)}</div>` : ''}

      <div class="ops-review__actions">
        <input class="ops-review__note" type="text" maxlength="300" value="${escapeAttribute(item.review_note || '')}" placeholder="검수 메모 / 반려 사유" data-review-note="${item.id}" />
        <button class="ops-primary-button" type="button" data-approve-request="${item.id}">승인</button>
        <button class="ops-secondary-button" type="button" data-hold-request="${item.id}">보류</button>
        <button class="ops-danger-button" type="button" data-reject-request="${item.id}">반려</button>
      </div>
    </article>
  `;
}

function paymentDetail(item) {
  if (item.payment_mode === '분할납부') {
    return `분할 · 공용 ${formatMoney(item.public_amount)} + 잔고 ${formatMoney(item.company_amount)}`;
  }
  return item.payment_mode || '공용계좌';
}

function isOpenRequest(status) {
  return status === 'pending' || status === 'hold';
}
