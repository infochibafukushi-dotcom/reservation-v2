const STORAGE_KEY = "reservations_v2";

function getData() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  const data = getData();

  data.forEach((r, i) => {
    const li = document.createElement("li");
    li.textContent = r.name + " / " + r.date;

    const btn = document.createElement("button");
    btn.textContent = "削除";
    btn.onclick = () => {
      data.splice(i, 1);
      saveData(data);
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

    const data = getData();
    data.push({ name, date });

    saveData(data);

    this.reset();
    render();
  };

  render();
}

initApp();
