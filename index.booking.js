let menuMaster = [];

async function init(){
  const res = await api('getMenuMaster');
  menuMaster = res.data || [];

  render();
}

function getGroup(group){
  return menuMaster.filter(m=>m.menu_group===group);
}

function render(){
  renderSelect("flowSelect", getGroup("flow"));
  renderSelect("assistanceType", getGroup("assistance"));
  renderSelect("stairAssistance", getGroup("stair"));
  renderSelect("equipmentRental", getGroup("equipment"));
}

function calcTotal(){
  let total = 0;
  ["flowSelect","assistanceType","stairAssistance","equipmentRental"].forEach(id=>{
    const val = document.getElementById(id).value;
    const item = menuMaster.find(m=>m.key===val);
    if(item) total += Number(item.price||0);
  });
  document.getElementById("totalPrice").innerText = total + "円";
  return total;
}

function submitReservation(){
  const total = calcTotal();

  fetch(GAS_URL,{
    method:"POST",
    body: JSON.stringify({
      action:"createReservation",
      payload:{
        menu:{
          flow:flowSelect.value,
          assistance:assistanceType.value,
          stair:stairAssistance.value,
          equipment:equipmentRental.value
        },
        total_price: total
      }
    })
  });
}

window.onload = init;
