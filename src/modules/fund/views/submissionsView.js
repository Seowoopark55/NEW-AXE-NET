import {
  escapeAttribute,
  escapeHtml,
  formatDateTime,
  formatMoney,
  formatPeriodLabel,
  requestStatusLabel,
} from '../fundUtils.js';
import { renderIdentityGate, renderPageHeader, renderVerifiedMember } from '../components/shared.js';

export function renderSubmissionsView(state) {
  const { fund, members } = state;
  const identity = fund.identity;
  if (!identity.verified || !identity.profile) {
    return `${renderPageHeader('내 제출', '제출한 공금의 검수 상태와 처리 결과를 확인합니다.')}${renderIdentityGate(identity, members.items, identity.loading ? '공금 정보를 확인하는 중입니다' : '내 제출을 보려면 로그인')}`;
  }
  const requests = identity.profile.requests ?? [];
  return `
    ${renderPageHeader('내 제출', '증빙, 납부 방식, 검수 결과를 제출 시간순으로 확인합니다.')}
    ${renderVerifiedMember(identity)}
    <section class="fund-section-card">
      <div class="fund-section-card__header"><div><span>SUBMISSIONS</span><h3>제출 내역</h3></div><p>${requests.length}건</p></div>
      <div class="fund-submission-list fund-submission-list--parity">${requests.length ? requests.map(renderSubmission).join('') : '<div class="fund-empty-state fund-empty-state--large">아직 제출한 공금이 없습니다.</div>'}</div>
    </section>`;
}

function renderSubmission(item) {
  return `
    <article class="fund-submission-item fund-submission-item--parity">
      <div class="fund-submission-item__main">
        <div><span>${formatPeriodLabel(item)}</span><strong>${formatMoney(item.amount)}</strong></div>
        <span class="fund-request-pill fund-request-pill--${item.status}">${requestStatusLabel(item.status)}</span>
      </div>
      <div class="fund-payment-breakdown">${paymentDetail(item)}</div>
      ${item.evidence_url ? `<a class="fund-evidence-thumb" href="${escapeAttribute(item.evidence_url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeAttribute(item.evidence_url)}" alt="증빙" /><span>증빙 크게 보기</span></a>` : ''}
      <div class="fund-submission-item__meta">
        <span>제출 ${formatDateTime(item.created_at)}</span>
        ${item.proxy_admin_name ? `<span>대리제출 · ${escapeHtml(item.proxy_admin_name)}</span>` : ''}
        ${item.reviewer ? `<span>검수 · ${escapeHtml(item.reviewer)}</span>` : ''}
        ${item.reviewed_at ? `<span>${formatDateTime(item.reviewed_at)}</span>` : ''}
      </div>
      ${item.memo ? `<p>메모 · ${escapeHtml(item.memo)}</p>` : ''}
      ${item.review_note ? `<p class="fund-submission-item__review">검수 메모 · ${escapeHtml(item.review_note)}</p>` : ''}
    </article>`;
}

function paymentDetail(item) {
  if (item.payment_mode === '분할납부') return `분할납부 <b>공용 ${formatMoney(item.public_amount)}</b> + <b>잔고 ${formatMoney(item.company_amount)}</b>`;
  if (item.payment_mode === '회사잔고') return `회사잔고 <b>${formatMoney(item.company_amount || item.amount)}</b>`;
  return `공용계좌 <b>${formatMoney(item.public_amount || item.amount)}</b>`;
}
