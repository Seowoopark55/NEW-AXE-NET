export function renderTubeView(root, state, actions) {
  const tube = state.tube;
  const videos = filterVideos(tube.videos || [], tube.filters || {});
  const selected = (tube.videos || []).find((item) => item.tube_id === tube.selectedTubeId) || null;
  const categories = [...new Set((tube.videos || []).map((item) => String(item.category || '일반').trim() || '일반'))]
    .sort((a, b) => a.localeCompare(b, 'ko'));
  const totals = aggregate(tube.videos || []);

  root.innerHTML = `
    <section class="ops-tube">
      <header class="ops-tube__head">
        <div>
          <span class="ops-tube__eyebrow">AXE MEDIA ARCHIVE</span>
          <h1>AXE TUBE</h1>
          <p>AXE 활동 영상과 게임 플레이를 유튜브형 피드로 모아봅니다.</p>
        </div>
        <button class="ops-tube-btn" type="button" data-tube-refresh ${tube.loading ? 'disabled' : ''}>
          ${tube.loading ? '불러오는 중…' : '새로고침'}
        </button>
      </header>

      ${tube.error ? `<div class="ops-tube-alert ops-tube-alert--error">${h(tube.error)}</div>` : ''}
      ${tube.loading && !tube.initialized ? '<div class="ops-tube-loading">AXE TUBE 데이터를 불러오는 중입니다.</div>' : ''}

      <section class="ops-tube-summary" aria-label="AXE TUBE 요약">
        ${summary('영상', `${totals.count}개`, '현재 이관된 영상')}
        ${summary('조회', formatNumber(totals.views), '누적 조회수')}
        ${summary('추천', formatNumber(totals.likes), '누적 추천')}
        ${summary('분류', `${totals.categories}개`, '영상 카테고리')}
      </section>

      <section class="ops-tube-panel">
        <div class="ops-tube-toolbar">
          <label class="ops-tube-search">
            <span>검색</span>
            <input type="search" value="${h(tube.filters.search)}" placeholder="제목, 작성자, 내용 검색" data-tube-filter="search" />
          </label>
          <label class="ops-tube-field">
            <span>분류</span>
            <select data-tube-filter="category">
              ${option('all', '전체', tube.filters.category)}
              ${categories.map((value) => option(value, value, tube.filters.category)).join('')}
            </select>
          </label>
          <label class="ops-tube-field">
            <span>정렬</span>
            <select data-tube-filter="sort">
              ${option('recent', '최신순', tube.filters.sort)}
              ${option('views', '조회순', tube.filters.sort)}
              ${option('likes', '추천순', tube.filters.sort)}
            </select>
          </label>
          <div class="ops-tube-toolbar__meta">${videos.length} VIDEOS</div>
        </div>

        <div class="ops-tube-note">
          <strong>병행 운영 중</strong>
          <span>현재 영상 등록·수정은 기존 AXE TUBE / Discord 흐름을 유지합니다. NEW AXE NET은 Supabase 이관 데이터를 표시합니다.</span>
        </div>

        ${videos.length
          ? `<div class="ops-tube-grid">${videos.map(renderCard).join('')}</div>`
          : '<div class="ops-tube-empty">조건에 맞는 영상이 없습니다.</div>'}
      </section>

      ${selected ? renderDetail(selected) : ''}
    </section>
  `;

  bindEvents(root, actions);
}

function renderCard(video) {
  const thumbnail = getThumbnail(video);
  return `
    <button class="ops-tube-card" type="button" data-tube-open="${h(video.tube_id)}">
      <div class="ops-tube-card__thumb">
        <img src="${h(thumbnail)}" alt="${h(video.title || 'AXE TUBE')}" loading="lazy" />
        <span class="ops-tube-card__play" aria-hidden="true">▶</span>
        <span class="ops-tube-card__category">${h(video.category || '일반')}</span>
      </div>
      <div class="ops-tube-card__body">
        <h2>${h(video.title || '제목 없음')}</h2>
        <div class="ops-tube-card__writer">
          <strong>${h(video.writer || 'AXE')}</strong>
          ${badge(video.writer_badge)}
        </div>
        <p>${h(compact(video.content || '등록된 설명이 없습니다.', 96))}</p>
        <div class="ops-tube-card__meta">
          <span>조회 ${formatNumber(video.views)}</span>
          <span>추천 ${formatNumber(video.likes)}</span>
          <time>${formatDate(video.published_at)}</time>
        </div>
      </div>
    </button>
  `;
}

function renderDetail(video) {
  const videoId = safeYoutubeId(video.youtube_video_id || extractYoutubeId(video.url));
  const player = videoId
    ? `<iframe src="https://www.youtube.com/embed/${videoId}?rel=0" title="${h(video.title || 'AXE TUBE')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
    : `<div class="ops-tube-detail__fallback">YouTube 영상을 불러올 수 없습니다.</div>`;
  const youtubeUrl = normalizeYoutubeUrl(video.url, videoId);

  return `
    <div class="ops-tube-modal" data-tube-modal-backdrop>
      <section class="ops-tube-detail" role="dialog" aria-modal="true" aria-label="AXE TUBE 영상 상세">
        <header>
          <div>
            <span>AXE TUBE</span>
            <h2>${h(video.title || '제목 없음')}</h2>
          </div>
          <button type="button" data-tube-close aria-label="상세 닫기">×</button>
        </header>
        <div class="ops-tube-detail__player">${player}</div>
        <div class="ops-tube-detail__body">
          <div class="ops-tube-detail__meta">
            <div>
              <strong>${h(video.writer || 'AXE')}</strong>
              ${badge(video.writer_badge)}
              <span>${h(video.category || '일반')}</span>
            </div>
            <time>${formatDateTime(video.published_at)}</time>
          </div>
          <div class="ops-tube-detail__stats">
            <span><b>${formatNumber(video.views)}</b> 조회</span>
            <span><b>${formatNumber(video.likes)}</b> 추천</span>
            <span><b>${formatNumber(video.dislikes)}</b> 비추천</span>
          </div>
          <p>${h(video.content || '등록된 설명이 없습니다.')}</p>
          ${youtubeUrl ? `<a class="ops-tube-youtube" href="${h(youtubeUrl)}" target="_blank" rel="noopener noreferrer">YouTube에서 보기 ↗</a>` : ''}
        </div>
      </section>
    </div>
  `;
}

function bindEvents(root, actions) {
  root.querySelector('[data-tube-refresh]')?.addEventListener('click', () => actions.onRefresh?.());

  root.querySelectorAll('[data-tube-filter]').forEach((element) => {
    const eventName = element.tagName === 'INPUT' ? 'input' : 'change';
    element.addEventListener(eventName, () => actions.onFilterChange?.(element.dataset.tubeFilter, element.value));
  });

  root.querySelectorAll('[data-tube-open]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenVideo?.(button.dataset.tubeOpen));
  });

  root.querySelector('[data-tube-close]')?.addEventListener('click', () => actions.onCloseVideo?.());
  root.querySelector('[data-tube-modal-backdrop]')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) actions.onCloseVideo?.();
  });
}

function filterVideos(videos, filters) {
  const search = normalize(filters.search);
  const category = String(filters.category || 'all');
  const sort = String(filters.sort || 'recent');
  const rows = videos
    .filter((item) => category === 'all' || String(item.category || '일반') === category)
    .filter((item) => !search || normalize(`${item.title || ''} ${item.writer || ''} ${item.content || ''} ${item.category || ''}`).includes(search));

  rows.sort((a, b) => {
    if (sort === 'views') return number(b.views) - number(a.views) || dateValue(b.published_at) - dateValue(a.published_at);
    if (sort === 'likes') return number(b.likes) - number(a.likes) || dateValue(b.published_at) - dateValue(a.published_at);
    return dateValue(b.published_at) - dateValue(a.published_at);
  });
  return rows;
}

function aggregate(videos) {
  return {
    count: videos.length,
    views: videos.reduce((sum, item) => sum + number(item.views), 0),
    likes: videos.reduce((sum, item) => sum + number(item.likes), 0),
    categories: new Set(videos.map((item) => String(item.category || '일반'))).size,
  };
}

function summary(label, value, sub) {
  return `<div class="ops-tube-summary__card"><span>${h(label)}</span><strong>${h(value)}</strong><small>${h(sub)}</small></div>`;
}

function badge(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const label = raw === 'admin' ? 'ADMIN' : raw.toUpperCase();
  return `<span class="ops-tube-badge ops-tube-badge--${h(raw)}">${h(label)}</span>`;
}

function getThumbnail(video) {
  const direct = String(video.thumbnail_url || '').trim();
  if (direct) return direct;
  const id = safeYoutubeId(video.youtube_video_id || extractYoutubeId(video.url));
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '/assets/axe-brand-mark.webp';
}

function normalizeYoutubeUrl(url, videoId) {
  const raw = String(url || '').trim();
  if (/^https:\/\//i.test(raw)) return raw;
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';
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
  } catch (_) {}
  return '';
}

function safeYoutubeId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : '';
}

function option(value, label, selected) {
  return `<option value="${h(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${h(label)}</option>`;
}

function compact(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function number(value) {
  const result = Number(value || 0);
  return Number.isFinite(result) ? result : 0;
}

function formatNumber(value) {
  return Math.max(0, number(value)).toLocaleString('ko-KR');
}

function dateValue(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
