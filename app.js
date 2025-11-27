function proxied(url){ return "https://corsproxy.io/?" + url; }

let state={ baseServer:"", username:"", password:"", categories:[], channels:[], activeCategoryId:"all" };

function cleanUrl(x){ return x.replace(/\/+$/,""); }

document.addEventListener("DOMContentLoaded",()=>{
  const loginForm=document.getElementById("login-form");
  const statusEl=document.getElementById("status");
  const catList=document.getElementById("category-list");
  const chList=document.getElementById("channel-list");
  const titleEl=document.getElementById("current-title");
  const player=document.getElementById("player");
  const embedBox=document.getElementById("embedCode");
  const copyBtn=document.getElementById("copyEmbed");
  const fsBtn=document.getElementById("fullscreenBtn");

  fsBtn.onclick=()=>{ if(player.requestFullscreen) player.requestFullscreen(); };
  copyBtn.onclick=()=>{ navigator.clipboard.writeText(embedBox.value); alert("Copied!"); };

  loginForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const s=cleanUrl(serverUrl.value.trim());
    const u=username.value.trim();
    const p=password.value.trim();
    if(!s||!u||!p){ statusEl.textContent="Missing login"; return; }
    state.baseServer=s; state.username=u; state.password=p;
    statusEl.textContent="Logging in…";

    try{
      let login=await fetch(proxied(`${s}/player_api.php?username=${u}&password=${p}`));
      let loginData=await login.json();
      if(!loginData.user_info || loginData.user_info.status!=="Active"){
        statusEl.textContent="Login failed"; return;
      }
      statusEl.textContent="Loading…";

      let cats=await fetch(proxied(`${s}/player_api.php?username=${u}&password=${p}&action=get_live_categories`));
      state.categories=await cats.json();

      let ch=await fetch(proxied(`${s}/player_api.php?username=${u}&password=${p}&action=get_live_streams`));
      state.channels=await ch.json();

      statusEl.textContent="Loaded.";
      renderCats(); renderCh();
    }catch(err){ statusEl.textContent="Server error"; console.log(err); }
  });

  function renderCats(){
    catList.innerHTML="";
    let all=document.createElement("div");
    all.className="category-pill";
    all.textContent="All";
    all.onclick=()=>{ state.activeCategoryId="all"; renderCats(); renderCh(); };
    catList.appendChild(all);
    state.categories.forEach(c=>{
      let el=document.createElement("div");
      el.className="category-pill";
      el.textContent=c.category_name;
      el.onclick=()=>{ state.activeCategoryId=c.category_id; renderCats(); renderCh(); };
      catList.appendChild(el);
    });
  }

  function renderCh(){
    chList.innerHTML="";
    let f= state.activeCategoryId==="all" ? state.channels :
           state.channels.filter(x=> x.category_id==state.activeCategoryId );

    f.forEach(ch=>{
      let el=document.createElement("div");
      el.className="channel-card";
      el.textContent=ch.name;
      el.onclick=()=> play(ch);
      chList.appendChild(el);
    });
  }

  function play(ch){
    titleEl.textContent=ch.name;
    const raw=`${state.baseServer}/live/${state.username}/${state.password}/${ch.stream_id}.m3u8`;
    const url=proxied(raw);

    embedBox.value=`<iframe src="https://corsproxy.io/?${raw}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;

    if(player.canPlayType("application/vnd.apple.mpegurl")){
      player.src=url; player.play();
    } else if(window.Hls){
      const h=new Hls(); h.loadSource(url); h.attachMedia(player); h.on(Hls.Events.MANIFEST_PARSED,()=>player.play());
    } else { player.src=url; player.play(); }
  }
});