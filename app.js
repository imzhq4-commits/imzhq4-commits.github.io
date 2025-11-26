// IPTV Cinema frontend-only client using Xtream Codes + corsproxy.io
// No backend required.

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

// Build proxied URL
function proxied(url) {
  // corsproxy.io expects: https://corsproxy.io/?http://example.com/...
  return corsProxyPrefix + url;
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const statusEl = document.getElementById("status");

  const categoryRow = document.getElementById("category-row");
  const channelGrid = document.getElementById("channel-grid");
  const player = document.getElementById("player");
  const currentTitle = document.getElementById("current-title");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const serverInput = document.getElementById("serverUrl").value.trim();
    const usernameInput = document.getElementById("username").value.trim();
    const passwordInput = document
      .getElementById("password")
      .value.trim();

    if (!serverInput || !usernameInput || !passwordInput) {
      setStatus("Please fill server, username and password.", true);
      return;
    }

    state.baseServer = cleanUrl(serverInput);
    state.username = usernameInput;
    state.password = passwordInput;

    setStatus("Connecting to server...", false);

    try {
      // 1) Check login
      const loginUrl =
        `${state.baseServer}/player_api.php` +
        `?username=${encodeURIComponent(state.username)}` +
        `&password=${encodeURIComponent(state.password)}`;

      const loginResp = await fetch(proxied(loginUrl));
      const loginData = await loginResp.json();

      if (
        !loginData.user_info ||
        loginData.user_info.status !== "Active"
      ) {
        setStatus(
          "Login failed or account not active. Check credentials.",
          true
        );
        console.log("Login data:", loginData);
        return;
      }

      setStatus("Login OK. Loading categories...", false);

      // 2) Load categories
      const catUrl =
        `${state.baseServer}/player_api.php` +
        `?username=${encodeURIComponent(state.username)}` +
        `&password=${encodeURIComponent(state.password)}` +
        `&action=get_live_categories`;

      const catResp = await fetch(proxied(catUrl));
      const catData = await catResp.json();

      if (!Array.isArray(catData) || catData.length === 0) {
        setStatus("No live categories found.", true);
        return;
      }

      state.categories = catData;

      // 3) Load channels
      setStatus("Loading channels...", false);

      const chUrl =
        `${state.baseServer}/player_api.php` +
        `?username=${encodeURIComponent(state.username)}` +
        `&password=${encodeURIComponent(state.password)}` +
        `&action=get_live_streams`;

      const chResp = await fetch(proxied(chUrl));
      const chData = await chResp.json();

      if (!Array.isArray(chData) || chData.length === 0) {
        setStatus("No live channels returned by server.", true);
        return;
      }

      state.channels = chData;
      setStatus(
        `Loaded ${state.channels.length} channels.`,
        false,
        true
      );

      // Build UI
      renderCategories(categoryRow);
      state.activeCategoryId = "all";
      renderChannels(channelGrid, currentTitle, player);
    } catch (err) {
      console.error("Error during login / load:", err);
      setStatus(
        "Connection failed. Server may be offline or blocking requests.",
        true
      );
    }
  });

  function setStatus(message, isError = false, isSuccess = false) {
    statusEl.textContent = message || "";
    statusEl.classList.remove("error", "success");
    if (isError) statusEl.classList.add("error");
    if (isSuccess) statusEl.classList.add("success");
  }

  function renderCategories(container) {
    container.innerHTML = "";

    // "All" pill
    const allPill = document.createElement("div");
    allPill.className = "category-pill";
    allPill.textContent = "All";
    allPill.onclick = () => {
      state.activeCategoryId = "all";
      highlightActiveCategory(container);
      renderChannels(
        document.getElementById("channel-grid"),
        document.getElementById("current-title"),
        document.getElementById("player")
      );
    };
    container.appendChild(allPill);

    // Other categories
    state.categories.forEach((cat) => {
      const pill = document.createElement("div");
      pill.className = "category-pill";
      pill.textContent = cat.category_name || `Cat ${cat.category_id}`;
      pill.dataset.id = String(cat.category_id);

      pill.onclick = () => {
        state.activeCategoryId = String(cat.category_id);
        highlightActiveCategory(container);
        renderChannels(
          document.getElementById("channel-grid"),
          document.getElementById("current-title"),
          document.getElementById("player")
        );
      };

      container.appendChild(pill);
    });

    highlightActiveCategory(container);
  }

  function highlightActiveCategory(container) {
    const pills = container.querySelectorAll(".category-pill");
    pills.forEach((pill) => {
      pill.classList.remove("active");
      const id = pill.dataset.id || "all";
      if (id === state.activeCategoryId) {
        pill.classList.add("active");
      } else if (
        state.activeCategoryId === "all" &&
        !pill.dataset.id
      ) {
        pill.classList.add("active");
      }
    });
  }

  function renderChannels(grid, titleEl, videoEl) {
    grid.innerHTML = "";

    const filtered =
      state.activeCategoryId === "all"
        ? state.channels
        : state.channels.filter(
            (ch) =>
              String(ch.category_id) === state.activeCategoryId
          );

    if (!filtered.length) {
      const div = document.createElement("div");
      div.textContent = "No channels in this category.";
      div.style.opacity = "0.7";
      grid.appendChild(div);
      return;
    }

    filtered.forEach((ch) => {
      const card = document.createElement("div");
      card.className = "channel-card";

      const name = document.createElement("div");
      name.className = "channel-name";
      name.textContent = ch.name || ch.stream_name || "Channel";

      const meta = document.createElement("div");
      meta.className = "channel-meta";
      meta.textContent = ch.stream_type
        ? ch.stream_type.toUpperCase()
        : "LIVE";

      card.appendChild(name);
      card.appendChild(meta);

      card.onclick = () => {
        playChannel(ch, titleEl, videoEl);
      };

      grid.appendChild(card);
    });
  }

  function playChannel(channel, titleEl, videoEl) {
    titleEl.textContent =
      channel.name || channel.stream_name || "Channel";

    // Xtream streaming URL
    const rawStream =
      `${state.baseServer}/live/` +
      `${encodeURIComponent(state.username)}/` +
      `${encodeURIComponent(state.password)}/` +
      `${channel.stream_id}.m3u8`;

    // Send through proxy so it's HTTPS too
    const streamUrl = proxied(rawStream);

    // Use HLS.js if needed
    if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari & iOS
      videoEl.src = streamUrl;
      videoEl.play().catch((err) => {
        console.error("Play error:", err);
      });
    } else if (window.Hls && window.Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl
          .play()
          .catch((err) => console.error("Play error:", err));
      });
    } else {
      // Fallback
      videoEl.src = streamUrl;
      videoEl
        .play()
        .catch((err) => console.error("Play error:", err));
    }
  }
});
