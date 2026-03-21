function renderSelect(id, items){
  const el = document.getElementById(id);
  el.innerHTML = items.map(i=>`<option value="${i.key}">${i.label} (${i.price}円)</option>`).join('');
}
