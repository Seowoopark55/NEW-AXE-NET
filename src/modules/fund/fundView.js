export function renderFundView(root, state, actions = {}) {
  const { fund, system } = state;

  if (!system.connected) {
    root.innerHTML = `
      <section class="panel">
        <div class="panel__header">
          <div>
            <h2>공금</h2>
            <p>데이터 연결 대기</p>
          </div>
        </div>
        <div class="panel__body">
          <div class="notice ${system.error ? 'notice--error' : ''}">
            ${system.error ? escapeHtml(system.error) : 'Supabase 연결을 확인하고 있습니다.'}
          </div>
        </div>
      </section>
    `;
    return;
  }

  if (!fund.initialized) {
    root.innerHTML = `
      <section class="panel">
        <div class="panel__body">
          <div class="notice">공금 데이터를 준비하고 있습니다.</div>
        </div>
      </section>
    `;
    return;
  }

  if (fund.error) {
    root.innerHTML = `
      <section class="panel">
        <div class="panel__header">
          <div>
            <h2>공금</h2>
            <p>Supabase · new_axe_net.fund_*</p>
          </div>
        </div>
        <div class="panel__body">
          <div class="notice notice--error">
            <strong>공금 데이터 로드 실패</strong>
            <span>${escapeHtml(fund.error)}</span>
          </div>
        </div>
      </section>
    `;
    return;
  }

  const summary = fund.summary ?? {};
  const period = summary.period ?? fund.selectedPeriod;
  const balance = summary.balance ?? {};
  const counts = summary.counts ?? {};
  const amounts = summary.amounts ?? {};

  root.innerHTML = `
    <section class="panel fund-panel">
      <div class="panel__header fund-header">
        <div>
          <h2>공금</h2>
          <p>원장 · 주간 현황 · 면제/회비 규칙</p>
        </div>

        <label class="fund-period-select">
          <span>조회 기간</span>
          <select data-fund-period ${fund.loading ? 'disabled' : ''}>
            ${renderPeriodOptions(fund.periods, period)}
          </select>
        </label>
      </div>

      <div class="panel__body">
        ${fund.loading ? '<div class="notice">선택한 기간을 불러오는 중입니다.</div>' : ''}

        <div class="fund-balance-grid">
          ${renderKpi('전체 잔액', formatMoney(balance.total), '현재 active 원장 기준')}
          ${renderKpi('공용계좌', formatMoney(balance.public), '수입 - 지출 + 조정')}
          ${renderKpi('회사잔고', formatMoney(balance.company), '회사잔고 배정분')}
          ${renderKpi('주간 공금', formatMoney(summary.fee), formatPeriodLabel(period))}
        </div>

        <div class="fund-period-summary">
          <div class="fund-period-summary__head">
            <div>
              <span>WEEKLY STATUS</span>
              <h3>${formatPeriodLabel(period)}</h3>
            </div>
            <div class="fund-period-summary__amount">
              <span>납부 대상</span>
              <strong>${formatMoney(amounts.expected)}</strong>
            </div>
          </div>

          <div class="fund-status-cards">
            ${renderStatusCard('완료', counts.completed, amounts.paid, 'done')}
            ${renderStatusCard('미납', counts.unpaid, amounts.unpaid, 'unpaid')}
            ${renderStatusCard('면제', counts.exempt, amounts.exempt, 'exempt')}
            ${renderStatusCard('예정', counts.scheduled, 0, 'scheduled')}
          </div>
        </div>

        <div class="fund-content-grid">
          <section class="fund-section">
            <div class="fund-section__header">
              <div>
                <h3>주간 멤버 현황</h3>
                <p>${Number(counts.members ?? 0).toLocaleString('ko-KR')}명 기준</p>
              </div>
            </div>

            <div class="fund-status-table-wrap">
              <table class="fund-status-table">
                <thead>
                  <tr>
                    <th>순번</th>
                    <th>닉네임</th>
                    <th>상태</th>
                    <th class="fund-number">금액</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    fund.statusItems.length
                      ? fund.statusItems.map((item, index) => renderStatusRow(item, index + 1)).join('')
                      : '<tr><td colspan="4" class="fund-empty">표시할 데이터가 없습니다.</td></tr>'
                  }
                </tbody>
              </table>
            </div>
          </section>

          <section class="fund-section">
            <div class="fund-section__header">
              <div>
                <h3>최근 공금 내역</h3>
                <p>active 원장 최근 12건</p>
              </div>
            </div>

            <div class="fund-ledger-list">
              ${
                fund.recentLedger.length
                  ? fund.recentLedger.map(renderLedgerItem).join('')
                  : '<div class="fund-empty fund-empty--block">최근 내역이 없습니다.</div>'
              }
            </div>
          </section>
        </div>

        <div class="fund-legacy-note">
          현재 주간 상태는 기존 AXE NET에서 계산되어 있던 상태 스냅샷을 안전하게 이전해 표시합니다.
          다음 단계에서 NEW AXE NET 자체 계산 엔진으로 전환합니다.
        </div>
      </div>
    </section>
  `;

  root.querySelector('[data-fund-period]')?.addEventListener('change', (event) => {
    const [year, month, week] = event.target.value.split('-').map(Number);
    actions.onPeriodChange?.({ year, month, week });
  });
}

function renderPeriodOptions(periods, selected) {
  return periods.map((period) => {
    const value = `${period.year}-${period.month}-${period.week}`;
    const selectedValue = selected
      ? `${selected.year}-${selected.month}-${selected.week}`
      : '';

    return `
      <option value="${value}" ${value === selectedValue ? 'selected' : ''}>
        ${period.year}년 ${period.month}월 ${period.week}주차
      </option>
    `;
  }).join('');
}

function renderKpi(label, value, note) {
  return `
    <div class="fund-kpi">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </div>
  `;
}

function renderStatusCard(label, count, amount, type) {
  return `
    <div class="fund-status-card fund-status-card--${type}">
      <div>
        <span>${label}</span>
        <strong>${Number(count ?? 0).toLocaleString('ko-KR')}</strong>
      </div>
      <small>${amount ? formatMoney(amount) : '—'}</small>
    </div>
  `;
}

function renderStatusRow(item, displayOrder) {
  return `
    <tr>
      <td>${displayOrder}</td>
      <td><strong>${escapeHtml(item.nickname ?? '')}</strong></td>
      <td>${renderStatusBadge(item.status)}</td>
      <td class="fund-number">${formatMoney(item.amount)}</td>
    </tr>
  `;
}

function renderStatusBadge(status) {
  const classNames = {
    '완료': 'done',
    '미납': 'unpaid',
    '면제': 'exempt',
    '예정': 'scheduled',
    '가입 전': 'before',
  };

  const className = classNames[status] ?? 'before';

  return `<span class="fund-status-badge fund-status-badge--${className}">${escapeHtml(status)}</span>`;
}

function renderLedgerItem(item) {
  const amount = Number(item.amount ?? 0);
  const sign =
    item.direction === '지출'
      ? '-'
      : item.direction === '조정'
        ? (amount >= 0 ? '+' : '')
        : '+';

  return `
    <article class="fund-ledger-item">
      <div class="fund-ledger-item__main">
        <div>
          <strong>${escapeHtml(item.category || item.ledger_type || '공금')}</strong>
          <span>${escapeHtml(item.nickname || item.account || '공용')}</span>
        </div>
        <b class="fund-ledger-amount fund-ledger-amount--${ledgerAmountType(item)}">
          ${sign}${formatMoney(Math.abs(amount))}
        </b>
      </div>
      <div class="fund-ledger-item__meta">
        <span>${formatDate(item.ledger_date)}</span>
        <span>${escapeHtml(item.account || '')}</span>
      </div>
    </article>
  `;
}

function ledgerAmountType(item) {
  if (item.direction === '지출') return 'out';
  if (item.direction === '조정' && Number(item.amount ?? 0) < 0) return 'out';
  return 'in';
}

function formatMoney(value) {
  const number = Number(value ?? 0);
  return `${Number.isFinite(number) ? number.toLocaleString('ko-KR') : '0'}원`;
}

function formatPeriodLabel(period) {
  if (!period) return '기간 없음';
  return `${period.year}년 ${period.month}월 ${period.week}주차`;
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
