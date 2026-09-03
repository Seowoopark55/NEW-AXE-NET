import {
  escapeHtml,
  formatMoney,
  ledgerAmountType,
  ledgerSign,
} from '../fund/fundUtils.js';
import { getShortcutTarget } from '../shortcuts/shortcutTargets.js';

export function renderHomeView(root, state, actions = {}) {
  const fund = state.fund ?? {};
  const recentLedger = Array.isArray(fund.recentLedger) ? fund.recentLedger.slice(0, 4) : [];
  const recentNotices = (state.notice?.notices ?? [])
    .slice()
    .sort((a, b) => Number(Boolean(b.important)) - Number(Boolean(a.important)) || dateValue(b.published_at) - dateValue(a.published_at))
    .slice(0, 2);
  const fundLoading = Boolean(fund.loading || !fund.initialized);
  const noticeLoading = Boolean(state.notice?.loading || !state.notice?.initialized);

  const shortcuts = Array.isArray(state.shortcuts?.items) ? state.shortcuts.items : [];

  root.innerHTML = `
    <section class="ops-home" aria-label="AXE NET 홈">
      ${shortcuts.length ? `
        <section class="ops-home-quickpanel" aria-label="내 바로가기">
          <header class="ops-home-quickpanel__head">
            <div>
              <span>QUICK ACCESS</span>
              <h2>바로가기</h2>
            </div>
            <small>자주 쓰는 AXE 기능을 바로 실행합니다.</small>
          </header>
          <div class="ops-home-quickpanel__grid">
            ${shortcuts.map(renderHomeShortcut).join('')}
          </div>
        </section>
      ` : ''}

      <div class="ops-home-overview">
        <section class="ops-home-card">
          <header class="ops-home-card__head">
            <div>
              <span>NEWS</span>
              <h2>공지사항</h2>
            </div>
            <button type="button" data-home-module="notice">전체보기 →</button>
          </header>
          <div class="ops-home-notices">
            ${recentNotices.length
              ? recentNotices.map(renderRecentNoticeRow).join('')
              : noticeLoading
                ? '<div class="ops-home-empty">공지사항을 불러오는 중입니다.</div>'
                : '<div class="ops-home-empty">등록된 공지사항이 없습니다.</div>'}
          </div>
        </section>

        <section class="ops-home-card">
          <header class="ops-home-card__head">
            <div>
              <span>FUND</span>
              <h2>최근 공금 흐름</h2>
            </div>
            ${state.auth?.admin
              ? '<button type="button" data-home-fund-section="history">공금내역 →</button>'
              : '<button type="button" data-home-fund-section="overview">공금현황 →</button>'}
          </header>
          <div class="ops-home-recent">
            ${recentLedger.length
              ? recentLedger.map(renderRecentLedgerRow).join('')
              : fundLoading
                ? '<div class="ops-home-empty">최근 공금 흐름을 불러오는 중입니다.</div>'
                : '<div class="ops-home-empty">최근 공금 기록이 없습니다.</div>'}
          </div>
        </section>
      </div>

    </section>
  `;

  bindHomeEvents(root, actions);
}

function renderHomeShortcut(item) {
  const target = getShortcutTarget(item.target_key);
  return `
    <button class="ops-home-quickpanel__item" type="button" data-home-shortcut="${escapeHtml(item.target_key)}">
      <i aria-hidden="true">${escapeHtml(shortcutMark(item.target_key))}</i>
      <span>
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(target?.label || item.target_key)}</small>
      </span>
      <b aria-hidden="true">→</b>
    </button>
  `;
}

function shortcutMark(key) {
  const value = String(key || '');
  if (value.startsWith('fund.')) return '₩';
  if (value.startsWith('assets.')) return '◇';
  if (value.startsWith('info.')) return '⌕';
  if (value.startsWith('notice.')) return '!';
  if (value.startsWith('outlaw.')) return '◎';
  if (value === 'members') return 'M';
  return 'A';
}

function renderRecentLedgerRow(item) {
  const isOut = ledgerAmountType(item) === 'out';
  const amount = Math.abs(Number(item.amount ?? 0));
  const title = item.category || item.ledger_type || '공금내역';
  const person = item.nickname || '—';
  const account = item.account || '—';

  return `
    <div class="ops-home-recent__row">
      <time>${escapeHtml(shortDate(item.ledger_date))}</time>
      <div class="ops-home-recent__entry">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml([person, account].filter(Boolean).join(' · '))}</span>
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

  root.querySelectorAll('[data-home-shortcut]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenShortcut?.(button.dataset.homeShortcut));
  });

  root.querySelectorAll('[data-home-fund-section]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenFundSection?.(button.dataset.homeFundSection));
  });

  root.querySelectorAll('[data-home-notice-id]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenNotice?.(button.dataset.homeNoticeId));
  });
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

