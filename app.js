// IPTV Cinema frontend-only client using Xtream Codes + corsproxy.io
// API uses proxy (JSON only), video loads direct (no proxy).

const corsProxyPrefix = "https://corsproxy.io/?";

let state = {
  baseServer: "",
  username: "",
  password: "",
  categories: [],
  channels: [],
  activeCategoryId: "all"
};

// Helper: strip trailing slashes
function cleanUrl(url) {
  return url.replace(/\/+$/, "");
}

// Build proxied URL for API
function proxied(url) {
  return corsProxyPrefix + url;
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const statusEl = document.getElementById("status");

  const categoryRow = document.getElementById("category-row");
  const channelGrid = document.getElementById("channel-grid");
  const player = document.getElementById("player");
  const currentTitle = document.getElementById("current-title");

  // ======================
  // LOGIN HANDLER
  // ======================
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const serverInput = document.getElementById("serverUrl").value.trim();
    const usernameInput = document.getElementById("username").value.trim();
    const passwordInput = document.getElementById("password").value.trim();

    if (!serverInput || !usernameInput || !passwordInput) {
      setStatus("Please fill server, username and password.", true);
      return;
    }

    state.baseServer = cleanUrl(serverInput);
    state.username = usernameInput;
    state.password = passwordInput;

    setStatus("Connecting to server...", false);

    try {
      // 1. CHECK LOGIN (API)
      const loginUrl =
        `${state.baseServer}/player_api.php` +
        `?username=${encodeURIComponent(state.username)}` +
        `&password=${encodeURIComponent(state.password)}`;

      const loginResp = await fetch(proxied(loginUrl));
      const loginData = await loginResp.json();

      if (!loginData.user_info || loginData.user_info.status !== "Active") {
        setStatus("Login failed. Check credentials.", true);
        return;
      }

      setStatus("Login OK. Loading categories...");

      // 2. GET LIVE CATEGORIES (API)
      const catUrl =
        `${state.baseServer}/player_api.php` +
        `?username=${encodeURIComponent(state.username)}` +
        `&password=${encodeURIComponent(state.password)}` +
        `&action=get_live_categories`;

      const catResp = await fetch(proxied(catUrl));
      const catData = await catResp.json();

      if (!Array.isArray(catData)) {
        setStatus("No categories found.", true);
        return;
      }

      state.categories = catData;

      // 3. GET LIVE CHANNELS (API)
      setStatus("Loading channels...");

      const chUrl =
        `${state.baseServer}/player_api.php` +
        `?username=${encodeURIComponent(state.username)}` +
        `&password=${encodeURIComponent(state.password)}` +
        `&action=get_live_streams`;

      const chResp = await fetch(proxied(chUrl));
      const chData = await chResp.json();

      if (!Array.isArray(chData)) {
        setStatus("No channels returned by server.", true);
        return;
      }

      state.channels = chData;
      setStatus(`Loaded ${state.channels.length} channels.`, false, true);

      // BUILD UI
      renderCategories(categoryRow);
      renderChannels(channelGrid, currentTitle, player);

    } catch (err) {
      console.error("Login/load error:", err);
      setStatus("Connection failed. Proxy may be overloaded.", true);
    }
  });

  // ======================
  // STATUS BAR
  // ======================
  function setStatus(message, isError = false, isSuccess = false) {
    statusEl.textContent = message;
    statusEl.classList.remove("error", "success");
    if (isError) statusEl.classList.add("error");
    if (isSuccess) statusEl.classList.add("success");
  }

  // ======================
  // RENDER CATEGORIES
  // ======================
  function renderCategories(container) {
    container.innerHTML = "";

    // "All" category
    const all = document.createElement("div");
    all.className = "category-pill active";
    all.textContent = "All";
    all.onclick = () => {
      state.activeCategoryId = "all";
      highlightActiveCategory(container);
      renderChannels(
        document.getElementById("channel-grid"),
        document.getElementById("current-title"),
        document.getElementById("player")
      );
    };
    container.appendChild(all);

    // Other categories
    state.categories.forEach(cat => {
      const pill = document.createElement("div");
      pill.className = "category-pill";
      pill.dataset.id = String(cat.category_id);
      pill.textContent = cat.category_name;

      pill.onclick = () => {
        state.activeCategoryId = pill.dataset.id;
        highlightActiveCategory(container);
        renderChannels(
          document.getElementById("channel-grid"),
          document.getElementById("current-title"),
          document.getElementById("player")
        );
      };

      container.appendChild(pill);
    });
  }

  function highlightActiveCategory(container) {
    container.querySelectorAll(".category-pill").forEach(pill => {
      pill.classList.remove("active");
      if (
        pill.dataset.id === state.activeCategoryId ||
        (state.activeCategoryId === "all" && !pill.dataset.id)
      ) {
        pill.classList.add("active");
      }
    });
  }

  // ======================
  // RENDER CHANNELS
  // ======================
  function renderChannels(grid, titleEl, videoEl) {
    grid.innerHTML = "";

    const filtered =
      state.activeCategoryId === "all"
        ? state.channels
        : state.channels.filter(ch =>
            String(ch.category_id) === state.activeCategoryId
          );

    filtered.forEach(ch => {
      const card = document.createElement("div");
      card.className = "channel-card";

      const name = document.createElement("div");
      name.className = "channel-name";
      name.textContent = ch.name;

      const meta = document.createElement("div");
      meta.className = "channel-meta";
      meta.textContent = "LIVE";

      card.appendChild(name);
      card.appendChild(meta);

      card.onclick = () => playChannel(ch, titleEl, videoEl);

      grid.appendChild(card);
    });
  }

  // ======================
  // PLAY VIDEO (DIRECT — NO PROXY)
  // ======================
  function playChannel(channel, titleEl, videoEl) {
    titleEl.textContent = channel.name;

    // DIRECT VIDEO URL (fixed)
    const streamUrl =
      `${state.baseServer}/live/` +
      `${encodeURIComponent(state.username)}/` +
      `${encodeURIComponent(state.password)}/` +
      `${channel.stream_id}.m3u8`;

    console.log("Playing:", streamUrl);

    // Safari / iOS native support
    if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = streamUrl;
      videoEl.play().catch(err => console.error("Play error:", err));
      return;
    }

    // Other browsers using HLS.js
    if (window.Hls && window.Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(err => console.error("Play error:", err));
      });
      return;
    }

    // Fallback
    videoEl.src = streamUrl;
    videoEl.play().catch(err => console.error("Play error:", err));
  }
});
