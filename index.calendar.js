if (typeof globalThis.hasBoundGridDelegation === 'undefined') globalThis.hasBoundGridDelegation = false;
let publicCalendarPage = 0;
let hasBoundPublicCalendarNav = false;
let hasRenderedInitialCalendar = false;
let hasScheduledDeferredBlockedPaint = false;

function getPublicDaysPerPage(){
  return Math.max(1, Number(config.days_per_page || 7));
}

function getPublicStartOffset(){
  return String(config.same_day_enabled || '0') === '1' ? 0 : 1;
}

function applyCalendarGridColumns(gridEl, daysCount){
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  const timeCol = isMobile ? 44 : 60;
  const normalizedDays = Math.max(1, Number(daysCount || 1));

  if (!isMobile){
    gridEl.style.gridTemplateColumns = `${timeCol}px repeat(${normalizedDays}, minmax(112px, 1fr))`;
  } else {
    gridEl.style.gridTemplateColumns = `${timeCol}px repeat(${normalizedDays}, minmax(62px, 1fr))`;
  }
}

function getDatesRange(){
  const today = new Date();
  today.setHours(0,0,0,0);

  const maxForwardDays = Math.max(1, Number(config.max_forward_days || 30));
  const startOffset = getPublicStartOffset();
  const daysPerPage = getPublicDaysPerPage();
  const startIndex = Math.max(0, publicCalendarPage * daysPerPage);
  const remaining = Math.max(0, maxForwardDays - startIndex);
  const visibleDays = Math.max(0, Math.min(daysPerPage, remaining));
  const dates = [];

  for (let i = 0; i < visibleDays; i++){
    const dt = new Date(today);
    dt.setDate(today.getDate() + startOffset + startIndex + i);
    dates.push(dt);
  }
  return dates;
}

function getPublicCalendarPageInfo(){
  const maxForwardDays = Math.max(1, Number(config.max_forward_days || 30));
  const daysPerPage = getPublicDaysPerPage();
  const totalPages = Math.max(1, Math.ceil(maxForwardDays / daysPerPage));
  const currentPage = Math.min(Math.max(0, publicCalendarPage), totalPages - 1);
  return { daysPerPage, totalPages, currentPage };
}

function ensurePublicCalendarNav(){
  const dateRangeEl = document.getElementById('dateRange');
  const headerRow = dateRangeEl ? dateRangeEl.parentElement : null;
  if (!dateRangeEl || !headerRow) return;

  let nav = document.getElementById('publicCalendarPager');
  if (!nav){
    nav = document.createElement('div');
    nav.id = 'publicCalendarPager';
    nav.className = 'flex items-center gap-2';
    nav.innerHTML = `
      <button id="publicPrevWeekBtn" class="cute-btn px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs md:text-sm whitespace-nowrap" type="button">← 前へ</button>
      <button id="publicNextWeekBtn" class="cute-btn px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs md:text-sm whitespace-nowrap" type="button">次へ →</button>
    `;
    const toggleBtn = document.getElementById('toggleTimeView');
    if (toggleBtn){
      headerRow.insertBefore(nav, toggleBtn);
    } else {
      headerRow.appendChild(nav);
    }
  }

  if (!hasBoundPublicCalendarNav){
    const prevBtn = document.getElementById('publicPrevWeekBtn');
    const nextBtn = document.getElementById('publicNextWeekBtn');

    if (prevBtn){
      prevBtn.addEventListener('click', async ()=>{
        const info = getPublicCalendarPageInfo();
        if (info.currentPage <= 0) return;
        publicCalendarPage = info.currentPage - 1;
        try{
          await withLoading(async ()=>{
            await ensureBlockedSlotsFresh(false, true);
            renderCalendar();
          }, '前の週を表示中...');
        }catch(err){
          toast(err?.message || '表示更新に失敗しました');
        }
      });
    }

    if (nextBtn){
      nextBtn.addEventListener('click', async ()=>{
        const info = getPublicCalendarPageInfo();
        if (info.currentPage >= info.totalPages - 1) return;
        publicCalendarPage = info.currentPage + 1;
        try{
          await withLoading(async ()=>{
            await ensureBlockedSlotsFresh(false, true);
            renderCalendar();
          }, '次の週を表示中...');
        }catch(err){
          toast(err?.message || '表示更新に失敗しました');
        }
      });
    }

    hasBoundPublicCalendarNav = true;
  }

  const info = getPublicCalendarPageInfo();
  const prevBtn = document.getElementById('publicPrevWeekBtn');
  const nextBtn = document.getElementById('publicNextWeekBtn');
  if (prevBtn){
    prevBtn.disabled = info.currentPage <= 0;
    prevBtn.style.opacity = info.currentPage <= 0 ? '0.45' : '1';
    prevBtn.style.pointerEvents = info.currentPage <= 0 ? 'none' : '';
  }
  if (nextBtn){
    nextBtn.disabled = info.currentPage >= info.totalPages - 1;
    nextBtn.style.opacity = info.currentPage >= info.totalPages - 1 ? '0.45' : '1';
    nextBtn.style.pointerEvents = info.currentPage >= info.totalPages - 1 ? 'none' : '';
  }
}

function buildSlots(){
  const regularSlots = [];
  for (let h=6; h<=21; h++){
    regularSlots.push({hour:h, minute:0, display:`${String(h).padStart(2,'0')}:00`});
    if (h < 21) regularSlots.push({hour:h, minute:30, display:`${String(h).padStart(2,'0')}:30`});
  }

  const extendedSlots = [];
  extendedSlots.push({hour:21, minute:30, display:`21:30`});
  for (let h=22; h<24; h++){
    extendedSlots.push({hour:h, minute:0, display:`${String(h).padStart(2,'0')}:00`});
    extendedSlots.push({hour:h, minute:30, display:`${String(h).padStart(2,'0')}:30`});
  }
  for (let h=0; h<=5; h++){
    extendedSlots.push({hour:h, minute:0, display:`${String(h).padStart(2,'0')}:00`});
    extendedSlots.push({hour:h, minute:30, display:`${String(h).padStart(2,'0')}:30`});
  }
  return { regularSlots, extendedSlots };
}

function getCalendarEstimatedMinHeight(){
  const regularRows = 32; // 時間ヘッダー1行 + 通常時間31行
  const extendedRows = 18; // 他時間ヘッダー1行 + 他時間17行
  const regularRowHeight = 56;
  const extendedRowHeight = 52;

  return (regularRows * regularRowHeight) + (isExtendedView ? (extendedRows * extendedRowHeight) : 0);
}

function reserveCalendarLayoutHeight(gridEl){
  if (!gridEl) return;

  const nextMinHeight = getCalendarEstimatedMinHeight();
  const prevMinHeight = Number(gridEl.dataset.reservedMinHeight || 0);
  const stableMinHeight = Math.max(prevMinHeight, nextMinHeight);

  gridEl.dataset.reservedMinHeight = String(stableMinHeight);
  gridEl.style.minHeight = `${stableMinHeight}px`;
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const dateRangeEl = document.getElementById('dateRange');
  if (!grid || !dateRangeEl) return;

  reserveCalendarLayoutHeight(grid);

  ensurePublicCalendarNav();

  const dates = getDatesRange();
  calendarDates = dates;

  if (dates.length === 0) {
    dateRangeEl.textContent = '';
    grid.innerHTML = '';
    return;
  }

  dateRangeEl.textContent = `${formatDate(dates[0])} ～ ${formatDate(dates[dates.length-1])}`;

  const { regularSlots, extendedSlots } = buildSlots();
  const isInitialLightweightRender = !hasRenderedInitialCalendar;

  let html = '';
  html += '<div class="time-label sticky-corner">時間</div>';

  dates.forEach((date, idx)=>{
    const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
    html += `<div class="date-header sticky-top ${isWeekend ? 'weekend' : ''}" data-date-idx="${idx}">${formatDate(date)}</div>`;
  });

  for (const slot of regularSlots){
    html += `<div class="time-label sticky-left">${slot.display}</div>`;
    for (let idx=0; idx<dates.length; idx++){
      const date = dates[idx];
      const blocked = isInitialLightweightRender ? false : isSlotBlockedWithMinute(date, slot.hour, slot.minute);
      const slotClass = blocked ? 'slot-unavailable' : 'slot-available';

      html += `<div class="${slotClass} p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
                data-action="slot"
                data-base-slot-class="slot-available"
                data-date-idx="${idx}"
                data-hour="${slot.hour}"
                data-minute="${slot.minute}">
                ${blocked ? 'X' : '◎'}
              </div>`;
    }
  }

  const shouldShowExtended = isExtendedView;
  if (shouldShowExtended){
    html += '<div class="time-label sticky-left" style="font-weight:bold;background:linear-gradient(135deg,#cffafe 0%,#a5f3fc 100%);color:#0e7490;border:2px solid #06b6d4;">他時間</div>';

    dates.forEach((date, idx)=>{
      const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
      html += `<div class="date-header ${isWeekend ? 'weekend' : ''}"
                style="background:linear-gradient(135deg,#cffafe 0%,#a5f3fc 100%);border-color:#06b6d4;color:#0e7490;"
                data-date-idx="${idx}">${formatDate(date)}</div>`;
    });

    for (const slot of extendedSlots){
      html += `<div class="time-label sticky-left" style="background:linear-gradient(135deg,#cffafe 0%,#a5f3fc 100%);border:2px solid #06b6d4;color:#0e7490;font-weight:600;">${slot.display}</div>`;
      for (let idx=0; idx<dates.length; idx++){
        const date = dates[idx];
        const blocked = isInitialLightweightRender ? false : isSlotBlockedWithMinute(date, slot.hour, slot.minute);
        const slotClass = blocked ? 'slot-unavailable' : 'slot-alternate';

        html += `<div class="${slotClass} p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
                  data-action="slot"
                  data-base-slot-class="slot-alternate"
                  data-date-idx="${idx}"
                  data-hour="${slot.hour}"
                  data-minute="${slot.minute}">
                  ${blocked ? 'X' : '◎'}
                </div>`;
      }
    }
  }

  grid.innerHTML = html;

  applyCalendarGridColumns(grid, dates.length);

  if (isInitialLightweightRender){
    hasRenderedInitialCalendar = true;
    if (!hasScheduledDeferredBlockedPaint){
      hasScheduledDeferredBlockedPaint = true;
      requestAnimationFrame(()=>{
        setTimeout(()=>{
          const slotEls = grid.querySelectorAll('[data-action="slot"]');
          slotEls.forEach((el)=>{
            const dateIdx = Number(el.dataset.dateIdx);
            const hour = Number(el.dataset.hour);
            const minute = Number(el.dataset.minute || 0);
            const date = calendarDates[dateIdx];
            if (!date) return;

            const blocked = isSlotBlockedWithMinute(date, hour, minute);
            if (blocked){
              el.classList.remove('slot-available', 'slot-alternate');
              el.classList.add('slot-unavailable');
              el.textContent = 'X';
            } else {
              if (el.classList.contains('slot-alternate')){
                el.classList.remove('slot-unavailable', 'slot-available');
                el.classList.add('slot-alternate');
              } else {
                el.classList.remove('slot-unavailable', 'slot-alternate');
                el.classList.add('slot-available');
              }
              el.textContent = '◎';
            }
          });
          hasScheduledDeferredBlockedPaint = false;
        }, 0);
      });
    }
  }
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function patchRenderedCalendarBlockedStates(){
  const grid = document.getElementById('calendarGrid');
  if (!grid || !calendarDates || !calendarDates.length) return;

  const slotEls = grid.querySelectorAll('[data-action="slot"]');
  if (!slotEls || !slotEls.length) return;

  slotEls.forEach((el)=>{
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = calendarDates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    if (blocked){
      el.classList.remove('slot-available', 'slot-alternate');
      el.classList.add('slot-unavailable');
      el.textContent = 'X';
      return;
    }

    const baseSlotClass = String(el.dataset.baseSlotClass || 'slot-available');
    if (baseSlotClass === 'slot-alternate'){
      el.classList.remove('slot-unavailable', 'slot-available');
      el.classList.add('slot-alternate');
    } else {
      el.classList.remove('slot-unavailable', 'slot-alternate');
      el.classList.add('slot-available');
    }
    el.textContent = '◎';
  });
}

function bindGridDelegation(){
  if (globalThis.hasBoundGridDelegation) return;

  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  grid.addEventListener('click', async (ev)=>{
    const el = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!el) return;

    const action = el.dataset.action;

    if (action === 'slot'){
      const dateIdx = Number(el.dataset.dateIdx);
      const hour = Number(el.dataset.hour);
      const minute = Number(el.dataset.minute || 0);

      const date = calendarDates[dateIdx];
      if (!date) return;

      const blocked = isSlotBlockedWithMinute(date, hour, minute);
      if (blocked) return;

      await openBookingForm(date, hour, minute);
    }
  }, { passive: false });

  globalThis.hasBoundGridDelegation = true;
}

function onCalendarDomReady(callback){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

onCalendarDomReady(function(){
  const grid = document.getElementById('calendarGrid');
  reserveCalendarLayoutHeight(grid);
  bindGridDelegation();
});
