import { supabase, hasSupabaseConfig } from './supabaseClient.js';

function requireSupabase() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error(
      'Supabase 설정이 없습니다. .env에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 입력하세요.',
    );
  }

  return supabase;
}

async function select(table, options = {}) {
  const client = requireSupabase();
  const { columns = '*', orderBy, ascending = true } = options;

  let query = client.from(table).select(columns);

  if (orderBy) {
    query = query.order(orderBy, { ascending });
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
