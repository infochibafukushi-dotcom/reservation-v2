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
  try{
    await adminRefreshBootstrapData(true);
    await adminRefreshVisibleWindow();
  }catch(primaryErr){
    const res = await gsRun('api_getInitData');
    const data = res && res.data ? res.data : {};

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
  if (!data || typeof data !== 'object') throw new Error('管理画面データ取得失敗');
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
  if (!resRes || !blockRes) throw new Error('予約一覧またはブロック取得に失敗しました');

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


function safeSetValue(id, value){
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value == null ? '' : value;
}


function safeGetEl(id){
  try{
    return document.getElementById(id);
  }catch(_){
    return null;
  }
}

function safeSetValue(id, value){
  const el = safeGetEl(id);
  if (!el) return;
  el.value = value == null ? '' : String(value);
}

function safeGetValue(id, fallback = ''){
  const el = safeGetEl(id);
  if (!el) return fallback;
  return String(el.value == null ? fallback : el.value);
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
  safeSetValue('statusSelect', String(r.status || '未対応'));
  safeSetValue('cfgLogoImageUrl', res.data.raw_url);
  safeSetValue('cfgCurrentPassword', '');
  safeSetValue('cfgNewPassword', '');
  safeSetValue('cfgConfirmPassword', '');
}

