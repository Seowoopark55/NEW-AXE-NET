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

    if (action === 'outlaw_bootstrap') {
      const [statsResult, locationsResult, stepsResult, mapsResult] = await Promise.all([
        context.client
          .from('outlaw_stats_current')
          .select('member_key,source_nickname,total_kills,total_deaths,kd,source_updated_at')
          .order('total_kills', { ascending: false }),
        context.client
          .from('outlaw_guide_locations')
          .select('location_key,map_name,main_image,coord,sort_order')
          .eq('active', true)
          .order('sort_order', { ascending: true }),
        context.client
          .from('outlaw_guide_steps')
          .select('id,location_key,route_group,step_no,title,content,image,video_url,sort_order')
          .eq('active', true)
          .order('sort_order', { ascending: true }),
        context.client
          .from('outlaw_briefing_maps')
          .select('map_key,map_name,image,description,note,coord,source_updated_at,sort_order')
          .eq('active', true)
          .order('sort_order', { ascending: true }),
      ]);

      for (const result of [statsResult, locationsResult, stepsResult, mapsResult]) {
        if (result.error) throw result.error;
      }

      const statRows = statsResult.data || [];
      const memberKeys = [...new Set(statRows.map((row) => row.member_key).filter(Boolean))];
      let memberRows = [];
      if (memberKeys.length) {
        const { data, error } = await context.client
          .from('members')
          .select('member_key,nickname,status,sort_order')
          .in('member_key', memberKeys);
        if (error) throw error;
        memberRows = data || [];
      }
      const memberMap = new Map(memberRows.map((member) => [member.member_key, member]));
      const stats = statRows.map((row) => ({
        ...row,
        nickname: memberMap.get(row.member_key)?.nickname || row.source_nickname,
        member_status: memberMap.get(row.member_key)?.status || 'active',
        member_sort_order: memberMap.get(row.member_key)?.sort_order || 0,
      }));

      return sendJson(res, 200, {
        ok: true,
        stats,
        guide_locations: locationsResult.data || [],
        guide_steps: stepsResult.data || [],
        maps: mapsResult.data || [],
      });
    }

    if (action === 'outlaw_history') {
      const memberKey = String(body.member_key || '').trim();
      if (!memberKey) {
        return sendJson(res, 400, { ok: false, message: '조회할 멤버 정보가 없습니다.' });
      }

      const { data, error } = await context.client
        .from('outlaw_stats_history')
        .select('record_id,member_key,source_nickname,total_kills,total_deaths,kill_delta,death_delta,delta_kd,confidence,status,recorded_at')
        .eq('member_key', memberKey)
        .order('recorded_at', { ascending: false })
        .limit(120);
      if (error) throw error;

      return sendJson(res, 200, { ok: true, history: data || [] });
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

    if (action === 'asset_plika_accounts') {
      const { data: accountRows, error: accountError } = await context.client
        .from('member_accounts')
        .select('id,member_key,account,note,sort_order,updated_at')
        .eq('enabled', true)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true })
        .limit(1000);
      if (accountError) throw accountError;

      const keys = [...new Set((accountRows || []).map((row) => row.member_key).filter(Boolean))];
      let memberRows = [];
      if (keys.length) {
        const { data, error } = await context.client
          .from('members')
          .select('member_key,nickname,status,sort_order')
          .in('member_key', keys);
        if (error) throw error;
        memberRows = data || [];
      }

      const memberMap = new Map(memberRows.map((row) => [row.member_key, row]));
      const accounts = (accountRows || [])
        .map((row) => ({
          ...row,
          nickname: memberMap.get(row.member_key)?.nickname || row.member_key,
          member_status: memberMap.get(row.member_key)?.status || null,
          member_sort_order: Number(memberMap.get(row.member_key)?.sort_order || 0),
        }))
        .filter((row) => row.member_status === 'active')
        .sort((a, b) => a.member_sort_order - b.member_sort_order
          || Number(a.sort_order || 0) - Number(b.sort_order || 0)
          || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'ko'));

      return sendJson(res, 200, { ok: true, accounts });
    }

    if (action === 'asset_plika_my_requests') {
      const { data, error } = await context.client
        .from('member_account_requests')
        .select('id,account,note,status,reviewer,review_note,reviewed_at,created_at')
        .eq('member_key', context.member.member_key)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return sendJson(res, 200, { ok: true, requests: data || [] });
    }

    if (action === 'asset_plika_request_submit') {
      const account = String(body.account || '').trim();
      const note = String(body.note || '').trim();
      if (!account) {
        return sendJson(res, 400, { ok: false, message: '계좌번호를 입력하세요.' });
      }
      if (account.length > 100) {
        return sendJson(res, 400, { ok: false, message: '계좌번호가 너무 깁니다.' });
      }
      if (note.length > 500) {
        return sendJson(res, 400, { ok: false, message: '메모는 500자 이하로 입력하세요.' });
      }

      const { data, error } = await context.client
        .from('member_account_requests')
        .insert({
          member_key: context.member.member_key,
          nickname: context.member.nickname,
          account,
          note: note || null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          return sendJson(res, 409, { ok: false, message: '이미 검수대기 중인 계좌 신청이 있습니다.' });
        }
        throw error;
      }

      return sendJson(res, 200, { ok: true, request_id: data.id });
    }

    if (action === 'info_modbook_my_requests') {
      const { data, error } = await context.client
        .from('info_modbook_requests')
        .select('id,type,category,name,parts,option1,option2,option3,success_rate,note,status,review_note,reviewer,reviewed_at,created_at')
        .eq('member_key', context.member.member_key)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return sendJson(res, 200, { ok: true, requests: data || [] });
    }

    if (action === 'info_modbook_price_update') {
      const id = Number(body.id);
      const rawPrice = String(body.recent_price ?? '').trim().replace(/,/g, '');
      const recentPrice = rawPrice === '' ? null : Number(rawPrice);
      if (!Number.isInteger(id) || id <= 0) {
        return sendJson(res, 400, { ok: false, message: '개조서 정보가 올바르지 않습니다.' });
      }
      if (recentPrice !== null && (!Number.isInteger(recentPrice) || recentPrice < 0)) {
        return sendJson(res, 400, { ok: false, message: '최근 거래가는 0 이상의 정수로 입력하세요.' });
      }
      const recentDate = recentPrice === null
        ? null
        : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

      const { data, error } = await context.client
        .from('info_modbooks')
        .update({
          recent_price: recentPrice,
          recent_date: recentDate,
          price_note: recentPrice === null ? null : context.member.nickname,
        })
        .eq('id', id)
        .eq('active', true)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return sendJson(res, 404, { ok: false, message: '개조서를 찾을 수 없습니다.' });
      return sendJson(res, 200, { ok: true, modbook_id: data.id });
    }

    if (action === 'info_modbook_request_submit') {
      const type = String(body.type || '').trim();
      const category = String(body.category || '').trim();
      const name = String(body.name || '').trim();
      const parts = String(body.parts || '').trim();
      const option1 = String(body.option1 || '').trim();
      const option2 = String(body.option2 || '').trim();
      const option3 = String(body.option3 || '').trim();
      const note = String(body.note || '').trim();
      const successRateText = String(body.success_rate ?? '').trim();
      const successRate = successRateText ? Number(successRateText) : null;

      if (!['접두', '접미'].includes(type)) {
        return sendJson(res, 400, { ok: false, message: '개조 위치는 접두 또는 접미 중에서 선택하세요.' });
      }
      if (!category || !name) {
        return sendJson(res, 400, { ok: false, message: '개조서 분류와 이름을 입력하세요.' });
      }
      if (!parts) {
        return sendJson(res, 400, { ok: false, message: '적용 부위를 입력하세요.' });
      }
      if (!option1 && !option2 && !option3) {
        return sendJson(res, 400, { ok: false, message: '개조 옵션을 하나 이상 입력하세요.' });
      }
      if (successRate !== null && (!Number.isInteger(successRate) || successRate < 0 || successRate > 100)) {
        return sendJson(res, 400, { ok: false, message: '성공률은 0~100 사이 정수로 입력하세요.' });
      }
      if (name.length > 100 || category.length > 80 || parts.length > 300) {
        return sendJson(res, 400, { ok: false, message: '입력 내용이 허용 길이를 초과했습니다.' });
      }

      const { data, error } = await context.client
        .from('info_modbook_requests')
        .insert({
          member_key: context.member.member_key,
          nickname: context.member.nickname,
          type,
          category,
          name,
          parts,
          option1: option1 || null,
          option2: option2 || null,
          option3: option3 || null,
          success_rate: successRate,
          note: note || null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          return sendJson(res, 409, { ok: false, message: '같은 개조서의 검수대기 신청이 이미 있습니다.' });
        }
        throw error;
      }

      return sendJson(res, 200, { ok: true, request_id: data.id });
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
