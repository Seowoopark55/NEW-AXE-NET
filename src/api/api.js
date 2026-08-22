import { supabase, hasSupabaseConfig } from './supabaseClient.js';

function requireSupabase() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error(
      'Supabase 설정이 없습니다. .env의 URL / PUBLISHABLE KEY를 확인하세요.',
    );
  }

  return supabase;
}

async function select(table, options = {}) {
  const client = requireSupabase();
  const {
    columns = '*',
    orderBy,
    ascending = true,
    limit,
  } = options;

  let query = client.from(table).select(columns);

  if (orderBy) {
    query = query.order(orderBy, { ascending });
  }

  if (Number.isInteger(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export const api = {
  select,
};
