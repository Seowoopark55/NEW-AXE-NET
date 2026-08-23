import {
  createMemberSession,
  findNewMemberForLegacyUser,
  getMemberLoginTarget,
  invalidMemberLoginError,
  legacyLogin,
  normalizeApiError,
  onlyPost,
  publicMember,
  readBody,
  sendJson,
  setMemberPassword,
  setMemberSessionCookie,
  touchMemberLogin,
  verifyMemberCredentials,
} from '../server/memberSession.js';

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;

  try {
    const body = await readBody(req);
    const nickname = String(body.nickname || '').trim();
    const password = String(body.password || '');

    if (!nickname || !password) {
      return sendJson(res, 400, {
        ok: false,
        message: '닉네임과 비밀번호를 입력하세요.',
      });
    }

    const target = await getMemberLoginTarget(nickname);
    if (!target?.member) {
      throw invalidMemberLoginError();
    }

    let member = null;
    let migrated = false;

    if (target.has_credential) {
      member = await verifyMemberCredentials(nickname, password);
      if (!member) throw invalidMemberLoginError();
    } else {
      // v1.27 이관 브리지:
      // 자격증명이 아직 NEW AXE NET에 없는 멤버만 기존 로그인 서버에서 1회 검증합니다.
      // 성공한 비밀번호는 평문 저장 없이 Supabase pgcrypto bcrypt 해시로 즉시 이관됩니다.
      const legacyUser = await legacyLogin(nickname, password);
      const legacyMember = await findNewMemberForLegacyUser(legacyUser);

      if (String(legacyMember.member_key) !== String(target.member.member_key)) {
        throw invalidMemberLoginError('로그인 계정과 NEW AXE NET 멤버 정보가 일치하지 않습니다. 관리자에게 문의하세요.');
      }

      await setMemberPassword(legacyMember.member_key, password, 'legacy_first_login');
      member = legacyMember;
      migrated = true;
    }

    const session = await createMemberSession(member);
    await touchMemberLogin(member.member_key);
    setMemberSessionCookie(req, res, session.token, session.expires_at);

    return sendJson(res, 200, {
      ok: true,
      expires_at: session.expires_at,
      member: publicMember(member),
      credential_migrated: migrated,
    });
  } catch (error) {
    console.error('[NEW AXE NET] member login failed:', error);
    const normalized = normalizeApiError(error);
    return sendJson(res, normalized.status, {
      ok: false,
      message: normalized.message,
    });
  }
}
