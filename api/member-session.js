import {
  clearMemberSessionCookie,
  getSessionToken,
  normalizeApiError,
  onlyPost,
  publicMember,
  readBody,
  requireMemberSession,
  revokeMemberSession,
  sendJson,
} from '../server/memberSession.js';

const ALLOWED_PAYMENT_MODES = new Set(['공용계좌', '회사잔고']);

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;

  let body = {};
  try {
    body = await readBody(req);
    const action = String(body.action || 'validate').trim();
    const token = getSessionToken(req, body);

    if (action === 'logout') {
      await revokeMemberSession(token);
      clearMemberSessionCookie(req, res);
      return sendJson(res, 200, { ok: true });
    }

    const context = await requireMemberSession(token);

    if (action === 'validate') {
      return sendJson(res, 200, {
        ok: true,
        member: publicMember(context.member),
        expires_at: context.session.expires_at,
      });
    }

    if (action === 'fund_profile') {
      const discordUserId = String(context.member.discord_user_id || '').trim();
      if (!discordUserId) {
        return sendJson(res, 409, {
          ok: false,
          message: '이 멤버는 Discord 계정 연결 정보가 없습니다. 관리자에게 계정연동을 요청하세요.',
        });
      }

      const { data, error } = await context.client.rpc('get_my_fund_profile', {
        p_member_key: context.member.member_key,
        p_discord_user_id: discordUserId,
      });
      if (error) throw error;

      return sendJson(res, 200, { ok: true, profile: data });
    }

    if (action === 'fund_submit') {
      const discordUserId = String(context.member.discord_user_id || '').trim();
      if (!discordUserId) {
        return sendJson(res, 409, {
          ok: false,
          message: '이 멤버는 Discord 계정 연결 정보가 없습니다. 관리자에게 계정연동을 요청하세요.',
        });
      }

      const paymentMode = String(body.payment_mode || '공용계좌');
      if (!ALLOWED_PAYMENT_MODES.has(paymentMode)) {
        return sendJson(res, 400, {
          ok: false,
          message: '납부 방식은 공용계좌 또는 회사잔고 중에서 선택하세요.',
        });
      }

      const year = Number(body.year);
      const month = Number(body.month);
      const week = Number(body.week);
      const amount = Number(body.amount);

      if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(week)) {
        return sendJson(res, 400, { ok: false, message: '납부 주차 정보가 올바르지 않습니다.' });
      }
      if (!Number.isInteger(amount) || amount <= 0) {
        return sendJson(res, 400, { ok: false, message: '납부 금액은 0원보다 큰 정수여야 합니다.' });
      }

      const { data, error } = await context.client.rpc('submit_fund_request', {
        p_member_key: context.member.member_key,
        p_discord_user_id: discordUserId,
        p_year: year,
        p_month: month,
        p_week: week,
        p_amount: amount,
        p_payment_mode: paymentMode,
        p_evidence_url: String(body.evidence_url || '').trim() || null,
        p_memo: String(body.memo || '').trim() || null,
      });
      if (error) throw error;

      return sendJson(res, 200, { ok: true, request_id: data });
    }

    return sendJson(res, 400, { ok: false, message: '지원하지 않는 세션 작업입니다.' });
  } catch (error) {
    console.error('[NEW AXE NET] member session action failed:', error);
    const normalized = normalizeApiError(error);
    if (normalized.status === 401 || normalized.status === 403) clearMemberSessionCookie(req, res);
    return sendJson(res, normalized.status, {
      ok: false,
      message: normalized.message,
    });
  }
}
