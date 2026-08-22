import {
  escapeHtml,
  formatDateTime,
  formatMoney,
  formatPeriodLabel,
  requestStatusLabel,
} from '../fundUtils.js';
import {
  renderIdentityGate,
  renderPageHeader,
  renderVerifiedMember,
} from '../components/shared.js';

export function renderSubmissionsView(state) {
  const { fund, members } = state;
  const identity = fund.identity;

  if (!identity.verified || !identity.profile) {
    return `
      ${renderPageHeader('내 제출', '내가 제출한 공금의 검수 상태와 관리자 처리 결과를 확인합니다.')}
      ${renderIdentityGate(identity, members.items, identity.loading ? '공금 정보를 확인하는 중입니다' : '내 제출을 보려면 로그인')}
    `;
  }

  const requests = identity.profile.requests ?? [];

  return `
    ${renderPageHeader('내 제출', '검수대기, 승인, 거절된 제출 내역을 시간순으로 확인합니다.')}
    ${renderVerifiedMember(identity)}

    <section class="fund-section-card">
      <div class="fund-section-card__header">
        <div><span>SUBMISSIONS</span><h3>제출 내역</h3></div>
        <p>${requests.length}건</p>
      </div>

      <div class="fund-submission-list">
        ${requests.length ? requests.map(renderSubmission).join('') : '<div class="fund-empty-state fund-empty-state--large">아직 제출한 공금이 없습니다.</div>'}
      </div>
    </section>
  `;
}

function renderSubmission(item) {
  return `
    <article class="fund-submission-item">
      <div class="fund-submission-item__main">
        <div>
          <span>${formatPeriodLabel(item)}</span>
          <strong>${formatMoney(item.amount)}</strong>
        </div>
        <span class="fund-request-pill fund-request-pill--${item.status}">${requestStatusLabel(item.status)}</span>
      </div>

      <div class="fund-submission-item__meta">
        <span>제출 ${formatDateTime(item.created_at)}</span>
        ${item.reviewer ? `<span>${escapeHtml(item.reviewer)} 검수</span>` : ''}
        ${item.reviewed_at ? `<span>${formatDateTime(item.reviewed_at)}</span>` : ''}
      </div>

      ${item.payment_mode ? `<p>납부 방식 · ${escapeHtml(item.payment_mode)}</p>` : ''}
      ${item.memo ? `<p>메모 · ${escapeHtml(item.memo)}</p>` : ''}
      ${item.review_note ? `<p class="fund-submission-item__review">검수 메모 · ${escapeHtml(item.review_note)}</p>` : ''}
      ${item.evidence_url ? `<a href="${escapeHtml(item.evidence_url)}" target="_blank" rel="noopener noreferrer">증빙 보기</a>` : ''}
    </article>
  `;
}
