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
  const { fund, members } = state;
  const identity = fund.identity;

  if (!identity.verified || !identity.profile) {
    return `
      ${renderPageHeader('공금납부', '내 미납 주차를 확인한 뒤 필요한 주차의 공금을 제출합니다.')}
      ${renderIdentityGate(identity, members.items, '공금납부를 위해 본인 확인')}
    `;
  }

  const periods = identity.profile.periods ?? [];
  const unpaid = periods.filter((item) => item.status === '미납' && item.request_status !== 'pending');
  const selected = fund.payment.selectedPeriod
    ?? unpaid[0]
    ?? periods.find((item) => item.status === '미납')
    ?? null;

  return `
    ${renderPageHeader('공금납부', '미납 주차를 선택하고 증빙을 제출하면 관리자 검수대기로 이동합니다.')}
    ${renderVerifiedMember(identity)}

    <div class="fund-payment-layout">
      <section class="fund-section-card">
        <div class="fund-section-card__header">
          <div><span>MY STATUS</span><h3>내 납부 현황</h3></div>
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

        ${selected ? renderPaymentForm(state, selected) : renderNoPayment(periods)}
      </section>
    </div>
  `;
}

function renderOwnPeriod(item, selected) {
  const selectable = item.status === '미납' && item.request_status !== 'pending';
  const isSelected = selected && selected.year === item.year && selected.month === item.month && selected.week === item.week;
  const request = item.request_status ? `<small>${requestStatusLabel(item.request_status)}</small>` : '';

  return `
    <button
      class="fund-own-period ${isSelected ? 'fund-own-period--active' : ''}"
      type="button"
      ${selectable ? `data-payment-period="${item.year}-${item.month}-${item.week}"` : 'disabled'}
    >
      <div>
        <strong>${formatPeriodLabel(item)}</strong>
        <span>${formatMoney(item.weekly_fee)}</span>
      </div>
      <div class="fund-own-period__status">
        ${renderStatusBadge(item.status)}
        ${request}
      </div>
    </button>
  `;
}

function renderPaymentForm(state, selected) {
  const payment = state.fund.payment;
  const pending = selected.request_status === 'pending';
  const canSubmit = selected.status === '미납' && !pending;

  if (!canSubmit) {
    return `
      <div class="fund-empty-state fund-empty-state--large">
        ${pending ? '이 주차는 이미 검수대기 중입니다.' : '선택한 주차는 현재 납부 제출 대상이 아닙니다.'}
      </div>
    `;
  }

  return `
    <form class="fund-payment-form" data-fund-payment-request-form>
      <input type="hidden" name="year" value="${selected.year}" />
      <input type="hidden" name="month" value="${selected.month}" />
      <input type="hidden" name="week" value="${selected.week}" />
      <input type="hidden" name="amount" value="${selected.weekly_fee}" />

      <div class="fund-payment-summary">
        <div><span>납부 주차</span><strong>${formatPeriodLabel(selected)}</strong></div>
        <div><span>납부 금액</span><strong>${formatMoney(selected.weekly_fee)}</strong></div>
        <div><span>입금 처리</span><strong>공용계좌</strong></div>
      </div>

      <label class="fund-field">
        <span>증빙 URL</span>
        <input
          type="url"
          name="evidence_url"
          maxlength="500"
          value="${escapeAttribute(payment.evidenceUrl || '')}"
          placeholder="이미지/증빙 링크 (선택)"
        />
      </label>

      <label class="fund-field">
        <span>메모</span>
        <input
          name="memo"
          maxlength="300"
          value="${escapeAttribute(payment.memo || '')}"
          placeholder="관리자에게 전달할 내용 (선택)"
        />
      </label>

      <div class="fund-info-box">
        제출만으로 납부 완료가 되지는 않습니다. 관리자가 확인해 승인하면 공금내역에 자동 등록되고 완료 상태로 바뀝니다.
      </div>

      <button class="fund-primary-button fund-primary-button--wide" type="submit" ${payment.submitting ? 'disabled' : ''}>
        ${payment.submitting ? '제출 중...' : '공금 제출'}
      </button>
    </form>
  `;
}

function renderNoPayment(periods) {
  const hasPending = periods.some((item) => item.request_status === 'pending');
  return `
    <div class="fund-empty-state fund-empty-state--large">
      ${hasPending ? '현재 제출 가능한 미납 주차가 없습니다. 검수 중인 제출은 내 제출에서 확인할 수 있습니다.' : '현재 제출할 미납 공금이 없습니다.'}
    </div>
  `;
}
