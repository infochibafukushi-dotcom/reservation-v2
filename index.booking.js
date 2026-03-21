
function initBookingForm(){
  buildTimeOptions();
  renderServiceSelectors();
  document.getElementById('bookingForm').addEventListener('change', updatePriceUI);
  document.getElementById('submitBooking').addEventListener('click', submitBooking);
}

function buildTimeOptions(){
  const el=document.getElementById('useTime');
  let html='<option value="">選択</option>';
  for(let h=6;h<=21;h++){
    html+=`<option>${h}:00</option>`;
    if(h!=21) html+=`<option>${h}:30</option>`;
  }
  el.innerHTML=html;
}

function updatePriceUI(){
  let total=0,html='';
  ['assistanceType','stairAssistance','equipmentRental','roundTrip'].forEach(id=>{
    const key=getSelectedOptionKey(id);
    if(!key)return;
    const price=getMenuPrice(key,0);
    const label=getMenuLabel(key,'');
    total+=price;
    html+=`<div>${label} ${price}円</div>`;
  });
  document.getElementById('priceBreakdown').innerHTML=html;
  document.getElementById('totalPrice').innerText=total+'円';
}

async function submitBooking(){
  const payload={
    date:useDate.value,
    time:useTime.value,
    from:fromAddress.value,
    to:toAddress.value,
    assistance:getSelectedOptionKey('assistanceType'),
    stair:getSelectedOptionKey('stairAssistance'),
    equipment:getSelectedOptionKey('equipmentRental'),
    round:getSelectedOptionKey('roundTrip')
  };
  await fetch(GAS_URL,{method:'POST',body:JSON.stringify({action:'createReservation',payload})});
  alert('予約送信完了');
}
