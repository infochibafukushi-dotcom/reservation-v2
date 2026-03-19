const ADMIN_ICON_FILE_ID = '1a0QB8ei00w_lSfL4PnF_xuEFUC2JP6FW';
const GAS_URL = "https://script.google.com/macros/s/AKfycbwJ0xeMbih09tdp0Ch8zs4SV49o0a-e7pYz7mFBedc0GI994Um140rjXVgCNPNL9pj7/exec";
const ADMIN_PAGE_URL = "admin.html";

function toast(msg='通信エラー', ms=2200){
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> el.style.display='none', ms);
}

let __loadingTimer = null;
function showLoading(show, text='読み込み中...'){
  const ov = document.getElementById('loadingOverlay');
  const tx = document.getElementById('loadingText');
  if (!ov || !tx) return;

  if (show){
    tx.textContent = text;
    clearTimeout(__loadingTimer);
    __loadingTimer = setTimeout(()=>{ ov.style.display = 'flex'; }, 180);
  } else {
    clearTimeout(__loadingTimer);
    ov.style.display = 'none';
  }
}

async function withLoading(fn, text){
  showLoading(true, text);
  try{
    return await fn();
  }finally{
    showLoading(false);
  }
}

function _jsonpCall(url, timeoutMs = 20000){
  return new Promise((resolve, reject)=>{
    const cbName = '__jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    const script = document.createElement('script');
    let done = false;

    function cleanup(){
      try{ delete window[cbName]; }catch(_){}
      if (script && script.parentNode) script.parentNode.removeChild(script);
    }

    const timer = setTimeout(()=>{
      if (done) return;
      done = true;
      cleanup();
      reject(new Error('JSONP timeout'));
    }, timeoutMs);

    window[cbName] = function(data){
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = function(){
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error('JSONP load error'));
    };

    const sep = url.includes('?') ? '&' : '?';
    script.src = url + sep + 'callback=' + encodeURIComponent(cbName);
    document.body.appendChild(script);
  });
}

async function _jsonpCallWithRetry(url, retryCount = 1, timeoutMs = 20000){
  let lastError = null;
  for (let i = 0; i <= retryCount; i++){
    try{
      return await _jsonpCall(url, timeoutMs);
    }catch(err){
      lastError = err;
      if (i < retryCount){
        await sleep(500);
      }
    }
  }
  throw lastError || new Error('JSONP error');
}

async function _postJson(action, payload){
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: action,
      payload: payload || {}
    })
  });

  const text = await res.text();
  let data = null;

  try{
    data = JSON.parse(text);
  }catch(_){
    throw new Error('POST応答の解析に失敗しました');
  }

  return data;
}

// ★ 高速化キャッシュ
let BOOTSTRAP_CACHE = null;

const gsRun = async (func, ...args) => {
  try{
    let data;

    // ★ 高速API（追加）
    if (func === 'api_bootstrap') {
      if (BOOTSTRAP_CACHE) {
        return { isOk:true, data: BOOTSTRAP_CACHE };
      }
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=bootstrap`, 1, 20000);
      BOOTSTRAP_CACHE = data.data;
    }

    // ★ 既存APIを内部的にbootstrap化
    else if (func === 'api_getConfigPublic') {
      const b = await gsRun('api_bootstrap');
      data = { isOk:true, data: b.data.config };
    }
    else if (func === 'api_getMenuMaster') {
      const b = await gsRun('api_bootstrap');
      data = { isOk:true, data: b.data.menu };
    }
    else if (func === 'api_getBlockedSlotKeys') {
      const b = await gsRun('api_bootstrap');
      data = { isOk:true, data:{ slot_keys: b.data.blocks } };
    }

    // ★ 既存そのまま
    else if (func === 'api_getConfig') {
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getConfig`, 1, 20000);
    }
    else if (func === 'api_getPublicBootstrap') {
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getPublicBootstrap`, 1, 20000);
    }
    else if (func === 'api_getInitData') {
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getInitData`, 1, 25000);
    }
    else if (func === 'api_getMenuKeyCatalog') {
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getMenuKeyCatalog`, 1, 20000);
    }
    else if (func === 'api_getMenuGroupCatalog') {
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getMenuGroupCatalog`, 1, 20000);
    }
    else if (func === 'api_getAutoRuleCatalog') {
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getAutoRuleCatalog`, 1, 20000);
    }
    else if (func === 'api_getDriveImageDataUrl') {
      const fileId = args[0];
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getDriveImageDataUrl&fileId=${encodeURIComponent(fileId)}`, 1, 20000);
    }
    else if (func === 'api_createReservation') {
      data = await _postJson('createReservation', args[0]);
    }
    else if (func === 'api_verifyAdminPassword') {
      data = await _postJson('verifyAdminPassword', args[0]);
    }
    else {
      throw new Error(`未対応のAPIです: ${func}`);
    }

    if (data && data.isOk === false) {
      const msg = data.error || data.message || '通信エラー（isOk=false）';
      throw new Error(msg);
    }

    return data;

  }catch(e){
    throw new Error(e?.message || '通信エラー');
  }
};
