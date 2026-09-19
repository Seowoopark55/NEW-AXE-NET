import { api } from '../../api/api.js';

export async function fetchCookingOrderSettings() {
  const data = await api.rpc('get_cooking_order_settings');
  return {
    config: data?.config && typeof data.config === 'object' ? data.config : {},
    types: Array.isArray(data?.types) ? data.types : [],
  };
}

export async function saveCookingOrderConfig(values = {}) {
  return api.rpc('save_cooking_order_config', {
    p_schedule_text: String(values.scheduleText || '').trim(),
    p_extra_guide: String(values.extraGuide || '').trim(),
  });
}

export async function saveCookingOrderType(values = {}) {
  const price = Math.max(0, Math.floor(Number(values.pricePerSet || 0)));
  const sortOrder = Math.max(0, Math.floor(Number(values.sortOrder || 0)));
  return api.rpc('save_cooking_order_type', {
    p_type_key: String(values.typeKey || '').trim() || null,
    p_label: String(values.label || '').trim(),
    p_short_label: String(values.shortLabel || '').trim(),
    p_detail: String(values.detail || '').trim(),
    p_price_per_set: price,
    p_sort_order: sortOrder,
    p_enabled: values.enabled !== false,
  });
}

export async function setCookingOrderTypeEnabled(typeKey, enabled) {
  return api.rpc('set_cooking_order_type_enabled', {
    p_type_key: String(typeKey || '').trim(),
    p_enabled: Boolean(enabled),
  });
}
