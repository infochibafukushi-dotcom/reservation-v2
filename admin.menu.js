function getBuiltinMenuGroupOrder(){
  return ['price', 'assistance', 'stair', 'equipment', 'round_trip', 'move_type', 'custom'];
}

function getOrderedMenuGroups(){
  const catalog = Array.isArray(adminMenuGroupCatalog) && adminMenuGroupCatalog.length
    ? adminMenuGroupCatalog.slice()
    : getBuiltinMenuGroupOrder().map((key, idx)=>({ key:key, label:getAdminGroupLabel(key), description:'', is_visible:true, sort_order:(idx+1)*100, is_custom:false }));

  return catalog.sort((a, b) => {
    const ao = Number(a && a.sort_order || 9999);
    const bo = Number(b && b.sort_order || 9999);
    if (ao !== bo) return ao - bo;
    return String(a && a.key || '').localeCompare(String(b && b.key || ''));
  });
}

function getMenuGroupOrder(){
  return getOrderedMenuGroups().map(group => String(group.key || '').trim()).filter(Boolean);
}

function getMenuGroupMap(){
  const map = {};
  getOrderedMenuGroups().forEach(group => {
    const key = String(group && group.key || '').trim();
    if (!key) return;
    map[key] = JSON.parse(JSON.stringify(group));
  });
  return map;
}

function findMenuGroupByKey(groupKey){
  return getOrderedMenuGroups().find(group => String(group && group.key || '') === String(groupKey || '')) || null;
}

function buildMenuAutoApplyOptions(selectedGroup, selectedKey){
  const targetGroups = getOrderedMenuGroups().filter(group => {
    const key = String(group && group.key || '');
    if (!key) return false;
    if (key === 'price' || key === 'custom') return false;
    return true;
  });

  const groupOptions = [
    `<option value="">自動セットなし</option>`
  ].concat(targetGroups.map(group => {
    const key = String(group.key || '');
    const label = String(group.label || key || '');
    return `<option value="${escapeHtml(key)}" ${selectedGroup === key ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  })).join('');

  let keyCandidates = [];
  if (selectedGroup) {
    keyCandidates = (adminMenuMaster || []).filter(item => String(item.menu_group || '') === String(selectedGroup || ''));
  }

  const keyOptions = [`<option value="">選択してください</option>`].concat(
    keyCandidates.map(item => `<option value="${escapeHtml(String(item.key || ''))}" ${String(item.key || '') === String(selectedKey || '') ? 'selected' : ''}>${escapeHtml(String(item.label || item.key || ''))}</option>`)
  ).join('');

  return { groupOptions, keyOptions };
}

function buildMenuGroupInternalKey(label){
  const base = String(label || '').trim()
    .replace(/[　\s]+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'group';

  let key = base;
  let seq = 2;
  const exists = new Set(getOrderedMenuGroups().map(group => String(group.key || '')));
  while (exists.has(key)) {
    key = `${base}_${seq}`;
    seq++;
  }
  return key;
}

function makeMenuInternalKey(row, index){
  const existing = String(row.key || '').trim();
  if (existing) return existing;

  const group = String(row.menu_group || 'custom').trim().toUpperCase();
  const label = String(row.label || 'ITEM').trim()
    .replace(/[　\s]+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'ITEM';

  return `CUSTOM_${group}_${label}_${index + 1}`;
}

function normalizeGroupKey(group){
  const g = String(group || 'custom').trim();
  return getMenuGroupOrder().includes(g) ? g : 'custom';
}

function normalizeRequiredFlag(value){
  if (value === true || String(value).toUpperCase() === 'TRUE' || String(value) === '1') return true;
  return false;
}

function adminNormalizeMenuRows(){
  return (adminMenuMaster || []).map((item, idx) => {
    const clone = JSON.parse(JSON.stringify(item || {}));
    clone.menu_group = normalizeGroupKey(clone.menu_group);
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
    return clone;
  });
}

function getMenuItemsByGroup(group){
  return (adminMenuMaster || [])
    .filter(item => String(item.menu_group || '') === String(group || ''))
    .sort((a, b) => Number(a.sort_order || 9999) - Number(b.sort_order || 9999));
}

function resequenceMenuSortOrderByGroup(){
  getMenuGroupOrder().forEach(group => {
    const items = getMenuItemsByGroup(group);
    items.forEach((item, idx) => {
      item.sort_order = (idx + 1) * 10;
    });
  });
}

function getGroupDescription(group){
  const hit = findMenuGroupByKey(group);
  if (hit && String(hit.description || '').trim()) return String(hit.description || '').trim();
  if (group === 'price') return '料金概算の基本項目';
  if (group === 'assistance') return '予約フォームの「介助内容」';
  if (group === 'stair') return '予約フォームの「階段介助」';
  if (group === 'equipment') return '予約フォームの「機材レンタル」';
  if (group === 'round_trip') return '予約フォームの「往復送迎」';
  if (group === 'move_type') return '予約フォームの「移動方法」';
  return '予約フォームに追加できるプルダウン';
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
              <label class="form-label">必須 / 任意</label>
              <select data-field="required_flag" data-key="${escapeHtml(item.key || '')}">
                <option value="1" ${item.required_flag ? 'selected' : ''}>必須</option>
                <option value="0" ${!item.required_flag ? 'selected' : ''}>任意</option>
              </select>
            </div>
          </div>

          <div class="menu-item-bottom">
            <div class="form-group">
              <label class="form-label">説明</label>
              <input type="text" value="${escapeHtml(item.note || '')}" data-field="note" data-key="${escapeHtml(item.key || '')}" placeholder="補足説明">
            </div>

            <div class="form-group">
              <label class="form-label">自動セット先</label>
              <select data-field="auto_apply_group" data-key="${escapeHtml(item.key || '')}">
                ${autoOptions.groupOptions}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">自動セット項目</label>
              <select data-field="auto_apply_key" data-key="${escapeHtml(item.key || '')}">
                ${autoOptions.keyOptions}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">現在グループ</label>
              <input type="text" value="${escapeHtml(getAdminGroupLabel(item.menu_group || 'custom'))}" disabled>
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
  const groupKey = String(group && group.key || '');
  const items = getMenuItemsByGroup(groupKey);
  const isVisible = !(group && (group.is_visible === false || String(group.is_visible).toUpperCase() === 'FALSE'));
  const isCustom = !!(group && (group.is_custom === true || String(group.is_custom).toUpperCase() === 'TRUE'));

  return `
    <div class="menu-group-card" data-menu-group="${escapeHtml(groupKey)}">
      <div class="menu-group-card-header" data-action="toggleMenuGroup" data-group="${escapeHtml(groupKey)}">
        <div>
          <div class="menu-group-card-title">${escapeHtml(String(group.label || groupKey || ''))}</div>
          <div class="menu-group-card-sub">${escapeHtml(getGroupDescription(groupKey))}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="text-xs font-bold ${isVisible ? 'text-emerald-600' : 'text-slate-400'}">${isVisible ? '公開表示' : '非表示'}</span>
          <div class="menu-group-card-toggle" data-menu-group-toggle="${escapeHtml(groupKey)}">＋</div>
        </div>
      </div>

      <div class="menu-group-card-body collapsed" id="menuGroupBody_${escapeHtml(groupKey)}">
        <div class="menu-item-card" style="margin-bottom:16px;background:${isVisible ? '#f8fafc' : '#f1f5f9'};">
          <div class="menu-item-main">
            <div class="form-group">
              <label class="form-label">グループ名</label>
              <input type="text" value="${escapeHtml(String(group.label || groupKey || ''))}" data-group-field="label" data-group-key="${escapeHtml(groupKey)}" ${isCustom ? '' : 'disabled'}>
            </div>
            <div class="form-group">
              <label class="form-label">表示切替</label>
              <select data-group-field="is_visible" data-group-key="${escapeHtml(groupKey)}">
                <option value="1" ${isVisible ? 'selected' : ''}>表示</option>
                <option value="0" ${!isVisible ? 'selected' : ''}>非表示</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">内部キー</label>
              <input type="text" value="${escapeHtml(groupKey)}" disabled>
            </div>
            <div class="form-group">
              <label class="form-label">グループ種別</label>
              <input type="text" value="${isCustom ? '追加グループ' : '標準グループ'}" disabled>
            </div>
          </div>
          <div class="menu-item-bottom">
            <div class="form-group" style="grid-column:1 / -1;">
              <label class="form-label">説明</label>
              <input type="text" value="${escapeHtml(String(group.description || ''))}" data-group-field="description" data-group-key="${escapeHtml(groupKey)}" ${isCustom ? '' : 'disabled'} placeholder="公開側フォームに表示する補足文">
            </div>
          </div>
        </div>

        <div>
          ${items.length ? items.map(item => renderMenuItemCard(item, items)).join('') : `
            <div class="text-sm text-slate-500 font-bold py-3">まだ項目がありません</div>
          `}
        </div>

        <div class="menu-add-row" style="display:flex;gap:12px;flex-wrap:wrap;">
          <button class="cute-btn px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700" data-action="menuAddInGroup" data-group="${escapeHtml(groupKey)}" type="button">
            このグループに追加
          </button>
          ${isCustom ? `<button class="cute-btn px-5 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:from-rose-600 hover:to-rose-700" data-action="menuRemoveGroup" data-group="${escapeHtml(groupKey)}" type="button">このグループを削除</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderMenuAdminList(){
  const wrap = document.getElementById('menuAdminList');
  if (!wrap) return;

  adminMenuMaster = adminNormalizeMenuRows();
  resequenceMenuSortOrderByGroup();

  const groups = getOrderedMenuGroups();
  wrap.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <button class="cute-btn px-5 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700" data-action="menuAddGroup" type="button">
        プルダウングループを追加
      </button>
    </div>
    ${groups.map(group => renderMenuGroupCard(group)).join('')}
  `;
}

function addMenuGroup(){
  const label = window.prompt('追加するプルダウングループ名を入力してください', '新しい項目');
  if (label === null) return;
  const trimmed = String(label || '').trim();
  if (!trimmed) {
    toast('グループ名を入力してください');
    return;
  }

  const key = buildMenuGroupInternalKey(trimmed);
  adminMenuGroupCatalog = getOrderedMenuGroups().concat([{
    key: key,
    label: trimmed,
    description: '',
    is_visible: true,
    sort_order: (getOrderedMenuGroups().length + 1) * 100,
    is_custom: true
  }]);

  renderMenuAdminList();
  setTimeout(()=>{
    const body = document.getElementById(`menuGroupBody_${key}`);
    const toggle = document.querySelector(`[data-menu-group-toggle="${key}"]`);
    if (body && body.classList.contains('collapsed')) {
      body.classList.remove('collapsed');
      if (toggle) toggle.textContent = '−';
    }
  }, 0);
}

function addMenuItemToGroup(group){
  const normalizedGroup = normalizeGroupKey(group);
  const nextIndex = adminMenuMaster.length;
  adminMenuMaster.push({
    key: '',
    key_jp: '',
    label: '',
    price: 0,
    note: '',
    is_visible: true,
    sort_order: 9999,
    menu_group: normalizedGroup,
    required_flag: false,
    auto_apply_group: '',
    auto_apply_key: ''
  });

  adminMenuMaster = adminNormalizeMenuRows();
  adminMenuMaster[adminMenuMaster.length - 1].key = makeMenuInternalKey(adminMenuMaster[adminMenuMaster.length - 1], nextIndex);
  resequenceMenuSortOrderByGroup();
  renderMenuAdminList();
}

function removeMenuGroup(groupKey){
  const hit = findMenuGroupByKey(groupKey);
  if (!hit || !(hit.is_custom === true || String(hit.is_custom).toUpperCase() === 'TRUE')) return;

  adminMenuMaster = (adminMenuMaster || []).filter(item => String(item.menu_group || '') !== String(groupKey || ''));
  adminMenuGroupCatalog = getOrderedMenuGroups().filter(group => String(group.key || '') !== String(groupKey || ''));
  resequenceMenuSortOrderByGroup();
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
  renderMenuAdminList();
}

function toggleMenuGroup(group){
  const body = document.getElementById(`menuGroupBody_${group}`);
  const toggle = document.querySelector(`[data-menu-group-toggle="${group}"]`);
  if (!body || !toggle) return;

  const collapsed = body.classList.toggle('collapsed');
  toggle.textContent = collapsed ? '＋' : '−';
}

function updateAdminMenuGroupField(groupKey, field, value){
  const list = getOrderedMenuGroups();
  const idx = list.findIndex(group => String(group.key || '') === String(groupKey || ''));
  if (idx < 0) return;

  if (field === 'is_visible') {
    list[idx][field] = String(value) === '1' || value === true;
  } else {
    list[idx][field] = value;
  }

  adminMenuGroupCatalog = list;
}

function bindMenuEvents(){
  const wrap = document.getElementById('menuAdminList');
  if (!wrap) return;
  if (wrap.dataset.boundMenuEvents === '1') return;
  wrap.dataset.boundMenuEvents = '1';

  wrap.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const key = String(btn.dataset.key || '');
    const group = String(btn.dataset.group || '');

    if (action === 'toggleMenuGroup'){
      toggleMenuGroup(group);
      return;
    }

    if (action === 'menuAddGroup'){
      addMenuGroup();
      return;
    }

    if (action === 'menuAddInGroup'){
      addMenuItemToGroup(group);
      toggleMenuGroup(group);
      toggleMenuGroup(group);
      return;
    }

    if (action === 'menuRemoveGroup'){
      removeMenuGroup(group);
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
        adminMenuMaster.splice(idx, 1);
        resequenceMenuSortOrderByGroup();
        renderMenuAdminList();
      }
    }
  });

  wrap.addEventListener('input', (e)=>{
    const el = e.target;

    const groupKey = String(el.dataset.groupKey || '');
    const groupField = String(el.dataset.groupField || '');
    if (groupKey && groupField) {
      updateAdminMenuGroupField(groupKey, groupField, el.value);
      const headerTitle = wrap.querySelector(`[data-menu-group="${groupKey}"] .menu-group-card-title`);
      if (headerTitle && groupField === 'label') headerTitle.textContent = el.value || groupKey;
      return;
    }

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
    const el = e.target;

    const groupKey = String(el.dataset.groupKey || '');
    const groupField = String(el.dataset.groupField || '');
    if (groupKey && groupField) {
      updateAdminMenuGroupField(groupKey, groupField, el.value);
      renderMenuAdminList();
      return;
    }

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

    if (field === 'auto_apply_group'){
      adminMenuMaster[idx].auto_apply_key = '';
      renderMenuAdminList();
    }
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
      auto_apply_key: String(item.auto_apply_key || '').trim()
    };
  }).filter(item => String(item.label || '').trim());
}

function buildSaveMenuGroupPayload(){
  return getOrderedMenuGroups().map((group, idx) => {
    return {
      key: String(group.key || '').trim(),
      label: String(group.label || group.key || '').trim(),
      description: String(group.description || '').trim(),
      is_visible: !(group.is_visible === false || String(group.is_visible).toUpperCase() === 'FALSE'),
      sort_order: Number(group.sort_order || ((idx + 1) * 100)),
      is_custom: !!(group.is_custom === true || String(group.is_custom).toUpperCase() === 'TRUE')
    };
  }).filter(group => !!group.key);
}
