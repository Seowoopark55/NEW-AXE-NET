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

  const visibleItems =
    members.filter === 'all'
      ? members.items
      : members.items.filter((item) => item.status === members.filter);

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
  `;

  root.querySelectorAll('[data-member-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      actions.onFilterChange?.(button.dataset.memberFilter);
    });
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

    <div class="member-toolbar">
      ${renderFilterButton('all', '전체', members.filter)}
      ${renderFilterButton('active', '활동', members.filter)}
      ${renderFilterButton('inactive', '비활성', members.filter)}
      ${renderFilterButton('resigned', '퇴사', members.filter)}
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
              : '<tr><td colspan="8" class="member-table__empty">표시할 멤버가 없습니다.</td></tr>'
          }
        </tbody>
      </table>
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
    <tr>
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
    <span class="member-status member-status--${escapeHtml(status || 'inactive')}">
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
