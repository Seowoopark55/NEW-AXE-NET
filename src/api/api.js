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
    filters = {},
  } = options;

  let query = client.from(table).select(columns);

  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

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

async function update(table, values, match) {
  const client = requireSupabase();

  let query = client.from(table).update(values);

  for (const [column, value] of Object.entries(match ?? {})) {
    query = query.eq(column, value);
  }

  const { data, error } = await query.select();

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function rpc(functionName, args = {}) {
  const client = requireSupabase();
  const { data, error } = await client.rpc(functionName, args);

  if (error) {
    throw error;
  }

  return data;
}

async function storageUpload(bucket, path, file, options = {}) {
  const client = requireSupabase();
  const { data, error } = await client.storage.from(bucket).upload(path, file, {
    upsert: false,
    ...options,
  });
  if (error) throw error;
  return data;
}

async function storageRemove(bucket, paths) {
  const client = requireSupabase();
  const { data, error } = await client.storage.from(bucket).remove(paths);
  if (error) throw error;
  return data;
}

async function storageSignedUrl(bucket, path, expiresIn = 3600) {
  const client = requireSupabase();
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

export const api = {
  select,
  update,
  rpc,
  storageUpload,
  storageRemove,
  storageSignedUrl,
};
