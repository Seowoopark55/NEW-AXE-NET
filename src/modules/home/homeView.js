import {
  escapeHtml,
  formatMoney,
  ledgerAmountType,
  ledgerSign,
} from '../fund/fundUtils.js';

export function renderHomeView(root, state, actions = {}) {
  const fund = state.fund ?? {};
  const recentLedger = Array.isArray(fund.recentLedger) ? fund.recentLedger.slice(0, 4) : [];
  const recentNotices = (state.notice?.notices ?? [])
    .slice()
    .sort((a, b) => Number(Boolean(b.important)) - Number(Boolean(a.important)) || dateValue(b.published_at) - dateValue(a.published_at))
    .slice(0, 2);
  const recentVideos = (state.tube?.videos ?? [])
    .slice()
    .sort((a, b) => dateValue(b.published_at) - dateValue(a.published_at))
    .slice(0, 4);
  const dataLoading = Boolean(fund.loading || !fund.initialized || state.notice?.loading || state.tube?.loading);

  const shortcuts = Array.isArray(state.shortcuts?.items) ? state.shortcuts.items : [];

  root.innerHTML = `
    <section class="ops-home" aria-label="NEW AXE NET 홈">
      ${dataLoading ? '<div class="ops-home__loading">최신 데이터를 불러오는 중입니다.</div>' : ''}
      ${shortcuts.length ? `
        <div class="ops-home-shortcuts" aria-label="내 바로가기">
          <span class="ops-home-shortcuts__label">⚡ 바로가기</span>
          ${shortcuts.map((item) => `<button class="ops-home-shortcuts__item" type="button" data-home-shortcut="${escapeHtml(item.target_key)}">${escapeHtml(item.label)}</button>`).join('')}
        </div>
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
              : '<div class="ops-home-empty">최근 공금 기록이 없습니다.</div>'}
          </div>
        </section>
      </div>

      <section class="ops-home-card ops-home-card--tube">
        <header class="ops-home-card__head">
          <div>
            <span>MEDIA</span>
            <h2>AXE TUBE</h2>
          </div>
          <button type="button" data-home-module="tube">전체보기 →</button>
        </header>
        ${recentVideos.length
          ? `<div class="ops-home-videos">${recentVideos.map(renderVideoPreview).join('')}</div>`
          : '<div class="ops-home-empty">등록된 AXE TUBE 영상이 없습니다.</div>'}
      </section>
    </section>
  `;

  bindHomeEvents(root, actions);
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

function renderVideoPreview(video) {
  return `
    <button class="ops-home-video" type="button" data-home-module="tube" aria-label="${escapeHtml(video.title || 'AXE TUBE')} 보기">
      <span class="ops-home-video__thumb">
        <img src="${escapeHtml(getThumbnail(video))}" alt="" loading="lazy" />
        <i aria-hidden="true">▶</i>
      </span>
      <span class="ops-home-video__copy">
        <strong>${escapeHtml(video.title || '제목 없음')}</strong>
        <small>${escapeHtml(video.writer || 'AXE')} · ${escapeHtml(formatVideoDate(video.published_at))}</small>
      </span>
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

function getThumbnail(video) {
  const direct = String(video?.thumbnail_url || '').trim();
  if (direct) return direct;
  const id = safeYoutubeId(video?.youtube_video_id || extractYoutubeId(video?.url));
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '/assets/axe-hero-premium.webp';
}

function extractYoutubeId(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v') || '';
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0])) return parts[1] || '';
    }
  } catch {
    return '';
  }
  return '';
}

function safeYoutubeId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : '';
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

function formatVideoDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
