import { store } from '../../state/store.js';
import {
  fetchAdminSession,
  getCurrentSession,
  onAuthStateChange,
  signInWithPassword,
  signOut,
} from './authService.js';
import { renderAuthView } from './authView.js';

export async function initAuthModule() {
  const root = document.querySelector('#auth-root');

  if (!root) {
    throw new Error('#auth-root element not found.');
  }

  const render = () => {
    renderAuthView(root, store.getState().auth, {
      onOpenLogin() {
        store.updateState((state) => ({
          ...state,
          auth: {
            ...state.auth,
            loginOpen: true,
            error: null,
          },
        }));
      },

      onCloseLogin() {
        store.updateState((state) => ({
          ...state,
          auth: {
            ...state.auth,
            loginOpen: false,
            error: null,
          },
        }));
      },

      async onLogin({ email, password }) {
        if (!email || !password) return;

        store.updateState((state) => ({
          ...state,
          auth: {
            ...state.auth,
            loading: true,
            error: null,
          },
        }));

        try {
          const session = await signInWithPassword(email, password);
          await applySession(session, { closeLogin: true });
        } catch (error) {
          store.updateState((state) => ({
            ...state,
            auth: {
              ...state.auth,
              loading: false,
              error: translateAuthError(error),
            },
          }));
        }
      },

      async onLogout() {
        try {
          await signOut();
        } catch (error) {
          console.error('[NEW AXE NET] logout failed:', error);
        } finally {
          await applySession(null);
        }
      },
    });
  };

  render();
  store.subscribe(render);

  const session = await getCurrentSession();
  await applySession(session);

  onAuthStateChange(async (nextSession) => {
    await applySession(nextSession);
  });
}

async function applySession(session, options = {}) {
  const user = session?.user ?? null;
  let admin = null;
  let error = null;

  if (user) {
    try {
      admin = await fetchAdminSession();
    } catch (adminError) {
      console.error('[NEW AXE NET] admin session lookup failed:', adminError);
      error = adminError?.message ?? String(adminError);
    }
  }

  store.updateState((state) => ({
    ...state,
    auth: {
      ...state.auth,
      initialized: true,
      loading: false,
      user,
      admin,
      error,
      loginOpen: options.closeLogin ? false : state.auth.loginOpen,
    },
  }));
}

function translateAuthError(error) {
  const message = error?.message ?? String(error);

  if (message.toLowerCase().includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }

  if (message.toLowerCase().includes('email not confirmed')) {
    return '이메일 인증이 완료되지 않은 계정입니다.';
  }

  return message;
}
