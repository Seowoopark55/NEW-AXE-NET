import {
  createMemberSession,
  ensureMemberAdminBridge,
  findNewMemberForLegacyUser,
  getMemberLoginTarget,
  legacySignup,
  normalizeApiError,
  onlyPost,
  publicMember,
  readBody,
  sendJson,
  setMemberPassword,
  setMemberSessionCookie,
  touchMemberLogin,
} from '../server/memberSession.js';

function signupError(message, statusCode = 400, code = 'MEMBER_SIGNUP_FAILED') {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;

  try {
    const body = await readBody(req);
    const nickname = String(body.nickname || '').trim();
    const password = String(body.password || '');

    if (!nickname || !password) {
      throw signupError('닉네임과 비밀번호를 입력하세요.');
    }
    if (nickname.length < 2 || nickname.length > 32) {
      throw signupError('닉네임을 다시 확인해주세요.');
    }
    if (password.length < 4 || password.length > 128) {
      throw signupError('비밀번호는 4~128자로 입력해주세요.');
    }

    const target = await getMemberLoginTarget(nickname);
    if (!target?.member) {
      throw signupError(
        '회사 멤버 명단에 등록된 활성 닉네임을 찾을 수 없습니다. 관리자에게 멤버 등록을 먼저 요청해주세요.',
        404,
        'MEMBER_NOT_REGISTERED',
      );
    }

    if (target.has_credential) {
      throw signupError('이미 가입된 계정입니다. 로그인 탭을 이용해주세요.', 409, 'MEMBER_ALREADY_SIGNED_UP');
    }

    // 기존 회원가입 서버를 1회 거치는 이유:
    // 아직 credential이 없는 기존 멤버의 닉네임을 제3자가 알고 있는 것만으로
    // 새 비밀번호를 덮어쓰는 계정 탈취를 막습니다. 기존 계정이면 legacy signup이
    // '이미 사용 중인 닉네임'으로 거절하고, 진짜 신규 멤버만 새 계정을 만듭니다.
    const legacyUser = await legacySignup(nickname, password);
    const member = await findNewMemberForLegacyUser(legacyUser);

    if (String(member.member_key) !== String(target.member.member_key)) {
      throw signupError('회원가입 계정과 AXE NET 멤버 정보가 일치하지 않습니다. 관리자에게 문의하세요.', 409);
    }

    // 가입 성공 직후 평문은 저장하지 않고 현재 Supabase credential로 bcrypt 이관합니다.
    await setMemberPassword(member.member_key, password, 'legacy_signup_migration');

    // 이관 직후 세션을 발급하여 별도 재로그인 없이 바로 이용합니다.
    let adminBridge = null;
    if (String(member.role || '').toLowerCase() === 'admin') {
      try {
        adminBridge = await ensureMemberAdminBridge(member, password);
      } catch (bridgeError) {
        console.error('[AXE NET] member signup admin bridge failed:', bridgeError);
        adminBridge = {
          mode: 'error',
          auto_signin: false,
          message: '회원가입은 완료됐지만 관리자 권한 자동 연결에 실패했습니다. 최고관리자에게 문의하세요.',
        };
      }
    }

    const session = await createMemberSession(member);
    await touchMemberLogin(member.member_key);
    setMemberSessionCookie(req, res, session.token, session.expires_at);

    return sendJson(res, 200, {
      ok: true,
      expires_at: session.expires_at,
      member: publicMember(member),
      admin_bridge: adminBridge,
    });
  } catch (error) {
    console.error('[AXE NET] member signup failed:', error);
    const normalized = normalizeApiError(error);
    return sendJson(res, normalized.status, {
      ok: false,
      message: normalized.message,
    });
  }
}
