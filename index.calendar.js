function initCalendar(){
  if(typeof renderCalendar === "function"){
    renderCalendar();
  }else{
    console.error("renderCalendarが未定義");
  }
}
