
const GAS_URL = "https://script.google.com/macros/s/AKfycbzVIEREUxN43gudkQU077sjRbqineT-Jp-gBF_fcYKGAgnHc4BsXAKbaj_kcHLeUfnL/exec";
const PUBLIC_PAGE_URL = "index.html";

let config = {};
const defaultConfig = {
  main_title: '介護タクシー予約',
  logo_subtext: '丁寧・安全な送迎をご提供します',
  admin_tap_count: '5',
  days_per_page: '7',
  max_forward_days: '30',
  same_day_enabled: '0',
  extended_enabled: '1',
  phone_notify_text: '090-6331-4289',
  form_submit_button_text: '予約する',
  form_move_type_label: '移動方法',
  form_move_type_placeholder: '選択してください',
  form_move_type_help_text: '最初に移動方法をお選びください',
  form_move_type_note_wheelchair: '無料車いすで移動します。次に介助内容を選択してください。',
  form_move_type_note_reclining: 'リクライニング車いすで移動します。身体介助が必要になる場合があります。',
  form_move_type_note_stretcher: 'ストレッチャーで移動します。身体介助が必要です。状況により安全確保のため2名体制となる場合があります。',
  form_move_type_note_own: 'ご自身の車いすで移動します。固定可否を確認します。',
  calendar_toggle_extended_text: '他時間予約',
  calendar_toggle_regular_text: '通常時間',
  calendar_legend_available: '◎ 予約可能',
  calendar_legend_unavailable: 'X 予約不可',
  calendar_scroll_guide_text: '上下・左右にスクロールして、他の日付や時間を確認できます。',
  warning_stair_bodyassist_text: '階段介助ご利用時は身体介助が必要です',
  warning_stretcher_bodyassist_text: 'ストレッチャー利用時は身体介助が必要です',
  warning_staff_add_text: '表示価格は1名体制での目安です。状況により安全確保のため2名体制となる場合があります（＋5,000円）',
  warning_wheelchair_damage_text: '車いす固定による傷・すれ等は保証対象外です'
};
let menuMaster = [];
let menuKeyCatalog = [];
let menuGroupCatalog = [];
let autoRuleCatalog = [];
let blockedSlotKeySet = new Set();
let selectedSlot = null;
let calendarDates = [];
let isExtendedView = false;
let __publicBootstrapLoaded = false;

function toast(msg='通信エラー', ms=2600){
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>{ el.style.display='none'; }, ms);
}

let __loadingTimer = null;
function showLoading(show, text='読み込み中...'){
  const ov = document.getElementById('loadingOverlay');
  const tx = document.getElementById('loadingText');
  if (!ov || !tx) return;
  if (show){
    tx.textContent = text;
    clearTimeout(__loadingTimer);
    __loadingTimer = setTimeout(()=>{ ov.style.display='flex'; }, 120);
  } else {
    clearTimeout(__loadingTimer);
    ov.style.display='none';
  }
}

async function withLoading(fn, text){
  showLoading(true, text);
  try {
    return await fn();
  } finally {
    showLoading(false);
  }
}

function _appendCacheBust(url){
  const sep = String(url || '').includes('?') ? '&' : '?';
  return String(url || '') + sep + '_ts=' + Date.now() + '_' + Math.floor(Math.random()*100000);
}

async function _fetchJsonGet(url, timeoutMs=20000){
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(()=>{ try{ if (controller) controller.abort(); }catch(_){ } }, timeoutMs);
  try {
    const res = await fetch(_appendCacheBust(url), {
      method: 'GET',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch(_){
      throw new Error('GET応答の解析に失敗しました');
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function _postJson(action, payload, timeoutMs=25000){
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(()=>{ try{ if (controller) controller.abort(); }catch(_){ } }, timeoutMs);
  try {
    const res = await fetch(_appendCacheBust(GAS_URL), {
      method: 'POST',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, payload: payload || {} })
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch(_){
      throw new Error('POST応答の解析に失敗しました');
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function sleep(ms){ return new Promise(r=>setTimeout(r, ms||0)); }

function ymdLocal(dateObj){
  const d = new Date(dateObj);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function normalizeDateToYMD(value){
  if (!value) return '';
  if (value instanceof Date) return ymdLocal(value);
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return ymdLocal(d);
  return s;
}

function formatDate(dateObj){
  const d = new Date(dateObj);
  const week = ['日','月','火','水','木','金','土'][d.getDay()];
  return `${d.getMonth()+1}/${d.getDate()}(${week})`;
}

function escapeHtml(v){
  return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

function debounce(fn, wait){
  let timer = null;
  return function(...args){
    clearTimeout(timer);
    timer = setTimeout(()=>fn.apply(this,args), wait || 120);
  };
}

function normalizeMenuItem(item){
  const row = Object.assign({}, item || {});
  const key = String(row.key || '').trim();
  let group = String(row.menu_group || '').trim();
  if ((!group || group === 'custom') && /^MOVE_/i.test(key)) group = 'move_type';
  row.menu_group = group || 'custom';
  row.is_visible = !(row.is_visible === false || String(row.is_visible).toUpperCase() === 'FALSE');
  row.sort_order = Number(row.sort_order || 9999);
  row.price = Number(row.price || 0);
  row.auto_apply_group = String(row.auto_apply_group || '').trim();
  row.auto_apply_key = String(row.auto_apply_key || '').trim();
  row.auto_apply_group_2 = String(row.auto_apply_group_2 || '').trim();
  row.auto_apply_key_2 = String(row.auto_apply_key_2 || '').trim();
  return row;
}

function normalizeMenuMaster(items){
  return (Array.isArray(items) ? items : []).map(normalizeMenuItem);
}

function getMenuMap(){
  const map = {};
  (menuMaster || []).forEach(item => {
    map[String(item.key || '')] = item;
  });
  return map;
}

function getMenuByKey(key){
  return getMenuMap()[String(key || '')] || null;
}

function getMenuLabel(key, fallback){
  const item = getMenuByKey(key);
  if (item && item.label) return String(item.label);
  const catalog = (menuKeyCatalog || []).find(x => String(x.key || '') === String(key || ''));
  if (catalog && catalog.default_label) return String(catalog.default_label);
  return fallback || '';
}

function getMenuNote(key, fallback){
  const item = getMenuByKey(key);
  if (item && item.note) return String(item.note);
  return fallback || '';
}

function getMenuPrice(key, fallback){
  const item = getMenuByKey(key);
  if (item && item.price !== undefined && item.price !== null && item.price !== '') return Number(item.price || 0);
  return Number(fallback || 0);
}

function getMenuAutoApplyGroup(key){
  const item = getMenuByKey(key);
  return item ? String(item.auto_apply_group || '').trim() : '';
}

function getMenuAutoApplyKey(key){
  const item = getMenuByKey(key);
  return item ? String(item.auto_apply_key || '').trim() : '';
}

function getMenuAutoApplyGroup2(key){
  const item = getMenuByKey(key);
  return item ? String(item.auto_apply_group_2 || '').trim() : '';
}

function getMenuAutoApplyKey2(key){
  const item = getMenuByKey(key);
  return item ? String(item.auto_apply_key_2 || '').trim() : '';
}

function getAutoRuleByTrigger(targetGroup, triggerKey){
  return (autoRuleCatalog || []).find(rule =>
    String(rule.target || '').trim() === String(targetGroup || '').trim() &&
    String(rule.trigger_key || '').trim() === String(triggerKey || '').trim() &&
    (rule.enabled === true || String(rule.enabled) === '1' || String(rule.enabled).toUpperCase() === 'TRUE')
  ) || null;
}

function getItemsByGroup(group){
  const g = String(group || '').trim();
  return (menuMaster || []).filter(item => {
    const itemGroup = String(item.menu_group || '').trim();
    const key = String(item.key || '').trim();
    const visible = !(item.is_visible === false || String(item.is_visible).toUpperCase() === 'FALSE');
    if (!visible) return false;
    if (itemGroup === g) return true;
    if (g === 'move_type' && itemGroup === 'custom' && /^MOVE_/i.test(key)) return true;
    return false;
  }).sort((a,b)=>Number(a.sort_order||9999)-Number(b.sort_order||9999));
}

function isPublicGroupVisible(groupKey){
  const key = String(groupKey || '').trim();
  if (!key) return true;
  if (['price','custom','auto_set'].includes(key)) return false;
  let map = {};
  try {
    map = typeof config.menu_group_visibility_json === 'string'
      ? (JSON.parse(config.menu_group_visibility_json || '{}') || {})
      : (config.menu_group_visibility_json || {});
  } catch(_){
    map = {};
  }
  const raw = map[key];
  if (raw === undefined || raw === null || raw === '') return true;
  return raw === true || String(raw) === '1' || String(raw).toUpperCase() === 'TRUE';
}

function isPublicGroupRequired(groupKey){
  const key = String(groupKey || '').trim();
  if (!key) return false;
  if (['price','custom','auto_set'].includes(key)) return false;
  let map = {};
  try {
    map = typeof config.menu_group_required_json === 'string'
      ? (JSON.parse(config.menu_group_required_json || '{}') || {})
      : (config.menu_group_required_json || {});
  } catch(_){
    map = {};
  }
  const raw = map[key];
  if (raw === undefined || raw === null || raw === '') return true;
  return raw === true || String(raw) === '1' || String(raw).toUpperCase() === 'TRUE';
}

function makeSlotKey(dateObj, hour, minute){
  return `${ymdLocal(dateObj)}-${Number(hour)}-${Number(minute||0)}`;
}

function isSlotBlockedWithMinute(dateObj, hour, minute){
  return blockedSlotKeySet.has(makeSlotKey(dateObj, hour, minute));
}

function getBlockedRangeBounds(){
  if (typeof getDatesRange === 'function'){
    const dates = getDatesRange();
    if (dates && dates.length){
      const start = ymdLocal(dates[0]);
      const end = ymdLocal(dates[dates.length-1]);
      return { start, end };
    }
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const end = new Date(today); end.setDate(end.getDate()+7);
  return { start: ymdLocal(today), end: ymdLocal(end) };
}

async function ensureBlockedSlotsFresh(force=false){
  if (!force && blockedSlotKeySet && blockedSlotKeySet.size) return;
  const bounds = getBlockedRangeBounds();
  const res = await _fetchJsonGet(`${GAS_URL}?action=getBlockedSlotKeys&startDate=${encodeURIComponent(bounds.start)}&endDate=${encodeURIComponent(bounds.end)}`, 25000);
  if (!res || !res.isOk) throw new Error((res && res.error) || '空き状況取得失敗');
  const keys = (((res.data || {}).slot_keys) || ((res.data || {}).keys) || []);
  blockedSlotKeySet = new Set(Array.isArray(keys) ? keys.map(v=>String(v)) : []);
}

function hydratePublicCacheForFastPaint(){
  try {
    const raw = sessionStorage.getItem('chiba_public_bootstrap_cache');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.menu_master) return false;
    config = Object.assign({}, defaultConfig, data.config || {});
    menuMaster = normalizeMenuMaster(data.menu_master || []);
    menuKeyCatalog = Array.isArray(data.menu_key_catalog) ? data.menu_key_catalog : [];
    menuGroupCatalog = Array.isArray(data.menu_group_catalog) ? data.menu_group_catalog : [];
    autoRuleCatalog = Array.isArray(data.auto_rule_catalog) ? data.auto_rule_catalog : [];
    __publicBootstrapLoaded = true;
    return true;
  } catch(_){
    return false;
  }
}

function persistPublicCache(){
  try {
    sessionStorage.setItem('chiba_public_bootstrap_cache', JSON.stringify({
      config, menu_master: menuMaster, menu_key_catalog: menuKeyCatalog, menu_group_catalog: menuGroupCatalog, auto_rule_catalog: autoRuleCatalog
    }));
  } catch(_){
  }
}

async function refreshAllData(force=false){
  if (!force && __publicBootstrapLoaded && menuMaster.length) {
    await ensureBlockedSlotsFresh(false);
    return;
  }
  const res = await _fetchJsonGet(`${GAS_URL}?action=getPublicBootstrap`, 25000);
  if (!res || !res.isOk) throw new Error((res && res.error) || '公開データ取得失敗');
  const data = res.data || {};
  config = Object.assign({}, defaultConfig, data.config || {});
  menuMaster = normalizeMenuMaster(data.menu_master || []);
  menuKeyCatalog = Array.isArray(data.menu_key_catalog) ? data.menu_key_catalog : [];
  menuGroupCatalog = Array.isArray(data.menu_group_catalog) ? data.menu_group_catalog : [];
  autoRuleCatalog = Array.isArray(data.auto_rule_catalog) ? data.auto_rule_catalog : [];
  __publicBootstrapLoaded = true;
  persistPublicCache();
  await ensureBlockedSlotsFresh(true);
}

const gsRun = async (func, ...args) => {
  if (func === 'api_getPublicBootstrap') {
    return await _fetchJsonGet(`${GAS_URL}?action=getPublicBootstrap`, 25000);
  } else if (func === 'api_getBlockedSlotKeys') {
    const payload = args[0] || {};
    return await _fetchJsonGet(`${GAS_URL}?action=getBlockedSlotKeys&startDate=${encodeURIComponent(payload.startDate||'')}&endDate=${encodeURIComponent(payload.endDate||'')}`, 25000);
  } else if (func === 'api_verifyAdminPassword') {
    return await _postJson('verifyAdminPassword', args[0] || {});
  } else if (func === 'api_getDriveImageDataUrl') {
    return await _fetchJsonGet(`${GAS_URL}?action=getDriveImageDataUrl&fileId=${encodeURIComponent(args[0]||'')}`, 25000);
  } else if (func === 'api_createReservation') {
    return await _postJson('createReservation', args[0] || {}, 30000);
  }
  throw new Error('未対応API: ' + func);
};
