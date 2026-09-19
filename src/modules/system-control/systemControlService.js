import { api } from '../../api/api.js';

export async function fetchRuntimeControls() {
  const data = await api.rpc('get_runtime_controls');
  return Array.isArray(data) ? data : [];
}

export async function setRuntimeControl(systemKey, enabled) {
  return api.rpc('set_runtime_control', {
    p_system_key: String(systemKey || '').trim(),
    p_enabled: Boolean(enabled),
  });
}
