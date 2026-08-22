import {
  clearMemberSessionCookie,
  getSessionToken,
  normalizeApiError,
  onlyPost,
  publicMember,
  hydrateFundEvidence,
  uploadFundEvidence,
  removeFundEvidence,
  readBody,
  requireMemberSession,
  revokeMemberSession,
  sendJson,
} from '../server/memberSession.js';

const ALLOWED_PAYMENT_MODES = new Set(['공용계좌', '회사잔고', '분할납부']);

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

      const profile = await hydrateFundEvidence(data, context.client);
      return sendJson(res, 200, { ok: true, profile });
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
          message: '납부 방식은 공용계좌, 회사잔고 또는 분할납부 중에서 선택하세요.',
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

      let publicAmount = Number(body.public_amount || 0);
      let companyAmount = Number(body.company_amount || 0);
      if (paymentMode === '공용계좌') { publicAmount = amount; companyAmount = 0; }
      if (paymentMode === '회사잔고') { publicAmount = 0; companyAmount = amount; }
      if (paymentMode === '분할납부') {
        if (!Number.isInteger(publicAmount) || publicAmount <= 0 || !Number.isInteger(companyAmount) || companyAmount <= 0) {
          return sendJson(res, 400, { ok: false, message: '분할납부 금액을 모두 입력하세요.' });
        }
        if (publicAmount + companyAmount !== amount) {
          return sendJson(res, 400, { ok: false, message: '분할납부 합계가 총 납부금액과 일치하지 않습니다.' });
        }
      }

      const upload = await uploadFundEvidence(context.client, context.member.member_key, body.evidence);
      try {
        const { data, error } = await context.client.rpc('submit_fund_request_v2', {
          p_member_key: context.member.member_key,
          p_discord_user_id: discordUserId,
          p_year: year,
          p_month: month,
          p_week: week,
          p_amount: amount,
          p_payment_mode: paymentMode,
          p_public_amount: publicAmount,
          p_company_amount: companyAmount,
          p_evidence_url: upload.ref,
          p_memo: String(body.memo || '').trim() || null,
          p_submitted_by_name: context.member.nickname,
          p_proxy_admin_name: null,
          p_submitted_via: 'member_web',
        });
        if (error) throw error;
        return sendJson(res, 200, { ok: true, request_id: data });
      } catch (error) {
        await removeFundEvidence(context.client, upload.path);
        throw error;
      }
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
