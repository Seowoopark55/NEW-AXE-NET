export function renderAuthView(root, auth, actions = {}) {
  if (!root) return;

  root.innerHTML = `
    <div class="auth-control">
      ${renderAuthButton(auth)}
    </div>
    ${auth.loginOpen ? renderLoginModal(auth) : ''}
  `;

  root.querySelector('[data-open-login]')?.addEventListener('click', () => {
    actions.onOpenLogin?.('member');
  });

  root.querySelector('[data-open-admin-login]')?.addEventListener('click', () => {
    actions.onOpenLogin?.('admin');
  });

  root.querySelectorAll('[data-close-login]').forEach((element) => {
    element.addEventListener('click', () => actions.onCloseLogin?.());
  });

  root.querySelector('[data-auth-logout]')?.addEventListener('click', () => {
    actions.onLogout?.();
  });

  root.querySelectorAll('[data-login-mode]').forEach((button) => {
    button.addEventListener('click', () => actions.onLoginModeChange?.(button.dataset.loginMode));
  });

  const memberForm = root.querySelector('[data-member-login-form]');
  memberForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(memberForm);
    actions.onMemberLogin?.({
      nickname: String(formData.get('nickname') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
    });
  });

  const adminForm = root.querySelector('[data-admin-login-form]');
  adminForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(adminForm);
    actions.onAdminLogin?.({
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
    });
  });
}

function renderAuthButton(auth) {
  if (!auth.initialized) {
    return '<span class="auth-pill auth-pill--muted">ACCOUNT CHECKING</span>';
  }

  if (auth.admin) {
    return `
      <div class="auth-signed-in auth-signed-in--admin">
        <div class="auth-signed-in__text">
          <span>관리자</span>
          <strong>${escapeHtml(auth.admin.nickname)}</strong>
        </div>
        <button class="auth-logout" type="button" data-auth-logout>로그아웃</button>
      </div>
    `;
  }

  if (auth.member) {
    return `
      <div class="auth-signed-in">
        <div class="auth-signed-in__text">
          <span>멤버</span>
          <strong>${escapeHtml(auth.member.nickname)}</strong>
        </div>
        <button class="auth-admin-upgrade" type="button" data-open-admin-login>관리자</button>
        <button class="auth-logout" type="button" data-auth-logout>로그아웃</button>
      </div>
    `;
  }

  if (auth.user && !auth.admin) {
    return `
      <div class="auth-signed-in">
        <div class="auth-signed-in__text">
          <span class="auth-denied">관리자 연결 없음</span>
          <strong>${escapeHtml(auth.user.email ?? 'Authenticated')}</strong>
        </div>
        <button class="auth-logout" type="button" data-auth-logout>로그아웃</button>
      </div>
    `;
  }

  return `
    <button class="auth-login-button" type="button" data-open-login>
      로그인
    </button>
  `;
}

function renderLoginModal(auth) {
  const mode = auth.loginMode === 'admin' ? 'admin' : 'member';

  return `
    <div class="auth-modal-backdrop" data-close-login></div>

    <section class="auth-modal" role="dialog" aria-modal="true" aria-label="AXE NET 로그인">
      <div class="auth-modal__header">
        <div>
          <span>AXE ACCOUNT</span>
          <h3>${mode === 'member' ? 'AXE NET 로그인' : '관리자 인증'}</h3>
          <p>${mode === 'member'
            ? 'AXE NET에서 사용 중인 닉네임과 비밀번호로 로그인합니다.'
            : 'NEW AXE NET 관리 기능은 Supabase Auth 관리자 계정으로 인증합니다.'}</p>
        </div>

        <button type="button" class="auth-modal__close" data-close-login aria-label="닫기">×</button>
      </div>

      <div class="auth-mode-tabs" role="tablist" aria-label="로그인 종류">
        <button class="${mode === 'member' ? 'active' : ''}" type="button" data-login-mode="member">멤버 로그인</button>
        <button class="${mode === 'admin' ? 'active' : ''}" type="button" data-login-mode="admin">관리자 인증</button>
      </div>

      ${mode === 'member' ? renderMemberLoginForm(auth) : renderAdminLoginForm(auth)}
    </section>
  `;
}

function renderMemberLoginForm(auth) {
  return `
    <form class="auth-form" data-member-login-form>
      <label>
        <span>닉네임</span>
        <input
          name="nickname"
          autocomplete="username"
          autocapitalize="off"
          spellcheck="false"
          placeholder="AXE NET 닉네임"
          required
        />
      </label>

      <label>
        <span>비밀번호</span>
        <input
          type="password"
          name="password"
          autocomplete="current-password"
          required
        />
      </label>

      ${auth.error ? `<div class="auth-form__error">${escapeHtml(auth.error)}</div>` : ''}

      <button class="auth-form__submit" type="submit" ${auth.loading ? 'disabled' : ''}>
        ${auth.loading ? '확인 중...' : '로그인'}
      </button>

      <div class="auth-form__help">
        로그인 후 공금납부·내 제출에서 Discord 숫자 ID를 다시 입력하지 않습니다.
      </div>
    </form>
  `;
}

function renderAdminLoginForm(auth) {
  return `
    <form class="auth-form" data-admin-login-form>
      <label>
        <span>이메일</span>
        <input type="email" name="email" autocomplete="username" placeholder="admin@example.com" required />
      </label>

      <label>
        <span>비밀번호</span>
        <input type="password" name="password" autocomplete="current-password" required />
      </label>

      ${auth.error ? `<div class="auth-form__error">${escapeHtml(auth.error)}</div>` : ''}

      <button class="auth-form__submit" type="submit" ${auth.loading ? 'disabled' : ''}>
        ${auth.loading ? '확인 중...' : '관리자 인증'}
      </button>
    </form>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
