import {
  escapeHtml,
  formatMoney,
  ledgerAmountType,
  ledgerSign,
} from '../fund/fundUtils.js';

export function renderHomeView(root, state, actions = {}) {
  const members = state.members?.items ?? [];
  const fund = state.fund ?? {};
  const summary = fund.summary ?? {};
  const counts = summary.counts ?? {};
  const balance = summary.balance ?? {};
  const period = summary.period ?? fund.selectedPeriod ?? null;
  const recentLedger = Array.isArray(fund.recentLedger) ? fund.recentLedger.slice(0, 6) : [];
  const recentNotices = (state.notice?.notices ?? [])
    .slice()
    .sort((a, b) => Number(Boolean(b.important)) - Number(Boolean(a.important)) || dateValue(b.published_at) - dateValue(a.published_at))
    .slice(0, 4);
  const pendingCount = state.auth?.admin
    ? (fund.admin?.requests ?? []).filter((item) => item.status === 'pending' || item.status === 'hold').length
    : null;

  const memberCounts = countMembers(members);
  const completed = Number(counts.completed ?? 0);
  const unpaid = Number(counts.unpaid ?? 0);
  const exempt = Number(counts.exempt ?? 0);
  const payable = completed + unpaid;
  const progress = payable > 0 ? Math.round((completed / payable) * 100) : 0;
  const dataLoading = Boolean(state.members?.loading || fund.loading || !fund.initialized);

  root.innerHTML = `
    <section class="ops-home">
      <header class="ops-home__header">
        <div>
          <h1>운영 홈</h1>
          <p>멤버와 공금의 현재 상태를 한 화면에서 확인하고 필요한 업무로 바로 이동합니다.</p>
        </div>
        <div class="ops-home__period">${escapeHtml(periodLabel(period))}</div>
      </header>

      ${dataLoading ? '<div class="ops-home__loading">운영 데이터를 불러오는 중입니다.</div>' : ''}

      <section class="ops-home-summary" aria-label="운영 요약">
        <div class="ops-home-summary__primary">
          <span>공용계좌 잔액</span>
          <strong>${formatMoney(balance.public ?? 0)}</strong>
          <small>공금 운영 기준 잔액</small>
        </div>
        <div class="ops-home-summary__metric">
          <span>활동 멤버</span>
          <strong>${memberCounts.active}</strong>
          <small>전체 ${memberCounts.total}명</small>
        </div>
        <div class="ops-home-summary__metric ${unpaid ? 'is-alert' : ''}">
          <span>현재 미납</span>
          <strong>${unpaid}</strong>
          <small>완료 ${completed} · 면제 ${exempt}</small>
        </div>
        <div class="ops-home-summary__metric ${pendingCount ? 'is-alert' : ''}">
          <span>${pendingCount === null ? '납부 완료율' : '검수대기·보류'}</span>
          <strong>${pendingCount === null ? `${progress}%` : pendingCount}</strong>
          <small>${pendingCount === null ? `${completed}/${payable || 0} 완료` : '관리자 검수 필요'}</small>
        </div>
      </section>

      <div class="ops-home-grid">
        <section class="ops-home-panel ops-home-panel--work">
          <div class="ops-home-panel__head">
            <div>
              <h2>바로가기</h2>
              <p>자주 쓰는 운영 화면으로 바로 이동합니다.</p>
            </div>
          </div>
          <div class="ops-home-shortcuts">
            ${shortcut('공지사항', '주요 공지와 운영기준을 확인합니다.', 'notice', null, actions)}
            ${shortcut('정보', '제작·퀘스트·개조서·스킬랭크를 조회합니다.', 'info', null, actions)}
            ${shortcut('AXE TUBE', 'AXE 활동 영상과 게임 플레이를 확인합니다.', 'tube', null, actions)}
            ${shortcut('멤버', '조직 구성과 권한, 활동 상태를 관리합니다.', 'members', null, actions)}
            ${shortcut('월별현황', '멤버별 공금 납부 상태를 한눈에 확인합니다.', 'fund', 'overview', actions)}
            ${shortcut('공금납부', '본인 또는 관리자 대리 납부를 제출합니다.', 'fund', 'payment', actions)}
            ${state.auth?.admin ? shortcut('검수대기', '대기·보류 제출을 검수하고 승인합니다.', 'fund', 'review', actions, pendingCount) : ''}
            ${state.auth?.admin ? shortcut('공금내역', '수입·지출과 승인 반영 공금기록을 확인합니다.', 'fund', 'history', actions) : ''}
          </div>
        </section>

        <section class="ops-home-panel ops-home-panel--status">
          <div class="ops-home-panel__head">
            <div>
              <h2>현재 공금</h2>
              <p>${escapeHtml(periodLabel(period))} 진행 상태입니다.</p>
            </div>
            <button class="ops-home-link" type="button" data-home-fund-section="overview">월별현황 보기</button>
          </div>

          <div class="ops-home-progress">
            <div class="ops-home-progress__line">
              <span>납부 완료</span>
              <strong>${progress}%</strong>
            </div>
            <div class="ops-home-progress__track" aria-label="납부 완료율 ${progress}%">
              <i style="width:${Math.max(0, Math.min(100, progress))}%"></i>
            </div>
            <div class="ops-home-progress__stats">
              <span><b>${completed}</b> 완료</span>
              <span class="${unpaid ? 'is-alert' : ''}"><b>${unpaid}</b> 미납</span>
              <span><b>${exempt}</b> 면제</span>
            </div>
          </div>
        </section>
      </div>

      <section class="ops-home-panel ops-home-panel--notices">
        <div class="ops-home-panel__head">
          <div>
            <h2>최근 공지</h2>
            <p>중요 공지와 최근 업데이트를 먼저 확인합니다.</p>
          </div>
          <button class="ops-home-link" type="button" data-home-module="notice">공지사항 보기</button>
        </div>
        <div class="ops-home-notices">
          ${recentNotices.length
            ? recentNotices.map(renderRecentNoticeRow).join('')
            : '<div class="ops-home-empty">등록된 공지사항이 없습니다.</div>'}
        </div>
      </section>

      <section class="ops-home-panel ops-home-panel--recent">
        <div class="ops-home-panel__head">
          <div>
            <h2>최근 공금 흐름</h2>
            <p>최근 반영된 공금 기록입니다.</p>
          </div>
          ${state.auth?.admin ? '<button class="ops-home-link" type="button" data-home-fund-section="history">공금내역 보기</button>' : ''}
        </div>
        <div class="ops-home-recent">
          ${recentLedger.length
            ? recentLedger.map(renderRecentLedgerRow).join('')
            : '<div class="ops-home-empty">최근 공금 기록이 없습니다.</div>'}
        </div>
      </section>
    </section>
  `;

  bindHomeEvents(root, actions);
}

function shortcut(title, description, moduleName, fundSection, actions, badge = null) {
  const attr = fundSection
    ? `data-home-fund-section="${escapeHtml(fundSection)}"`
    : `data-home-module="${escapeHtml(moduleName)}"`;
  const badgeHtml = Number(badge) > 0 ? `<span class="ops-home-shortcut__badge">${Number(badge)}</span>` : '';

  return `
    <button class="ops-home-shortcut" type="button" ${attr}>
      <span class="ops-home-shortcut__copy">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(description)}</small>
      </span>
      <span class="ops-home-shortcut__tail">${badgeHtml}<i aria-hidden="true">→</i></span>
    </button>
  `;
}

function renderRecentLedgerRow(item) {
  const isOut = ledgerAmountType(item) === 'out';
  const amount = Math.abs(Number(item.amount ?? 0));
  const title = item.category || item.ledger_type || '공금내역';
  const person = item.nickname || '—';
  const account = item.account || '—';
  const meta = [person, account].filter(Boolean).join(' · ');

  return `
    <div class="ops-home-recent__row">
      <time>${escapeHtml(shortDate(item.ledger_date))}</time>
      <div class="ops-home-recent__entry">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(meta)}</span>
      </div>
      <div class="ops-home-recent__amount ${isOut ? 'is-out' : ''}">
        ${ledgerSign(item)}${formatMoney(amount)}
      </div>
    </div>
  `;
}

function renderRecentNoticeRow(item) {
  return `
    <button class="ops-home-notice-row" type="button" data-home-notice-id="${Number(item.id)}">
      <span class="ops-home-notice-row__title">
        ${item.important ? '<em>중요</em>' : ''}
        <strong>${escapeHtml(item.title || '제목 없음')}</strong>
      </span>
      <time>${escapeHtml(shortDate(item.published_at))}</time>
    </button>
  `;
}

function bindHomeEvents(root, actions) {
  root.querySelectorAll('[data-home-module]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenModule?.(button.dataset.homeModule));
  });

  root.querySelectorAll('[data-home-fund-section]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenFundSection?.(button.dataset.homeFundSection));
  });

  root.querySelectorAll('[data-home-notice-id]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenNotice?.(button.dataset.homeNoticeId));
  });
}

function countMembers(items) {
  return (items ?? []).reduce((acc, item) => {
    acc.total += 1;
    if (item.status === 'active') acc.active += 1;
    if (item.status === 'inactive') acc.inactive += 1;
    if (item.status === 'resigned') acc.resigned += 1;
    return acc;
  }, { total: 0, active: 0, inactive: 0, resigned: 0 });
}

function periodLabel(period) {
  if (!period?.year || !period?.month || !period?.week) return '현재 회차';
  return `${Number(period.year)}년 ${Number(period.month)}월 ${Number(period.week)}주차`;
}

function dateValue(value) {
  const time = new Date(value || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function shortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}.${day}`;
}
