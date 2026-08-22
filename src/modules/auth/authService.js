import { supabase, hasSupabaseConfig } from '../../api/supabaseClient.js';

function requireSupabase() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase 설정이 없습니다.');
  }

  return supabase;
}

export async function getCurrentSession() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session ?? null;
}

export async function signInWithPassword(email, password) {
  const client = requireSupabase();

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data.session ?? null;
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function fetchAdminSession() {
  const client = requireSupabase();

  const { data, error } = await client
    .from('admin_session')
    .select('user_id,member_key,nickname,role,enabled')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export function onAuthStateChange(callback) {
  const client = requireSupabase();
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session ?? null);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
