function checkAdminAuth(){
  const auth = sessionStorage.getItem('chiba_care_taxi_admin_auth');
  if (auth !== 'ok'){
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('adminView').classList.add('hidden');
    return false;
  }

  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('adminView').classList.remove('hidden');
  return true;
}

async function adminRefreshAllData(){
  const res = await gsRun('api_getInitData');
  const data = res.data || {};

  adminConfig = { ...ADMIN_DEFAULT_CONFIG, ...(data.config || {}) };
  adminReservations = Array.isArray(data.reservations) ? data.reservations : [];
  adminBlocks = Array.isArray(data.blocks) ? data.blocks : [];
  adminMenuMaster = Array.isArray(data.menu_master) ? data.menu_master : [];
  adminMenuKeyCatalog = Array.isArray(data.menu_key_catalog) ? data.menu_key_catalog : [];
  adminMenuGroupCatalog = Array.isArray(data.menu_group_catalog) && data.menu_group_catalog.length ? data.menu_group_catalog : getAdminResolvedGroupCatalog();
  adminAutoRuleCatalog = Array.isArray(data.auto_rule_catalog) ? data.auto_rule_catalog : [];

  buildAdminBlockedSlots(adminBlocks);
  buildAdminReservedSlots(adminReservations);

  applyAdminConfigToForm();
  renderAdminStats();
  renderMenuAdminList();
  renderAdminCalendar();
  renderReservationTable();
}


function adminGetVisibleRange(){
  try{
    if (typeof adminGetPageInfo === 'function'){
      const info = adminGetPageInfo();
      if (info && info.visibleDates && info.visibleDates.length){
        return {
          start: ymdLocal(info.visibleDates[0]),
          end: ymdLocal(info.visibleDates[info.visibleDates.length - 1])
        };
      }
    }
  }catch(_){ }

  const today = new Date();
  const daysPerPage = Math.max(1, Number((adminConfig && adminConfig.days_per_page) || 7));
  const start = new Date(today);
  const end = new Date(today);
  end.setDate(end.getDate() + daysPerPage - 1);
  return {
    start: ymdLocal(start),
    end: ymdLocal(end)
  };
}

function adminMergeReservationsInRange(range, reservations){
  const start = String(range && range.start || '');
  const end = String(range && range.end || '');
  const nextList = Array.isArray(reservations) ? reservations : [];
  const keep = (adminReservations || []).filter(item => {
    const ymd = normalizeDateToYMD(item && (item.date || item.reservation_date || item.pickup_date || item.day || ''));
    return !(ymd && start && end && ymd >= start && ymd <= end);
  });
  adminReservations = keep.concat(nextList).sort((a, b)=>{
    const ad = String((a && (a.reservation_datetime || a.date || a.reservation_date || '')) || '');
    const bd = String((b && (b.reservation_datetime || b.date || b.reservation_date || '')) || '');
    return ad.localeCompare(bd, 'ja');
  });
}

function adminMergeBlocksInRange(range, blocks){
  const start = String(range && range.start || '');
  const end = String(range && range.end || '');
  const nextList = Array.isArray(blocks) ? blocks : [];
  const keep = (adminBlocks || []).filter(item => {
    const ymd = normalizeDateToYMD(item && (item.block_date || item.date || item.slot_date || ''));
    return !(ymd && start && end && ymd >= start && ymd <= end);
  });
  adminBlocks = keep.concat(nextList);
}

function adminApplyDerivedState(options = {}){
  const shouldRenderConfig = options.renderConfig === true;
  if (shouldRenderConfig){
    applyAdminConfigToForm();
    renderMenuAdminList();
  }
  buildAdminBlockedSlots(adminBlocks);
  buildAdminReservedSlots(adminReservations);
  renderAdminStats();
  renderAdminCalendar();
  renderReservationTable();
}

async function adminRefreshBootstrapData(renderConfig = true){
  const res = await gsRun('api_getAdminBootstrap');
  const data = res && res.data ? res.data : {};
  adminConfig = { ...ADMIN_DEFAULT_CONFIG, ...(data.config || {}) };
  adminMenuMaster = Array.isArray(data.menu_master) ? data.menu_master : [];
  adminMenuKeyCatalog = Array.isArray(data.menu_key_catalog) ? data.menu_key_catalog : [];
  adminMenuGroupCatalog = Array.isArray(data.menu_group_catalog) && data.menu_group_catalog.length ? data.menu_group_catalog : getAdminResolvedGroupCatalog();
  adminAutoRuleCatalog = Array.isArray(data.auto_rule_catalog) ? data.auto_rule_catalog : [];
  adminApplyDerivedState({ renderConfig });
}

async function adminRefreshVisibleWindow(){
  const range = adminGetVisibleRange();
  const [resRes, blockRes] = await Promise.all([
    gsRun('api_getReservationsRange', range),
    gsRun('api_getBlocksRange', range)
  ]);

  adminMergeReservationsInRange(range, resRes && resRes.data ? resRes.data.reservations : []);
  adminMergeBlocksInRange(range, blockRes && blockRes.data ? blockRes.data.blocks : []);
  adminApplyDerivedState({ renderConfig: false });
}

function adminClearPublicClientCache(){
  try{
    localStorage.removeItem('chiba_care_taxi_public_bootstrap_cache_v2');
  }catch(_){ }
  try{
    const keys = [];
    for (let i = 0; i < localStorage.length; i++){
      const key = localStorage.key(i);
      if (String(key || '').indexOf('chiba_care_taxi_public_blocked_keys_v2__') === 0){
        keys.push(key);
      }
    }
    keys.forEach(key => {
      try{ localStorage.removeItem(key); }catch(_){ }
    });
  }catch(_){ }
}

function adminUpdateReservationLocal(payload){
  const rid = String(payload && payload.reservation_id || '').trim();
  if (!rid) return;
  const next = [];
  let updated = false;

  (adminReservations || []).forEach(item => {
    if (String(item && item.reservation_id || '').trim() === rid){
      next.push({ ...item, ...payload });
      updated = true;
    } else {
      next.push(item);
    }
  });

  if (!updated){
    next.push({ ...payload });
  }

  adminReservations = next;
}

function renderAdminStats(){
  document.getElementById('totalReservations').textContent = String(adminReservations.length || 0);
  document.getElementById('pendingCount').textContent = String(adminReservations.filter(r => String(r.status || '未対応') === '未対応').length);
  document.getElementById('confirmedCount').textContent = String(adminReservations.filter(r => String(r.status || '') === '確認済').length);
  document.getElementById('completedCount').textContent = String(adminReservations.filter(r => String(r.status || '') === '完了').length);
}

function applyAdminConfigToForm(){
  safeSetValue('cfgLogoText', adminConfig.logo_text || '');
  safeSetValue('cfgLogoSubtext', adminConfig.logo_subtext || '');
  safeSetValue('cfgLogoImageUrl', adminConfig.logo_image_url || '');
  safeSetValue('cfgLogoUseGithubImage', String(adminConfig.logo_use_github_image || '1'));
  safeSetValue('cfgGithubUsername', adminConfig.github_username || '');
  safeSetValue('cfgGithubRepo', adminConfig.github_repo || '');
  safeSetValue('cfgGithubBranch', adminConfig.github_branch || 'main');
  safeSetValue('cfgGithubAssetsBasePath', adminConfig.github_assets_base_path || '');
  safeSetValue('cfgLogoGithubPath', adminConfig.logo_github_path || '');
  safeSetValue('cfgGithubToken', adminConfig.github_token || '');
  safeSetValue('cfgPhoneNotifyText', adminConfig.phone_notify_text || '');
  safeSetValue('cfgGasNotifyUrl', adminConfig.gas_notify_url || '');
  safeSetValue('cfgGasNotifySecret', adminConfig.gas_notify_secret || '');

  safeSetValue('cfgWarningStairBodyAssistText', adminConfig.warning_stair_bodyassist_text || '');
  safeSetValue('cfgWarningWheelchairDamageText', adminConfig.warning_wheelchair_damage_text || '');
  safeSetValue('cfgWarningStretcherBodyAssistText', adminConfig.warning_stretcher_bodyassist_text || '');

  safeSetValue('cfgFormModalTitle', adminConfig.form_modal_title || '');
  safeSetValue('cfgFormPrivacyText', adminConfig.form_privacy_text || '');
  safeSetValue('cfgFormBasicSectionTitle', adminConfig.form_basic_section_title || '');
  safeSetValue('cfgFormBasicSectionBadge', adminConfig.form_basic_section_badge || '');
  safeSetValue('cfgFormOptionalSectionTitle', adminConfig.form_optional_section_title || '');
  safeSetValue('cfgFormOptionalSectionBadge', adminConfig.form_optional_section_badge || '');
  safeSetValue('cfgFormServiceSectionTitle', adminConfig.form_service_section_title || '');
  safeSetValue('cfgFormServiceSectionBadge', adminConfig.form_service_section_badge || '');
  safeSetValue('cfgFormPriceSectionTitle', adminConfig.form_price_section_title || '');
  safeSetValue('cfgFormPriceTotalLabel', adminConfig.form_price_total_label || '');
  safeSetValue('cfgFormPriceNoticeText', adminConfig.form_price_notice_text || '');
  safeSetValue('cfgFormSubmitButtonText', adminConfig.form_submit_button_text || '');

  safeSetValue('cfgFormUsageTypeLabel', adminConfig.form_usage_type_label || '');
  safeSetValue('cfgFormUsageTypePlaceholder', adminConfig.form_usage_type_placeholder || '');
  safeSetValue('cfgFormUsageTypeOptionFirst', adminConfig.form_usage_type_option_first || '');
  safeSetValue('cfgFormUsageTypeOptionRepeat', adminConfig.form_usage_type_option_repeat || '');

  safeSetValue('cfgFormCustomerNameLabel', adminConfig.form_customer_name_label || '');
  safeSetValue('cfgFormCustomerNamePlaceholder', adminConfig.form_customer_name_placeholder || '');
  safeSetValue('cfgFormPhoneLabel', adminConfig.form_phone_label || '');
  safeSetValue('cfgFormPhonePlaceholder', adminConfig.form_phone_placeholder || '');
  safeSetValue('cfgFormPickupLabel', adminConfig.form_pickup_label || '');
  safeSetValue('cfgFormPickupPlaceholder', adminConfig.form_pickup_placeholder || '');
  safeSetValue('cfgFormDestinationLabel', adminConfig.form_destination_label || '');
  safeSetValue('cfgFormDestinationPlaceholder', adminConfig.form_destination_placeholder || '');
  safeSetValue('cfgFormNotesLabel', adminConfig.form_notes_label || '');
  safeSetValue('cfgFormNotesPlaceholder', adminConfig.form_notes_placeholder || '');
  safeSetValue('cfgFormAssistanceLabel', adminConfig.form_assistance_label || '');
  safeSetValue('cfgFormStairLabel', adminConfig.form_stair_label || '');
  safeSetValue('cfgFormEquipmentLabel', adminConfig.form_equipment_label || '');
  safeSetValue('cfgFormRoundTripLabel', adminConfig.form_round_trip_label || '');

  safeSetValue('cfgCompleteTitle', adminConfig.complete_title || '');
  safeSetValue('cfgCompleteTitleSub', adminConfig.complete_title_sub || '');
  safeSetValue('cfgCompleteReservationIdLabel', adminConfig.complete_reservation_id_label || '');
  safeSetValue('cfgCompleteCloseButtonText', adminConfig.complete_close_button_text || '');
  safeSetValue('cfgCalendarScrollGuideText', adminConfig.calendar_scroll_guide_text || '');

  safeSetValue('cfgSameDayEnabled', String(adminConfig.same_day_enabled || '0'));
  safeSetValue('cfgSameDayMinHours', String(adminConfig.same_day_min_hours || '3'));

  const img = document.getElementById('adminLogoPreview');
  const txt = document.getElementById('adminLogoPreviewText');
  const sub = document.getElementById('adminLogoPreviewSubtext');
  img.src = adminConfig.logo_image_url || 'https://raw.githubusercontent.com/infochibafukushi-dotcom/chiba-care-taxi-assets/main/logo.png';
  txt.textContent = adminConfig.logo_text || '介護タクシー予約';
  sub.textContent = adminConfig.logo_subtext || '丁寧・安全な送迎をご提供します';

  const toggleBtn = document.getElementById('toggleAdminTimeView');
  toggleBtn.textContent = adminExtendedView ? '通常時間表示' : '時間外表示';
}

function renderReservationTable(){
  const body = document.getElementById('sheetTableBody');
  if (!body) return;

  body.innerHTML = adminReservations.map((r, idx) => {
    const status = String(r.status || '未対応');
    return `
      <tr class="sheet-row-clickable ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}" data-reservation-index="${idx}">
        <td class="border border-slate-200 p-3">${escapeHtml(r.reservation_id || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.reservation_datetime || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.usage_type || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.customer_name || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.phone_number || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.pickup_location || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.destination || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.assistance_type || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.stair_assistance || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.equipment_rental || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.stretcher_two_staff || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.round_trip || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.notes || '')}</td>
        <td class="border border-slate-200 p-3">${Number(r.total_price || 0).toLocaleString()}円</td>
        <td class="border border-slate-200 p-3"><span class="badge ${getAdminStatusBadge(status)}">${escapeHtml(status)}</span></td>
        <td class="border border-slate-200 p-3"><button class="cute-btn px-3 py-2 bg-gradient-to-r from-sky-500 to-sky-600 text-white" data-action="openDetail" data-index="${idx}" type="button">詳細</button></td>
      </tr>
    `;
  }).join('');
}

function openReservationDetail(index){
  const r = adminReservations[index];
  if (!r) return;

  adminCurrentReservation = { ...r };

  document.getElementById('detailContent').innerHTML = `
    <div class="space-y-4 text-sm">
      <div><strong>予約ID:</strong> ${escapeHtml(r.reservation_id || '')}</div>
      <div><strong>予約日時:</strong> ${escapeHtml(r.reservation_datetime || '')}</div>
      <div><strong>ご利用区分:</strong> ${escapeHtml(r.usage_type || '')}</div>
      <div><strong>お名前:</strong> ${escapeHtml(r.customer_name || '')}</div>
      <div><strong>電話番号:</strong> ${escapeHtml(r.phone_number || '')}</div>
      <div><strong>お伺い場所:</strong> ${escapeHtml(r.pickup_location || '')}</div>
      <div><strong>送迎先:</strong> ${escapeHtml(r.destination || '')}</div>
      <div><strong>介助内容:</strong> ${escapeHtml(r.assistance_type || '')}</div>
      <div><strong>階段介助:</strong> ${escapeHtml(r.stair_assistance || '')}</div>
      <div><strong>機材:</strong> ${escapeHtml(r.equipment_rental || '')}</div>
      <div><strong>2名体制:</strong> ${escapeHtml(r.stretcher_two_staff || '')}</div>
      <div><strong>往復:</strong> ${escapeHtml(r.round_trip || '')}</div>
      <div><strong>備考:</strong> ${escapeHtml(r.notes || '')}</div>
      <div><strong>料金:</strong> ${Number(r.total_price || 0).toLocaleString()}円</div>
    </div>
  `;

  document.getElementById('statusSelect').value = String(r.status || '未対応');
  document.getElementById('detailModal').classList.remove('hidden');
}

function collectLogoConfigPayload(){
  return {
    logo_text: safeGetValue('cfgLogoText').trim(),
    logo_subtext: safeGetValue('cfgLogoSubtext').trim(),
    logo_image_url: safeGetValue('cfgLogoImageUrl').trim(),
    logo_use_github_image: document.getElementById('cfgLogoUseGithubImage').value,
    github_username: safeGetValue('cfgGithubUsername').trim(),
    github_repo: safeGetValue('cfgGithubRepo').trim(),
    github_branch: safeGetValue('cfgGithubBranch').trim(),
    github_assets_base_path: safeGetValue('cfgGithubAssetsBasePath').trim(),
    logo_github_path: safeGetValue('cfgLogoGithubPath').trim(),
    github_token: safeGetValue('cfgGithubToken').trim(),
    phone_notify_text: safeGetValue('cfgPhoneNotifyText').trim(),
    gas_notify_url: safeGetValue('cfgGasNotifyUrl').trim(),
    gas_notify_secret: safeGetValue('cfgGasNotifySecret').trim()
  };
}

function collectWarningConfigPayload(){
  return {
    warning_stair_bodyassist_text: safeGetValue('cfgWarningStairBodyAssistText').trim(),
    warning_wheelchair_damage_text: safeGetValue('cfgWarningWheelchairDamageText').trim(),
    warning_stretcher_bodyassist_text: safeGetValue('cfgWarningStretcherBodyAssistText').trim(),

    form_modal_title: safeGetValue('cfgFormModalTitle').trim(),
    form_privacy_text: safeGetValue('cfgFormPrivacyText').trim(),
    form_basic_section_title: safeGetValue('cfgFormBasicSectionTitle').trim(),
    form_basic_section_badge: safeGetValue('cfgFormBasicSectionBadge').trim(),
    form_optional_section_title: safeGetValue('cfgFormOptionalSectionTitle').trim(),
    form_optional_section_badge: safeGetValue('cfgFormOptionalSectionBadge').trim(),
    form_service_section_title: safeGetValue('cfgFormServiceSectionTitle').trim(),
    form_service_section_badge: safeGetValue('cfgFormServiceSectionBadge').trim(),
    form_price_section_title: safeGetValue('cfgFormPriceSectionTitle').trim(),
    form_price_total_label: safeGetValue('cfgFormPriceTotalLabel').trim(),
    form_price_notice_text: safeGetValue('cfgFormPriceNoticeText').trim(),
    form_submit_button_text: safeGetValue('cfgFormSubmitButtonText').trim(),

    form_usage_type_label: safeGetValue('cfgFormUsageTypeLabel').trim(),
    form_usage_type_placeholder: safeGetValue('cfgFormUsageTypePlaceholder').trim(),
    form_usage_type_option_first: safeGetValue('cfgFormUsageTypeOptionFirst').trim(),
    form_usage_type_option_repeat: safeGetValue('cfgFormUsageTypeOptionRepeat').trim(),

    form_customer_name_label: safeGetValue('cfgFormCustomerNameLabel').trim(),
    form_customer_name_placeholder: safeGetValue('cfgFormCustomerNamePlaceholder').trim(),
    form_phone_label: safeGetValue('cfgFormPhoneLabel').trim(),
    form_phone_placeholder: safeGetValue('cfgFormPhonePlaceholder').trim(),
    form_pickup_label: safeGetValue('cfgFormPickupLabel').trim(),
    form_pickup_placeholder: safeGetValue('cfgFormPickupPlaceholder').trim(),
    form_destination_label: safeGetValue('cfgFormDestinationLabel').trim(),
    form_destination_placeholder: safeGetValue('cfgFormDestinationPlaceholder').trim(),
    form_notes_label: safeGetValue('cfgFormNotesLabel').trim(),
    form_notes_placeholder: safeGetValue('cfgFormNotesPlaceholder').trim(),
    form_assistance_label: safeGetValue('cfgFormAssistanceLabel').trim(),
    form_stair_label: safeGetValue('cfgFormStairLabel').trim(),
    form_equipment_label: safeGetValue('cfgFormEquipmentLabel').trim(),
    form_round_trip_label: safeGetValue('cfgFormRoundTripLabel').trim(),

    complete_title: safeGetValue('cfgCompleteTitle').trim(),
    complete_title_sub: safeGetValue('cfgCompleteTitleSub').trim(),
    complete_reservation_id_label: safeGetValue('cfgCompleteReservationIdLabel').trim(),
    complete_close_button_text: safeGetValue('cfgCompleteCloseButtonText').trim(),
    calendar_scroll_guide_text: safeGetValue('cfgCalendarScrollGuideText').trim()
  };
}

function collectSameDayPayload(){
  return {
    same_day_enabled: document.getElementById('cfgSameDayEnabled').value,
    same_day_min_hours: document.getElementById('cfgSameDayMinHours').value
  };
}

async function uploadLogoFile(){
  const fileInput = document.getElementById('logoFileInput');
  const file = fileInput.files && fileInput.files[0];
  const status = document.getElementById('logoUploadStatus');

  if (!file){
    status.className = 'small-status ng';
    status.textContent = 'ファイルを選択してください';
    return;
  }

  const base64Data = await new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(String(reader.result || ''));
    reader.onerror = ()=> reject(new Error('画像読込に失敗しました'));
    reader.readAsDataURL(file);
  });

  const payload = {
    file_name: file.name,
    mime_type: file.type || 'image/png',
    base64_data: base64Data
  };

  const res = await withLoading(async ()=>{
    return await gsRun('api_uploadLogoImage', payload);
  }, 'ロゴ画像アップロード中...');

  status.className = 'small-status ok';
  status.textContent = 'アップロード完了';

  if (res && res.data && res.data.raw_url){
    document.getElementById('cfgLogoImageUrl').value = res.data.raw_url;
    document.getElementById('adminLogoPreview').src = res.data.raw_url;
  }
}

function bindPanelToggles(){
  document.querySelectorAll('[data-panel-toggle]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      const key = btn.dataset.panelToggle;
      const body = document.getElementById(key + 'Body');
      if (!body) return;
      const collapsed = body.classList.toggle('collapsed');
      btn.textContent = collapsed ? '＋' : '−';
    });
  });
}

function bindReservationTableEvents(){
  const body = document.getElementById('sheetTableBody');
  if (!body) return;

  body.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action="openDetail"]');
    if (btn){
      openReservationDetail(Number(btn.dataset.index));
      return;
    }

    const tr = e.target.closest('[data-reservation-index]');
    if (tr){
      openReservationDetail(Number(tr.dataset.reservationIndex));
    }
  });
}

async function saveStatusUpdate(hideOnly = false){
  if (!adminCurrentReservation) return;

  const payload = { ...adminCurrentReservation };
  if (hideOnly){
    payload.is_visible = false;
  } else {
    payload.status = document.getElementById('statusSelect').value;
  }

  await withLoading(async ()=>{
    await gsRun('api_updateReservation', payload);
    adminUpdateReservationLocal(payload);
    await adminRefreshVisibleWindow();
  }, '予約を更新中...');

  document.getElementById('detailModal').classList.add('hidden');
}

function bindUI(){
  document.getElementById('goPublicPageBtn').addEventListener('click', ()=>{
    window.location.href = PUBLIC_PAGE_URL;
  });

  document.getElementById('goPublicPageTopBtn').addEventListener('click', ()=>{
    window.location.href = PUBLIC_PAGE_URL;
  });

  document.getElementById('logoutAdmin').addEventListener('click', ()=>{
    sessionStorage.removeItem('chiba_care_taxi_admin_auth');
    sessionStorage.removeItem('chiba_care_taxi_admin_auth_time');
    window.location.href = PUBLIC_PAGE_URL;
  });

  document.getElementById('toggleAdminTimeView').addEventListener('click', ()=>{
    adminExtendedView = !adminExtendedView;
    document.getElementById('toggleAdminTimeView').textContent = adminExtendedView ? '通常時間表示' : '時間外表示';
    renderAdminCalendar();
  });

  document.getElementById('openSheetBtn').addEventListener('click', ()=>{
    document.getElementById('sheetModal').classList.remove('hidden');
  });
  document.getElementById('closeSheet').addEventListener('click', ()=>{
    document.getElementById('sheetModal').classList.add('hidden');
  });

  document.getElementById('closeDetail').addEventListener('click', ()=>{
    document.getElementById('detailModal').classList.add('hidden');
  });

  document.getElementById('updateStatus').addEventListener('click', async ()=>{
    try{
      await saveStatusUpdate(false);
      toast('更新しました');
    }catch(err){
      toast(err?.message || '更新に失敗しました');
    }
  });

  document.getElementById('hideReservation').addEventListener('click', async ()=>{
    try{
      await saveStatusUpdate(true);
      toast('非表示にしました');
    }catch(err){
      toast(err?.message || '更新に失敗しました');
    }
  });

  document.getElementById('saveLogoConfigBtn').addEventListener('click', async ()=>{
    try{
      await withLoading(async ()=>{
        const res = await gsRun('api_saveConfig', collectLogoConfigPayload());
        if (res && res.data && res.data.config){
          adminConfig = { ...adminConfig, ...(res.data.config || {}) };
        }
        adminClearPublicClientCache();
        adminApplyDerivedState({ renderConfig: true });
      }, '設定保存中...');
      toast('保存しました');
    }catch(err){
      toast(err?.message || '保存に失敗しました');
    }
  });

  document.getElementById('saveWarningConfigBtn').addEventListener('click', async ()=>{
    try{
      await withLoading(async ()=>{
        const res = await gsRun('api_saveConfig', collectWarningConfigPayload());
        if (res && res.data && res.data.config){
          adminConfig = { ...adminConfig, ...(res.data.config || {}) };
        }
        adminClearPublicClientCache();
        adminApplyDerivedState({ renderConfig: true });
      }, '警告文・予約表示文言保存中...');
      toast('保存しました');
    }catch(err){
      toast(err?.message || '保存に失敗しました');
    }
  });

  document.getElementById('saveSameDayConfigBtn').addEventListener('click', async ()=>{
    try{
      await withLoading(async ()=>{
        const res = await gsRun('api_saveConfig', collectSameDayPayload());
        if (res && res.data && res.data.config){
          adminConfig = { ...adminConfig, ...(res.data.config || {}) };
        }
        adminClearPublicClientCache();
        adminApplyDerivedState({ renderConfig: true });
      }, '当日予約設定保存中...');
      toast('保存しました');
    }catch(err){
      toast(err?.message || '保存に失敗しました');
    }
  });

  document.getElementById('uploadLogoBtn').addEventListener('click', async ()=>{
    try{
      await uploadLogoFile();
      toast('アップロードしました');
    }catch(err){
      document.getElementById('logoUploadStatus').className = 'small-status ng';
      document.getElementById('logoUploadStatus').textContent = err?.message || 'アップロード失敗';
      toast(err?.message || 'アップロードに失敗しました');
    }
  });

  document.getElementById('changePasswordBtn').addEventListener('click', async ()=>{
    const status = document.getElementById('passwordChangeStatus');
    try{
      await withLoading(async ()=>{
        await gsRun('api_changeAdminPassword', {
          current_password: safeGetValue('cfgCurrentPassword').trim(),
          new_password: safeGetValue('cfgNewPassword').trim(),
          confirm_password: safeGetValue('cfgConfirmPassword').trim()
        });
      }, 'パスワード変更中...');

      status.className = 'small-status ok';
      status.textContent = '変更しました';
      document.getElementById('cfgCurrentPassword').value = '';
      document.getElementById('cfgNewPassword').value = '';
      document.getElementById('cfgConfirmPassword').value = '';
      toast('変更しました');
    }catch(err){
      status.className = 'small-status ng';
      status.textContent = err?.message || '変更に失敗しました';
      toast(err?.message || '変更に失敗しました');
    }
  });

  document.getElementById('saveMenuMasterBtn').addEventListener('click', async ()=>{
    try{
      const items = buildSaveMenuPayload();
      const menuConfigPayload = buildMenuGroupConfigPayload();
      await withLoading(async ()=>{
        await gsRun('api_saveMenuMaster', { items });
        const configRes = await gsRun('api_saveConfig', menuConfigPayload);
        if (configRes && configRes.data && configRes.data.config){
          adminConfig = { ...adminConfig, ...(configRes.data.config || {}) };
        }
        await adminRefreshBootstrapData(true);
        adminClearPublicClientCache();
      }, 'メニュー保存中...');
      toast('保存しました');
    }catch(err){
      toast(err?.message || '保存に失敗しました');
    }
  });

  window.addEventListener('resize', debounce(()=>{
    try{ renderAdminCalendar(); }catch(_){}
  }, 150));
}

async function initAdmin(){
  if (!checkAdminAuth()) return;

  bindPanelToggles();
  bindMenuEvents();
  bindReservationTableEvents();
  bindAdminGridDelegation();
  bindUI();

  try{
    await withLoading(async ()=>{
      await adminRefreshAllData();
    }, '読み込み中...');
  }catch(err){
    toast(err?.message || '初期化に失敗しました');
  }
}

initAdmin();
