import {
  escapeHtml,
  formatMoney,
  formatMonthLabel,
  formatPeriodLabel,
  renderStatusBadge,
} from '../fundUtils.js';
import { renderCompactLedger, renderPageHeader } from '../components/shared.js';

export function renderOverviewView(state) {
  const fund = state.fund;
  const overview = fund.monthOverview ?? { weeks: [], totals: {} };
  const summary = fund.summary ?? {};
  const balance = summary.balance ?? {};
  const totals = overview.totals ?? {};
  const period = fund.selectedPeriod;

  return `
    ${renderPageHeader(
      '월별현황',
      '한 달의 납부 흐름을 주차별로 확인하고 필요한 주차를 바로 점검합니다.',
      renderMonthPicker(fund.selectedMonth),
    )}

    <div class="fund-overview-kpis">
      ${renderKpi('납부완료', totals.completed, '건')}
      ${renderKpi('미납', totals.unpaid, '건', 'danger')}
      ${renderKpi('면제', totals.exempt, '건')}
      ${renderKpi('검수대기', totals.pending, '건', Number(totals.pending) > 0 ? 'warn' : '')}
    </div>

    <div class="fund-balance-row">
      ${renderBalance('공용계좌', balance.public)}
      ${renderBalance('회사잔고', balance.company)}
      ${renderBalance('총 잔액', balance.total, true)}
    </div>

    <section class="fund-section-card">
      <div class="fund-section-card__header">
        <div>
          <span>WEEKLY FLOW</span>
          <h3>${formatMonthLabel(fund.selectedMonth)}</h3>
        </div>
        <p>주차를 누르면 아래 멤버 현황이 바뀝니다.</p>
      </div>

      <div class="fund-week-grid">
        ${(overview.weeks ?? []).map((week) => renderWeekCard(week, period)).join('')}
      </div>
    </section>

    <div class="fund-two-column">
      <section class="fund-section-card">
        <div class="fund-section-card__header">
          <div>
            <span>MEMBERS</span>
            <h3>${formatPeriodLabel(period)}</h3>
          </div>
          <p>${fund.statusItems.length}명</p>
        </div>

        <div class="fund-member-status-list">
          ${fund.statusItems.length
            ? fund.statusItems.map((item, index) => `
                <div class="fund-member-status-row">
                  <span class="fund-member-status-row__order">${index + 1}</span>
                  <strong>${escapeHtml(item.nickname)}</strong>
                  ${renderStatusBadge(item.status)}
                  <b>${formatMoney(item.amount)}</b>
                </div>
              `).join('')
            : '<div class="fund-empty-state">표시할 멤버가 없습니다.</div>'}
        </div>
      </section>

      <section class="fund-section-card">
        <div class="fund-section-card__header">
          <div>
            <span>RECENT</span>
            <h3>최근 공금내역</h3>
          </div>
          ${state.auth.admin ? '<button class="fund-text-button" type="button" data-fund-section="history">전체보기</button>' : ''}
        </div>

        <div class="fund-compact-ledger-list">
          ${fund.recentLedger.length
            ? fund.recentLedger.slice(0, 8).map(renderCompactLedger).join('')
            : '<div class="fund-empty-state">최근 내역이 없습니다.</div>'}
        </div>
      </section>
    </div>
  `;
}

function renderMonthPicker(month) {
  if (!month) return '';
  return `
    <div class="fund-month-picker">
      <button type="button" data-fund-month-shift="-1">‹</button>
      <strong>${month.year}년 ${month.month}월</strong>
      <button type="button" data-fund-month-shift="1">›</button>
    </div>
  `;
}

function renderKpi(label, value, suffix, tone = '') {
  return `
    <div class="fund-overview-kpi ${tone ? `fund-overview-kpi--${tone}` : ''}">
      <span>${label}</span>
      <strong>${Number(value ?? 0).toLocaleString('ko-KR')}<small>${suffix}</small></strong>
    </div>
  `;
}

function renderBalance(label, value, strong = false) {
  return `
    <div class="fund-balance-card ${strong ? 'fund-balance-card--strong' : ''}">
      <span>${label}</span>
      <strong>${formatMoney(value)}</strong>
    </div>
  `;
}

function renderWeekCard(week, selectedPeriod) {
  const selected = selectedPeriod && Number(selectedPeriod.week) === Number(week.week)
    && Number(selectedPeriod.year) === Number(week.year)
    && Number(selectedPeriod.month) === Number(week.month);

  return `
    <button
      class="fund-week-card ${selected ? 'fund-week-card--active' : ''}"
      type="button"
      data-fund-week="${week.week}"
      data-year="${week.year}"
      data-month="${week.month}"
    >
      <div class="fund-week-card__top">
        <strong>${week.week}주차</strong>
        <span>${formatMoney(week.weekly_fee)}</span>
      </div>
      <div class="fund-week-card__stats">
        <span>완료 <b>${week.completed}</b></span>
        <span class="is-danger">미납 <b>${week.unpaid}</b></span>
        <span>면제 <b>${week.exempt}</b></span>
        ${Number(week.pending) > 0 ? `<span class="is-warn">검수 <b>${week.pending}</b></span>` : ''}
      </div>
    </button>
  `;
}
