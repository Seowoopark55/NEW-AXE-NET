import {
  escapeHtml,
  formatMoney,
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
  const currentWeek = weeks.find((week) => isDateInsideWeek(todayKst, week)) ?? null;
  const firstWeek = weeks[0] ?? null;
  const lastWeek = weeks.at(-1) ?? null;

  return `
    ${renderPageHeader(
      '월별현황',
      '월별 공금표에서 멤버별 납부·검수·면제 상태를 한 번에 확인합니다.',
      renderMonthPicker(fund.selectedMonth),
    )}

    <section class="fund-status-overview">
      <div class="fund-status-overview__main">
        <span>선택 월</span>
        <strong>${formatMonthLabel(fund.selectedMonth)}</strong>
        <p>${renderRangeSummary(firstWeek, lastWeek, weeks.length)}</p>
      </div>
      ${currentWeek ? `
        <div class="fund-status-overview__current">
          <span>현재 회차</span>
          <strong>${Number(currentWeek.week)}주차</strong>
          <small>${shortRange(currentWeek.period_start, currentWeek.period_end)}</small>
        </div>
      ` : ''}
    </section>

    <section class="fund-legacy-panel">
      <div class="fund-legacy-panel__head">
        <div>
          <h3>${formatMonthLabel(fund.selectedMonth)} 공금 현황</h3>
          <p>공금은 일요일~토요일의 연속 7일 단위이며, 토요일 마감일이 속한 달의 주차로 배정됩니다.</p>
        </div>
        <div class="fund-status-legend">
          <span><i class="done"></i>완료</span>
          <span><i class="pending"></i>검수대기</span>
          <span><i class="unpaid"></i>미납</span>
          <span><i class="exempt"></i>면제</span>
          <span><i class="future"></i>예정/가입 전</span>
        </div>
      </div>

      <div class="fund-matrix-wrap">
        <table class="fund-matrix">
          <thead>
            <tr>
              <th class="left">멤버</th>
              ${weeks.map((week) => {
                const current = isDateInsideWeek(todayKst, week);
                return `
                  <th class="${current ? 'is-current-week' : ''}">
                    <span class="fund-week-heading">
                      <strong>${Number(week.week)}주차</strong>
                      ${current ? '<em>현재</em>' : ''}
                    </span>
                    <small>${shortRange(week.period_start, week.period_end)}</small>
                  </th>
                `;
              }).join('')}
              <th>미납</th>
            </tr>
          </thead>
          <tbody>
            ${members.length
              ? members.map((member) => renderMemberRow(member, weeks, todayKst)).join('')
              : `<tr><td colspan="${weeks.length + 2}" class="fund-empty-state">공금 대상 멤버가 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="fund-status-guide">
        <span>※ 달에 따라 4주차 또는 5주차까지 자동 생성됩니다.</span>
        <span>현재 회차는 시작일부터 바로 납부 대상이며, 아직 납부·검수 기록이 없으면 미납으로 표시됩니다.</span>
      </div>
    </section>
  `;
}

function renderMemberRow(member, weeks, todayKst) {
  const cellMap = new Map((member.cells ?? []).map((cell) => [Number(cell.week), cell]));
  return `
    <tr>
      <td class="left">
        <strong>${escapeHtml(member.nickname)}</strong>
      </td>
      ${weeks.map((week) => {
        const cell = cellMap.get(Number(week.week));
        const current = isDateInsideWeek(todayKst, week);
        return `<td class="${current ? 'is-current-week' : ''}">${renderMatrixStatus(cell)}</td>`;
      }).join('')}
      <td class="fund-matrix__unpaid">
        <strong>${Number(member.unpaid_count ?? 0)}</strong>
      </td>
    </tr>
  `;
}

function renderMatrixStatus(cell) {
  if (!cell) return '<span class="fund-matrix-status muted">—</span>';
  const cls = statusClass(cell.status);
  const amount = ['미납', '검수대기'].includes(cell.status)
    ? `<small>${formatMoney(cell.weekly_fee ?? cell.amount)}</small>`
    : '';
  return `
    <span class="fund-matrix-status ${cls}">
      <b>${escapeHtml(cell.status)}</b>
      ${amount}
    </span>
  `;
}

function statusClass(status) {
  if (status === '완료') return 'done';
  if (status === '검수대기') return 'pending';
  if (status === '미납') return 'unpaid';
  if (status === '면제') return 'exempt';
  if (status === '예정') return 'future';
  return 'muted';
}

function renderMonthPicker(month) {
  if (!month) return '';
  return `
    <div class="fund-month-toolbar">
      <button type="button" data-fund-month-shift="-1" aria-label="이전 달">‹</button>
      <strong>${month.year}년 ${month.month}월</strong>
      <button type="button" data-fund-month-shift="1" aria-label="다음 달">›</button>
    </div>
  `;
}

function renderRangeSummary(firstWeek, lastWeek, weekCount) {
  if (!firstWeek || !lastWeek || !weekCount) return '표시할 공금 회차가 없습니다.';
  return `${shortRange(firstWeek.period_start, firstWeek.period_end)}부터 ${shortRange(lastWeek.period_start, lastWeek.period_end)}까지 ${weekCount}개 주간 회차를 표시합니다.`;
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
