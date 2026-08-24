function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function attr(value) { return escapeHtml(value); }
function fmtDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
function num(value) { return Number(value || 0).toLocaleString('ko-KR'); }
function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : '-';
}

const DOMAIN_LABELS = {
  general:'일반', craft:'제작', processing:'가공·재련', cooking:'요리',
  skill:'스킬', quest:'퀘스트', member:'멤버', assets:'회사 자산',
  fund:'공금', outlaw:'무법지대', modbook:'개조서', notice:'공지',
  rules:'운영기준', map:'맵·공략', community:'커뮤니티',
  account:'플리카 계좌', info:'정보', system:'시스템',
};
const UNKNOWN_STATUS_LABELS = { open:'미답변', resolved:'해결', ignored:'무시' };
const RESULT_STATUS_LABELS = { success:'성공', empty:'결과 없음', error:'오류', blocked:'차단' };
const EMBEDDING_STATUS_LABELS = { pending:'대기', ready:'준비 완료', error:'오류', disabled:'사용 안 함' };
const SOURCE_TYPE_LABELS = {
  manual:'수동 등록', info:'정보', fund:'공금', member:'멤버', asset:'자산',
  outlaw:'무법지대', notice:'공지', rules:'운영기준', map:'맵',
  community:'커뮤니티', legacy:'레거시',
};
const INTENT_LABELS = {
  lookup:'정보 조회', how_make:'제작 방법', materials:'필요 재료',
  material_quantity:'재료 계산', uses:'사용처', location:'획득처',
  list:'목록', count:'개수', member_list:'멤버 목록',
  member_count:'인원', member_lookup:'멤버 조회', skill_points:'스킬 포인트',
  skill_compare:'스킬 비교', quest:'퀘스트', quest_list:'퀘스트 목록',
  quest_reward:'퀘스트 보상', asset_owner:'자산 보유자',
  asset_summary:'자산 현황', asset_lookup:'자산 조회',
  asset_unassigned:'미배정 자산', asset_without:'무자산 멤버',
  outlaw_ranking:'무법 랭킹', fund_recent:'최근 공금',
  fund_unpaid:'공금 미납', fund_balance:'공금 현황',
  modbook_list:'개조서 목록', modbook_lookup:'개조서 조회', modbook_price:'개조서 시세',
};
function domainLabel(value){ return DOMAIN_LABELS[String(value||'general')] || String(value||'일반'); }
function intentLabel(value){ return INTENT_LABELS[String(value||'')] || String(value||'-'); }
function unknownStatusLabel(value){ return UNKNOWN_STATUS_LABELS[String(value||'')] || String(value||'-'); }
function resultStatusLabel(value){ return RESULT_STATUS_LABELS[String(value||'')] || String(value||'-'); }
function embeddingStatusLabel(value){ return EMBEDDING_STATUS_LABELS[String(value||'')] || String(value||'-'); }
function sourceTypeLabel(value){ return SOURCE_TYPE_LABELS[String(value||'')] || String(value||'-'); }

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '').replace(/[^0-9a-z가-힣]/g, '');
}
function extractQuestionSubject(question) {
  let text = String(question || '')
    .replace(/^(!!|!)+/, '')
    .trim();

  // 문장 끝의 ?, !, ~, 마침표 때문에 의도어 제거가 실패하지 않도록 먼저 정리합니다.
  text = text.replace(/[?!~.,。！？\s]+$/g, '').trim();

  // "OO 재료는?", "OO 재료 뭐야?", "OO 만드는 법" 등에서 핵심 대상명만 남깁니다.
  const suffixes = [
    /\s*(?:필요한\s*)?재료(?:는|가|이|을|를)?$/i,
    /\s*재료\s*(?:뭐야|뭐임|뭔데|알려줘|알려\s*줘)$/i,
    /\s*(?:뭐야|뭐임|뭔데|알려줘|알려\s*줘)$/i,
    /\s*(?:어떻게\s*(?:만들|제작|가공).*)$/i,
    /\s*(?:만드는\s*법|제작법|가공법|제작\s*방법|가공\s*방법)$/i,
    /\s*(?:어디서.*|획득처.*|사용처.*)$/i,
  ];

  for (const pattern of suffixes) {
    const cleaned = text.replace(pattern, '').trim();
    if (cleaned !== text) {
      text = cleaned;
      break;
    }
  }

  return text;
}
function knowledgeMatchScore(item, unknown) {
  if (!item || !unknown) return 0;
  const subject = normalizeKey(extractQuestionSubject(unknown.question));
  const question = normalizeKey(unknown.question);
  const keys = [item.title, ...(item.aliases || [])].map(normalizeKey).filter(Boolean);
  if (!keys.length) return 0;
  if (subject && keys.includes(subject)) return 100;
  if (question && keys.includes(question)) return 98;
  if (subject && keys.some((key) => key.includes(subject) || subject.includes(key))) return 90;
  if (subject && keys.some((key) => question.includes(key) && key.length >= 3)) return 86;
  return 0;
}
function existingKnowledgeCandidates(ai, unknown) {
  return ai.knowledge
    .map((item) => ({ item, score: knowledgeMatchScore(item, unknown) }))
    .filter((row) => row.score >= 80)
    .sort((a,b) => b.score - a.score || String(a.item.title).localeCompare(String(b.item.title),'ko'))
    .slice(0, 5);
}

export function renderAiView(root, state, actions) {
  const { ai, auth } = state;
  if (!auth.admin) {
    root.innerHTML = `
      <section class="ops-ai ops-ai--locked">
        <div class="ops-ai-access">
          <span>AXE AI</span><h1>관리자 전용</h1>
          <p>AI 지식·미답변·질문 로그는 관리자 계정에서만 관리할 수 있습니다.</p>
        </div>
      </section>`;
    return;
  }

  const domains = [...new Set(ai.knowledge.map((item) => item.domain).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
  root.innerHTML = `
    <section class="ops-ai">
      <header class="ops-ai__head">
        <div><span class="ops-ai__eyebrow">AXE INTELLIGENCE · ADMIN 1.2</span><h1>AXE AI 관리</h1><p>Discord 질문에 사용하는 지식과 학습 대기 항목을 관리합니다.</p></div>
        <div class="ops-ai__head-actions">
          <button type="button" class="ops-ai-button" data-ai-refresh>새로고침</button>
          <button type="button" class="ops-ai-button ops-ai-button--primary" data-ai-create>+ 지식 등록</button>
        </div>
      </header>

      ${ai.message ? `<div class="ops-ai-message">${escapeHtml(ai.message)}</div>` : ''}
      ${ai.error ? `<div class="ops-ai-message ops-ai-message--error"><strong>AXE AI 데이터 로드 실패</strong><span>${escapeHtml(ai.error)}</span></div>` : ''}

      <nav class="ops-ai-tabs" aria-label="AXE AI 관리 메뉴">
        ${tabButton('dashboard','대시보드',ai.tab)}
        ${tabButton('knowledge',`지식 ${num(ai.summary.knowledgeCount)}`,ai.tab)}
        ${tabButton('unknown',`미답변 ${num(ai.summary.unknownOpenCount)}`,ai.tab)}
        ${tabButton('logs','질문 로그',ai.tab)}
      </nav>

      ${ai.loading && !ai.initialized ? '<div class="ops-ai-loading">AXE AI 데이터를 불러오는 중입니다.</div>' : renderTab(ai, domains)}
    </section>
    ${ai.editor.open ? renderEditor(ai) : ''}
  `;

  bind(root, ai, actions);
}

function tabButton(key,label,active){ return `<button type="button" class="${key===active?'is-active':''}" data-ai-tab="${key}">${label}</button>`; }

function renderTab(ai, domains) {
  if (ai.tab === 'knowledge') return renderKnowledge(ai, domains);
  if (ai.tab === 'unknown') return renderUnknown(ai);
  if (ai.tab === 'logs') return renderLogs(ai);
  return renderDashboard(ai);
}

function renderDashboard(ai) {
  const s = ai.summary;
  const recent = ai.logs.slice(0, 8);
  return `
    <div class="ops-ai-dashboard">
      <section class="ops-ai-stats">
        ${stat('등록 지식', s.knowledgeCount, `${s.activeKnowledgeCount}개 활성`)}
        ${stat('미답변', s.unknownOpenCount, '관리자 답변 대기')}
        ${stat('오늘 질문', s.todayQueryCount, '00:00 이후')}
        ${stat('임베딩 대기', s.pendingEmbeddingCount, 'OpenAI 연결 전 대기')}
      </section>
      <div class="ops-ai-dashboard-grid">
        <section class="ops-ai-panel">
          <header><div><span>SEARCH ROUTE</span><h2>최근 검색 경로</h2></div></header>
          <div class="ops-ai-route-bars">
            ${routeBar('Supabase 지식', s.supabaseQueryCount, s.supabaseQueryCount+s.fallbackQueryCount, 'supabase')}
            ${routeBar('Apps Script fallback', s.fallbackQueryCount, s.supabaseQueryCount+s.fallbackQueryCount, 'fallback')}
          </div>
          <p class="ops-ai-note">최근 최대 300건 기준입니다. 실시간 운영 데이터는 의도적으로 구조화 검색 경로를 유지합니다.</p>
        </section>
        <section class="ops-ai-panel">
          <header><div><span>RECENT QUERY</span><h2>최근 질문</h2></div><button type="button" data-ai-tab="logs">전체 보기</button></header>
          <div class="ops-ai-mini-list">${recent.length ? recent.map((item)=>`<div><strong>${escapeHtml(item.question)}</strong><span>${routeLabel(item.search_mode)} · ${escapeHtml(domainLabel(item.parsed_domain))}</span><time>${fmtDate(item.created_at)}</time></div>`).join('') : '<p>질문 로그가 없습니다.</p>'}</div>
        </section>
      </div>
    </div>`;
}
function stat(label,value,meta){return `<article class="ops-ai-stat"><span>${label}</span><strong>${num(value)}</strong><small>${meta}</small></article>`;}
function routeBar(label,value,total,type){ const rate=total?Math.round(value/total*100):0; return `<div class="ops-ai-route"><div><span>${label}</span><b>${num(value)} · ${rate}%</b></div><i><em class="is-${type}" style="width:${rate}%"></em></i></div>`; }

function renderKnowledge(ai, domains) {
  const search=ai.filters.knowledgeSearch.trim().toLowerCase();
  const domain=ai.filters.knowledgeDomain;
  const rows=ai.knowledge.filter((item)=>{
    if(domain!=='all' && item.domain!==domain) return false;
    if(!search) return true;
    return [item.title,item.content,item.category,item.domain,...(item.aliases||[])].join(' ').toLowerCase().includes(search);
  });
  return `
    <section class="ops-ai-panel ops-ai-panel--table">
      <div class="ops-ai-toolbar">
        <label class="ops-ai-search"><span>⌕</span><input type="search" data-ai-filter="knowledgeSearch" value="${attr(ai.filters.knowledgeSearch)}" placeholder="제목 · 내용 · 별칭 검색" /></label>
        <select data-ai-filter="knowledgeDomain"><option value="all">전체 분야</option>${domains.map((v)=>`<option value="${attr(v)}" ${v===domain?'selected':''}>${escapeHtml(domainLabel(v))}</option>`).join('')}</select>
        <span>${rows.length}개 표시</span>
      </div>
      <div class="ops-ai-table-wrap"><table class="ops-ai-table"><thead><tr><th>지식</th><th>분야</th><th>별칭</th><th>상태</th><th>AI 검색 준비</th><th>수정일</th><th></th></tr></thead><tbody>
        ${rows.length ? rows.map(knowledgeRow).join('') : '<tr><td colspan="7" class="ops-ai-empty">조건에 맞는 AI 지식이 없습니다.</td></tr>'}
      </tbody></table></div>
    </section>`;
}
function knowledgeRow(item){return `<tr>
  <td><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(String(item.content||'').slice(0,100))}</span></td>
  <td><strong class="ops-ai-domain-label">${escapeHtml(domainLabel(item.domain))}</strong>${item.category?`<small>${escapeHtml(item.category)}</small>`:''}</td>
  <td><span>${(item.aliases||[]).slice(0,3).map((a)=>`<i>${escapeHtml(a)}</i>`).join('') || '-'}</span></td>
  <td><button type="button" class="ops-ai-switch ${item.active?'is-on':''}" data-ai-toggle="${item.id}" data-active="${item.active?'1':'0'}">${item.active?'활성':'비활성'}</button></td>
  <td><span class="ops-ai-status is-${attr(item.embedding_status)}">${escapeHtml(embeddingStatusLabel(item.embedding_status))}</span></td>
  <td><time>${fmtDate(item.updated_at)}</time></td>
  <td><div class="ops-ai-row-actions"><button type="button" data-ai-edit="${item.id}">수정</button><button type="button" class="is-danger" data-ai-delete="${item.id}">삭제</button></div></td>
</tr>`;}

function renderUnknown(ai){
  const status=ai.filters.unknownStatus;
  const rows=ai.unknown.filter((item)=>status==='all'||item.status===status);
  return `<section class="ops-ai-panel ops-ai-panel--table">
    <div class="ops-ai-toolbar"><div class="ops-ai-segment">${['open','resolved','ignored','all'].map((v)=>`<button type="button" class="${status===v?'is-active':''}" data-ai-unknown-status="${v}">${({open:'미답변',resolved:'해결',ignored:'무시',all:'전체'})[v]}</button>`).join('')}</div><span>${rows.length}건 표시</span></div>
    <div class="ops-ai-table-wrap"><table class="ops-ai-table ops-ai-table--unknown"><thead><tr><th>질문</th><th>분야</th><th>질문 횟수</th><th>최근 질문</th><th>상태</th><th></th></tr></thead><tbody>
    ${rows.length?rows.map(unknownRow).join(''):'<tr><td colspan="6" class="ops-ai-empty">해당 상태의 질문이 없습니다.</td></tr>'}</tbody></table></div>
  </section>`;
}
function unknownRow(item){return `<tr><td><strong>${escapeHtml(item.question)}</strong>${item.admin_note?`<span>${escapeHtml(item.admin_note)}</span>`:''}</td><td><strong class="ops-ai-domain-label">${escapeHtml(domainLabel(item.domain))}</strong></td><td><b class="ops-ai-ask-count ${Number(item.ask_count)>=3?'is-hot':''}">${num(item.ask_count)}회</b></td><td><time>${fmtDate(item.last_asked_at)}</time></td><td><span class="ops-ai-status is-${attr(item.status)}">${escapeHtml(unknownStatusLabel(item.status))}</span></td><td><div class="ops-ai-row-actions">${item.status==='open'?`<button type="button" class="is-primary" data-ai-learn="${item.id}">지식으로 등록</button><button type="button" data-ai-ignore="${item.id}">무시</button>`:`<button type="button" data-ai-reopen="${item.id}">다시 열기</button>`}</div></td></tr>`;}

function renderLogs(ai){
  const search=ai.filters.logSearch.trim().toLowerCase();
  const rows=ai.logs.filter((item)=>!search||[item.question,item.parsed_domain,item.parsed_intent,item.search_mode].join(' ').toLowerCase().includes(search));
  return `<section class="ops-ai-panel ops-ai-panel--table"><div class="ops-ai-toolbar"><label class="ops-ai-search"><span>⌕</span><input type="search" data-ai-filter="logSearch" value="${attr(ai.filters.logSearch)}" placeholder="질문 · domain · 경로 검색" /></label><span>최근 ${rows.length}건 표시</span></div><div class="ops-ai-table-wrap"><table class="ops-ai-table ops-ai-table--logs"><thead><tr><th>질문</th><th>분류</th><th>검색 경로</th><th>결과</th><th>신뢰도</th><th>응답</th><th>시간</th></tr></thead><tbody>${rows.length?rows.map(logRow).join(''):'<tr><td colspan="7" class="ops-ai-empty">질문 로그가 없습니다.</td></tr>'}</tbody></table></div></section>`;
}
function logRow(item){return `<tr><td><strong>${escapeHtml(item.question)}</strong><span>${escapeHtml(item.resolved_query||'')}</span></td><td><strong class="ops-ai-domain-label">${escapeHtml(domainLabel(item.parsed_domain))}</strong><small>${escapeHtml(intentLabel(item.parsed_intent))}</small></td><td><span class="ops-ai-route-pill is-${routeClass(item.search_mode)}">${routeLabel(item.search_mode)}</span></td><td><span class="ops-ai-status is-${attr(item.result_status)}">${escapeHtml(resultStatusLabel(item.result_status))}</span><small>${num(item.match_count)}건</small></td><td>${item.confidence==null?'-':pct(item.confidence)}</td><td>${item.duration_ms==null?'-':`${num(item.duration_ms)}ms`}</td><td><time>${fmtDate(item.created_at)}</time></td></tr>`;}
function routeClass(mode){ return mode==='supabase_knowledge'?'supabase':mode==='apps_script_fallback'?'fallback':'other'; }
function routeLabel(mode){return ({supabase_knowledge:'Supabase 지식',apps_script_fallback:'Apps Script',parser:'Parser',cache:'Cache'})[mode]||escapeHtml(mode||'-');}

function renderEditor(ai){
  const item=ai.editor.knowledgeId?ai.knowledge.find((row)=>Number(row.id)===Number(ai.editor.knowledgeId)):null;
  const unknown=ai.editor.sourceUnknownId?ai.unknown.find((row)=>Number(row.id)===Number(ai.editor.sourceUnknownId)):null;
  const candidates=unknown?existingKnowledgeCandidates(ai, unknown):[];
  const defaults={domain:item?.domain||unknown?.domain||'general',category:item?.category||'',title:item?.title||extractTitle(unknown?.question)||'',content:item?.content||'',source_type:item?.source_type||'manual',source_table:item?.source_table||'',source_key:item?.source_key||'',priority:item?.priority??0,active:item?.active??true,aliases:(item?.aliases||[]).join('\n')};
  return `<div class="ops-ai-modal"><div class="ops-ai-modal__backdrop" data-ai-close></div><section class="ops-ai-editor" role="dialog" aria-modal="true"><header><div><span>${unknown?'LEARN FROM QUESTION':item?'EDIT KNOWLEDGE':'NEW KNOWLEDGE'}</span><h2>${unknown?'미답변을 지식으로 등록':item?'AI 지식 수정':'AI 지식 등록'}</h2>${unknown?`<p>질문: ${escapeHtml(unknown.question)} · ${num(unknown.ask_count)}회</p>`:'<p>저장 즉시 AXE AI 검색 카탈로그에 반영됩니다.</p>'}</div><button type="button" data-ai-close>×</button></header>
    ${unknown&&candidates.length?`<div class="ops-ai-existing-match"><div><span>기존 지식 후보</span><strong>새로 만들지 않고 기존 지식에 연결할 수 있습니다.</strong></div>${candidates.map(({item,score})=>`<button type="button" data-ai-link-existing="${item.id}" data-ai-link-unknown="${unknown.id}"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(domainLabel(item.domain))}${item.category?` · ${escapeHtml(item.category)}`:''} · 일치 ${score}%</small><em>이 지식에 연결</em></button>`).join('')}</div>`:''}
    <form data-ai-form><div class="ops-ai-form-grid">
    <label><span>분야 코드 *</span><input name="domain" value="${attr(defaults.domain)}" required placeholder="processing" /><small>예: 제작 craft · 가공 processing · 요리 cooking</small></label>
    <label><span>분류</span><input name="category" value="${attr(defaults.category)}" placeholder="제작법" /></label>
    <label class="is-wide"><span>제목 *</span><input name="title" value="${attr(defaults.title)}" required maxlength="180" /></label>
    <label class="is-wide"><span>내용 *</span><textarea name="content" rows="8" required placeholder="AI가 그대로 참고할 정확한 내용을 입력하세요.">${escapeHtml(defaults.content)}</textarea></label>
    <label class="is-wide"><span>별칭</span><textarea name="aliases" rows="4" placeholder="한 줄에 하나 또는 쉼표로 구분">${escapeHtml(defaults.aliases)}</textarea><small>예: 상급목재 / 고급목재 / 상급 나무</small></label>
    <label><span>데이터 원본</span><select name="source_type">${['manual','info','fund','member','asset','outlaw','notice','rules','map','community','legacy'].map((v)=>`<option value="${v}" ${v===defaults.source_type?'selected':''}>${escapeHtml(sourceTypeLabel(v))}</option>`).join('')}</select></label>
    <label><span>우선순위</span><input name="priority" type="number" min="-100" max="100" value="${attr(defaults.priority)}" /></label>
    <label><span>원본 테이블</span><input name="source_table" value="${attr(defaults.source_table)}" placeholder="선택 사항" /></label>
    <label><span>원본 고유 키</span><input name="source_key" value="${attr(defaults.source_key)}" placeholder="선택 사항" /></label>
    <label class="ops-ai-check"><input name="active" type="checkbox" ${defaults.active?'checked':''}/><span>활성 지식으로 사용</span></label>
    ${unknown?'<label class="is-wide"><span>관리자 메모</span><input name="admin_note" placeholder="선택" /></label>':''}
  </div>${ai.editor.error?`<div class="ops-ai-editor-error">${escapeHtml(ai.editor.error)}</div>`:''}<footer><button type="button" data-ai-close ${ai.editor.saving?'disabled':''}>취소</button><button type="submit" class="is-primary" ${ai.editor.saving?'disabled':''}>${ai.editor.saving?'저장 중…':'저장'}</button></footer></form></section></div>`;
}
function extractTitle(question){ return String(question||'').replace(/^(!!|!)/,'').replace(/(?:재료는?|뭐야|알려줘|어떻게.*)$/,'').trim().slice(0,120); }

function bind(root, ai, actions){
  root.querySelectorAll('[data-ai-tab]').forEach((b)=>b.addEventListener('click',()=>actions.onTabChange?.(b.dataset.aiTab)));
  root.querySelector('[data-ai-refresh]')?.addEventListener('click',()=>actions.onRefresh?.());
  root.querySelector('[data-ai-create]')?.addEventListener('click',()=>actions.onOpenCreate?.());
  root.querySelectorAll('[data-ai-filter]').forEach((el)=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>actions.onFilterChange?.(el.dataset.aiFilter,el.value)));
  root.querySelectorAll('[data-ai-unknown-status]').forEach((b)=>b.addEventListener('click',()=>actions.onFilterChange?.('unknownStatus',b.dataset.aiUnknownStatus)));
  root.querySelectorAll('[data-ai-edit]').forEach((b)=>b.addEventListener('click',()=>actions.onEditKnowledge?.(b.dataset.aiEdit)));
  root.querySelectorAll('[data-ai-delete]').forEach((b)=>b.addEventListener('click',()=>actions.onDeleteKnowledge?.(b.dataset.aiDelete)));
  root.querySelectorAll('[data-ai-toggle]').forEach((b)=>b.addEventListener('click',()=>actions.onToggleKnowledge?.(b.dataset.aiToggle,b.dataset.active!=='1')));
  root.querySelectorAll('[data-ai-learn]').forEach((b)=>b.addEventListener('click',()=>actions.onOpenUnknown?.(b.dataset.aiLearn)));
  root.querySelectorAll('[data-ai-link-existing]').forEach((b)=>b.addEventListener('click',()=>actions.onLinkUnknownToKnowledge?.(b.dataset.aiLinkUnknown,b.dataset.aiLinkExisting)));
  root.querySelectorAll('[data-ai-ignore]').forEach((b)=>b.addEventListener('click',()=>actions.onIgnoreUnknown?.(b.dataset.aiIgnore)));
  root.querySelectorAll('[data-ai-reopen]').forEach((b)=>b.addEventListener('click',()=>actions.onReopenUnknown?.(b.dataset.aiReopen)));
  root.querySelectorAll('[data-ai-close]').forEach((el)=>el.addEventListener('click',()=>actions.onCloseEditor?.()));
  const form=root.querySelector('[data-ai-form]');
  form?.addEventListener('submit',(event)=>{event.preventDefault();const fd=new FormData(form);actions.onSaveKnowledge?.({domain:String(fd.get('domain')||'').trim(),category:String(fd.get('category')||'').trim(),title:String(fd.get('title')||'').trim(),content:String(fd.get('content')||'').trim(),aliases:String(fd.get('aliases')||''),source_type:String(fd.get('source_type')||'manual'),source_table:String(fd.get('source_table')||'').trim(),source_key:String(fd.get('source_key')||'').trim(),priority:Number(fd.get('priority')||0),active:fd.get('active')==='on',admin_note:String(fd.get('admin_note')||'').trim()});});
}
