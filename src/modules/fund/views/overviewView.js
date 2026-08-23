import {
  escapeHtml,
  formatMonthLabel,
  getKstDateString,
} from '../fundUtils.js';

export function renderOverviewView(state) {
  const fund = state.fund;
  const matrix = fund.monthMatrix ?? { weeks: [], members: [] };
  const weeks = matrix.weeks ?? [];
  const members = matrix.members ?? [];
  const todayKst = getKstDateString();

  return `
    <div class="ops-monthly">
      <header class="ops-view-head">
        <div>
          <h2>월별현황</h2>
          <p>멤버별 납부·검수·면제 상태를 한 화면에서 확인합니다.</p>
        </div>
        <div class="ops-view-actions">
          ${renderMonthPicker(fund.selectedMonth, fund.periods)}
        </div>
      </header>

      <section class="ops-surface ops-monthly__surface">
        <div class="ops-toolbar">
          <div class="ops-monthly__meta">
            <strong>${formatMonthLabel(fund.selectedMonth)}</strong>
            <span>${renderMonthSummary(weeks)}</span>
          </div>
          <span class="ops-toolbar__summary">${members.length}명 · ${weeks.length}개 회차</span>
        </div>
        <div class="ops-monthly__scroll">
          <table class="ops-monthly__table">
            <colgroup>
              <col class="ops-monthly__col-member" />
              ${weeks.map(() => '<col class="ops-monthly__col-week" />').join('')}
            </colgroup>
            <thead>
              <tr>
                <th>멤버명</th>
                ${weeks.map((week) => {
                  const current = isDateInsideWeek(todayKst, week);
                  return `
                    <th class="${current ? 'ops-monthly__current' : ''}">
                      <span class="ops-monthly__week-title">${Number(week.week)}주차</span>
                      <span class="ops-monthly__week-date">${shortRange(week.period_start, week.period_end)}</span>
                    </th>
                  `;
                }).join('')}
              </tr>
            </thead>
            <tbody>
              ${members.length
                ? members.map((member) => renderMemberRow(member, weeks, todayKst)).join('')
                : `<tr><td colspan="${weeks.length + 1}" class="ops-empty-cell">공금 대상 멤버가 없습니다.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderMemberRow(member, weeks, todayKst) {
  const cellMap = new Map(
    (member.cells ?? []).map((cell) => [Number(cell.week), cell]),
  );

  return `
    <tr>
      <td><span class="ops-monthly__member">${escapeHtml(member.nickname)}</span></td>
      ${weeks.map((week) => {
        const cell = cellMap.get(Number(week.week));
        const current = isDateInsideWeek(todayKst, week);
        return `
          <td class="${current ? 'ops-monthly__current' : ''}">
            ${renderMatrixStatus(cell)}
          </td>
        `;
      }).join('')}
    </tr>
  `;
}

function renderMatrixStatus(cell) {
  if (!cell) return '<span class="ops-status ops-status--muted">—</span>';
  const display = displayStatus(cell);
  return `<span class="ops-status ops-status--${statusClass(display)}">${escapeHtml(display)}</span>`;
}

function displayStatus(cell) {
  if (cell.status === '완료') {
    if (cell.payment_account === '분할납부') return '분할';
    if (cell.payment_account === '회사잔고') return '잔고';
    if (cell.payment_account === '공용계좌') return '공용';
    return '완료';
  }
  if (cell.status === '검수대기') return '검수';
  if (cell.status === '가입 전') return '제외';
  return cell.status;
}

function statusClass(status) {
  if (status === '공용') return 'public';
  if (status === '분할') return 'split';
  if (status === '잔고') return 'company';
  if (status === '완료') return 'done';
  if (status === '검수') return 'pending';
  if (status === '미납') return 'unpaid';
  if (status === '부족') return 'short';
  if (status === '반려') return 'reject';
  if (status === '면제') return 'exempt';
  if (status === '예정') return 'future';
  if (status === '제외') return 'before';
  return 'muted';
}

function renderMonthPicker(month, periods = []) {
  if (!month) return '';
  const months = uniqueMonths(periods);
  const currentValue = `${month.year}-${String(month.month).padStart(2, '0')}`;

  if (!months.some((item) => item.value === currentValue)) {
    months.push({ value: currentValue, label: `${month.year}년 ${month.month}월`, year: month.year, month: month.month });
    months.sort((a, b) => b.year - a.year || b.month - a.month);
  }

  return `
    <select class="ops-select" data-fund-month-select aria-label="월 선택">
      ${months.map((item) => `
        <option value="${item.value}" ${item.value === currentValue ? 'selected' : ''}>${item.label}</option>
      `).join('')}
    </select>
  `;
}

function uniqueMonths(periods) {
  const map = new Map();
  for (const item of periods ?? []) {
    const year = Number(item.year);
    const month = Number(item.month);
    if (!year || !month) continue;
    const value = `${year}-${String(month).padStart(2, '0')}`;
    if (!map.has(value)) map.set(value, { value, label: `${year}년 ${month}월`, year, month });
  }
  return [...map.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}

function renderMonthSummary(weeks) {
  if (!weeks.length) return '표시할 회차가 없습니다.';
  const first = weeks[0];
  const last = weeks.at(-1);
  return `${shortRange(first.period_start, first.period_end)} ~ ${shortRange(last.period_start, last.period_end)}`;
}

function shortRange(start, end) {
  if (!start || !end) return '';
  return `${shortDate(start)}~${shortDate(end)}`;
}

function shortDate(value) {
  const text = String(value).slice(0, 10);
  const parts = text.split('-');
  if (parts.length !== 3) return text;
  return `${parts[1]}/${parts[2]}`;
}

function isDateInsideWeek(dateKey, week) {
  if (!dateKey || !week?.period_start || !week?.period_end) return false;
  return String(week.period_start).slice(0, 10) <= dateKey
    && dateKey <= String(week.period_end).slice(0, 10);
}
