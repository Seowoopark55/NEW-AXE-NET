export function renderOutlawView(root, state, actions) {
  const outlaw = state.outlaw;
  const auth = state.auth;
  const canRead = Boolean(auth.member || auth.admin);

  root.innerHTML = `
    <section class="ops-outlaw">
      <header class="ops-outlaw__head">
        <div>
          <span class="ops-outlaw__eyebrow">OUTLAW OPERATIONS</span>
          <h1>무법지대</h1>
          <p>팀 전투 통계와 공략, 브리핑맵을 하나의 운영 화면에서 확인합니다.</p>
        </div>
        <button class="ops-outlaw-btn" type="button" data-outlaw-refresh ${outlaw.loading ? 'disabled' : ''}>
          ${outlaw.loading ? '불러오는 중…' : '새로고침'}
        </button>
      </header>

      <nav class="ops-outlaw-tabs" aria-label="무법지대 메뉴">
        ${tabButton('stats', '통계', outlaw.tab)}
        ${tabButton('guide', '공략', outlaw.tab)}
        ${tabButton('map', '브리핑맵', outlaw.tab)}
      </nav>

      ${outlaw.error ? `<div class="ops-outlaw-alert ops-outlaw-alert--error">${h(outlaw.error)}</div>` : ''}
      ${!canRead ? renderGate() : ''}
      ${canRead && outlaw.tab === 'stats' ? renderStats(outlaw, state.members.items || []) : ''}
      ${canRead && outlaw.tab === 'guide' ? renderGuides(outlaw) : ''}
      ${canRead && outlaw.tab === 'map' ? renderMaps(outlaw) : ''}
    </section>
  `;

  bindEvents(root, actions);
}

function renderGate() {
  return `
    <section class="ops-outlaw-gate">
      <div class="ops-outlaw-gate__icon">AXE</div>
      <h2>무법지대 자료는 팀원 전용입니다.</h2>
      <p>전투 통계와 공략, 브리핑맵은 일반 팀원 로그인 또는 관리자 인증 후 확인할 수 있습니다.</p>
      <button class="ops-outlaw-btn ops-outlaw-btn--gold" type="button" data-outlaw-login>멤버 로그인</button>
    </section>
  `;
}

function renderStats(outlaw, members) {
  const memberMap = new Map(members.map((member) => [member.member_key, member]));
  const keyword = normalize(outlaw.filters.statSearch);
  const status = outlaw.filters.statStatus;

  const rows = outlaw.stats
    .map((row) => ({
      ...row,
      member: memberMap.get(row.member_key) || {
        nickname: row.nickname || row.source_nickname || '알 수 없음',
        status: row.member_status || 'active',
      },
    }))
    .filter((row) => status === 'all' || row.member.status === status)
    .filter((row) => !keyword || normalize(`${row.member.nickname} ${row.source_nickname || ''}`).includes(keyword))
    .sort(rankCompare);

  const rankMap = new Map(outlaw.stats.slice().sort(rankCompare).map((row, index) => [row.member_key, index + 1]));
  const activeRows = outlaw.stats
    .map((row) => ({ ...row, member: memberMap.get(row.member_key) || { status: row.member_status || 'active', nickname: row.nickname || row.source_nickname } }))
    .filter((row) => row.member.status === 'active');
  const leader = activeRows.slice().sort(rankCompare)[0];
  const totalKills = activeRows.reduce((sum, row) => sum + number(row.total_kills), 0);
  const avgKd = activeRows.length
    ? activeRows.reduce((sum, row) => sum + kdValue(row), 0) / activeRows.length
    : 0;

  return `
    <section class="ops-outlaw-panel">
      <div class="ops-outlaw-summary">
        ${summaryCard('활동 기록', `${activeRows.length}명`, '현재 활동 멤버 기준')}
        ${summaryCard('누적 킬', formatNumber(totalKills), '활동 멤버 합계')}
        ${summaryCard('평균 K/D', avgKd.toFixed(2), '활동 멤버 평균')}
        ${summaryCard('킬 1위', leader ? h(displayName(leader, memberMap)) : '-', leader ? `${formatNumber(leader.total_kills)} KILL` : '기록 없음')}
      </div>

      <div class="ops-outlaw-toolbar">
        <label class="ops-outlaw-search">
          <span>검색</span>
          <input type="search" value="${h(outlaw.filters.statSearch)}" placeholder="닉네임 검색" data-outlaw-filter="statSearch" />
        </label>
        <label class="ops-outlaw-field">
          <span>멤버 상태</span>
          <select data-outlaw-filter="statStatus">
            ${option('active', '활동 멤버', status)}
            ${option('all', '전체 기록', status)}
            ${option('resigned', '퇴사', status)}
            ${option('inactive', '비활성', status)}
          </select>
        </label>
        <div class="ops-outlaw-toolbar__meta">${rows.length} RECORDS</div>
      </div>

      ${outlaw.selectedMemberKey ? renderHistoryPanel(outlaw, memberMap, rankMap) : ''}

      <div class="ops-outlaw-rank-wrap">
        <table class="ops-outlaw-rank">
          <thead>
            <tr><th>순위</th><th>멤버</th><th>킬</th><th>데스</th><th>K/D</th><th>최근 갱신</th><th></th></tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((row) => renderRankRow(row, rankMap.get(row.member_key), outlaw.selectedMemberKey)).join('') : '<tr><td colspan="7" class="ops-outlaw-empty">조건에 맞는 통계가 없습니다.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderRankRow(row, rank, selectedMemberKey) {
  const nickname = row.member?.nickname || row.nickname || row.source_nickname || '-';
  const status = row.member?.status || row.member_status || 'active';
  const selected = row.member_key === selectedMemberKey;
  return `
    <tr class="ops-outlaw-rank__row ${selected ? 'is-selected' : ''}" data-outlaw-stat="${h(row.member_key)}">
      <td><span class="ops-outlaw-rankno ${rank <= 3 ? `is-top${rank}` : ''}">${rank || '-'}</span></td>
      <td>
        <div class="ops-outlaw-member">
          <strong>${h(nickname)}</strong>
          ${status !== 'active' ? `<span>${h(statusLabel(status))}</span>` : ''}
        </div>
      </td>
      <td><strong class="ops-outlaw-kill">${formatNumber(row.total_kills)}</strong></td>
      <td>${formatNumber(row.total_deaths)}</td>
      <td><strong>${kdValue(row).toFixed(2)}</strong></td>
      <td>${formatDateTime(row.source_updated_at)}</td>
      <td><button class="ops-outlaw-mini" type="button" data-outlaw-stat="${h(row.member_key)}">기록</button></td>
    </tr>
  `;
}

function renderHistoryPanel(outlaw, memberMap, rankMap) {
  const stat = outlaw.stats.find((row) => row.member_key === outlaw.selectedMemberKey);
  if (!stat) return '';
  const member = memberMap.get(stat.member_key);
  const name = member?.nickname || stat.nickname || stat.source_nickname || '-';
  const historyAsc = outlaw.history.slice().sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
  const recent = outlaw.history[0];

  return `
    <section class="ops-outlaw-history">
      <header>
        <div>
          <span>PLAYER HISTORY</span>
          <h2>${h(name)}</h2>
          <p>현재 ${rankMap.get(stat.member_key) || '-'}위 · ${formatNumber(stat.total_kills)}킬 / ${formatNumber(stat.total_deaths)}데스 · K/D ${kdValue(stat).toFixed(2)}</p>
        </div>
        <button type="button" data-outlaw-history-close aria-label="기록 닫기">×</button>
      </header>
      ${outlaw.historyLoading ? '<div class="ops-outlaw-history__loading">기록을 불러오는 중입니다…</div>' : ''}
      ${outlaw.historyError ? `<div class="ops-outlaw-alert ops-outlaw-alert--error">${h(outlaw.historyError)}</div>` : ''}
      ${!outlaw.historyLoading && !outlaw.historyError ? `
        <div class="ops-outlaw-history__grid">
          <div class="ops-outlaw-history__chart">
            ${renderTrendSvg(historyAsc)}
            <div class="ops-outlaw-chart-legend"><span class="is-kill">KILL</span><span class="is-death">DEATH</span><small>최근 ${Math.min(historyAsc.length, 24)}개 기록</small></div>
          </div>
          <div class="ops-outlaw-history__recent">
            <span>RECENT DELTA</span>
            <strong>+${formatNumber(recent?.kill_delta || 0)} K</strong>
            <b>+${formatNumber(recent?.death_delta || 0)} D</b>
            <small>${formatDateTime(recent?.recorded_at)}</small>
          </div>
        </div>
        <div class="ops-outlaw-history__list">
          ${outlaw.history.slice(0, 8).map((row) => `
            <div>
              <time>${formatDateTime(row.recorded_at)}</time>
              <strong>${formatNumber(row.total_kills)} K / ${formatNumber(row.total_deaths)} D</strong>
              <span>+${formatNumber(row.kill_delta)} / +${formatNumber(row.death_delta)}</span>
            </div>
          `).join('') || '<p class="ops-outlaw-empty">기록이 없습니다.</p>'}
        </div>
      ` : ''}
    </section>
  `;
}

function renderTrendSvg(historyAsc) {
  const rows = historyAsc.slice(-24);
  if (rows.length < 2) return '<div class="ops-outlaw-chart-empty">차트를 만들 기록이 아직 부족합니다.</div>';
  const width = 640;
  const height = 180;
  const padX = 16;
  const padY = 18;
  const values = rows.flatMap((row) => [number(row.total_kills), number(row.total_deaths)]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const point = (value, index) => {
    const x = padX + (index / (rows.length - 1)) * (width - padX * 2);
    const y = height - padY - ((number(value) - min) / range) * (height - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const kills = rows.map((row, index) => point(row.total_kills, index)).join(' ');
  const deaths = rows.map((row, index) => point(row.total_deaths, index)).join(' ');
  return `
    <svg class="ops-outlaw-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="킬 데스 기록 추이">
      <line x1="16" y1="162" x2="624" y2="162" class="ops-outlaw-chart__axis" />
      <line x1="16" y1="90" x2="624" y2="90" class="ops-outlaw-chart__grid" />
      <polyline points="${kills}" class="ops-outlaw-chart__line ops-outlaw-chart__line--kill" />
      <polyline points="${deaths}" class="ops-outlaw-chart__line ops-outlaw-chart__line--death" />
    </svg>
  `;
}

function renderGuides(outlaw) {
  const keyword = normalize(outlaw.filters.guideSearch);
  const locations = outlaw.guideLocations.filter((row) => !keyword || normalize(`${row.map_name} ${row.coord || ''}`).includes(keyword));
  const selectedKey = locations.some((row) => row.location_key === outlaw.selectedLocationKey)
    ? outlaw.selectedLocationKey
    : locations[0]?.location_key;
  const selected = locations.find((row) => row.location_key === selectedKey);
  const steps = outlaw.guideSteps
    .filter((row) => row.location_key === selectedKey)
    .sort((a, b) => number(a.sort_order) - number(b.sort_order));
  const grouped = groupBy(steps, 'route_group');

  return `
    <section class="ops-outlaw-panel">
      <div class="ops-outlaw-toolbar ops-outlaw-toolbar--guide">
        <label class="ops-outlaw-search">
          <span>공략 검색</span>
          <input type="search" value="${h(outlaw.filters.guideSearch)}" placeholder="지역명 또는 좌표" data-outlaw-filter="guideSearch" />
        </label>
        <div class="ops-outlaw-toolbar__meta">${locations.length} LOCATIONS · ${outlaw.guideSteps.length} STEPS</div>
      </div>

      <div class="ops-outlaw-guide-layout">
        <aside class="ops-outlaw-guide-list">
          ${locations.map((row) => `
            <button type="button" class="ops-outlaw-guide-item ${row.location_key === selectedKey ? 'is-active' : ''}" data-outlaw-guide="${h(row.location_key)}">
              <span>${h(row.coord || '좌표 없음')}</span>
              <strong>${h(row.map_name)}</strong>
              <small>${outlaw.guideSteps.filter((step) => step.location_key === row.location_key).length} STEPS</small>
            </button>
          `).join('') || '<div class="ops-outlaw-empty">공략 데이터가 없습니다.</div>'}
        </aside>

        <div class="ops-outlaw-guide-detail">
          ${selected ? `
            <div class="ops-outlaw-guide-hero">
              ${renderImage(selected.main_image, selected.map_name, 'ops-outlaw-image--hero')}
              <div>
                <span>COORD ${h(selected.coord || '-')}</span>
                <h2>${h(selected.map_name)}</h2>
                <p>${steps.length}개의 공략 단계가 등록되어 있습니다.</p>
              </div>
            </div>
            ${Object.entries(grouped).map(([group, groupSteps]) => `
              <section class="ops-outlaw-route">
                <header><span>ROUTE</span><h3>${h(group)}</h3></header>
                <div class="ops-outlaw-steps">
                  ${groupSteps.map((step) => `
                    <article class="ops-outlaw-step">
                      <div class="ops-outlaw-step__no">${h(step.step_no)}</div>
                      <div class="ops-outlaw-step__body">
                        <h4>${h(step.title)}</h4>
                        ${step.content ? `<p>${h(step.content)}</p>` : ''}
                        ${step.image ? renderImage(step.image, `${selected.map_name} ${step.step_no}`, 'ops-outlaw-image--step') : ''}
                        ${step.video_url ? `<a class="ops-outlaw-video" href="${h(step.video_url)}" target="_blank" rel="noopener noreferrer">공략 영상 열기 ↗</a>` : ''}
                      </div>
                    </article>
                  `).join('')}
                </div>
              </section>
            `).join('')}
          ` : '<div class="ops-outlaw-empty">선택할 공략 지역이 없습니다.</div>'}
        </div>
      </div>
    </section>
  `;
}

function renderMaps(outlaw) {
  const keyword = normalize(outlaw.filters.mapSearch);
  const maps = outlaw.maps.filter((row) => !keyword || normalize(`${row.map_name} ${row.coord || ''} ${row.description || ''}`).includes(keyword));
  const selectedKey = maps.some((row) => row.map_key === outlaw.selectedMapKey)
    ? outlaw.selectedMapKey
    : maps[0]?.map_key;
  const selected = maps.find((row) => row.map_key === selectedKey);

  return `
    <section class="ops-outlaw-panel">
      <div class="ops-outlaw-toolbar ops-outlaw-toolbar--map">
        <label class="ops-outlaw-search">
          <span>브리핑맵 검색</span>
          <input type="search" value="${h(outlaw.filters.mapSearch)}" placeholder="지역명 또는 좌표" data-outlaw-filter="mapSearch" />
        </label>
        <div class="ops-outlaw-toolbar__meta">${maps.length} MAPS</div>
      </div>

      ${selected ? `
        <section class="ops-outlaw-map-focus">
          ${renderImage(selected.image, selected.map_name, 'ops-outlaw-image--map-focus')}
          <div>
            <span>BRIEFING MAP · ${h(selected.coord || '좌표 미정')}</span>
            <h2>${h(selected.map_name)}</h2>
            <p>${h(cleanDash(selected.description) || '등록된 상세 설명이 없습니다.')}</p>
            ${cleanDash(selected.note) ? `<small>${h(cleanDash(selected.note))}</small>` : ''}
          </div>
        </section>
      ` : ''}

      <div class="ops-outlaw-map-grid">
        ${maps.map((row) => `
          <button type="button" class="ops-outlaw-map-card ${row.map_key === selectedKey ? 'is-active' : ''}" data-outlaw-map="${h(row.map_key)}">
            ${renderImage(row.image, row.map_name, 'ops-outlaw-image--map-card')}
            <div>
              <span>${h(row.coord || '좌표 미정')}</span>
              <strong>${h(row.map_name)}</strong>
              <small>${h(cleanDash(row.description) || 'BRIEFING')}</small>
            </div>
          </button>
        `).join('') || '<div class="ops-outlaw-empty">브리핑맵 데이터가 없습니다.</div>'}
      </div>
    </section>
  `;
}

function renderImage(filename, label, className = '') {
  if (!filename) return `<div class="ops-outlaw-image is-missing ${className}"><div class="ops-outlaw-image__fallback"><strong>IMAGE PENDING</strong><span>${h(label)}</span></div></div>`;
  const src = `/assets/outlaw/${encodeURIComponent(String(filename))}`;
  return `
    <div class="ops-outlaw-image ${className}" data-outlaw-image-wrap>
      <img src="${h(src)}" alt="${h(label)}" loading="lazy" data-outlaw-image />
      <div class="ops-outlaw-image__fallback"><strong>IMAGE NOT MIGRATED</strong><span>${h(filename)}</span></div>
    </div>
  `;
}

function summaryCard(label, value, note) {
  return `<div class="ops-outlaw-summary__card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
}

function tabButton(tab, label, active) {
  return `<button type="button" class="${tab === active ? 'is-active' : ''}" data-outlaw-tab="${tab}">${label}</button>`;
}

function bindEvents(root, actions) {
  root.querySelectorAll('[data-outlaw-tab]').forEach((button) => button.addEventListener('click', () => actions.onTabChange(button.dataset.outlawTab)));
  root.querySelector('[data-outlaw-refresh]')?.addEventListener('click', actions.onRefresh);
  root.querySelector('[data-outlaw-login]')?.addEventListener('click', actions.onOpenLogin);

  root.querySelectorAll('[data-outlaw-filter]').forEach((input) => {
    const event = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(event, () => actions.onFilterChange(input.dataset.outlawFilter, input.value));
  });

  root.querySelectorAll('[data-outlaw-stat]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      actions.onSelectStat(element.dataset.outlawStat);
    });
  });
  root.querySelector('[data-outlaw-history-close]')?.addEventListener('click', actions.onCloseHistory);
  root.querySelectorAll('[data-outlaw-guide]').forEach((button) => button.addEventListener('click', () => actions.onSelectGuide(button.dataset.outlawGuide)));
  root.querySelectorAll('[data-outlaw-map]').forEach((button) => button.addEventListener('click', () => actions.onSelectMap(button.dataset.outlawMap)));

  root.querySelectorAll('[data-outlaw-image]').forEach((image) => {
    image.addEventListener('error', () => image.closest('[data-outlaw-image-wrap]')?.classList.add('is-missing'));
    if (image.complete && image.naturalWidth === 0) image.closest('[data-outlaw-image-wrap]')?.classList.add('is-missing');
  });
}

function rankCompare(a, b) {
  return number(b.total_kills) - number(a.total_kills)
    || kdValue(b) - kdValue(a)
    || number(a.total_deaths) - number(b.total_deaths);
}

function kdValue(row) {
  if (row.kd !== null && row.kd !== undefined && row.kd !== '') return number(row.kd);
  const deaths = number(row.total_deaths);
  return deaths ? number(row.total_kills) / deaths : number(row.total_kills);
}

function displayName(row, memberMap) {
  return memberMap.get(row.member_key)?.nickname || row.nickname || row.source_nickname || '-';
}

function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || '기본 루트';
    (acc[value] ||= []).push(row);
    return acc;
  }, {});
}

function option(value, label, current) {
  return `<option value="${h(value)}" ${value === current ? 'selected' : ''}>${h(label)}</option>`;
}

function statusLabel(status) {
  if (status === 'resigned') return '퇴사';
  if (status === 'inactive') return '비활성';
  return status || '';
}

function cleanDash(value) {
  const text = String(value || '').trim();
  return !text || text === '-' ? '' : text;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function formatNumber(value) {
  return number(value).toLocaleString('ko-KR');
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
