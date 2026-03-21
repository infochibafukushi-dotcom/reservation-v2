
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
  const keys=[
    getSelectedOptionKey('assistanceType'),
    getSelectedOptionKey('stairAssistance'),
    getSelectedOptionKey('equipmentRental'),
    getSelectedOptionKey('roundTrip')
  ];
  let total=0,html='';
  keys.forEach(k=>{
    if(!k)return;
    const price=getMenuPrice(k,0);
    const label=getMenuLabel(k,'');
    total+=price;
    html+=`<div class="price-item"><span>${label}</span><span>${price}円</span></div>`;
  });
  document.getElementById('priceBreakdown').innerHTML=html;
  document.getElementById('totalPrice').innerText=total+'円';
}

async function submitBooking(){
  const payload={
    date:useDate.value,
    time:useTime.value,
    pickup:fromAddress.value,
    destination:toAddress.value,
    menu:{
      assistance:getSelectedOptionKey('assistanceType'),
      stair:getSelectedOptionKey('stairAssistance'),
      equipment:getSelectedOptionKey('equipmentRental'),
      round:getSelectedOptionKey('roundTrip')
    }
  };
  await fetch(GAS_URL,{method:'POST',body:JSON.stringify({action:'createReservation',payload})});
  alert('送信完了');
}
