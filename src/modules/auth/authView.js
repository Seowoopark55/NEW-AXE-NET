export function renderAuthView(root, auth, actions = {}) {
  if (!root) return;

  root.innerHTML = `
    <div class="auth-control">
      ${renderAuthButton(auth)}
    </div>
    ${auth.loginOpen ? renderLoginModal(auth) : ''}
  `;

  root.querySelector('[data-open-login]')?.addEventListener('click', () => {
    actions.onOpenLogin?.();
  });

  root.querySelectorAll('[data-close-login]').forEach((element) => {
    element.addEventListener('click', () => {
      actions.onCloseLogin?.();
    });
  });

  root.querySelector('[data-auth-logout]')?.addEventListener('click', () => {
    actions.onLogout?.();
  });

  const form = root.querySelector('[data-login-form]');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    actions.onLogin?.({
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
    });
  });
}

function renderAuthButton(auth) {
  if (!auth.initialized) {
    return '<span class="auth-pill auth-pill--muted">AUTH CHECKING</span>';
  }

  if (auth.admin) {
    return `
      <div class="auth-signed-in">
        <div class="auth-signed-in__text">
          <span>관리자</span>
          <strong>${escapeHtml(auth.admin.nickname)}</strong>
        </div>
        <button class="auth-logout" type="button" data-auth-logout>로그아웃</button>
      </div>
    `;
  }

  if (auth.user && !auth.admin) {
    return `
      <div class="auth-signed-in">
        <div class="auth-signed-in__text">
          <span class="auth-denied">권한 없음</span>
          <strong>${escapeHtml(auth.user.email ?? 'Authenticated')}</strong>
        </div>
        <button class="auth-logout" type="button" data-auth-logout>로그아웃</button>
      </div>
    `;
  }

  return `
    <button class="auth-login-button" type="button" data-open-login>
      관리자 로그인
    </button>
  `;
}

function renderLoginModal(auth) {
  return `
    <div class="auth-modal-backdrop" data-close-login></div>

    <section class="auth-modal" role="dialog" aria-modal="true" aria-label="관리자 로그인">
      <div class="auth-modal__header">
        <div>
          <span>ADMIN ACCESS</span>
          <h3>관리자 로그인</h3>
          <p>Supabase Auth 계정으로 로그인합니다.</p>
        </div>

        <button type="button" class="auth-modal__close" data-close-login aria-label="닫기">
          ×
        </button>
      </div>

      <form class="auth-form" data-login-form>
        <label>
          <span>이메일</span>
          <input
            type="email"
            name="email"
            autocomplete="username"
            placeholder="admin@example.com"
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

        ${
          auth.error
            ? `<div class="auth-form__error">${escapeHtml(auth.error)}</div>`
            : ''
        }

        <button class="auth-form__submit" type="submit" ${auth.loading ? 'disabled' : ''}>
          ${auth.loading ? '확인 중...' : '로그인'}
        </button>
      </form>
    </section>
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
