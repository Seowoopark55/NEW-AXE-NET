import './overview.css';
import {
  escapeHtml,
  formatMonthLabel,
  getKstDateString,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderOverviewView(state) {
  const fund = state.fund;
  const matrix = fund.monthMatrix ?? { weeks: [], members: [] };
  const weeks = matrix.weeks ?? [];
  const members = matrix.members ?? [];
  const todayKst = getKstDateString();

  return `
    <div class="fund-monthly">
      ${renderPageHeader(
        '월별현황',
        '월별 공금표에서 멤버별 납부·검수·면제 상태를 한 번에 확인합니다.',
        renderMonthPicker(fund.selectedMonth, fund.periods),
      )}

      <section class="fund-monthly__summary">
        <strong class="fund-monthly__summary-title">${formatMonthLabel(fund.selectedMonth)}</strong>
        <span class="fund-monthly__summary-text">${renderMonthSummary(weeks)}</span>
      </section>

      <section class="fund-monthly__panel">
        <div class="fund-monthly__scroll">
          <table class="fund-monthly__table">
            <colgroup>
              <col class="fund-monthly__col-member" />
              ${weeks.map(() => '<col class="fund-monthly__col-week" />').join('')}
            </colgroup>
            <thead>
              <tr>
                <th class="fund-monthly__head-cell fund-monthly__head-cell--member">멤버명</th>
                ${weeks.map((week) => {
                  const current = isDateInsideWeek(todayKst, week);
                  return `
                    <th class="fund-monthly__head-cell ${current ? 'is-current-week' : ''}">
                      <span class="fund-monthly__week-title">${Number(week.week)}주차</span>
                      <span class="fund-monthly__week-date">${shortRange(week.period_start, week.period_end)}</span>
                    </th>
                  `;
                }).join('')}
              </tr>
            </thead>
            <tbody>
              ${members.length
                ? members.map((member) => renderMemberRow(member, weeks, todayKst)).join('')
                : `<tr><td colspan="${weeks.length + 1}" class="fund-monthly__empty">공금 대상 멤버가 없습니다.</td></tr>`}
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
      <td class="fund-monthly__member-cell">
        <span class="fund-monthly__member-name">${escapeHtml(member.nickname)}</span>
      </td>
      ${weeks.map((week) => {
        const cell = cellMap.get(Number(week.week));
        const current = isDateInsideWeek(todayKst, week);
        return `
          <td class="fund-monthly__status-cell ${current ? 'is-current-week' : ''}">
            ${renderMatrixStatus(cell)}
          </td>
        `;
      }).join('')}
    </tr>
  `;
}

function renderMatrixStatus(cell) {
  if (!cell) {
    return '<span class="fund-monthly__status fund-monthly__status--muted">—</span>';
  }

  const display = displayStatus(cell);
  const cls = statusClass(display);

  return `
    <span class="fund-monthly__status fund-monthly__status--${cls}">
      ${escapeHtml(display)}
    </span>
  `;
}

function displayStatus(cell) {
  if (cell.status === '완료') {
    if (cell.payment_account === '분할납부') return '분할';
    if (cell.payment_account === '회사잔고') return '잔고';
    if (cell.payment_account === '공용계좌') return '공용';
    return '완료';
  }

  if (cell.status === '검수대기') return '검수';
  return cell.status;
}

function statusClass(status) {
  if (status === '공용') return 'public';
  if (status === '분할') return 'split';
  if (status === '잔고') return 'company';
  if (status === '완료') return 'done';
  if (status === '검수') return 'pending';
  if (status === '미납') return 'unpaid';
  if (status === '면제') return 'exempt';
  if (status === '예정') return 'future';
  return 'muted';
}

function renderMonthPicker(month, periods = []) {
  if (!month) return '';

  const months = uniqueMonths(periods);
  const currentValue = `${month.year}-${String(month.month).padStart(2, '0')}`;

  if (!months.some((item) => item.value === currentValue)) {
    months.push({
      value: currentValue,
      label: `${month.year}년 ${month.month}월`,
      year: month.year,
      month: month.month,
    });
    months.sort((a, b) => (
      b.year - a.year || b.month - a.month
    ));
  }

  return `
    <label class="fund-monthly__month-select">
      <select data-fund-month-select>
        ${months.map((item) => `
          <option
            value="${item.value}"
            ${item.value === currentValue ? 'selected' : ''}
          >
            ${item.label}
          </option>
        `).join('')}
      </select>
    </label>
  `;
}

function uniqueMonths(periods) {
  const map = new Map();

  for (const item of periods ?? []) {
    const year = Number(item.year);
    const month = Number(item.month);
    if (!year || !month) continue;

    const value = `${year}-${String(month).padStart(2, '0')}`;
    if (!map.has(value)) {
      map.set(value, {
        value,
        label: `${year}년 ${month}월`,
        year,
        month,
      });
    }
  }

  return [...map.values()].sort(
    (a, b) => b.year - a.year || b.month - a.month,
  );
}

function renderMonthSummary(weeks) {
  if (!weeks.length) return '표시할 회차가 없습니다.';
  const first = weeks[0];
  const last = weeks.at(-1);
  return `${shortRange(first.period_start, first.period_end)}부터 ${shortRange(last.period_start, last.period_end)}까지 ${weeks.length}개 주간 회차를 표시합니다.`;
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
