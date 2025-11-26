// ==========================
// IPTV Cinema (Fixed Version)
// API goes through Render proxy (HTTPS)
// Video streaming goes directly (fast)
// ==========================

const API_PROXY = "https://proxy-github-io-fe2z.onrender.com/";  
// Do NOT add extra slashes

let state = {
  baseUrl: "",
  username: "",
  password: "",
  categories: [],
  channels: [],
  activeCategoryId: "all"
};

// Remove trailing slashes
function clean(url) {
  return url.replace(/\/+$/, "");
}

// Proxy API (only API, NOT video)
function api(url) {
  return API_PROXY + url;
}

// MAIN
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const status = document.getElementById("status");
  const categoryRow = document.getElementById("category-row");
  const channelGrid = document.getElementById("channel-grid");
  const player = document.getElementById("player");
  const title = document.getElementById("current-title");

  // LOGIN HANDLER
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Get user input
    state.baseUrl = clean(document.getElementById("serverUrl").value.trim());
    state.username = document.getElementById("username").value.trim();
    state.password = document.getElementById("password").value.trim();

    if (!state.baseUrl || !state.username || !state.password) {
      showStatus("Missing required fields.", true);
      return;
    }

    showStatus("Login OK. Loading data…");

    try {
      // --------------------------
      // 1. LOGIN
      // --------------------------
      const loginUrl =
        `${state.baseUrl}/player_api.php?username=${state.username}&password=${state.password}`;

      const loginResp = await fetch(api(loginUrl));
      const loginData = await loginResp.json();

      if (!loginData.user_info || loginData.user_info.status !== "Active") {
        showStatus("Login failed. Check username/password.", true);
        return;
      }

      // --------------------------
      // 2. LIVE CATEGORIES
      // --------------------------
      const catUrl =
        `${state.baseUrl}/player_api.php?username=${state.username}&password=${state.password}&action=get_live_categories`;

      const catResp = await fetch(api(catUrl));
      state.categories = await catResp.json();

      // --------------------------
      // 3. LIVE CHANNELS
      // --------------------------
      const chUrl =
        `${state.baseUrl}/player_api.php?username=${state.username}&password=${state.password}&action=get_live_streams`;

      const chResp = await fetch(api(chUrl));
      state.channels = await chResp.json();

      showStatus(`Loaded ${state.channels.length} channels.`, false, true);

      buildCategories(categoryRow);
      buildChannels(channelGrid, title, player);

    } catch (error) {
      console.error("ERROR:", error);
      showStatus("Server error. Try again.", true);
    }
  });

  // STATUS MESSAGES
  function showStatus(msg, error = false, success = false) {
    status.textContent = msg;
    status.classList.remove("error", "success");
    if (error) status.classList.add("error");
    if (success) status.classList.add("success");
  }

  // ==========================
  // BUILD CATEGORIES
  // ==========================
  function buildCategories(container) {
    container.innerHTML = "";

    // "All" button
    const all = document.createElement("div");
    all.className = "category-pill active";
    all.textContent = "All";
    all.onclick = () => {
      state.activeCategoryId = "all";
      highlight(container);
      buildChannels(
        document.getElementById("channel-grid"),
        document.getElementById("current-title"),
        document.getElementById("player")
      );
    };
    container.appendChild(all);

    // Each category
    state.categories.forEach(cat => {
      const pill = document.createElement("div");
      pill.className = "category-pill";
      pill.dataset.id = cat.category_id;
      pill.textContent = cat.category_name;
      pill.onclick = () => {
        state.activeCategoryId = String(cat.category_id);
        highlight(container);
        buildChannels(
          document.getElementById("channel-grid"),
          document.getElementById("current-title"),
          document.getElementById("player")
        );
      };
      container.appendChild(pill);
    });
  }

  // Highlight selected category
  function highlight(container) {
    container.querySelectorAll(".category-pill").forEach(p => {
      p.classList.remove("active");
      if (
        p.dataset.id === state.activeCategoryId ||
        (state.activeCategoryId === "all" && !p.dataset.id)
      ) {
        p.classList.add("active");
      }
    });
  }

  // ==========================
  // BUILD CHANNELS
  // ==========================
  function buildChannels(grid, titleEl, videoEl) {
    grid.innerHTML = "";

    const filtered =
      state.activeCategoryId === "all"
        ? state.channels
        : state.channels.filter(
            c => String(c.category_id) === state.activeCategoryId
          );

    filtered.forEach(ch => {
      const card = document.createElement("div");
      card.className = "channel-card";

      card.innerHTML = `
        <div class="channel-name">${ch.name}</div>
        <div class="channel-meta">LIVE</div>
      `;

      card.onclick = () => playChannel(ch, titleEl, videoEl);

      grid.appendChild(card);
    });
  }

  // ==========================
  // PLAY VIDEO (DIRECT STREAM)
  // ==========================
  function playChannel(ch, titleEl, videoEl) {
    titleEl.textContent = ch.name;

    const streamUrl =
      `${state.baseUrl}/live/${state.username}/${state.password}/${ch.stream_id}.m3u8`;

    videoEl.src = streamUrl;
    videoEl.play().catch(e => console.error("Play error:", e));
  }
});
