
const MENU_GROUP_FIXED_FIRST = 'price';
const MENU_GROUP_FALLBACK_ORDER = ['price', 'assistance', 'stair', 'equipment', 'round_trip', 'move_type', 'custom'];

function safeJsonParseMenu(text, fallback){
  try{
    const parsed = JSON.parse(String(text || ''));
    return parsed === undefined || parsed === null ? fallback : parsed;
  }catch(_){
    return fallback;
  }
}

function getBaseMenuGroupCatalog(){
  return Array.isArray(getAdminResolvedGroupCatalog()) && getAdminResolvedGroupCatalog().length
    ? getAdminResolvedGroupCatalog()
    : [
        { key: 'price', label: '料金概算（基本料金）' },
        { key: 'assistance', label: '介助内容' },
        { key: 'stair', label: '階段介助' },
        { key: 'equipment', label: '機材レンタル' },
        { key: 'round_trip', label: '往復送迎' },
        { key: 'move_type', label: '移動方法' },
        { key: 'custom', label: 'その他（表示先なし）' }
      ];
}

function getStoredMenuGroupCatalog(){
  const saved = safeJsonParseMenu(adminConfig && adminConfig.menu_group_catalog_json, []);
  return Array.isArray(saved) ? saved : [];
}

function getStoredMenuGroupOrder(){
  const saved = safeJsonParseMenu(adminConfig && adminConfig.menu_group_order_json, []);
  return Array.isArray(saved) ? saved.map(v => String(v || '').trim()).filter(Boolean) : [];
}

function getStoredMenuGroupRequired(){
  const saved = safeJsonParseMenu(adminConfig && adminConfig.menu_group_required_json, {});
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
}

function isMenuGroupRequired(group){
  const req = getStoredMenuGroupRequired();
  const key = String(group || '').trim();
  if (!key || ['price','custom','auto_set'].includes(key)) return false;
  if (req[key] === undefined || req[key] === null || req[key] === ''){
    return getMenuItemsByGroup(key).some(item => !!item.required_flag);
  }
  return req[key] === true || String(req[key]) === '1' || String(req[key]).toUpperCase() === 'TRUE';
}

function setMenuGroupRequired(group, required){
  const key = String(group || '').trim();
  if (!key || ['price','custom','auto_set'].includes(key)) return;
  const req = cloneMenuObject(getStoredMenuGroupRequired());
  req[key] = !!required;
  adminConfig.menu_group_required_json = JSON.stringify(req);
}

function getStoredMenuGroupVisibility(){
  const saved = safeJsonParseMenu(adminConfig && adminConfig.menu_group_visibility_json, {});
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
}

function cloneMenuObject(value){
  return JSON.parse(JSON.stringify(value || {}));
}

function getAllKnownMenuGroups(){
  const map = {};

  getBaseMenuGroupCatalog().forEach(group => {
    const key = String(group && group.key || '').trim();
    if (!key) return;
    map[key] = {
      key: key,
      label: String(group && group.label || key).trim()
    };
  });

  getStoredMenuGroupCatalog().forEach(group => {
    const key = String(group && group.key || '').trim();
    if (!key) return;
    map[key] = {
      key: key,
      label: String(group && group.label || map[key]?.label || key).trim()
    };
  });

  (adminMenuMaster || []).forEach(item => {
    let key = String(item && item.menu_group || '').trim();
    const itemKey = String(item && item.key || '').trim();
    if (key === 'custom' && /^MOVE_/.test(itemKey)) key = 'move_type';
    if (!key) return;
    if (!map[key]){
      map[key] = {
        key: key,
        label: key === 'custom' ? 'その他（表示先なし）' : key
      };
    }
  });

  return Object.keys(map).map(key => map[key]);
}

function getEffectiveMenuGroupOrder(){
  const allGroups = getAllKnownMenuGroups();
  const allKeys = allGroups.map(group => String(group.key || '').trim()).filter(Boolean);
  const savedOrder = getStoredMenuGroupOrder();

  const merged = [];
  const pushUnique = (key) => {
    const value = String(key || '').trim();
    if (!value) return;
    if (!allKeys.includes(value)) return;
    if (merged.includes(value)) return;
    merged.push(value);
  };

  pushUnique(MENU_GROUP_FIXED_FIRST);

  savedOrder.forEach(key => {
    if (String(key || '').trim() === MENU_GROUP_FIXED_FIRST) return;
    pushUnique(key);
  });

  MENU_GROUP_FALLBACK_ORDER.forEach(key => {
    if (String(key || '').trim() === MENU_GROUP_FIXED_FIRST) return;
    pushUnique(key);
  });

  allKeys.forEach(key => {
    if (String(key || '').trim() === MENU_GROUP_FIXED_FIRST) return;
    pushUnique(key);
  });

  return [MENU_GROUP_FIXED_FIRST].concat(merged.filter(key => key !== MENU_GROUP_FIXED_FIRST));
}

function getGroupLabelByKey(groupKey){
  const found = getAllKnownMenuGroups().find(group => String(group.key || '') === String(groupKey || ''));
  return found ? String(found.label || groupKey || '') : String(groupKey || '');
}

function normalizeGroupKey(group){
  const key = String(group || 'custom').trim();
  if (!key) return 'custom';

  const known = getEffectiveMenuGroupOrder();
  if (known.includes(key)) return key;
  return key;
}

function isFixedMenuGroup(group){
  return String(group || '') === MENU_GROUP_FIXED_FIRST;
}

function isPublicMenuGroup(group){
  return !['price', 'custom'].includes(String(group || '').trim());
}

function isMenuGroupVisible(group){
  const visibility = getStoredMenuGroupVisibility();
  const key = String(group || '').trim();
  if (!key) return true;
  if (visibility[key] === undefined || visibility[key] === null || visibility[key] === '') return true;
  if (visibility[key] === true || String(visibility[key]) === '1' || String(visibility[key]).toUpperCase() === 'TRUE') return true;
  return false;
}

function setMenuGroupVisible(group, visible){
  const key = String(group || '').trim();
  if (!key || isFixedMenuGroup(key)) return;

  const visibility = cloneMenuObject(getStoredMenuGroupVisibility());
  visibility[key] = !!visible;
  adminConfig.menu_group_visibility_json = JSON.stringify(visibility);
}

function getMenuGroupDescription(group){
  const key = String(group || '').trim();
  if (key === 'price') return '料金概算の基本項目に使う';
  if (key === 'assistance') return `予約フォームの「${getGroupLabelByKey(key)}」プルダウンに表示`;
  if (key === 'stair') return `予約フォームの「${getGroupLabelByKey(key)}」プルダウンに表示`;
  if (key === 'equipment') return `予約フォームの「${getGroupLabelByKey(key)}」プルダウンに表示`;
  if (key === 'round_trip') return `予約フォームの「${getGroupLabelByKey(key)}」プルダウンに表示`;
  if (key === 'move_type') return `予約フォームの「${getGroupLabelByKey(key)}」プルダウンに表示`;
  if (key === 'custom') return '保存のみ。どのプルダウンにも出せない';
  return `予約フォームの「${getGroupLabelByKey(key)}」プルダウンに表示`;
}

function buildMenuAutoApplyOptions(selectedGroup, selectedKey){
  const groupCatalog = getEffectiveMenuGroupOrder().filter(group => isPublicMenuGroup(group) || String(group)==='auto_set');
  const groupOptions = [
    `<option value="">自動セットなし</option>`
  ].concat(
    groupCatalog.map(group => `<option value="${escapeHtml(group)}" ${String(selectedGroup || '') === String(group) ? 'selected' : ''}>${escapeHtml(getGroupLabelByKey(group))}</option>`)
  ).join('');

  let keyCandidates = [];
  if (selectedGroup) {
    keyCandidates = (adminMenuMaster || []).filter(item => String(item.menu_group || '') === String(selectedGroup || ''));
  }

  const keyOptions = [`<option value="">選択してください</option>`].concat(
    keyCandidates.map(item => `<option value="${escapeHtml(String(item.key || ''))}" ${String(item.key || '') === String(selectedKey || '') ? 'selected' : ''}>${escapeHtml(String(item.label || item.key || ''))}</option>`)
  ).join('');

  return { groupOptions, keyOptions };
}

function makeMenuInternalKey(row, index){
  const existing = String(row && row.key || '').trim();
  if (existing) return existing;

  const group = String(row && row.menu_group || 'custom').trim().toUpperCase();
  const label = String(row && row.label || 'ITEM').trim()
    .replace(/[　\s]+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'ITEM';

  return `CUSTOM_${group}_${label}_${index + 1}`;
}

function normalizeRequiredFlag(value){
  if (value === true || String(value).toUpperCase() === 'TRUE' || String(value) === '1') return true;
  return false;
}

function adminNormalizeMenuRows(){
  return (adminMenuMaster || []).map((item, idx) => {
    const clone = cloneMenuObject(item || {});
    clone.menu_group = normalizeGroupKey((String(clone.menu_group || '') === 'custom' && /^MOVE_/.test(String(clone.key || ''))) ? 'move_type' : clone.menu_group);
    clone.key = makeMenuInternalKey(clone, idx);
    clone.key_jp = String(clone.key_jp || '');
    clone.label = String(clone.label || '');
    clone.price = Number(clone.price || 0);
    clone.note = String(clone.note || '');
    clone.sort_order = Number(clone.sort_order || ((idx + 1) * 10));
    clone.is_visible = !(clone.is_visible === false || String(clone.is_visible).toUpperCase() === 'FALSE');
    clone.required_flag = normalizeRequiredFlag(clone.required_flag);
    clone.auto_apply_group = String(clone.auto_apply_group || '');
    clone.auto_apply_key = String(clone.auto_apply_key || '');
    clone.auto_apply_group_2 = String(clone.auto_apply_group_2 || '');
    clone.auto_apply_key_2 = String(clone.auto_apply_key_2 || '');
    return clone;
  });
}

function getMenuItemsByGroup(group){
  return (adminMenuMaster || [])
    .filter(item => { const itemKey = String(item.key || ''); let itemGroup = String(item.menu_group || ''); if (itemGroup === 'custom' && /^MOVE_/.test(itemKey)) itemGroup = 'move_type'; return String(itemGroup) === String(group || ''); })
    .sort((a, b) => Number(a.sort_order || 9999) - Number(b.sort_order || 9999));
}

function resequenceMenuSortOrderByGroup(){
  getEffectiveMenuGroupOrder().forEach(group => {
    const items = getMenuItemsByGroup(group);
    items.forEach((item, idx) => {
      item.sort_order = (idx + 1) * 10;
    });
  });
}

function getMenuGroupIndex(group){
  return getEffectiveMenuGroupOrder().findIndex(key => String(key) === String(group || ''));
}

function moveMenuGroup(group, direction){
  const target = String(group || '').trim();
  if (!target || isFixedMenuGroup(target)) return;

  const order = getEffectiveMenuGroupOrder().slice();
  const currentIndex = order.findIndex(key => String(key) === target);
  if (currentIndex < 0) return;

  let swapIndex = currentIndex;
  if (direction === 'up') swapIndex = currentIndex - 1;
  if (direction === 'down') swapIndex = currentIndex + 1;

  if (swapIndex <= 0) return;
  if (swapIndex >= order.length) return;

  const swapKey = order[swapIndex];
  if (!swapKey || isFixedMenuGroup(swapKey)) return;

  order[currentIndex] = swapKey;
  order[swapIndex] = target;
  adminConfig.menu_group_order_json = JSON.stringify(order);
}

function ensureMenuOpenStateStore(){
  if (!window.__menuGroupOpenState) window.__menuGroupOpenState = {};
  return window.__menuGroupOpenState;
}

function setMenuGroupOpenState(group, isOpen){
  const state = ensureMenuOpenStateStore();
  state[String(group || '')] = !!isOpen;
}

function getMenuGroupOpenState(group){
  const state = ensureMenuOpenStateStore();
  if (state[String(group || '')] === undefined) return false;
  return !!state[String(group || '')];
}

function renderMenuItemCard(item, groupItems){
  const autoOptions = buildMenuAutoApplyOptions(item.auto_apply_group || '', item.auto_apply_key || '');
  const groupIndex = groupItems.findIndex(x => String(x.key || '') === String(item.key || ''));

  return `
    <div class="menu-item-card" data-menu-key="${escapeHtml(item.key || '')}">
      <div class="menu-item-top">
        <div class="menu-move-box">
          <button class="move-btn" data-action="menuUp" data-key="${escapeHtml(item.key || '')}" type="button" ${groupIndex <= 0 ? 'disabled' : ''}>↑</button>
          <button class="move-btn" data-action="menuDown" data-key="${escapeHtml(item.key || '')}" type="button" ${groupIndex >= groupItems.length - 1 ? 'disabled' : ''}>↓</button>
        </div>

        <div class="flex-1">
          <div class="menu-item-main">
            <div class="form-group">
              <label class="form-label">項目名</label>
              <input type="text" value="${escapeHtml(item.label || '')}" data-field="label" data-key="${escapeHtml(item.key || '')}" placeholder="例: テスト">
            </div>

            <div class="form-group">
              <label class="form-label">価格</label>
              <input type="number" value="${Number(item.price || 0)}" data-field="price" data-key="${escapeHtml(item.key || '')}" placeholder="0">
            </div>

            <div class="form-group">
              <label class="form-label">表示切替</label>
              <select data-field="is_visible" data-key="${escapeHtml(item.key || '')}">
                <option value="1" ${item.is_visible ? 'selected' : ''}>表示</option>
                <option value="0" ${!item.is_visible ? 'selected' : ''}>非表示</option>
              </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">自動セット先2</label>
                    <select data-field="auto_apply_group_2" data-key="${escapeHtml(item.key || '')}">${buildMenuAutoApplyOptions(item.auto_apply_group_2 || '', item.auto_apply_key_2 || '').groupOptions}</select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">自動セット項目2</label>
                    <select data-field="auto_apply_key_2" data-key="${escapeHtml(item.key || '')}">${buildMenuAutoApplyOptions(item.auto_apply_group_2 || '', item.auto_apply_key_2 || '').keyOptions}</select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="menu-item-bottom">
            <div class="form-group">
              <label class="form-label">説明</label>
              <input type="text" value="${escapeHtml(item.note || '')}" data-field="note" data-key="${escapeHtml(item.key || '')}" placeholder="補足説明">
            </div>

            <div class="form-group md:col-span-4">
              <button class="cute-btn w-full text-left px-4 py-3" type="button" data-action="toggleAutoBox" data-key="${escapeHtml(item.key || '')}">自動セット設定${(item.auto_apply_group||item.auto_apply_key||item.auto_apply_group_2||item.auto_apply_key_2)?'（設定あり）':'（未設定）'}</button>
              <div class="mt-3 ${(item.auto_apply_group||item.auto_apply_key||item.auto_apply_group_2||item.auto_apply_key_2)?'':'hidden'}" id="autoBox_${escapeHtml(item.key || '')}">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div class="form-group">
                    <label class="form-label">自動セット先1</label>
              <select data-field="auto_apply_group" data-key="${escapeHtml(item.key || '')}">
                ${autoOptions.groupOptions}
              </select>
                  </div>

                  <div class="form-group">
                    <label class="form-label">自動セット項目1</label>
              <select data-field="auto_apply_key" data-key="${escapeHtml(item.key || '')}">
                ${autoOptions.keyOptions}
              </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">自動セット先2</label>
                    <select data-field="auto_apply_group_2" data-key="${escapeHtml(item.key || '')}">${buildMenuAutoApplyOptions(item.auto_apply_group_2 || '', item.auto_apply_key_2 || '').groupOptions}</select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">自動セット項目2</label>
                    <select data-field="auto_apply_key_2" data-key="${escapeHtml(item.key || '')}">${buildMenuAutoApplyOptions(item.auto_apply_group_2 || '', item.auto_apply_key_2 || '').keyOptions}</select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="menu-meta">
            並び順: <strong>${Number(item.sort_order || 0)}</strong>
            ／ 日本語キー: <strong>${escapeHtml(item.key_jp || item.label || '未設定')}</strong>
            ／ 保存IDは内部で自動管理します
          </div>

          <div class="menu-inline-actions">
            <button class="cute-btn px-4 py-2 menu-remove-btn" data-action="menuRemove" data-key="${escapeHtml(item.key || '')}" type="button">削除</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMenuGroupCard(group){
  const items = getMenuItemsByGroup(group);
  const open = getMenuGroupOpenState(group);
  const visible = isFixedMenuGroup(group) ? true : isMenuGroupVisible(group);
  const groupIndex = getMenuGroupIndex(group);
  const order = getEffectiveMenuGroupOrder();

  return `
    <div class="menu-group-card" data-menu-group="${escapeHtml(group)}">
      <div class="menu-group-card-header" data-action="toggleMenuGroup" data-group="${escapeHtml(group)}">
        <div>
          <div class="menu-group-card-title">${escapeHtml(getGroupLabelByKey(group))}</div>
          <div class="menu-group-card-sub">${escapeHtml(getMenuGroupDescription(group))}</div>
        </div>

        <div class="flex items-center gap-2">
          <button class="cute-btn px-3 py-2 ${visible ? 'text-emerald-600' : 'text-slate-500'}" data-action="toggleGroupVisibility" data-group="${escapeHtml(group)}" type="button" ${isFixedMenuGroup(group) ? 'disabled' : ''}>
            ${isFixedMenuGroup(group) ? '固定表示' : (visible ? '公開表示' : '非表示')}
          </button>
          <button class="move-btn" data-action="groupUp" data-group="${escapeHtml(group)}" type="button" ${isFixedMenuGroup(group) || groupIndex <= 1 ? 'disabled' : ''}>↑</button>
          <button class="move-btn" data-action="groupDown" data-group="${escapeHtml(group)}" type="button" ${isFixedMenuGroup(group) || groupIndex < 1 || groupIndex >= order.length - 1 ? 'disabled' : ''}>↓</button>
          <select class="cute-btn px-2 py-2" data-action="groupRequired" data-group="${escapeHtml(group)}" onclick="event.stopPropagation()">
            <option value="1" ${isMenuGroupRequired(group) ? 'selected' : ''}>必須</option>
            <option value="0" ${!isMenuGroupRequired(group) ? 'selected' : ''}>任意</option>
          </select>
          <button class="move-btn" data-action="menuAddInGroup" data-group="${escapeHtml(group)}" type="button">＋</button>
          ${(!isFixedMenuGroup(group) && getMenuItemsByGroup(group).length === 0) ? `<button class="move-btn" data-action="groupDelete" data-group="${escapeHtml(group)}" type="button">🗑</button>` : ''}
          <div class="menu-group-card-toggle" data-menu-group-toggle="${escapeHtml(group)}">${open ? '−' : '＋'}</div>
        </div>
      </div>

      <div class="menu-group-card-body ${open ? '' : 'collapsed'}" id="menuGroupBody_${escapeHtml(group)}">
        <div>
          ${items.length ? items.map(item => renderMenuItemCard(item, items)).join('') : `
            <div class="text-sm text-slate-500 font-bold py-3">まだ項目がありません</div>
          `}
        </div>

        <div class="menu-add-row">
          <button class="cute-btn px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700" data-action="menuAddInGroup" data-group="${escapeHtml(group)}" type="button">
            このグループに追加
          </button>
        </div>
      </div>
    </div>
  `;
}

function ensureMenuToolbar(){
  const list = document.getElementById('menuAdminList');
  if (!list || !list.parentNode) return;

  let toolbar = document.getElementById('menuGroupToolbar');
  if (!toolbar){
    toolbar = document.createElement('div');
    toolbar.id = 'menuGroupToolbar';
    toolbar.className = 'mb-4 flex justify-end';
    toolbar.innerHTML = `
      <button id="addMenuGroupBtn" class="cute-btn px-5 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700" type="button">
        プルダウングループを追加
      </button>
    `;
    list.parentNode.insertBefore(toolbar, list);
    const addBtn = document.getElementById('addMenuGroupBtn');
    if (addBtn && !addBtn.dataset.bound){
      addBtn.dataset.bound = '1';
      addBtn.addEventListener('click', promptAddMenuGroup);
    }
  }
}

function renderMenuAdminList(){
  const wrap = document.getElementById('menuAdminList');
  if (!wrap) return;

  ensureMenuToolbar();

  adminMenuMaster = adminNormalizeMenuRows();
  resequenceMenuSortOrderByGroup();

  wrap.innerHTML = getEffectiveMenuGroupOrder().map(group => renderMenuGroupCard(group)).join('');
}

function addMenuItemToGroup(group){
  const nextIndex = adminMenuMaster.length;
  adminMenuMaster.push({
    key: '',
    key_jp: '',
    label: '',
    price: 0,
    note: '',
    is_visible: true,
    sort_order: 9999,
    menu_group: normalizeGroupKey(group),
    required_flag: false,
    auto_apply_group: '',
    auto_apply_key: ''
  });

  adminMenuMaster = adminNormalizeMenuRows();
  adminMenuMaster[adminMenuMaster.length - 1].key = makeMenuInternalKey(adminMenuMaster[adminMenuMaster.length - 1], nextIndex);
  resequenceMenuSortOrderByGroup();
  setMenuGroupOpenState(group, true);
  renderMenuAdminList();
}

function findMenuIndexByKey(key){
  return adminMenuMaster.findIndex(item => String(item.key || '') === String(key || ''));
}

function moveMenuItemWithinGroup(key, direction){
  const idx = findMenuIndexByKey(key);
  if (idx < 0) return;

  const item = adminMenuMaster[idx];
  const group = String(item.menu_group || 'custom');
  const groupItems = getMenuItemsByGroup(group);
  const pos = groupItems.findIndex(x => String(x.key || '') === String(key || ''));
  if (pos < 0) return;

  if (direction === 'up' && pos > 0){
    const otherKey = groupItems[pos - 1].key;
    const otherIdx = findMenuIndexByKey(otherKey);
    const tmp = adminMenuMaster[idx];
    adminMenuMaster[idx] = adminMenuMaster[otherIdx];
    adminMenuMaster[otherIdx] = tmp;
  }

  if (direction === 'down' && pos < groupItems.length - 1){
    const otherKey = groupItems[pos + 1].key;
    const otherIdx = findMenuIndexByKey(otherKey);
    const tmp = adminMenuMaster[idx];
    adminMenuMaster[idx] = adminMenuMaster[otherIdx];
    adminMenuMaster[otherIdx] = tmp;
  }

  resequenceMenuSortOrderByGroup();
  setMenuGroupOpenState(group, true);
  renderMenuAdminList();
}

function toggleMenuGroup(group){
  const body = document.getElementById(`menuGroupBody_${group}`);
  const toggle = document.querySelector(`[data-menu-group-toggle="${group}"]`);
  if (!body || !toggle) return;

  const collapsed = body.classList.toggle('collapsed');
  setMenuGroupOpenState(group, !collapsed);
  toggle.textContent = collapsed ? '＋' : '−';
}

function slugifyMenuGroupLabel(label){
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[　\s]+/g, '_')
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9fafー]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function makeMenuGroupKeyFromLabel(label){
  const slug = slugifyMenuGroupLabel(label);
  if (!slug) return '';

  const ascii = slug.replace(/[^\x00-\x7F]/g, '');
  const base = ascii || `group_${Date.now()}`;
  let key = base;
  let count = 2;
  const used = getAllKnownMenuGroups().map(group => String(group.key || ''));
  while (used.includes(key)){
    key = `${base}_${count}`;
    count += 1;
  }
  return key;
}

function promptAddMenuGroup(){
  const label = window.prompt('新しいプルダウングループ名を入力してください', '');
  if (label === null) return;

  const trimmed = String(label || '').trim();
  if (!trimmed){
    toast('グループ名を入力してください');
    return;
  }

  const key = makeMenuGroupKeyFromLabel(trimmed);
  if (!key){
    toast('グループキーの作成に失敗しました');
    return;
  }

  const catalog = getStoredMenuGroupCatalog().slice();
  catalog.push({
    key: key,
    label: trimmed
  });
  adminConfig.menu_group_catalog_json = JSON.stringify(catalog);

  const order = getEffectiveMenuGroupOrder().filter(group => group !== key);
  order.push(key);
  adminConfig.menu_group_order_json = JSON.stringify(order);

  const visibility = cloneMenuObject(getStoredMenuGroupVisibility());
  visibility[key] = true;
  adminConfig.menu_group_visibility_json = JSON.stringify(visibility);

  adminMenuGroupCatalog = getAdminResolvedGroupCatalog();
  setMenuGroupOpenState(key, true);
  renderMenuAdminList();
}

function bindMenuEvents(){
  const wrap = document.getElementById('menuAdminList');
  if (!wrap || wrap.dataset.boundMenuEvents === '1') return;
  wrap.dataset.boundMenuEvents = '1';

  wrap.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = String(btn.dataset.action || '');
    const key = String(btn.dataset.key || '');
    const group = String(btn.dataset.group || '');

    if (action === 'toggleMenuGroup'){
      toggleMenuGroup(group);
      return;
    }

    if (action === 'menuAddInGroup'){
      addMenuItemToGroup(group);
      return;
    }

    if (action === 'groupUp'){
      moveMenuGroup(group, 'up');
      renderMenuAdminList();
      return;
    }

    if (action === 'groupDown'){
      moveMenuGroup(group, 'down');
      renderMenuAdminList();
      return;
    }

    if (action === 'toggleAutoBox'){ const box=document.getElementById(`autoBox_${key}`); if(box) box.classList.toggle('hidden'); return; }

    if (action === 'groupDelete'){
      if (getMenuItemsByGroup(group).length > 0) return;
      if (!window.confirm('空のグループを削除しますか？')) return;
      const catalog=getStoredMenuGroupCatalog().filter(g=>String(g.key)!==String(group));
      adminConfig.menu_group_catalog_json = JSON.stringify(catalog);
      const order=getStoredMenuGroupOrder().filter(g=>String(g)!==String(group));
      adminConfig.menu_group_order_json = JSON.stringify(order);
      const visibility=cloneMenuObject(getStoredMenuGroupVisibility()); delete visibility[group]; adminConfig.menu_group_visibility_json = JSON.stringify(visibility);
      const req=cloneMenuObject(getStoredMenuGroupRequired()); delete req[group]; adminConfig.menu_group_required_json = JSON.stringify(req);
      renderMenuAdminList();
      return;
    }

    if (action === 'toggleGroupVisibility'){
      if (!isFixedMenuGroup(group)){
        setMenuGroupVisible(group, !isMenuGroupVisible(group));
        renderMenuAdminList();
      }
      return;
    }

    if (action === 'menuUp'){
      moveMenuItemWithinGroup(key, 'up');
      return;
    }

    if (action === 'menuDown'){
      moveMenuItemWithinGroup(key, 'down');
      return;
    }

    if (action === 'menuRemove'){
      const idx = findMenuIndexByKey(key);
      if (idx >= 0){
        const row = adminMenuMaster[idx];
        adminMenuMaster.splice(idx, 1);
        resequenceMenuSortOrderByGroup();
        setMenuGroupOpenState(row && row.menu_group || '', true);
        renderMenuAdminList();
      }
    }
  });

  wrap.addEventListener('input', (e)=>{
    const el = e.target;
    const key = String(el.dataset.key || '');
    const field = String(el.dataset.field || '');
    const idx = findMenuIndexByKey(key);
    if (idx < 0 || !field) return;

    if (field === 'price'){
      adminMenuMaster[idx][field] = Number(el.value || 0);
    } else {
      adminMenuMaster[idx][field] = el.value;
    }

    if (field === 'label'){
      const currentKey = String(adminMenuMaster[idx].key || '');
      if (!currentKey || currentKey.startsWith('CUSTOM_')){
        adminMenuMaster[idx].key = makeMenuInternalKey(adminMenuMaster[idx], idx);
      }
    }
  });

  wrap.addEventListener('change', (e)=>{
    const action = String(e.target?.dataset?.action || '');
    const group = String(e.target?.dataset?.group || '');
    if (action === 'groupRequired'){ setMenuGroupRequired(group, String(e.target.value)==='1'); return; }
    const el = e.target;
    const key = String(el.dataset.key || '');
    const field = String(el.dataset.field || '');
    const idx = findMenuIndexByKey(key);
    if (idx < 0 || !field) return;

    if (field === 'is_visible'){
      adminMenuMaster[idx][field] = String(el.value) === '1';
    } else if (field === 'required_flag'){
      adminMenuMaster[idx][field] = String(el.value) === '1';
    } else {
      adminMenuMaster[idx][field] = el.value;
    }

    if (field === 'auto_apply_group'){ adminMenuMaster[idx].auto_apply_key = ''; renderMenuAdminList(); }
    if (field === 'auto_apply_group_2'){ adminMenuMaster[idx].auto_apply_key_2 = ''; renderMenuAdminList(); }
  });
}

function buildSaveMenuPayload(){
  resequenceMenuSortOrderByGroup();

  return adminMenuMaster.map((item, idx) => {
    const label = String(item.label || '').trim();
    const group = String(item.menu_group || 'custom').trim() || 'custom';
    const key = String(item.key || '').trim() || makeMenuInternalKey(item, idx);

    let keyJp = String(item.key_jp || '').trim();
    if (!keyJp){
      const catalog = adminFindCatalogByKey(key);
      keyJp = catalog ? String(catalog.key_jp || '') : label;
    }

    return {
      key: key,
      key_jp: keyJp,
      label: label,
      price: Number(item.price || 0),
      note: String(item.note || '').trim(),
      is_visible: !(item.is_visible === false || String(item.is_visible).toUpperCase() === 'FALSE'),
      sort_order: Number(item.sort_order || ((idx + 1) * 10)),
      menu_group: group,
      required_flag: !!item.required_flag,
      auto_apply_group: String(item.auto_apply_group || '').trim(),
      auto_apply_key: String(item.auto_apply_key || '').trim(),
      auto_apply_group_2: String(item.auto_apply_group_2 || '').trim(),
      auto_apply_key_2: String(item.auto_apply_key_2 || '').trim()
    };
  }).filter(item => String(item.label || '').trim());
}

function buildMenuGroupConfigPayload(){
  const catalog = getAllKnownMenuGroups().map(group => ({
    key: String(group.key || '').trim(),
    label: String(group.label || group.key || '').trim()
  })).filter(group => !!group.key);

  const visibility = cloneMenuObject(getStoredMenuGroupVisibility());
  const order = getEffectiveMenuGroupOrder().slice();

  return {
    menu_group_catalog_json: JSON.stringify(catalog),
    menu_group_visibility_json: JSON.stringify(visibility),
    menu_group_order_json: JSON.stringify(order),
    menu_group_required_json: JSON.stringify(getStoredMenuGroupRequired())
  };
}
