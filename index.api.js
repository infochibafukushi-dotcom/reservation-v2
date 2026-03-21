const GAS_URL = "https://script.google.com/macros/s/AKfycby3QuOPtjBwF7m5kzC_P_-rHjR0_gZ1Gy-P-ToR_kknDnXiXJGNTk2NuRpm5dnEofoC/exec";

async function api(action){
  const res = await fetch(GAS_URL + "?action=" + action);
  return await res.json();
}
