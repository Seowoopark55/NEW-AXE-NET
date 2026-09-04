import { store } from '../../state/store.js';

export const SHORTCUT_TARGETS = [
  { key: 'home', group: '홈', label: '홈', module: 'home' },

  { key: 'notice.general', group: '소식', label: '일반공지', module: 'notice', tab: 'general' },
  { key: 'notice.patch', group: '소식', label: '패치노트', module: 'notice', tab: 'patch' },
  { key: 'notice.operations', group: '소식', label: '운영기준', module: 'notice', tab: 'operations' },

  { key: 'info.craft', group: '정보', label: '제작', module: 'info', tab: 'craft' },
  { key: 'info.quest', group: '정보', label: '퀘스트', module: 'info', tab: 'quest' },
  { key: 'info.process', group: '정보', label: '가공·재련', module: 'info', tab: 'process' },
  { key: 'info.modbook', group: '정보', label: '개조서', module: 'info', tab: 'modbook' },
  { key: 'info.preset', group: '정보', label: '추천세팅', module: 'info', tab: 'preset' },
  { key: 'info.skill', group: '정보', label: '스킬랭크', module: 'info', tab: 'skill' },

  { key: 'outlaw.stats', group: '콘텐츠', label: '무법지대 · 통계', module: 'outlaw', tab: 'stats' },
  { key: 'outlaw.guide', group: '콘텐츠', label: '무법지대 · 공략', module: 'outlaw', tab: 'guide' },
  { key: 'outlaw.map', group: '콘텐츠', label: '무법지대 · 브리핑맵', module: 'outlaw', tab: 'map' },
  { key: 'tube', group: '콘텐츠', label: 'AXE TUBE', module: 'tube' },

  { key: 'fund.overview', group: '운영 · 공금', label: '공금 · 월별현황', module: 'fund', section: 'overview' },
  { key: 'fund.payment', group: '운영 · 공금', label: '공금 · 납부', module: 'fund', section: 'payment' },
  { key: 'fund.submissions', group: '운영 · 공금', label: '공금 · 내 제출', module: 'fund', section: 'submissions' },
  { key: 'fund.review', group: '운영 · 공금', label: '공금 · 검수대기', module: 'fund', section: 'review', adminOnly: true },
  { key: 'fund.history', group: '운영 · 공금', label: '공금 · 공금내역', module: 'fund', section: 'history', adminOnly: true },
  { key: 'fund.balance', group: '운영 · 공금', label: '공금 · 잔액점검', module: 'fund', section: 'balance', adminOnly: true },
  { key: 'fund.feeRules', group: '운영 · 공금', label: '공금 · 요율관리', module: 'fund', section: 'feeRules', adminOnly: true },
  { key: 'fund.exemptions', group: '운영 · 공금', label: '공금 · 면제관리', module: 'fund', section: 'exemptions', adminOnly: true },
  { key: 'fund.integrity', group: '운영 · 공금', label: '공금 · 정합성점검', module: 'fund', section: 'integrity', adminOnly: true },
  { key: 'fund.fundMembers', group: '운영 · 공금', label: '공금 · 납부대상', module: 'fund', section: 'fundMembers', adminOnly: true },

  { key: 'assets.accounts', group: '운영 · 자산·계좌', label: '자산·계좌 · 플리카 계좌', module: 'assets', tab: 'accounts' },
  { key: 'assets.company', group: '운영 · 자산·계좌', label: '자산·계좌 · 회사 자산', module: 'assets', tab: 'company', adminOnly: true },
  { key: 'assets.returns', group: '운영 · 자산·계좌', label: '자산·계좌 · 반납 내역', module: 'assets', tab: 'returns', adminOnly: true },
  { key: 'members', group: '운영', label: '멤버 · 권한', module: 'members' },
];

const TARGET_MAP = new Map(SHORTCUT_TARGETS.map((target) => [target.key, target]));

export function getShortcutTarget(key) {
  return TARGET_MAP.get(String(key || '').trim()) || null;
}

export function getAvailableShortcutTargets(state = store.getState()) {
  const isAdmin = Boolean(state.auth?.admin);
  return SHORTCUT_TARGETS.filter((target) => !target.adminOnly || isAdmin);
}

export function canUseShortcutTarget(target, state = store.getState()) {
  return Boolean(target && (!target.adminOnly || state.auth?.admin));
}

export function navigateToShortcut(targetKey) {
  const target = getShortcutTarget(targetKey);
  const current = store.getState();
  if (!canUseShortcutTarget(target, current)) return false;

  store.updateState((state) => {
    let next = {
      ...state,
      ui: { ...state.ui, activeModule: target.module },
    };

    if (target.module === 'notice') {
      next = {
        ...next,
        notice: {
          ...state.notice,
          tab: target.tab || 'general',
          selectedNoticeId: null,
          selectedOperationId: null,
          operationCategory: 'all',
        },
      };
    }

    if (target.module === 'info') {
      next = {
        ...next,
        info: {
          ...state.info,
          tab: target.tab || 'craft',
          selectedCraftId: null,
          selectedModbookId: null,
        },
      };
    }

    if (target.module === 'outlaw') {
      next = {
        ...next,
        outlaw: {
          ...state.outlaw,
          tab: target.tab || 'stats',
          selectedMemberKey: null,
          selectedLocationKey: null,
          selectedMapKey: null,
        },
      };
    }

    if (target.module === 'tube') {
      next = {
        ...next,
        tube: {
          ...state.tube,
          selectedTubeId: null,
        },
      };
    }

    if (target.module === 'fund') {
      next = {
        ...next,
        fund: {
          ...state.fund,
          section: target.section || 'overview',
        },
      };
    }

    if (target.module === 'assets') {
      next = {
        ...next,
        assets: {
          ...state.assets,
          tab: target.tab || 'accounts',
          modal: { ...state.assets.modal, type: null, itemId: null, error: null },
        },
      };
    }

    return next;
  });

  return true;
}
