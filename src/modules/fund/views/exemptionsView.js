import { escapeAttribute, escapeHtml, formatDateTime, formatPeriodLabel } from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderExemptionsView(state) {
  const { fund, members } = state;
  const admin = fund.admin;
  const period = fund.selectedPeriod;
  const activeMembers = members.items.filter((member) => member.status === 'active');
  const groups = groupExemptions(admin.exemptions ?? []);
  const memberCount = new Set(groups.map((group) => group.member_key).filter(Boolean)).size;
  const currentMonth = period ? `${period.year}-${String(period.month).padStart(2, '0')}` : currentMonthValue();
  const defaultWeek = Number(period?.week || 1);

  return `
    <div class="fund-admin fund-admin--medium">
      ${renderPageHeader('면제관리', '멤버별 공금 면제 기간을 시작 주차부터 종료 주차까지 관리합니다.')}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <div class="fund-exemption-layout">
        <section class="fund-admin-panel fund-admin-panel--form">
          ${panelHead('기간 면제 등록', '선택한 기간 전체가 미납 대상에서 제외됩니다.')}
          <form class="fund-settings-form fund-admin-exemption-form" data-exemption-form>
            <label class="fund-field fund-field--wide"><span>멤버</span><select name="member_key" required><option value="">선택</option>${activeMembers.map((member) => `<option value="${escapeAttribute(member.member_key)}">${escapeHtml(member.nickname)}</option>`).join('')}</select></label>
            <div class="fund-exemption-period-grid">
              <label class="fund-field"><span>시작 월</span><input type="month" name="start_month" value="${escapeAttribute(currentMonth)}" data-exemption-start-month required /></label>
              <label class="fund-field"><span>시작 주차</span><select name="start_week" data-exemption-start-week>${renderWeekOptions(currentMonth, defaultWeek)}</select></label>
              <label class="fund-field"><span>종료 월</span><input type="month" name="end_month" value="${escapeAttribute(currentMonth)}" data-exemption-end-month required /></label>
              <label class="fund-field"><span>종료 주차</span><select name="end_week" data-exemption-end-week>${renderWeekOptions(currentMonth, defaultWeek)}</select></label>
            </div>
            <label class="fund-field fund-field--wide"><span>사유</span><input name="reason" maxlength="200" placeholder="휴식기, 휴가, 복귀 예정 등" /></label>
            <button class="fund-primary-button" type="submit" ${admin.saving ? 'disabled' : ''}>면제 저장</button>
          </form>
          <div class="fund-admin-note">면제 기간은 월별현황에서 미납이 아닌 <b>면제</b>로 표시됩니다. 선택 기간에 검수대기 또는 승인 신청이 있으면 해당 신청을 먼저 정리해야 합니다.</div>
        </section>

        <section class="fund-admin-panel fund-admin-panel--rules">
          ${panelHead(`활성 면제 ${groups.length}건`, `${memberCount}명 · 기간 단위로 묶어 표시`)}
          <div class="fund-admin-exemption-list">${groups.length ? groups.map(renderExemptionGroup).join('') : '<div class="fund-empty-state">현재 활성 면제가 없습니다.</div>'}</div>
        </section>
      </div>
    </div>
  `;
}

function renderExemptionGroup(group) {
  const rangeLabel = group.start && group.end
    ? (samePeriod(group.start, group.end)
      ? formatPeriodLabel(group.start)
      : `${formatPeriodLabel(group.start)} ~ ${formatPeriodLabel(group.end)}`)
    : '기간 정보 없음';
  const disableAttr = group.range_key
    ? `data-disable-exemption-range="${escapeAttribute(group.range_key)}"`
    : `data-disable-exemption="${Number(group.id)}"`;

  return `
    <article class="fund-admin-exemption">
      <div class="fund-admin-exemption__main">
        <strong>${escapeHtml(group.nickname || '멤버')}</strong>
        <span class="fund-admin-exemption__range">${escapeHtml(rangeLabel)}</span>
        <small>${escapeHtml(group.reason || '사유 없음')}</small>
      </div>
      <div class="fund-admin-exemption__meta">
        <span>${escapeHtml(group.created_by || '관리자')}</span>
        <small>${formatDateTime(group.created_at)}</small>
      </div>
      <button class="fund-danger-button fund-secondary-button--small" type="button" ${disableAttr}>면제 해제</button>
    </article>
  `;
}

function groupExemptions(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!row?.enabled) return;
    const key = row.range_key || `legacy:${row.id}`;
    if (!map.has(key)) {
      map.set(key, {
        id: row.id,
        range_key: row.range_key || '',
        member_key: row.member_key || '',
        nickname: row.nickname || '',
        reason: row.reason || '',
        created_by: row.created_by || '',
        created_at: row.created_at || '',
        periods: [],
      });
    }
    const group = map.get(key);
    group.periods.push({ year: Number(row.year), month: Number(row.month), week: Number(row.week) });
    if (!group.reason && row.reason) group.reason = row.reason;
  });

  return [...map.values()]
    .map((group) => {
      const sorted = group.periods.slice().sort(comparePeriod);
      return { ...group, start: sorted[0] || null, end: sorted[sorted.length - 1] || null };
    })
    .sort((a, b) => comparePeriod(b.start, a.start) || String(a.nickname).localeCompare(String(b.nickname), 'ko'));
}

function comparePeriod(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return Number(a.year) - Number(b.year)
    || Number(a.month) - Number(b.month)
    || Number(a.week) - Number(b.week);
}

function samePeriod(a, b) {
  return a?.year === b?.year && a?.month === b?.month && a?.week === b?.week;
}

function panelHead(title, desc, count = '') {
  return `<div class="fund-admin-panel__head is-row"><div><h3>${title}</h3><p>${desc}</p></div>${count ? `<b>${count}</b>` : ''}</div>`;
}

function currentMonthValue() {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}`;
}

function renderWeekOptions(monthValue, selectedWeek = 1) {
  const count = saturdayCount(monthValue);
  const selected = Math.min(Math.max(Number(selectedWeek) || 1, 1), count);
  return Array.from({ length: count }, (_, index) => index + 1)
    .map((week) => `<option value="${week}" ${week === selected ? 'selected' : ''}>${week}주차</option>`)
    .join('');
}

function saturdayCount(monthValue) {
  const [year, month] = String(monthValue || '').split('-').map(Number);
  if (!year || !month) return 5;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 6) count += 1;
  }
  return Math.max(count, 1);
}
