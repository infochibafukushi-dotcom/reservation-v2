const CALENDAR_PAGE_SIZE = 7;
let calendarPageIndex = 0;

function applyCalendarGridColumns(gridEl, daysCount){
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  const timeCol = isMobile ? 44 : 60;
  const sc = gridEl?.closest?.('.scroll-container') || gridEl?.parentElement;
  const baseW = (sc && sc.clientWidth) ? sc.clientWidth : window.innerWidth;

  if (!isMobile){
    const dayW = Math.max(110, Math.floor((baseW - timeCol) / 7));
    gridEl.style.gridTemplateColumns = `${timeCol}px repeat(${daysCount}, ${dayW}px)`;
  } else {
    gridEl.style.gridTemplateColumns = `${timeCol}px repeat(${daysCount}, minmax(62px, 1fr))`;
  }
}

function getCalendarWindowInfo(){
  const maxForwardDays = Math.max(1, Number(config.max_forward_days || 30));
  const totalPages = Math.max(1, Math.ceil(maxForwardDays / CALENDAR_PAGE_SIZE));

  if (calendarPageIndex < 0) calendarPageIndex = 0;
  if (calendarPageIndex > totalPages - 1) calendarPageIndex = totalPages - 1;

  const startIndex = calendarPageIndex * CALENDAR_PAGE_SIZE;
  const endIndexExclusive = Math.min(startIndex + CALENDAR_PAGE_SIZE, maxForwardDays);

  return {
    maxForwardDays,
    totalPages,
    startIndex,
    endIndexExclusive,
    pageSize: CALENDAR_PAGE_SIZE
  };
}

function getDatesRange(){
  const today = new Date();
  today.setHours(0,0,0,0);

  const startOffset = String(config.same_day_enabled || '0') === '1' ? 0 : 1;
  const dates = [];
  const info = getCalendarWindowInfo();

  for (let i = info.startIndex; i < info.endIndexExclusive; i++){
    const dt = new Date(today);
    dt.setDate(today.getDate() + startOffset + i);
    dates.push(dt);
  }
  return dates;
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

function getCalendarPagerHtml(dates){
  if (!dates || !dates.length) return '';

  const info = getCalendarWindowInfo();
  const hasPrev = calendarPageIndex > 0;
  const hasNext = calendarPageIndex < (info.totalPages - 1);

  return `
    <div class="flex items-center justify-between gap-2 w-full">
      <button
        type="button"
        onclick="prevCalendarPage()"
        ${hasPrev ? '' : 'disabled'}
        class="cute-btn px-3 py-2 text-xs md:text-sm whitespace-nowrap ${hasPrev ? 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' : 'bg-gray-100 text-gray-300 border border-gray-200 cursor-not-allowed'}"
        aria-label="前の7日">
        ← 前へ
      </button>

      <div class="min-w-0 flex-1 text-center">
        <div class="text-sm md:text-lg font-bold text-gray-800 leading-tight">
          ${formatDate(dates[0])} ～ ${formatDate(dates[dates.length-1])}
        </div>
        <div class="text-[11px] md:text-xs font-bold text-gray-500 leading-tight mt-0.5">
          ${info.maxForwardDays}日中 ${info.startIndex + 1}〜${info.endIndexExclusive}日を表示
        </div>
      </div>

      <button
        type="button"
        onclick="nextCalendarPage()"
        ${hasNext ? '' : 'disabled'}
        class="cute-btn px-3 py-2 text-xs md:text-sm whitespace-nowrap ${hasNext ? 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' : 'bg-gray-100 text-gray-300 border border-gray-200 cursor-not-allowed'}"
        aria-label="次の7日">
        次へ →
      </button>
    </div>
  `;
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const dateRangeEl = document.getElementById('dateRange');
  if (!grid || !dateRangeEl) return;

  const dates = getDatesRange();
  calendarDates = dates;

  if (dates.length === 0) {
    dateRangeEl.textContent = '';
    grid.innerHTML = '';
    return;
  }

  dateRangeEl.innerHTML = getCalendarPagerHtml(dates);

  const { regularSlots, extendedSlots } = buildSlots();

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
      const blocked = isSlotBlockedWithMinute(date, slot.hour, slot.minute);
      const slotClass = blocked ? 'slot-unavailable' : 'slot-available';

      html += `<div class="${slotClass} p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
                data-action="slot"
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
        const blocked = isSlotBlockedWithMinute(date, slot.hour, slot.minute);
        const slotClass = blocked ? 'slot-unavailable' : 'slot-alternate';

        html += `<div class="${slotClass} p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
                  data-action="slot"
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
  requestAnimationFrame(()=> applyCalendarGridColumns(grid, dates.length));
}

function prevCalendarPage(){
  const info = getCalendarWindowInfo();
  if (info.totalPages <= 1) return;
  if (calendarPageIndex <= 0) return;
  calendarPageIndex -= 1;
  renderCalendar();
}

function nextCalendarPage(){
  const info = getCalendarWindowInfo();
  if (info.totalPages <= 1) return;
  if (calendarPageIndex >= info.totalPages - 1) return;
  calendarPageIndex += 1;
  renderCalendar();
}

function bindGridDelegation(){
  if (hasBoundGridDelegation) return;

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

      openBookingForm(date, hour, minute);
    }
  }, { passive: false });

  hasBoundGridDelegation = true;
}
