import { bindImeSafeInput, captureImeSearchFocus, restoreImeSearchFocus } from '../../utils/dom.js';

export function renderMembersView(root, state, actions = {}) {
  const searchFocus = captureImeSearchFocus(root);
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
    <section class="ops-members">
      <header class="ops-members__header">
        <div>
          <h1>멤버</h1>
          <p>조직 구성과 권한, 활동 상태를 한 곳에서 관리합니다.</p>
        </div>
        <div class="ops-members__actions">
          ${
            state.auth.admin?.admin_level === 'superadmin'
              ? `
                <button class="ops-member-primary" type="button" data-open-member-create>
                  + 멤버 추가
                </button>
              `
              : ''
          }
          <span class="ops-member-count">${members.loading ? '불러오는 중' : `${counts.all}명`}</span>
        </div>
      </header>

      ${renderMembersState(members, counts, visibleItems)}
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

    ${
      members.create.open && state.auth.admin?.admin_level === 'superadmin'
        ? renderMemberCreateModal(members.create)
        : ''
    }
  `;

  const searchInput = root.querySelector('[data-member-search]');
  if (searchInput) {
    bindImeSafeInput(searchInput, (value) => actions.onSearchChange?.(value), { delay: 220 });
  }
  restoreImeSearchFocus(root, searchFocus);

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

  root.querySelector('[data-open-member-create]')?.addEventListener('click', () => {
    actions.onOpenCreate?.();
  });

  root.querySelectorAll('[data-close-member-create]').forEach((element) => {
    element.addEventListener('click', () => {
      actions.onCloseCreate?.();
    });
  });

  const createForm = root.querySelector('[data-member-create-form]');
  createForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(createForm);

    actions.onCreateMember?.({
      nickname: String(formData.get('nickname') ?? '').trim(),
      discord_user_id: String(formData.get('discord_user_id') ?? '').trim(),
      discord_name: String(formData.get('discord_name') ?? '').trim(),
      role: String(formData.get('role') ?? ''),
      status: String(formData.get('status') ?? ''),
      joined_date: String(formData.get('joined_date') ?? ''),
      badge: String(formData.get('badge') ?? '').trim(),
      points: String(formData.get('points') ?? '0'),
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
    <section class="ops-members">
      <header class="ops-members__header">
        <div>
          <h1>멤버</h1>
          <p>데이터 연결을 확인하고 있습니다.</p>
        </div>
      </header>
      <div class="notice ${system.error ? 'notice--error' : ''}">
        ${message}
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
    <section class="ops-member-summary" aria-label="멤버 현황">
      ${renderStat('전체', counts.all)}
      ${renderStat('활동', counts.active)}
      ${renderStat('비활성', counts.inactive)}
      ${renderStat('퇴사', counts.resigned)}
    </section>

    <section class="ops-member-board">
      <div class="ops-member-toolbar">
        <div class="ops-member-toolbar__filters">
          ${renderFilterButton('all', '전체', members.filter)}
          ${renderFilterButton('active', '활동', members.filter)}
          ${renderFilterButton('inactive', '비활성', members.filter)}
          ${renderFilterButton('resigned', '퇴사', members.filter)}
        </div>

        <label class="ops-member-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="닉네임 · Discord · 권한 · 배지 검색"
            value="${escapeAttribute(members.search)}"
            data-member-search
            data-ime-search="members:search"
          />
        </label>
      </div>

      <div class="ops-member-meta">
        <span>${visibleItems.length}명 표시</span>
        <span>행을 클릭하면 상세정보를 확인할 수 있습니다.</span>
      </div>

      <div class="ops-member-table-wrap">
        <table class="ops-member-table">
          <colgroup>
            <col class="ops-member-col-order" />
            <col class="ops-member-col-name" />
            <col class="ops-member-col-discord" />
            <col class="ops-member-col-role" />
            <col class="ops-member-col-status" />
            <col class="ops-member-col-date" />
            <col class="ops-member-col-badge" />
            <col class="ops-member-col-points" />
          </colgroup>
          <thead>
            <tr>
              <th>순번</th>
              <th>닉네임</th>
              <th>Discord</th>
              <th>권한</th>
              <th>상태</th>
              <th>가입일</th>
              <th>배지</th>
              <th class="is-number">포인트</th>
            </tr>
          </thead>
          <tbody>
            ${
              visibleItems.length
                ? visibleItems.map((item, index) => renderMemberRow(item, index + 1)).join('')
                : '<tr><td colspan="8" class="ops-member-empty">조건에 맞는 멤버가 없습니다.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMemberCreateModal(createState) {
  return `
    <div class="member-create-backdrop" data-close-member-create></div>

    <section class="member-create-modal" role="dialog" aria-modal="true" aria-label="신규 멤버 등록">
      <div class="member-create-modal__header">
        <div>
          <span>NEW MEMBER</span>
          <h3>신규 멤버 등록</h3>
          <p>등록 후 목록 마지막 순서에 자동 배치됩니다.</p>
        </div>

        <button
          class="member-create-modal__close"
          type="button"
          aria-label="닫기"
          data-close-member-create
        >
          ×
        </button>
      </div>

      <form class="member-create-form" data-member-create-form>
        <div class="member-create-grid">
          <label class="member-edit-field member-create-grid__wide">
            <span>닉네임 *</span>
            <input
              type="text"
              name="nickname"
              maxlength="50"
              placeholder="인게임 닉네임"
              required
              autofocus
            />
          </label>

          <label class="member-edit-field">
            <span>Discord 사용자 ID</span>
            <input
              type="text"
              name="discord_user_id"
              inputmode="numeric"
              placeholder="숫자 ID · 선택"
            />
          </label>

          <label class="member-edit-field">
            <span>Discord 표시명</span>
            <input
              type="text"
              name="discord_name"
              maxlength="100"
              placeholder="선택"
            />
          </label>

          <label class="member-edit-field">
            <span>권한</span>
            <select name="role">
              <option value="user" selected>user</option>
              <option value="admin">admin</option>
            </select>
          </label>

          <label class="member-edit-field">
            <span>상태</span>
            <select name="status">
              <option value="active" selected>활동</option>
              <option value="inactive">비활성</option>
            </select>
          </label>

          <label class="member-edit-field">
            <span>가입일 *</span>
            <input
              type="date"
              name="joined_date"
              value="${getLocalDateString()}"
              required
            />
          </label>

          <label class="member-edit-field">
            <span>배지</span>
            <input
              type="text"
              name="badge"
              maxlength="50"
              value="bronze"
              placeholder="bronze"
            />
          </label>

          <label class="member-edit-field member-create-grid__wide">
            <span>초기 포인트</span>
            <input
              type="number"
              name="points"
              min="0"
              step="1"
              value="0"
              required
            />
          </label>
        </div>

        <div class="member-create-help">
          role=admin으로 지정한 멤버는 다음 로그인부터 닉네임/비밀번호만으로 관리자 권한이 자동 적용됩니다.
          최고관리자 이메일 인증은 별도로 유지됩니다.
        </div>

        ${
          createState.error
            ? `<div class="member-save-message member-save-message--error">${escapeHtml(createState.error)}</div>`
            : ''
        }

        <div class="member-create-actions">
          <button
            class="member-edit-cancel"
            type="button"
            data-close-member-create
            ${createState.creating ? 'disabled' : ''}
          >
            취소
          </button>

          <button
            class="member-edit-save"
            type="submit"
            ${createState.creating ? 'disabled' : ''}
          >
            ${createState.creating ? '등록 중...' : '멤버 등록'}
          </button>
        </div>
      </form>
    </section>
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
      auth.admin?.admin_level === 'superadmin'
        ? `
          <button class="member-edit-button" type="button" data-member-edit>
            멤버 정보 수정
          </button>
          <div class="member-detail__note">
            최고관리자 <strong>${escapeHtml(auth.admin.nickname)}</strong>으로 인증되었습니다.
            수정 내용은 Supabase에 즉시 반영됩니다.
          </div>

          ${renderMemberAudit(membersState.audit, item.member_key)}
        `
        : `
          <div class="member-detail__note">
            멤버 정보 수정과 권한 부여는 최고관리자만 사용할 수 있습니다.
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
    <div class="ops-member-stat">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderFilterButton(filter, label, activeFilter) {
  return `
    <button
      class="ops-member-filter ${filter === activeFilter ? 'is-active' : ''}"
      type="button"
      data-member-filter="${filter}"
    >
      ${label}
    </button>
  `;
}

function renderMemberRow(item, displayOrder) {
  return `
    <tr class="ops-member-row" data-member-key="${escapeAttribute(item.member_key)}">
      <td class="ops-member-order">${escapeHtml(displayOrder)}</td>
      <td class="ops-member-name"><strong>${escapeHtml(item.nickname ?? '')}</strong></td>
      <td class="ops-member-discord">${escapeHtml(item.discord_name || '—')}</td>
      <td>${renderRole(item.role)}</td>
      <td>${renderStatus(item.status)}</td>
      <td class="ops-member-date">${escapeHtml(item.joined_date || '—')}</td>
      <td class="ops-member-badge">${escapeHtml(item.badge || '—')}</td>
      <td class="is-number">${formatNumber(item.points)}</td>
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
