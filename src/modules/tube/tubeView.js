export function renderTubeView(root, state, actions) {
  const tube = state.tube;
  const videos = filterVideos(tube.videos || [], tube.filters || {});
  const selected = (tube.videos || []).find((item) => item.tube_id === tube.selectedTubeId) || null;
  const editing = tube.editor?.tubeId
    ? (tube.videos || []).find((item) => item.tube_id === tube.editor.tubeId) || null
    : null;
  const categories = [...new Set((tube.videos || []).map((item) => String(item.category || '일반').trim() || '일반'))]
    .sort((a, b) => a.localeCompare(b, 'ko'));
  const totals = aggregate(tube.videos || []);
  const isMember = Boolean(state.auth?.member);
  const isAdmin = Boolean(state.auth?.admin);
  const canCreate = isMember || isAdmin;

  root.innerHTML = `
    <section class="ops-tube">
      <header class="ops-tube__head">
        <div>
          <span class="ops-tube__eyebrow">AXE MEDIA ARCHIVE</span>
          <h1>AXE TUBE</h1>
          <p>AXE 활동 영상과 게임 플레이를 유튜브형 피드로 모아봅니다.</p>
        </div>
        <div class="ops-tube__head-actions">
          ${canCreate ? '<button class="ops-tube-btn ops-tube-btn--primary" type="button" data-tube-new>+ 영상 등록</button>' : ''}
          <button class="ops-tube-btn" type="button" data-tube-refresh ${tube.loading ? 'disabled' : ''}>
            ${tube.loading ? '불러오는 중…' : '새로고침'}
          </button>
        </div>
      </header>

      ${tube.error ? `<div class="ops-tube-alert ops-tube-alert--error">${h(tube.error)}</div>` : ''}
      ${tube.message ? `<div class="ops-tube-alert ${tube.messageType === 'success' ? 'ops-tube-alert--success' : tube.messageType === 'error' ? 'ops-tube-alert--error' : ''}">${h(tube.message)}</div>` : ''}
      ${tube.loading && !tube.initialized ? '<div class="ops-tube-loading">AXE TUBE 데이터를 불러오는 중입니다.</div>' : ''}

      <section class="ops-tube-summary" aria-label="AXE TUBE 요약">
        ${summary('영상', `${totals.count}개`, '현재 활성 영상')}
        ${summary('조회', formatNumber(totals.views), '기존 + NEW AXE NET')}
        ${summary('추천', formatNumber(totals.likes), '기존 + 멤버 추천')}
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
          <strong>Supabase-first</strong>
          <span>NEW AXE NET에서 영상 등록·수정·내리기가 가능합니다. 기존 Discord / Apps Script에서 등록된 영상도 Shadow Mirror로 계속 들어옵니다.</span>
        </div>

        ${videos.length
          ? `<div class="ops-tube-grid">${videos.map((video) => renderCard(video, {
              canManage: canManageVideo(state, video),
            })).join('')}</div>`
          : '<div class="ops-tube-empty">조건에 맞는 영상이 없습니다.</div>'}
      </section>

      ${selected ? renderDetail(selected, {
        reaction: tube.myReactions?.[selected.tube_id] || null,
        isMember,
        saving: tube.reactionSavingTubeId === selected.tube_id,
        canManage: canManageVideo(state, selected),
      }) : ''}

      ${tube.editor?.open ? renderEditor(editing, {
        saving: Boolean(tube.editor.saving),
        error: tube.editor.error,
        confirmDelete: Boolean(tube.editor.confirmDelete),
        currentWriter: editing?.writer || state.auth?.member?.nickname || state.auth?.admin?.nickname || 'AXE',
        draft: tube.editor.draft || null,
      }) : ''}
    </section>
  `;

  bindEvents(root, actions);
}

function renderCard(video, options = {}) {
  const thumbnail = getThumbnail(video);
  return `
    <article class="ops-tube-card-wrap">
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
            ${syncBadge(video.sync_owner)}
          </div>
          <p>${h(compact(video.content || '등록된 설명이 없습니다.', 96))}</p>
          <div class="ops-tube-card__meta">
            <span>조회 ${formatNumber(video.views)}</span>
            <span>추천 ${formatNumber(video.likes)}</span>
            <time>${formatDate(video.published_at)}</time>
          </div>
        </div>
      </button>
      ${options.canManage ? `<button class="ops-tube-card-manage" type="button" data-tube-edit="${h(video.tube_id)}" aria-label="${h(video.title)} 수정">수정</button>` : ''}
    </article>
  `;
}

function renderDetail(video, options = {}) {
  const videoId = safeYoutubeId(video.youtube_video_id || extractYoutubeId(video.url));
  const player = videoId
    ? `<iframe src="https://www.youtube.com/embed/${videoId}?rel=0" title="${h(video.title || 'AXE TUBE')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
    : `<div class="ops-tube-detail__fallback">YouTube 영상을 불러올 수 없습니다.</div>`;
  const youtubeUrl = normalizeYoutubeUrl(video.url, videoId);
  const reaction = options.reaction || null;
  const isMember = Boolean(options.isMember);
  const saving = Boolean(options.saving);

  return `
    <div class="ops-tube-modal" data-tube-modal-backdrop>
      <section class="ops-tube-detail" role="dialog" aria-modal="true" aria-label="AXE TUBE 영상 상세">
        <header>
          <div>
            <span>AXE TUBE</span>
            <h2>${h(video.title || '제목 없음')}</h2>
          </div>
          <div class="ops-tube-detail__header-actions">
            ${options.canManage ? `<button class="ops-tube-detail__edit" type="button" data-tube-edit="${h(video.tube_id)}">수정</button>` : ''}
            <button type="button" data-tube-close aria-label="상세 닫기">×</button>
          </div>
        </header>
        <div class="ops-tube-detail__player">${player}</div>
        <div class="ops-tube-detail__body">
          <div class="ops-tube-detail__meta">
            <div>
              <strong>${h(video.writer || 'AXE')}</strong>
              ${badge(video.writer_badge)}
              ${syncBadge(video.sync_owner)}
              <span>${h(video.category || '일반')}</span>
            </div>
            <time>${formatDateTime(video.published_at)}</time>
          </div>

          <div class="ops-tube-detail__engagement">
            <span class="ops-tube-view-count"><b>${formatNumber(video.views)}</b> 조회</span>
            <button
              type="button"
              class="ops-tube-reaction ${reaction === 'like' ? 'is-active' : ''}"
              data-tube-react="like"
              data-tube-id="${h(video.tube_id)}"
              ${saving ? 'disabled' : ''}
            >👍 추천 <b>${formatNumber(video.likes)}</b></button>
            <button
              type="button"
              class="ops-tube-reaction ops-tube-reaction--dislike ${reaction === 'dislike' ? 'is-active' : ''}"
              data-tube-react="dislike"
              data-tube-id="${h(video.tube_id)}"
              ${saving ? 'disabled' : ''}
            >👎 비추천 <b>${formatNumber(video.dislikes)}</b></button>
          </div>

          ${isMember
            ? `<div class="ops-tube-reaction-help">${saving ? '반응을 저장하는 중입니다…' : reaction ? '같은 버튼을 다시 누르면 반응이 취소됩니다.' : '멤버 계정 기준으로 한 영상에 추천 또는 비추천 하나만 기록됩니다.'}</div>`
            : '<button type="button" class="ops-tube-login-cta" data-tube-login>추천·비추천은 멤버 로그인 후 사용할 수 있습니다 →</button>'}

          <p>${h(video.content || '등록된 설명이 없습니다.')}</p>
          ${youtubeUrl ? `<a class="ops-tube-youtube" href="${h(youtubeUrl)}" target="_blank" rel="noopener noreferrer">YouTube에서 보기 ↗</a>` : ''}
        </div>
      </section>
    </div>
  `;
}

function renderEditor(video, options = {}) {
  const isEdit = Boolean(video);
  const draft = options.draft || {};
  const value = (key, fallback = '') => Object.prototype.hasOwnProperty.call(draft, key) ? draft[key] : fallback;
  return `
    <div class="ops-tube-editor-backdrop" data-tube-editor-backdrop>
      <form class="ops-tube-editor" data-tube-editor-form>
        <header>
          <div>
            <span>AXE TUBE · ${isEdit ? 'EDIT' : 'UPLOAD'}</span>
            <h2>${isEdit ? '영상 정보 수정' : '새 영상 등록'}</h2>
            <p>${isEdit ? '저장하는 순간 이 영상은 NEW AXE NET 기준으로 관리됩니다.' : 'YouTube 링크를 기준으로 썸네일과 재생 정보를 자동 연결합니다.'}</p>
          </div>
          <button type="button" data-tube-editor-close aria-label="편집창 닫기">×</button>
        </header>

        <div class="ops-tube-editor__body">
          ${options.error ? `<div class="ops-tube-alert ops-tube-alert--error">${h(options.error)}</div>` : ''}
          <div class="ops-tube-editor__meta">
            <span>등록자</span>
            <strong>${h(options.currentWriter || 'AXE')}</strong>
            ${video ? syncBadge(video.sync_owner) : '<span class="ops-tube-sync ops-tube-sync--new">NEW</span>'}
          </div>

          <label class="ops-tube-editor__field ops-tube-editor__field--wide">
            <span>영상 제목</span>
            <input name="title" maxlength="100" required value="${h(value('title', video?.title || ''))}" placeholder="영상 제목" ${options.saving ? 'disabled' : ''} />
          </label>

          <label class="ops-tube-editor__field ops-tube-editor__field--wide">
            <span>YouTube 링크</span>
            <input name="url" required value="${h(value('url', video?.url || ''))}" placeholder="https://youtu.be/... 또는 youtube.com/watch?v=..." ${options.saving ? 'disabled' : ''} />
          </label>

          <label class="ops-tube-editor__field">
            <span>분류</span>
            <input name="category" maxlength="50" value="${h(value('category', video?.category || '일반'))}" placeholder="일반" ${options.saving ? 'disabled' : ''} />
          </label>

          <label class="ops-tube-editor__field ops-tube-editor__field--wide">
            <span>설명</span>
            <textarea name="content" maxlength="1500" rows="6" placeholder="영상 설명 또는 태그" ${options.saving ? 'disabled' : ''}>${h(value('content', video?.content || ''))}</textarea>
          </label>

          ${isEdit && String(video.sync_owner || '') !== 'supabase'
            ? '<div class="ops-tube-editor__takeover"><strong>기존 미러 영상</strong><span>이 영상을 저장하거나 내리면 이후 메타데이터는 NEW AXE NET이 우선합니다. 기존 Shadow Mirror가 다시 덮어쓰지 않습니다.</span></div>'
            : ''}
        </div>

        <footer>
          <div class="ops-tube-editor__danger">
            ${isEdit && !options.confirmDelete ? `<button type="button" class="ops-tube-btn ops-tube-btn--danger-ghost" data-tube-delete-request ${options.saving ? 'disabled' : ''}>영상 내리기</button>` : ''}
            ${isEdit && options.confirmDelete ? `
              <span>정말 목록에서 내릴까요?</span>
              <button type="button" class="ops-tube-btn ops-tube-btn--danger" data-tube-delete-confirm ${options.saving ? 'disabled' : ''}>내리기 확인</button>
              <button type="button" class="ops-tube-btn" data-tube-delete-cancel ${options.saving ? 'disabled' : ''}>취소</button>
            ` : ''}
          </div>
          <div class="ops-tube-editor__actions">
            <button type="button" class="ops-tube-btn" data-tube-editor-close ${options.saving ? 'disabled' : ''}>취소</button>
            <button type="submit" class="ops-tube-btn ops-tube-btn--primary" ${options.saving ? 'disabled' : ''}>${options.saving ? '저장 중…' : isEdit ? '변경 저장' : '영상 등록'}</button>
          </div>
        </footer>
      </form>
    </div>
  `;
}

function bindEvents(root, actions) {
  root.querySelector('[data-tube-refresh]')?.addEventListener('click', () => actions.onRefresh?.());
  root.querySelector('[data-tube-new]')?.addEventListener('click', () => actions.onOpenEditor?.());

  root.querySelectorAll('[data-tube-filter]').forEach((element) => {
    const eventName = element.tagName === 'INPUT' ? 'input' : 'change';
    element.addEventListener(eventName, () => actions.onFilterChange?.(element.dataset.tubeFilter, element.value));
  });

  root.querySelectorAll('[data-tube-open]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenVideo?.(button.dataset.tubeOpen));
  });

  root.querySelectorAll('[data-tube-edit]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      actions.onOpenEditor?.(button.dataset.tubeEdit);
    });
  });

  root.querySelectorAll('[data-tube-react]').forEach((button) => {
    button.addEventListener('click', () => actions.onReact?.(button.dataset.tubeId, button.dataset.tubeReact));
  });

  root.querySelector('[data-tube-login]')?.addEventListener('click', () => actions.onOpenLogin?.());
  root.querySelector('[data-tube-close]')?.addEventListener('click', () => actions.onCloseVideo?.());
  root.querySelector('[data-tube-modal-backdrop]')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) actions.onCloseVideo?.();
  });

  root.querySelectorAll('[data-tube-editor-close]').forEach((button) => {
    button.addEventListener('click', () => actions.onCloseEditor?.());
  });
  root.querySelector('[data-tube-editor-backdrop]')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) actions.onCloseEditor?.();
  });
  root.querySelector('[data-tube-editor-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    actions.onSaveVideo?.({
      title: form.get('title'),
      url: form.get('url'),
      category: form.get('category'),
      content: form.get('content'),
    });
  });
  root.querySelector('[data-tube-delete-request]')?.addEventListener('click', () => actions.onRequestDelete?.());
  root.querySelector('[data-tube-delete-confirm]')?.addEventListener('click', () => actions.onConfirmDelete?.());
  root.querySelector('[data-tube-delete-cancel]')?.addEventListener('click', () => actions.onCancelDelete?.());
}

function canManageVideo(state, video) {
  if (state.auth?.admin) return true;
  const memberKey = String(state.auth?.member?.member_key || '');
  return Boolean(memberKey && memberKey === String(video?.writer_member_key || ''));
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

function option(value, label, selected) {
  return `<option value="${h(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${h(label)}</option>`;
}

function badge(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const label = raw === 'admin' ? 'ADMIN' : raw.toUpperCase();
  return `<span class="ops-tube-badge ops-tube-badge--${h(raw)}">${h(label)}</span>`;
}

function syncBadge(value) {
  const owner = String(value || '').toLowerCase();
  if (owner === 'supabase') return '<span class="ops-tube-sync ops-tube-sync--new">NEW 관리</span>';
  return '<span class="ops-tube-sync">기존 미러</span>';
}

function getThumbnail(video) {
  const direct = String(video.thumbnail_url || '').trim();
  if (direct) return direct;
  const videoId = safeYoutubeId(video.youtube_video_id || extractYoutubeId(video.url));
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '/assets/axe-hero-premium.webp';
}

function normalizeYoutubeUrl(url, videoId) {
  const raw = String(url || '').trim();
  if (/^https?:\/\//i.test(raw)) return raw;
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
  } catch {
    return '';
  }
  return '';
}

function safeYoutubeId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : '';
}

function compact(value, length) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, Math.max(0, length - 1))}…` : text;
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
