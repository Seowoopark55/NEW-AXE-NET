import {
  escapeAttribute,
  escapeHtml,
  formatMoney,
  formatPeriodLabel,
  renderStatusBadge,
  requestStatusLabel,
} from '../fundUtils.js';
import {
  renderIdentityGate,
  renderPageHeader,
  renderVerifiedMember,
} from '../components/shared.js';

export function renderPaymentView(state) {
  const { fund, members, auth } = state;
  const identity = fund.identity;

  if (!identity.verified || !identity.profile) {
    return `
      ${renderPageHeader('공금납부', '미납 주차를 선택하고 증빙 스크린샷을 제출합니다.')}
      ${renderIdentityGate(identity, members.items, identity.loading ? '공금 정보를 확인하는 중입니다' : '공금납부를 위해 로그인')}
    `;
  }

  const admin = Boolean(auth.admin);
  const effectiveProfile = admin && fund.payment.proxyProfile
    ? fund.payment.proxyProfile
    : identity.profile;
  const periods = effectiveProfile?.periods ?? [];
  const unpaid = periods.filter((item) => item.status === '미납' && item.request_status !== 'pending');
  const selected = fund.payment.selectedPeriod
    ?? unpaid[0]
    ?? periods.find((item) => item.status === '미납')
    ?? null;

  return `
    ${renderPageHeader('공금납부', '기존 AXE NET처럼 증빙 제출 후 검수대기 상태가 되며, 운영진 승인 후 월별현황에 반영됩니다.')}
    ${admin ? renderProxyBar(state) : renderVerifiedMember(identity)}

    <div class="fund-payment-layout fund-payment-layout--parity">
      <section class="fund-section-card fund-own-status-card">
        <div class="fund-section-card__header">
          <div><span>MY STATUS</span><h3>${admin && fund.payment.proxyProfile ? `${escapeHtml(effectiveProfile.member?.nickname || '')} 납부 현황` : '내 납부 현황'}</h3></div>
          <p>최근 ${periods.length}개 주차</p>
        </div>
        <div class="fund-own-period-list">
          ${periods.length ? periods.map((item) => renderOwnPeriod(item, selected)).join('') : '<div class="fund-empty-state">공금 대상 기간이 없습니다.</div>'}
        </div>
      </section>

      <section class="fund-section-card fund-payment-form-card">
        <div class="fund-section-card__header">
          <div><span>PAYMENT</span><h3>공금 제출</h3></div>
        </div>
        ${fund.payment.success ? `<div class="fund-inline-success">${escapeHtml(fund.payment.success)}</div>` : ''}
        ${fund.payment.error ? `<div class="fund-inline-error">${escapeHtml(fund.payment.error)}</div>` : ''}
        ${selected ? renderPaymentForm(state, selected, effectiveProfile) : renderNoPayment(periods)}
      </section>
    </div>
  `;
}

function renderProxyBar(state) {
  const { fund, members, auth } = state;
  const active = members.items.filter((item) => item.status === 'active');
  const currentKey = fund.payment.proxyMemberKey || auth.admin?.member_key || fund.identity.memberKey;
  return `
    <div class="fund-proxy-bar">
      <div>
        <span>관리자 대리제출</span>
        <strong>${escapeHtml(auth.admin?.nickname || '관리자')}</strong>
        <small>관리자는 제출자를 선택할 수 있습니다.</small>
      </div>
      <select class="fund-premium-select" data-fund-proxy-member ${fund.payment.proxyLoading ? 'disabled' : ''}>
        ${active.map((member) => `<option value="${escapeAttribute(member.member_key)}" ${member.member_key === currentKey ? 'selected' : ''}>${escapeHtml(member.nickname)}</option>`).join('')}
      </select>
    </div>
  `;
}

function renderOwnPeriod(item, selected) {
  const selectable = item.status === '미납' && item.request_status !== 'pending';
  const isSelected = selected && selected.year === item.year && selected.month === item.month && selected.week === item.week;
  const request = item.request_status ? `<small>${requestStatusLabel(item.request_status)}</small>` : '';
  return `
    <button class="fund-own-period ${isSelected ? 'fund-own-period--active' : ''}" type="button" ${selectable ? `data-payment-period="${item.year}-${item.month}-${item.week}"` : 'disabled'}>
      <div><strong>${formatPeriodLabel(item)}</strong><span>${formatMoney(item.weekly_fee)}</span></div>
      <div class="fund-own-period__status">${renderStatusBadge(item.status)}${request}</div>
    </button>
  `;
}

function renderPaymentForm(state, selected, profile) {
  const payment = state.fund.payment;
  const pending = selected.request_status === 'pending';
  if (selected.status !== '미납' || pending) {
    return `<div class="fund-empty-state fund-empty-state--large">${pending ? '이 주차는 이미 검수대기 중입니다.' : '선택한 주차는 현재 제출 대상이 아닙니다.'}</div>`;
  }

  const amount = Number(payment.amount || selected.weekly_fee || 0) || selected.weekly_fee;
  const mode = payment.paymentMode || '공용계좌';
  const publicAmount = payment.publicAmount || (mode === '공용계좌' ? String(amount) : '');
  const companyAmount = payment.companyAmount || (mode === '회사잔고' ? String(amount) : '');

  return `
    <form class="fund-payment-form fund-payment-form--parity" data-fund-payment-request-form>
      <input type="hidden" name="year" value="${selected.year}" />
      <input type="hidden" name="month" value="${selected.month}" />
      <input type="hidden" name="week" value="${selected.week}" />

      <div class="fund-payment-summary fund-payment-summary--compact">
        <div><span>제출자</span><strong>${escapeHtml(profile?.member?.nickname || '')}</strong></div>
        <div><span>납부 주차</span><strong>${formatPeriodLabel(selected)}</strong></div>
        <div><span>기준액</span><strong>${formatMoney(selected.weekly_fee)}</strong></div>
      </div>

      <div class="fund-payment-fields-grid">
        <label class="fund-field">
          <span>납부 방식</span>
          <select class="fund-premium-select" name="payment_mode" data-payment-mode>
            <option value="공용계좌" ${mode === '공용계좌' ? 'selected' : ''}>공용계좌</option>
            <option value="회사잔고" ${mode === '회사잔고' ? 'selected' : ''}>회사잔고</option>
            <option value="분할납부" ${mode === '분할납부' ? 'selected' : ''}>분할납부</option>
          </select>
        </label>
        <label class="fund-field">
          <span>총 납부금액</span>
          <input type="number" step="1" min="1" name="amount" data-payment-draft="amount" value="${escapeAttribute(amount)}" required />
        </label>
      </div>

      ${mode === '분할납부' ? `
        <div class="fund-split-grid">
          <label class="fund-field"><span>공용계좌 금액</span><input type="number" step="1" min="1" name="public_amount" data-payment-draft="publicAmount" value="${escapeAttribute(publicAmount)}" required /></label>
          <label class="fund-field"><span>회사잔고 금액</span><input type="number" step="1" min="1" name="company_amount" data-payment-draft="companyAmount" value="${escapeAttribute(companyAmount)}" required /></label>
        </div>
        <div class="fund-mini-help">공용계좌 + 회사잔고 금액의 합이 총 납부금액과 정확히 같아야 합니다.</div>
      ` : ''}

      ${renderEvidence(payment)}

      <label class="fund-field">
        <span>메모</span>
        <textarea name="memo" data-payment-draft="memo" maxlength="300" rows="3" placeholder="예: 이번 주는 회사잔고 일부와 공용계좌를 함께 사용했습니다.">${escapeHtml(payment.memo || '')}</textarea>
      </label>

      <div class="fund-info-box">증빙은 필수이며 3MB 이하 이미지로 첨부합니다. 파일 선택뿐 아니라 스크린샷 복사 후 Ctrl+V 붙여넣기도 지원합니다.</div>
      <button class="fund-primary-button fund-primary-button--wide" type="submit" ${payment.submitting ? 'disabled' : ''}>${payment.submitting ? '증빙 제출 중...' : '증빙 제출'}</button>
    </form>
  `;
}

function renderEvidence(payment) {
  return `
    <div class="fund-evidence-field">
      <div class="fund-field-label">증빙 스크린샷 <b>필수</b></div>
      <div class="fund-evidence-drop ${payment.evidencePreview ? 'has-image' : ''}" tabindex="0" data-evidence-drop>
        ${payment.evidencePreview
          ? `<img src="${escapeAttribute(payment.evidencePreview)}" alt="증빙 미리보기" /><div class="fund-evidence-overlay">다른 이미지를 붙여넣거나 드래그해서 교체</div>`
          : `<div class="fund-evidence-icon">▣</div><strong>스크린샷을 이곳에 Ctrl+V</strong><span>또는 클릭 / 드래그하여 이미지 첨부</span>`}
      </div>
      <input type="file" accept="image/*" data-evidence-file hidden />
      <div class="fund-evidence-actions">
        <button type="button" class="fund-secondary-button" data-evidence-browse>파일첨부</button>
        ${payment.evidence ? `<span>${escapeHtml(payment.evidence.name)} · ${formatBytes(payment.evidence.size)}</span><button type="button" class="fund-text-button" data-evidence-clear>지우기</button>` : '<span>3MB 이하 이미지</span>'}
      </div>
    </div>
  `;
}

function formatBytes(value) {
  const n = Number(value || 0);
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function renderNoPayment(periods) {
  const hasPending = periods.some((item) => item.request_status === 'pending');
  return `<div class="fund-empty-state fund-empty-state--large">${hasPending ? '현재 제출 가능한 미납 주차가 없습니다. 검수 중인 제출은 내 제출에서 확인할 수 있습니다.' : '현재 제출할 미납 공금이 없습니다.'}</div>`;
}
