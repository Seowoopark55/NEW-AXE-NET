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

    ${
      selectedMember
        ? renderMemberDetail(
            selectedMember,
            state.auth,
            members.editingMemberKey === selectedMember.member_key,
            members,
          )
        : ''
    }
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

  root.querySelectorAll('[data-close-member-detail]').forEach((element) => {
    element.addEventListener('click', () => {
      actions.onCloseDetail?.();
    });
  });

  root.querySelector('[data-member-edit]')?.addEventListener('click', () => {
    actions.onStartEdit?.(selectedMember?.member_key);
  });

  root.querySelector('[data-member-edit-cancel]')?.addEventListener('click', () => {
    actions.onCancelEdit?.();
  });

  const statusSelect = root.querySelector('[data-edit-status]');
  const resignedAtInput = root.querySelector('[data-edit-resigned-at]');

  if (statusSelect && resignedAtInput) {
    const syncResignedAt = () => {
      const resigned = statusSelect.value === 'resigned';

      resignedAtInput.disabled = !resigned;

      if (!resigned) {
        resignedAtInput.value = '';
        return;
      }

      if (!resignedAtInput.value) {
        resignedAtInput.value = getLocalDateString();
      }
    };

    statusSelect.addEventListener('change', syncResignedAt);
    syncResignedAt();
  }

  const editForm = root.querySelector('[data-member-edit-form]');
  editForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!selectedMember) return;

    const formData = new FormData(editForm);

    actions.onSaveMember?.(selectedMember.member_key, {
      nickname: String(formData.get('nickname') ?? '').trim(),
      role: String(formData.get('role') ?? ''),
      status: String(formData.get('status') ?? ''),
      badge: String(formData.get('badge') ?? '').trim(),
      points: String(formData.get('points') ?? '0'),
      resigned_at: String(formData.get('resigned_at') ?? ''),
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
              ? visibleItems.map((item, index) => renderMemberRow(item, index + 1)).join('')
              : '<tr><td colspan="8" class="member-table__empty">조건에 맞는 멤버가 없습니다.</td></tr>'
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderMemberDetail(item, auth, editing, membersState) {
  return `
    <div class="member-detail-backdrop" data-close-member-detail></div>

    <aside class="member-detail" aria-label="멤버 상세정보">
      <div class="member-detail__header">
        <div>
          <span class="member-detail__eyebrow">
            ${editing ? 'EDIT MEMBER' : 'MEMBER DETAIL'}
          </span>
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
        ${
          editing
            ? renderMemberEditForm(item, membersState)
            : renderMemberReadOnly(item, auth, membersState)
        }
      </div>
    </aside>
  `;
}

function renderMemberReadOnly(item, auth, membersState) {
  return `
    ${
      membersState.saveSuccess
        ? `<div class="member-save-message member-save-message--success">${escapeHtml(membersState.saveSuccess)}</div>`
        : ''
    }

    ${renderDetailItem('상태', renderStatus(item.status), true)}
    ${renderDetailItem('권한', renderRole(item.role), true)}
    ${renderDetailItem('배지', escapeHtml(item.badge || '—'), true)}
    ${renderDetailItem('가입일', escapeHtml(item.joined_date || '—'))}
    ${renderDetailItem('최근 로그인', escapeHtml(item.last_login || '—'))}
    ${renderDetailItem('퇴사일', escapeHtml(item.resigned_at || '—'))}
    ${renderDetailItem('포인트', formatNumber(item.points))}
    ${renderDetailItem('전체 정렬 순서', escapeHtml(item.sort_order ?? '—'))}

    ${
      auth.admin
        ? `
          <button class="member-edit-button" type="button" data-member-edit>
            멤버 정보 수정
          </button>
          <div class="member-detail__note">
            관리자 <strong>${escapeHtml(auth.admin.nickname)}</strong>으로 인증되었습니다.
            수정 내용은 Supabase에 즉시 반영됩니다.
          </div>

          ${renderMemberAudit(membersState.audit, item.member_key)}
        `
        : `
          <div class="member-detail__note">
            현재는 조회 전용입니다. 수정 기능은 관리자 로그인 후 사용할 수 있습니다.
          </div>
        `
    }
  `;
}

function renderMemberAudit(audit, memberKey) {
  if (audit.memberKey !== memberKey) {
    return '';
  }

  if (audit.loading) {
    return `
      <section class="member-audit">
        <div class="member-audit__heading">
          <span>최근 변경 이력</span>
          <small>최대 20건</small>
        </div>
        <div class="member-audit__empty">변경 이력을 불러오는 중입니다.</div>
      </section>
    `;
  }

  if (audit.error) {
    return `
      <section class="member-audit">
        <div class="member-audit__heading">
          <span>최근 변경 이력</span>
          <small>관리자 전용</small>
        </div>
        <div class="member-audit__error">${escapeHtml(audit.error)}</div>
      </section>
    `;
  }

  return `
    <section class="member-audit">
      <div class="member-audit__heading">
        <span>최근 변경 이력</span>
        <small>최대 20건</small>
      </div>

      ${
        audit.items.length
          ? `<div class="member-audit__list">${audit.items.map(renderAuditItem).join('')}</div>`
          : '<div class="member-audit__empty">아직 기록된 변경이 없습니다.</div>'
      }
    </section>
  `;
}

function renderAuditItem(item) {
  const fields = Array.isArray(item.changed_fields)
    ? item.changed_fields
    : [];

  return `
    <article class="member-audit__item">
      <div class="member-audit__meta">
        <strong>${escapeHtml(item.changed_by_nickname || '관리자')}</strong>
        <span>${formatDateTime(item.changed_at)}</span>
      </div>

      <div class="member-audit__changes">
        ${
          fields.length
            ? fields.map((field) => renderAuditChange(field, item.old_data, item.new_data)).join('')
            : '<span class="member-audit__unknown">변경 항목 정보 없음</span>'
        }
      </div>
    </article>
  `;
}

function renderAuditChange(field, oldData, newData) {
  const labels = {
    nickname: '닉네임',
    role: '권한',
    status: '상태',
    badge: '배지',
    points: '포인트',
    resigned_at: '퇴사일',
  };

  return `
    <div class="member-audit__change">
      <span>${labels[field] ?? escapeHtml(field)}</span>
      <div>
        <del>${escapeHtml(formatAuditValue(field, oldData?.[field]))}</del>
        <b>→</b>
        <ins>${escapeHtml(formatAuditValue(field, newData?.[field]))}</ins>
      </div>
    </div>
  `;
}

function formatAuditValue(field, value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (field === 'status') {
    return {
      active: '활동',
      inactive: '비활성',
      resigned: '퇴사',
    }[value] ?? String(value);
  }

  if (field === 'points') {
    return formatNumber(value);
  }

  return String(value);
}

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderMemberEditForm(item, membersState) {
  return `
    <form class="member-edit-form" data-member-edit-form>
      <label class="member-edit-field">
        <span>닉네임</span>
        <input
          type="text"
          name="nickname"
          value="${escapeAttribute(item.nickname ?? '')}"
          maxlength="50"
          required
        />
      </label>

      <label class="member-edit-field">
        <span>권한</span>
        <select name="role">
          ${renderOption('admin', 'admin', item.role)}
          ${renderOption('user', 'user', item.role)}
        </select>
      </label>

      <label class="member-edit-field">
        <span>상태</span>
        <select name="status" data-edit-status>
          ${renderOption('active', '활동', item.status)}
          ${renderOption('inactive', '비활성', item.status)}
          ${renderOption('resigned', '퇴사', item.status)}
        </select>
      </label>

      <label class="member-edit-field">
        <span>배지</span>
        <input
          type="text"
          name="badge"
          value="${escapeAttribute(item.badge ?? '')}"
          maxlength="50"
          placeholder="예: admin, bronze"
        />
      </label>

      <label class="member-edit-field">
        <span>포인트</span>
        <input
          type="number"
          name="points"
          min="0"
          step="1"
          value="${escapeAttribute(item.points ?? 0)}"
          required
        />
      </label>

      <label class="member-edit-field">
        <span>퇴사일</span>
        <input
          type="date"
          name="resigned_at"
          value="${escapeAttribute(item.resigned_at ?? '')}"
          data-edit-resigned-at
        />
      </label>

      ${
        membersState.saveError
          ? `<div class="member-save-message member-save-message--error">${escapeHtml(membersState.saveError)}</div>`
          : ''
      }

      <div class="member-edit-actions">
        <button
          class="member-edit-cancel"
          type="button"
          data-member-edit-cancel
          ${membersState.saving ? 'disabled' : ''}
        >
          취소
        </button>

        <button
          class="member-edit-save"
          type="submit"
          ${membersState.saving ? 'disabled' : ''}
        >
          ${membersState.saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  `;
}

function renderOption(value, label, current) {
  return `
    <option value="${escapeAttribute(value)}" ${value === current ? 'selected' : ''}>
      ${escapeHtml(label)}
    </option>
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

function renderMemberRow(item, displayOrder) {
  return `
    <tr class="member-table__row" data-member-key="${escapeAttribute(item.member_key)}">
      <td>${escapeHtml(displayOrder)}</td>
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

function getLocalDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
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
