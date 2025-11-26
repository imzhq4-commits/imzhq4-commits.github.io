const proxy = "https://api.allorigins.win/raw?url=";

let state = {
  server: "",
  user: "",
  pass: "",
  liveCats: [],
  vodCats: [],
  seriesCats: [],
  liveStreams: [],
  vodStreams: [],
  seriesList: [],
  activeTab: "live",
  activeCategory: "all"
};

function proxied(url) {
  return proxy + encodeURIComponent(url);
}

document.addEventListener("DOMContentLoaded", () => {

  const loginForm = document.getElementById("login-form");
  const statusEl = document.getElementById("status");
  const tabs = document.querySelectorAll(".tab-btn");
  const sidebarList = document.getElementById("sidebar-list");
  const contentGrid = document.getElementById("content-grid");
  const player = document.getElementById("player");
  const titleEl = document.getElementById("current-title");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    state.server = document.getElementById("serverUrl").value.trim();
    state.user = document.getElementById("username").value.trim();
    state.pass = document.getElementById("password").value.trim();

    if (!state.server || !state.user || !state.pass)
      return setStatus("Please fill all fields", true);

    setStatus("Logging in...");

    const loginUrl =
      `${state.server}/player_api.php?username=${state.user}&password=${state.pass}`;

    try {
      const res = await fetch(proxied(loginUrl));
      const data = await res.json();

      if (!data.user_info || data.user_info.status !== "Active")
        return setStatus("Login failed", true);

      setStatus("Loading categories...");
      await loadAllData();
      renderUI();

    } catch (err) {
      setStatus("Server error", true);
    }
  });

  async function loadAllData() {
    const base = `${state.server}/player_api.php?username=${state.user}&password=${state.pass}`;

    const liveCats = await fetch(proxied(base + "&action=get_live_categories")).then(r=>r.json());
    const vodCats = await fetch(proxied(base + "&action=get_vod_categories")).then(r=>r.json());
    const seriesCats = await fetch(proxied(base + "&action=get_series_categories")).then(r=>r.json());

    const live = await fetch(proxied(base + "&action=get_live_streams")).then(r=>r.json());
    const vod = await fetch(proxied(base + "&action=get_vod_streams")).then(r=>r.json());
    const series = await fetch(proxied(base + "&action=get_series")).then(r=>r.json());

    state.liveCats = liveCats;
    state.vodCats = vodCats;
    state.seriesCats = seriesCats;

    state.liveStreams = live;
    state.vodStreams = vod;
    state.seriesList = series;

    setStatus("Loaded ✔", false, true);
  }

  function renderUI() {
    renderTabs();
    renderSidebar();
    renderContent();
  }

  function renderTabs() {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(btn => {
      btn.onclick = () => {
        tabs.forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        state.activeTab = btn.dataset.tab;
        renderSidebar();
        renderContent();
      };
    });
  }

  function renderSidebar() {
    sidebarList.innerHTML = "";

    let categories = [];

    if (state.activeTab === "live") categories = state.liveCats;
    if (state.activeTab === "movies") categories = state.vodCats;
    if (state.activeTab === "series") categories = state.seriesCats;

    const all = document.createElement("div");
    all.className = "sidebar-item";
    all.textContent = "All";
    all.onclick = ()=>{ state.activeCategory="all"; renderContent(); };
    sidebarList.appendChild(all);

    categories.forEach(cat => {
      const item = document.createElement("div");
      item.className = "sidebar-item";
      item.textContent = cat.category_name;
      item.onclick = () => {
        state.activeCategory = cat.category_id;
        renderContent();
      };
      sidebarList.appendChild(item);
    });
  }

  function renderContent() {
    contentGrid.innerHTML = "";

    let list = [];

    if (state.activeTab === "live") {
      list = state.activeCategory==="all"
        ? state.liveStreams
        : state.liveStreams.filter(x=>String(x.category_id)===String(state.activeCategory));
    }

    if (state.activeTab === "movies") {
      list = state.activeCategory==="all"
        ? state.vodStreams
        : state.vodStreams.filter(x=>String(x.category_id)===String(state.activeCategory));
    }

    if (state.activeTab === "series") {
      list = state.activeCategory==="all"
        ? state.seriesList
        : state.seriesList.filter(x=>String(x.category_id)===String(state.activeCategory));
    }

    list.forEach(item => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `<div class="card-title">${item.name || item.stream_name}</div>`;

      card.onclick = () => playItem(item);
      contentGrid.appendChild(card);
    });
  }

  function playItem(item) {
    titleEl.textContent = item.name;

    let url = "";

    if (state.activeTab === "live") {
      url = `${state.server}/live/${state.user}/${state.pass}/${item.stream_id}.m3u8`;
    }

    if (state.activeTab === "movies") {
      url = `${state.server}/movie/${state.user}/${state.pass}/${item.stream_id}.mp4`;
    }

    if (state.activeTab === "series") {
      url = `${state.server}/series/${state.user}/${state.pass}/${item.series_id}.mp4`;
    }

    const final = proxied(url);

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(final);
      hls.attachMedia(player);
      hls.on(Hls.Events.MANIFEST_PARSED,()=>player.play());
    } else {
      player.src = final;
      player.play();
    }
  }

  function setStatus(msg, error=false, success=false) {
    statusEl.textContent = msg;
    statusEl.className = "status-bar";
    if (error) statusEl.classList.add("error");
    if (success) statusEl.classList.add("success");
  }

});
