const STORAGE_KEY = "reservations_v2";

function getData() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function isDuplicate(date) {
  const data = getData();
  return data.some(r => r.date === date);
}

function generateId() {
  return Date.now().toString();
}

function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  const data = getData();
  const latest = data.slice(-20).reverse();

  latest.forEach((r, i) => {
    const li = document.createElement("li");
    li.textContent = r.name + " / " + r.date;

    const btn = document.createElement("button");
    btn.textContent = "削除";
    btn.onclick = () => {
      const all = getData().filter(x => x.id !== r.id);
      saveData(all);
      render();
    };

    li.appendChild(btn);
    list.appendChild(li);
  });
}

function initApp() {
  document.getElementById("title").innerText = CONFIG.siteName;

  document.getElementById("form").onsubmit = function(e) {
    e.preventDefault();

    const name = document.getElementById("name").value;
    const date = document.getElementById("date").value;

    if (isDuplicate(date)) {
      alert("この日は予約済みです");
      return;
    }

    const data = getData();
    data.push({
      id: generateId(),
      name,
      date,
      time: Date.now()
    });

    saveData(data);

    this.reset();
    render();
  };

  render();
}

initApp();
