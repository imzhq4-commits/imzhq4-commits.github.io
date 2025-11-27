// Uses HTTPS proxy so HTTPS site (GitHub Pages) can talk to HTTP IPTV server
// Proxy: thingproxy.freeboard.io

const PROXY_PREFIX = "https://thingproxy.freeboard.io/fetch/";

let state = {
  baseServer: "",
  username: "",
  password: "",
  categories: [],
  channels: [],
  activeCategoryId: "all",
};

function cleanUrl(url) {
  return url.replace(/\/+$/, "");
}

function proxied(url) {
  return PROXY_PREFIX + url;
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const statusEl = document.getElementById("status");
  const categoryList = document.getElementById("category-list");
  const channelList = document.getElementById("channel-list");
  const currentTitle = document.getElementById("current-title");
  const player = document.getElementById("player");
  const embedBox = document.getElementById("embedCode");
  const copyEmbed = document.getElementById("copyEmbed");
  const fullscreenBtn = document.getElementById("fullscreenBtn");

  fullscreenBtn.onclick = () => {
    if (player.requestFullscreen) player.requestFullscreen();
  };

  copyEmbed.onclick = () => {
    if (!embedBox.value) return;
    embedBox.select();
    navigator.clipboard.writeText(embedBox.value).then(() => {
      alert("Embed code copied");
    });
  };

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const server = cleanUrl(
      document.getElementById("serverUrl").value.trim()
    );
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!server || !username || !password) {
      setStatus("Missing login details.", true);
      return;
    }

    state.baseServer = server;
    state.username = username;
    state.password = password;

    setStatus("Logging in...");

    try {
      // 1) Login
      const loginUrl =
        `${server}/player_api.php` +
        `?username=${encodeURIComponent(username)}` +
        `&password=${encodeURIComponent(password)}`;

      const loginResp = await fetch(proxied(loginUrl));
      const loginData = await loginResp.json();

      if (!loginData.user_info || loginData.user_info.status !== "Active") {
        setStatus("Login failed or account inactive.", true);
        return;
      }

      setStatus("Loading categories...");

      // 2) Categories
      const catUrl =
        `${server}/player_api.php` +
        `?username=${encodeURIComponent(username)}` +
        `&password=${encodeURIComponent(password)}` +
        `&action=get_live_categories`;

      const catResp = await fetch(proxied(catUrl));
      state.categories = await catResp.json();

      setStatus("Loading channels...");

      // 3) Channels
      const chUrl =
        `${server}/player_api.php` +
        `?username=${encodeURIComponent(username)}` +
        `&password=${encodeURIComponent(password)}` +
        `&action=get_live_streams`;

      const chResp = await fetch(proxied(chUrl));
      state.channels = await chResp.json();

      setStatus("Loaded.");
      renderCategories();
      renderChannels();
    } catch (err) {
      console.error(err);
      setStatus("Server error (proxy or IPTV blocked).", true);
    }
  });

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("error", isError);
  }

  function renderCategories() {
    categoryList.innerHTML = "";

    const all = document.createElement("div");
    all.className = "category-pill";
    if (state.activeCategoryId === "all") all.classList.add("active");
    all.textContent = "All";
    all.onclick = () => {
      state.activeCategoryId = "all";
      renderCategories();
      renderChannels();
    };
    categoryList.appendChild(all);

    state.categories.forEach((cat) => {
      const pill = document.createElement("div");
      pill.className = "category-pill";
      pill.textContent = cat.category_name || `Cat ${cat.category_id}`;
      pill.dataset.id = String(cat.category_id);

      if (String(state.activeCategoryId) === String(cat.category_id)) {
        pill.classList.add("active");
      }

      pill.onclick = () => {
        state.activeCategoryId = cat.category_id;
        renderCategories();
        renderChannels();
      };

      categoryList.appendChild(pill);
    });
  }

  function renderChannels() {
    channelList.innerHTML = "";

    const filtered =
      state.activeCategoryId === "all"
        ? state.channels
        : state.channels.filter(
            (c) => String(c.category_id) === String(state.activeCategoryId)
          );

    if (!filtered.length) {
      const div = document.createElement("div");
      div.className = "channel-item";
      div.textContent = "No channels in this category.";
      channelList.appendChild(div);
      return;
    }

    filtered.forEach((ch) => {
      const item = document.createElement("div");
      item.className = "channel-item";
      item.textContent = ch.name || ch.stream_name || "Channel";
      item.onclick = () => playChannel(ch);
      channelList.appendChild(item);
    });
  }

  function playChannel(ch) {
    currentTitle.textContent = ch.name || ch.stream_name || "Channel";

    const rawStream =
      `${state.baseServer}/live/` +
      `${encodeURIComponent(state.username)}/` +
      `${encodeURIComponent(state.password)}/` +
      `${ch.stream_id}.m3u8`;

    const streamUrl = proxied(rawStream);

    embedBox.value =
      `<iframe src="${streamUrl}" ` +
      `width="100%" height="100%" frameborder="0" ` +
      `allow="encrypted-media; picture-in-picture" ` +
      `allowfullscreen></iframe>`;

    if (player.canPlayType("application/vnd.apple.mpegurl")) {
      player.src = streamUrl;
      player
        .play()
        .catch((e) => console.error("Play error:", e));
    } else if (window.Hls && window.Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(player);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        player
          .play()
          .catch((e) => console.error("Play error:", e));
      });
    } else {
      player.src = streamUrl;
      player
        .play()
        .catch((e) => console.error("Play error:", e));
    }
  }
});
