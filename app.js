// =====================================================
// IPTV Cinema - Full Xtream Codes Player
// API Proxy: AllOrigins
// VIDEO Proxy: Elfsight (HLS streaming capable)
// =====================================================

// API proxy (JSON only)
const apiProxy = "https://api.allorigins.win/raw?url=";

// VIDEO proxy (HLS + MP4 capable)
const videoProxy = "https://cors-proxy.elfsight.com/?url=";

function proxyAPI(url) {
  return apiProxy + encodeURIComponent(url);
}

function proxyVIDEO(url) {
  return videoProxy + encodeURIComponent(url);
}

// ==================================================================

let state = {
  server: "",
  user: "",
  pass: "",
  activeTab: "live",
  activeCategory: "all",
  liveCats: [],
  vodCats: [],
  seriesCats: [],
  liveStreams: [],
  vodStreams: [],
  seriesList: []
};

document.addEventListener("DOMContentLoaded", () => {

  const loginForm = document.getElementById("login-form");
  const statusEl = document.getElementById("status");
  const sidebarList = document.getElementById("sidebar-list");
  const contentGrid = document.getElementById("content-grid");
  const titleEl = document.getElementById("current-title");
  const player = document.getElementById("player");

  // ----------------------------
  // LOGIN
  // ----------------------------
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    state.server = document.getElementById("serverUrl").value.trim();
    state.user = document.getElementById("username").value.trim();
    state.pass = document.getElementById("password").value.trim();

    if (!state.server || !state.user || !state.pass) {
      setStatus("Please fill all fields", true);
      return;
    }

    setStatus("Logging in...");

    const loginUrl =
      `${state.server}/player_api.php?username=${state.user}&password=${state.pass}`;

    try {
      const loginResp = await fetch(proxyAPI(loginUrl));
      const loginData = await loginResp.json();

      if (!loginData.user_info || loginData.user_info.status !== "Active") {
        return setStatus("Login failed. Wrong username/password.", true);
      }

      setStatus("Login OK. Loading data...");
      await loadAllData();
      setupTabs();
      renderSidebar();
      renderContent();

      setStatus("Loaded ✔", false, true);

    } catch (err) {
      console.error(err);
      setStatus("Server error. Try again.", true);
    }
  });

  // ----------------------------
  // LOAD ALL API DATA
  // ----------------------------
  async function loadAllData() {
    const base = `${state.server}/player_api.php?username=${state.user}&password=${state.pass}`;

    state.liveCats   = await fetch(proxyAPI(base + "&action=get_live_categories")).then(r=>r.json());
    state.vodCats    = await fetch(proxyAPI(base + "&action=get_vod_categories")).then(r=>r.json());
    state.seriesCats = await fetch(proxyAPI(base + "&action=get_series_categories")).then(r=>r.json());

    state.liveStreams = await fetch(proxyAPI(base + "&action=get_live_streams")).then(r=>r.json());
    state.vodStreams  = await fetch(proxyAPI(base + "&action=get_vod_streams")).then(r=>r.json());
    state.seriesList  = await fetch(proxyAPI(base + "&action=get_series")).then(r=>r.json());
  }

  // ----------------------------
  // TABS
  // ----------------------------
  function setupTabs() {
    const tabs = document.querySelectorAll(".tab-btn");

    tabs.forEach(btn => {
      btn.onclick = () => {
        tabs.forEach(t => t.classList.remove("active"));
        btn.classList.add("active");

        state.activeTab = btn.dataset.tab;
        state.activeCategory = "all";

        renderSidebar();
        renderContent();
      };
    });
  }

  // ----------------------------
  // SIDEBAR CATEGORIES
  // ----------------------------
  function renderSidebar() {
    sidebarList.innerHTML = "";

    let categories = [];

    if (state.activeTab === "live")   categories = state.liveCats;
    if (state.activeTab === "movies") categories = state.vodCats;
    if (state.activeTab === "series") categories = state.seriesCats;

    // ALL
    const all = document.createElement("div");
    all.className = "sidebar-item";
    all.innerText = "All";
    all.onclick = () => {
      state.activeCategory = "all";
      renderContent();
    };
    sidebarList.appendChild(all);

    // CATEGORY LIST
    categories.forEach(cat => {
      const item = document.createElement("div");
      item.className = "sidebar-item";
      item.innerText = cat.category_name;
      item.onclick = () => {
        state.activeCategory = cat.category_id;
        renderContent();
      };
      sidebarList.appendChild(item);
    });
  }

  // ----------------------------
  // CONTENT GRID
  // ----------------------------
  function renderContent() {
    contentGrid.innerHTML = "";

    let list = [];

    if (state.activeTab === "live") {
      list = state.activeCategory === "all"
        ? state.liveStreams
        : state.liveStreams.filter(s => String(s.category_id) === String(state.activeCategory));
    }

    if (state.activeTab === "movies") {
      list = state.activeCategory === "all"
        ? state.vodStreams
        : state.vodStreams.filter(s => String(s.category_id) === String(state.activeCategory));
    }

    if (state.activeTab === "series") {
      list = state.activeCategory === "all"
        ? state.seriesList
        : state.seriesList.filter(s => String(s.category_id) === String(state.activeCategory));
    }

    list.forEach(item => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `<div class="card-title">${item.name}</div>`;
      card.onclick = () => playItem(item);

      contentGrid.appendChild(card);
    });
  }

  // ----------------------------
  // PLAY ITEM (LIVE / MOVIE / SERIES)
  // ----------------------------
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

    const finalUrl = proxyVIDEO(url);

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(finalUrl);
      hls.attachMedia(player);
      hls.on(Hls.Events.MANIFEST_PARSED, () => player.play());
    } else {
      player.src = finalUrl;
      player.play();
    }
  }

  // ----------------------------
  // STATUS
  // ----------------------------
  function setStatus(msg, error=false, success=false) {
    statusEl.textContent = msg;
    statusEl.className = "status-bar";
    if (error) statusEl.classList.add("error");
    if (success) statusEl.classList.add("success");
  }

});
