export function renderMembersView(root, state, actions = {}) {
  const { members, system } = state;

  if (!system.connected) {
    root.innerHTML = renderWaiting(system);
    return;
  }

  const counts = {
    all: members.items.length,
    active: members.items.filter((item) => item.status === 'active').length,
    inactive: members.items.filter((item) => item.status === 'inactive').length,
    resigned: members.items.filter((item) => item.status === 'resigned').length,
  };

  const search = members.search.trim().toLowerCase();

  const visibleItems = members.items.filter((item) => {
    const matchesFilter =
      members.filter === 'all' || item.status === members.filter;

    if (!matchesFilter) return false;
    if (!search) return true;

    return [
      item.nickname,
      item.discord_name,
      item.role,
      item.status,
      item.badge,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });

  const selectedMember =
    members.items.find(
      (item) => item.member_key === members.selectedMemberKey,
    ) ?? null;

  root.innerHTML = `
    <section class="panel">
      <div class="panel__header">
        <div>
          <h2>멤버</h2>
          <p>Supabase · new_axe_net.members</p>
        </div>
        <span class="badge">${members.loading ? 'LOADING' : `${counts.all} MEMBERS`}</span>
      </div>

      <div class="panel__body">
        ${renderMembersState(members, counts, visibleItems)}
      </div>
    </section>

    ${selectedMember ? renderMemberDetail(selectedMember, state.auth) : ''}
  `;

  const searchInput = root.querySelector('[data-member-search]');
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      actions.onSearchChange?.(event.target.value);
    });
  }

  root.querySelectorAll('[data-member-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      actions.onFilterChange?.(button.dataset.memberFilter);
    });
  });

  root.querySelectorAll('[data-member-key]').forEach((row) => {
    row.addEventListener('click', () => {
      actions.onSelectMember?.(row.dataset.memberKey);
    });
  });

  root.querySelector('[data-close-member-detail]')?.addEventListener('click', () => {
    actions.onCloseDetail?.();
  });
}

function renderWaiting(system) {
  const message = system.error
    ? `<strong>Supabase 연결 실패</strong><span>${escapeHtml(system.error)}</span>`
    : '<strong>Supabase 연결 확인 중</strong><span>잠시 기다려주세요.</span>';

  return `
    <section class="panel">
      <div class="panel__header">
        <div>
          <h2>멤버</h2>
          <p>데이터 연결 대기</p>
        </div>
      </div>
      <div class="panel__body">
        <div class="notice ${system.error ? 'notice--error' : ''}">
          ${message}
        </div>
      </div>
    </section>
  `;
}

function renderMembersState(members, counts, visibleItems) {
  if (members.loading) {
    return '<div class="notice">멤버 데이터를 불러오는 중입니다.</div>';
  }

  if (members.error) {
    return `
      <div class="notice notice--error">
        <strong>멤버 데이터 로드 실패</strong>
        <span>${escapeHtml(members.error)}</span>
      </div>
    `;
  }

  return `
    <div class="member-stats">
      ${renderStat('전체', counts.all)}
      ${renderStat('활동', counts.active)}
      ${renderStat('비활성', counts.inactive)}
      ${renderStat('퇴사', counts.resigned)}
    </div>

    <div class="member-toolbar member-toolbar--split">
      <div class="member-toolbar__filters">
        ${renderFilterButton('all', '전체', members.filter)}
        ${renderFilterButton('active', '활동', members.filter)}
        ${renderFilterButton('inactive', '비활성', members.filter)}
        ${renderFilterButton('resigned', '퇴사', members.filter)}
      </div>

      <label class="member-search">
        <span class="member-search__icon">⌕</span>
        <input
          type="search"
          placeholder="닉네임 · Discord · 권한 · 배지 검색"
          value="${escapeAttribute(members.search)}"
          data-member-search
        />
      </label>
    </div>

    <div class="member-result-meta">
      <span>표시 ${visibleItems.length}명</span>
      <span>행을 클릭하면 상세정보를 볼 수 있습니다.</span>
    </div>

    <div class="member-table-wrap">
      <table class="member-table">
        <thead>
          <tr>
            <th>순번</th>
            <th>닉네임</th>
            <th>Discord</th>
            <th>권한</th>
            <th>상태</th>
            <th>가입일</th>
            <th>배지</th>
            <th class="member-table__number">포인트</th>
          </tr>
        </thead>
        <tbody>
          ${
            visibleItems.length
              ? visibleItems.map(renderMemberRow).join('')
              : '<tr><td colspan="8" class="member-table__empty">조건에 맞는 멤버가 없습니다.</td></tr>'
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderMemberDetail(item, auth) {
  return `
    <div class="member-detail-backdrop" data-close-member-detail></div>

    <aside class="member-detail" aria-label="멤버 상세정보">
      <div class="member-detail__header">
        <div>
          <span class="member-detail__eyebrow">MEMBER DETAIL</span>
          <h3>${escapeHtml(item.nickname ?? '')}</h3>
          <p>${escapeHtml(item.discord_name || 'Discord 미연동')}</p>
        </div>

        <button
          class="member-detail__close"
          type="button"
          aria-label="상세정보 닫기"
          data-close-member-detail
        >
          ×
        </button>
      </div>

      <div class="member-detail__body">
        ${renderDetailItem('상태', renderStatus(item.status), true)}
        ${renderDetailItem('권한', renderRole(item.role), true)}
        ${renderDetailItem('배지', escapeHtml(item.badge || '—'), true)}
        ${renderDetailItem('가입일', escapeHtml(item.joined_date || '—'))}
        ${renderDetailItem('최근 로그인', escapeHtml(item.last_login || '—'))}
        ${renderDetailItem('퇴사일', escapeHtml(item.resigned_at || '—'))}
        ${renderDetailItem('포인트', formatNumber(item.points))}
        ${renderDetailItem('정렬 순서', escapeHtml(item.sort_order ?? '—'))}

        <div class="member-detail__note">
          ${
            auth.admin
              ? `관리자 <strong>${escapeHtml(auth.admin.nickname)}</strong>으로 인증되었습니다. 다음 버전에서 이 영역에 멤버 수정 기능을 연결할 수 있습니다.`
              : '현재는 조회 전용입니다. 멤버 수정은 관리자 로그인 후 사용할 수 있도록 구성합니다.'
          }
        </div>
      </div>
    </aside>
  `;
}

function renderDetailItem(label, value, raw = false) {
  return `
    <div class="member-detail__item">
      <span>${label}</span>
      <strong>${raw ? value : escapeHtml(value)}</strong>
    </div>
  `;
}

function renderStat(label, value) {
  return `
    <div class="member-stat">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderFilterButton(filter, label, activeFilter) {
  return `
    <button
      class="member-filter ${filter === activeFilter ? 'member-filter--active' : ''}"
      type="button"
      data-member-filter="${filter}"
    >
      ${label}
    </button>
  `;
}

function renderMemberRow(item) {
  return `
    <tr class="member-table__row" data-member-key="${escapeAttribute(item.member_key)}">
      <td>${escapeHtml(item.sort_order ?? '')}</td>
      <td><strong>${escapeHtml(item.nickname ?? '')}</strong></td>
      <td>${escapeHtml(item.discord_name || '—')}</td>
      <td>${renderRole(item.role)}</td>
      <td>${renderStatus(item.status)}</td>
      <td>${escapeHtml(item.joined_date || '—')}</td>
      <td>${escapeHtml(item.badge || '—')}</td>
      <td class="member-table__number">${formatNumber(item.points)}</td>
    </tr>
  `;
}

function renderRole(role) {
  return `<span class="member-tag">${escapeHtml(role || 'user')}</span>`;
}

function renderStatus(status) {
  const labels = {
    active: '활동',
    inactive: '비활성',
    resigned: '퇴사',
  };

  return `
    <span class="member-status member-status--${escapeAttribute(status || 'inactive')}">
      ${labels[status] ?? escapeHtml(status ?? '')}
    </span>
  `;
}

function formatNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString('ko-KR') : '0';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
