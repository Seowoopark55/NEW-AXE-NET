import { api } from '../../api/api.js';

export async function fetchNotices() {
  return api.select('notices_app', {
    columns: 'id,legacy_id,notice_type,title,content,important,writer,published_at,updated_at',
    orderBy: 'published_at',
    ascending: false,
    limit: 500,
  });
}

export async function fetchOperationRules() {
  return api.select('operation_rules_app', {
    columns: 'id,legacy_id,category,title,content,sort_order,writer,updated_at',
    orderBy: 'sort_order',
    ascending: true,
    limit: 500,
  });
}

export async function saveNotice(values) {
  return api.rpc('save_notice', {
    p_id: values.id || null,
    p_notice_type: normalizeNoticeType(values.notice_type),
    p_title: String(values.title || '').trim(),
    p_content: String(values.content || '').trim(),
    p_important: Boolean(values.important),
  });
}

export async function deleteNotice(id) {
  return api.rpc('delete_notice', {
    p_id: Number(id),
  });
}

export async function saveOperationRule(values) {
  return api.rpc('save_operation_rule', {
    p_id: values.id || null,
    p_category: String(values.category || '').trim(),
    p_title: String(values.title || '').trim(),
    p_content: String(values.content || '').trim(),
    p_sort_order: Number(values.sort_order ?? 0),
  });
}

export async function deleteOperationRule(id) {
  return api.rpc('delete_operation_rule', {
    p_id: Number(id),
  });
}

function normalizeNoticeType(value) {
  return String(value || '').trim() === '패치노트' ? '패치노트' : '일반공지';
}
