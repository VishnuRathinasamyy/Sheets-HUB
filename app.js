/* =====================================================================
   ODEA SHEETS HUB v3 — app logic
   ⚙️ SETTINGS — the only things you ever edit in code:
===================================================================== */
const USERS = [
  { user: "Deepika Sampath", pass: "Odea2026", role: "admin", team: "Admin", name: "Master Admin" },
];

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDJQwWDb2csMhg-i_84TZH0VNpswFm1yh4",
  authDomain: "odea-hub.firebaseapp.com",
  databaseURL: "https://odea-hub-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "odea-hub",
  storageBucket: "odea-hub.firebasestorage.app",
  messagingSenderId: "198528619994",
  appId: "1:198528619994:web:093b8522eb4fcd3c239ce3"
};

const DEFAULT_TEAMS = ["Tech Team","Creative Team","BDE Team","Production Team","Admin"];
const LOCK_HOUR = 17;   // 5 PM IST — members can't add/delete entries after this
/* ===================== end of settings ============================ */

const LS_SESSION="odea_session", LS_THEME="odea_theme";
let db=null, cloudOn=false;
let sheets=[], cloudUsers=[], teams=[], entries=[], tasks=[], settings={};
let activeId=null, editingSheetId=null, editingUserKey=null, currentView="welcome";
let folders=[], editingFolderId=null, openFolders=JSON.parse(localStorage.getItem("odea_openfolders")||"{}");
let approvals=[], apprFilter="all";
let calls=[], activeCall=null, ringTimer=null, ringCtx=null, ringStop=null, dnd=localStorage.getItem("odea_dnd")==="1";
const RING_SECONDS=30;
let archTab="appr", archSort={col:"created",dir:-1};
const HIDE_AFTER=12*60*60*1000;   // approved/completed items vanish after 12 hours
let pins={};
function pinKey(){return "pins/"+(me().user||"anon");}
function isPinned(id){return !!pins[id];}
function togglePin(ev,id){
  ev.stopPropagation();
  if(!cloudOn)return;
  const on=!pins[id];
  db.ref(pinKey()+"/"+id).set(on?true:null);
  toast(on?"Pinned to top ✓":"Unpinned");
}

/* ---------- tiny helpers ---------- */
const $=id=>document.getElementById(id);
function toast(m){const t=$("toast");t.textContent=m;t.classList.add("on");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("on"),2600);}
function openModal(id){$(id).classList.add("on")}
function closeModal(id){$(id).classList.remove("on")}
function esc(t){return String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function session(){
  try{
    let s=sessionStorage.getItem(LS_SESSION);
    if(!s){                                   // new tab? inherit the login
      const b=localStorage.getItem(LS_SESSION);
      if(b){sessionStorage.setItem(LS_SESSION,b);s=b;}
    }
    return JSON.parse(s);
  }catch(e){return null}
}
function me(){return session()||{};}
function isAdminNow(){return me().role==="admin";}
function isCoordinator(){return me().role==="coordinator";}
function setPill(state,text){const p=$("syncPill");if(!p)return;p.className="sync-pill "+state;$("syncText").textContent=text;}
function todayIST(){return new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});}
function niceDate(){return new Date().toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata",weekday:"long",day:"numeric",month:"long"});}
function hourIST(){return parseInt(new Date().toLocaleString("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",hour12:false}),10);}
function isLocked(){return !isAdminNow() && hourIST()>=LOCK_HOUR;}
function cap(s){return s?s[0].toUpperCase()+s.slice(1):s;}
function userRec(u){return allUsers().find(a=>a.user===u)||{};}
function displayName(u){const x=userRec(u);return x.name||cap(u);}
function avatarHTML(u,size){
  const r=userRec(u), init=(r.name||u||"?")[0].toUpperCase();
  if(!r.photo) return `<div class="avatar" ${size?`style="width:${size}px;height:${size}px;font-size:${Math.round(size*.4)}px"`:""}>${esc(init)}</div>`;
  const st=size?`style="width:${size}px;height:${size}px;font-size:${Math.round(size*.4)}px"`:"";
  return r.photo?`<div class="avatar" ${st}><img src="${r.photo}" alt=""></div>`
                :`<div class="avatar" ${st}>${esc(init)}</div>`;
}
function sanitize(html){
  const doc=new DOMParser().parseFromString(html,"text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link").forEach(n=>n.remove());
  doc.querySelectorAll("*").forEach(n=>{[...n.attributes].forEach(a=>{
    if(/^on/i.test(a.name)||(a.name==="href"&&/^javascript:/i.test(a.value)))n.removeAttribute(a.name);
  });});
  return doc.body.innerHTML;
}

/* ---------- cloud boot ---------- */
function bootCloud(){
  if(!FIREBASE_CONFIG.apiKey||FIREBASE_CONFIG.apiKey==="PASTE-YOURS"){setPill("off","Local mode — cloud config missing");return;}
  try{
    firebase.initializeApp(FIREBASE_CONFIG);
    db=firebase.database(); cloudOn=true;
    setPill("ok","Cloud sync on");
    db.ref("sheets").on("value",s=>{const v=s.val()||{};
      sheets=Object.keys(v).map(k=>({id:k,...v[k]})).sort((a,b)=>((a.order??a.ts??0)-(b.order??b.ts??0)));
      renderFolders();});
    db.ref("users").on("value",s=>{const v=s.val()||{};
      cloudUsers=Object.keys(v).map(k=>({user:k,...v[k]}));
      if($("usersModal").classList.contains("on"))renderUsers();
      if(currentView==="board")renderBoard(); else if(currentView==="myday")renderMyDay();
      refreshMyChip();});
    db.ref("revoked").on("value",s=>{
      const v=s.val()||{}, m=session();
      if(m&&m.user&&v[m.user]) forceLogout();
    });
    db.ref("masters").on("value",s=>{const v=s.val()||{};
      USERS.forEach(u=>{
        const m=v[u.user]||{};
        u.photo = m.photo || null;                 // ← clears when removed
        if(m.name) u.name = m.name;
      });
      refreshMyChip(); if(currentView==="board")renderBoard();
      if($("usersModal").classList.contains("on"))renderUsers();
      if($("profileModal").classList.contains("on"))$("pfPreview").innerHTML=avatarHTML(me().user,72);});
    db.ref("pins").on("value",s=>{const v=s.val()||{};
      pins=(v[me().user||"anon"])||{}; renderFolders();});
    db.ref("folders").on("value",s=>{const v=s.val()||{};
      folders=Object.keys(v).map(k=>({id:k,...v[k]})).sort((a,b)=>((a.order??a.ts??0)-(b.order??b.ts??0)));
      renderFolders(); renderFolderSelect();});
    db.ref("teams").on("value",s=>{const v=s.val()||{};
      teams=Object.keys(v).map(k=>({id:k,name:v[k].name}));
      if(!teams.length&&isAdminNow())seedTeams();
      renderTeamDependents();});
        db.ref("entries").on("value",s=>{const v=s.val()||{};
      entries=Object.keys(v).map(k=>({id:k,...v[k]}));
      if(currentView==="board")renderBoard();
      else if(currentView==="myday")renderMyDay();});
    db.ref("tasks").on("value",s=>{const v=s.val()||{};
      tasks=Object.keys(v).map(k=>({id:k,...v[k]})).sort((a,b)=>(b.ts||0)-(a.ts||0));
      updateTaskBadge();
      if($("tasksModal").classList.contains("on"))renderTasks();
      if(currentView==="myday")renderMyDay();});
    db.ref("approvals").on("value",s=>{const v=s.val()||{};
      approvals=Object.keys(v).map(k=>({id:k,...v[k]})).sort((a,b)=>(b.ts||0)-(a.ts||0));
      updateApprBadge(); notifyCheck();
      if($("apprModal").classList.contains("on"))renderApprovals();
      if(currentView==="myday")renderMyDay();});
        db.ref("calls").on("value",s=>{const v=s.val()||{};
      calls=Object.keys(v).map(k=>({id:k,...v[k]}));
      handleCalls();});
    db.ref("settings").on("value",s=>{settings=s.val()||{};
      if($("settingsModal").classList.contains("on"))$("archiveUrl").value=settings.archiveUrl||"";
      renderFolders();});
  }catch(e){setPill("off","Local mode");}
}
function seedTeams(){DEFAULT_TEAMS.forEach(n=>db.ref("teams").push({name:n}));}
function teamNames(){return teams.length?teams.map(t=>t.name):DEFAULT_TEAMS;}
function allUsers(){return USERS.concat(cloudUsers);}


function forceLogout(){
  sessionStorage.removeItem(LS_SESSION);
  localStorage.removeItem(LS_SESSION);
  alert("Your access has been removed by an administrator.");
  location.reload();
}

/* ---------- auth ---------- */
function doLogin(){
  const u=$("u").value.trim(),p=$("p").value;
  const hit=allUsers().find(x=>x.user.toLowerCase()===u.toLowerCase()&&x.pass===p);
  if(!hit){$("loginErr").style.display="block";return;}
  const sess=JSON.stringify({user:hit.user,role:hit.role,team:hit.team||"",name:hit.name||cap(hit.user)});
  sessionStorage.setItem(LS_SESSION,sess); localStorage.setItem(LS_SESSION,sess);
  enterApp();
}
function doLogout(){sessionStorage.removeItem(LS_SESSION);localStorage.removeItem(LS_SESSION);location.reload();}
document.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&$("loginView").style.display!=="none"&&!$("appView").classList.contains("on"))doLogin();
});

function refreshMyChip(){
  const s=session();if(!s)return;
  const r=userRec(s.user);
  const name=r.name||s.name||s.user;
  $("whoName").textContent=name;
  const tl=myTeams(s.user).join(", ");
  $("whoRole").textContent=roleLabel(s.role)+(tl?" · "+tl:"");
  $("avatar").outerHTML=avatarHTML(s.user).replace('class="avatar"','class="avatar" id="avatar"');
}
function roleLabel(r){return r==="admin"?"Admin":r==="coordinator"?"Project Co-ordinator":"Member";}

function enterApp(){
  const s=session();if(!s)return;
  $("loginView").style.display="none";
  $("appView").classList.add("on");
  refreshMyChip();
  const a=isAdminNow(), co=isCoordinator();
  $("usersBtn").style.display=a?"":"none";
  $("settingsBtn").style.display=a?"":"none";
  $("addBtn").style.display=a?"":"none";
  $("newFolderBtn")&&($("newFolderBtn").style.display=a?"":"none");
  $("boardBtn")&&($("boardBtn").style.display=co?"none":"");
  $("mydayBtn")&&($("mydayBtn").style.display=co?"none":"");
  $("apprBtn")&&($("apprBtn").style.display=co?"none":"");
  $("archBtn")&&($("archBtn").style.display=co?"none":"");
  isCoordinator()?showWelcome():showMyDay();
  renderFolders(); updateTaskBadge();
    askNotifyPermission();
  bootDigest();
  if("speechSynthesis" in window)speechSynthesis.getVoices();   // warm up voices
  setTimeout(()=>{checkMyBirthday();birthdayHeads();},2000);
  const want=new URLSearchParams(location.search).get("sheet");
  if(want) setTimeout(()=>openSheet(want),600);   // deep link from a new tab
  if(co)openTasks();   // coordinators land straight in their one job
}

/* ---------- theme ---------- */
function applyTheme(t){
  document.body.classList.toggle("light",t==="light");
  const b=$("themeBtn");if(b)b.textContent=t==="light"?"☀️":"🌙";
  localStorage.setItem(LS_THEME,t);
}
function toggleTheme(){applyTheme(document.body.classList.contains("light")?"dark":"light");}
applyTheme(localStorage.getItem(LS_THEME)||"dark");

/* ---------- sidebar toggle ---------- */
function smartToggle(){
  const b=$("burgerBtn");
  if(window.innerWidth>860){
    const closed=$("sidebar").classList.toggle("closed");
    b.textContent=closed?"☰":"◀";
  }else{
    const willOpen=!$("sidebar").classList.contains("open");
    toggleSide(willOpen);
  }
}
function toggleSide(force){
  const sb=$("sidebar"),sc=$("scrim");
  const on=force!==undefined?force:!sb.classList.contains("open");
  sb.classList.toggle("open",on);sc.classList.toggle("on",on);
  if(window.innerWidth<=860&&$("burgerBtn"))$("burgerBtn").textContent=on?"✕":"☰";
}

function myTeams(u){                     // always read live data, not the frozen session
  const key=u||me().user;
  const r=userRec(key);
  if(r.teams)return Object.keys(r.teams);
  if(r.team)return [r.team];
  const s=me();                          // fallback for the master admin
  return (!u&&s.team)?[s.team]:[];
}
function pickedUserTeams(){
  const out={};
  $("nuTeamChecks").querySelectorAll("input:checked").forEach(i=>out[i.value]=true);
  return out;
}

/* ---------- sheets ---------- */
function extractId(url){const m=String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/);return m?m[1]:null;}
function canSee(s){
  if(isCoordinator())return false;          // coordinators see no sheets
  if(isAdminNow())return true;
  if(s.users&&s.users[me().user])return true;   // named individually
  const t=s.teams;
  if(!t||t.All)return true;
  return myTeams().some(x=>t[x]);
}
function visibleSheets(){return sheets.filter(canSee);}

function renderTeamDependents(){
  const tc=$("teamChecks");
  if(tc){tc.innerHTML=`<label class="check-pill all"><input type="checkbox" value="All" onchange="allTeamToggle(this)"> All teams</label>`+
    teamNames().map(n=>`<label class="check-pill"><input type="checkbox" value="${esc(n)}"> ${esc(n)}</label>`).join("");}
  const tk=$("nuTeamChecks");
  if(tk)tk.innerHTML=teamNames().map(n=>`<label class="check-pill"><input type="checkbox" value="${esc(n)}"> ${esc(n)}</label>`).join("");
    const su=$("sheetUserChecks");
  if(su)su.innerHTML=allUsers().filter(u=>u.role!=="coordinator")
    .map(u=>`<label class="check-pill"><input type="checkbox" value="${esc(u.user)}"> ${esc(u.name||cap(u.user))}</label>`).join("");
  const chips=$("teamChips");
  if(chips)chips.innerHTML=teams.map(t=>`<span class="team-chip">${esc(t.name)}<button onclick="delTeam('${t.id}')" title="Remove">✕</button></span>`).join("")||'<small style="color:var(--cream-dim)">No teams yet</small>';
}
function allTeamToggle(cb){
  $("teamChecks").querySelectorAll("input").forEach(i=>{if(i!==cb)i.checked=false;});
}
function pickedTeams(){
  const out={};
  $("teamChecks").querySelectorAll("input:checked").forEach(i=>out[i.value]=true);
  return Object.keys(out).length?out:{All:true};
}
function pickedSheetUsers(){
  const out={};
  const el=$("sheetUserChecks");
  if(el)el.querySelectorAll("input:checked").forEach(i=>out[i.value]=true);
  return out;
}
function accessLabel(s){
  const t=(s.teams&&!s.teams.All)?Object.keys(s.teams):[];
  const u=s.users?Object.keys(s.users).map(displayName):[];
  if(!t.length&&!u.length)return "All teams";
  return esc([...t,...u].join(", "));
}

function openAddSheet(){
  editingSheetId=null;
  $("addModalTitle").textContent="Add a Google Sheet";
  $("sheetSaveBtn").textContent="Add sheet";
  $("sheetName").value=$("sheetUrl").value=$("sheetIcon").value="";
  renderTeamDependents();
  renderFolderSelect(); $("sheetFolder").value="";
  $("sheetUserChecks")&&$("sheetUserChecks").querySelectorAll("input").forEach(i=>i.checked=false);
  openModal("addModal");
}
function editSheet(ev,id){
  ev.stopPropagation();
  if(!isAdminNow())return;
  const s=sheets.find(x=>x.id===id);if(!s)return;
  editingSheetId=id;
  $("addModalTitle").textContent="Edit sheet";
  $("sheetSaveBtn").textContent="Save changes";
  $("sheetName").value=s.name;$("sheetIcon").value=s.icon||"";
  $("sheetUrl").value="https://docs.google.com/spreadsheets/d/"+s.gid+"/edit";
  renderTeamDependents();
  const t=s.teams||{All:true};
  $("teamChecks").querySelectorAll("input").forEach(i=>i.checked=!!t[i.value]);
  renderFolderSelect(); $("sheetFolder").value=s.folder||"";
  const su=s.users||{};
  $("sheetUserChecks")&&$("sheetUserChecks").querySelectorAll("input").forEach(i=>i.checked=!!su[i.value]);
  openModal("addModal");
}
function saveSheet(){
  if(!isAdminNow()){toast("Only admins can manage sheets");return;}
  const name=$("sheetName").value.trim(),url=$("sheetUrl").value.trim();
  const icon=$("sheetIcon").value.trim()||"📄";
  if(!name){toast("Give the sheet a display name");return;}
  const gid=extractId(url);
  if(!gid){toast("That doesn't look like a Google Sheets link");return;}
    const data={name,gid,icon,teams:pickedTeams(),users:pickedSheetUsers(),folder:$("sheetFolder").value||""};
  if(!cloudOn){toast("Cloud not connected");return;}
  if(editingSheetId){db.ref("sheets/"+editingSheetId).update(data).then(()=>toast("Sheet updated ✓"));}
  else{data.ts=Date.now();db.ref("sheets").push(data).then(()=>toast("“"+name+"” added ✓"));}
  closeModal("addModal");
}
function delSheet(ev,id){
  ev.stopPropagation();
  if(!isAdminNow())return;
  const s=sheets.find(x=>x.id===id);if(!s)return;
  if(!confirm("Remove “"+s.name+"” from the dashboard? (The Google Sheet itself is not deleted.)"))return;
  db.ref("sheets/"+id).remove();
  if(activeId===id){activeId=null;showWelcome();}
}
function renderFolderSelect(){
  const sel=$("sheetFolder");if(!sel)return;
  const cur=sel.value;
  sel.innerHTML=`<option value="">— No folder (top level) —</option>`+
    folders.map(f=>`<option value="${f.id}">${esc(f.icon||"📁")} ${esc(f.name)}</option>`).join("");
  sel.value=cur;
}
function openFolderModal(id){
  editingFolderId=id||null;
  const f=id?folders.find(x=>x.id===id):null;
  $("folderModalTitle").textContent=f?"Edit folder":"New folder";
  $("folderSaveBtn").textContent=f?"Save changes":"Create folder";
  $("folderName").value=f?f.name:"";
  $("folderIcon").value=f?(f.icon||""):"";
  openModal("folderModal");
}
function saveFolder(){
  if(!isAdminNow()){toast("Only admins can manage folders");return;}
  const name=$("folderName").value.trim(), icon=$("folderIcon").value.trim()||"📁";
  if(!name){toast("Give the folder a name");return;}
  if(!cloudOn){toast("Cloud not connected");return;}
  if(editingFolderId) db.ref("folders/"+editingFolderId).update({name,icon}).then(()=>toast("Folder updated ✓"));
  else db.ref("folders").push({name,icon,ts:Date.now()}).then(()=>toast("Folder “"+name+"” created ✓"));
  closeModal("folderModal");
}
function editFolder(ev,id){ ev.stopPropagation(); openFolderModal(id); }
function delFolder(ev,id){
  ev.stopPropagation();
  if(!isAdminNow())return;
  const f=folders.find(x=>x.id===id);if(!f)return;
  const kids=sheets.filter(s=>s.folder===id);
  askConfirm("Delete folder “"+f.name+"”?",
    kids.length
      ? ("This will also remove its "+kids.length+" sheet(s) from the dashboard. The actual Google Sheets are NOT deleted.")
      : "The folder is empty.",
    ()=>{
      kids.forEach(s=>{
        db.ref("sheets/"+s.id).remove();
        if(activeId===s.id){activeId=null;showWelcome();}
      });
      db.ref("folders/"+id).remove();
      toast("Folder and "+kids.length+" sheet(s) removed ✓");
    },"Yes, delete all");
}
function toggleFolder(id){
  openFolders[id]=!openFolders[id];
  localStorage.setItem("odea_openfolders",JSON.stringify(openFolders));
  renderFolders();
}
function addSheetTo(ev,folderId){
  ev.stopPropagation();
  openAddSheet();
  renderFolderSelect();
  $("sheetFolder").value=folderId;
}
function renderFolders(){
  const list=$("folderList");if(!list)return;
  if(isCoordinator()){
    list.innerHTML='<div class="empty-hint">Task assignment access only.<br>Use the <b>🔔 Tasks</b> button above.</div>';
    return;
  }
  const visAll=visibleSheets();
  const vis=visAll.filter(s=>!isPinned(s.id));
  const admin=isAdminNow();
  const row=s=>`
    <div class="folder subsheet ${s.id===activeId?"active":""}" data-id="${s.id}" onclick="openSheet('${s.id}')" oncontextmenu="showCtx(event,'${s.id}')">
      <div class="folder-ico">${s.icon||"📄"}</div>
      <div class="folder-meta"><b>${esc(s.name)}</b><small>${accessLabel(s)}</small></div>
      <button class="btn folder-edit pin-btn ${isPinned(s.id)?"on":""}" title="${isPinned(s.id)?"Unpin":"Pin to top"}" onclick="togglePin(event,'${s.id}')">${isPinned(s.id)?"★":"☆"}</button>
      ${admin?`<button class="btn folder-edit" title="Edit" onclick="editSheet(event,'${s.id}')">✏️</button><button class="btn folder-del" title="Remove" onclick="delSheet(event,'${s.id}')">✕</button>`:""}
    </div>`;

  let html="";
  const pinned=visAll.filter(s=>isPinned(s.id));
  if(pinned.length){
    html+=`<div class="pin-head">📌 Pinned</div>`+pinned.map(row).join("")+`<div class="pin-sep"></div>`;
  }
  if(settings.archiveUrl&&admin){
    const agid=extractId(settings.archiveUrl);
    if(agid)html+=`<div class="folder ${activeId==="__archive"?"active":""}" onclick="openArchive()">
      <div class="folder-ico">🗂️</div>
      <div class="folder-meta"><b>To-Do / EOD Archive</b><small>Admin only</small></div></div>`;
  }

  folders.forEach(f=>{
    const kids=vis.filter(s=>s.folder===f.id);
    if(!kids.length&&!admin)return;
    const open=!!openFolders[f.id];
    html+=`
      <div class="grp" data-fid="${f.id}">
        <div class="folder grp-head" onclick="toggleFolder('${f.id}')">
          <div class="folder-ico">${esc(f.icon||"📁")}</div>
          <div class="folder-meta"><b>${esc(f.name)}</b><small>${kids.length} sheet${kids.length===1?"":"s"}</small></div>
          ${admin?`<button class="btn folder-edit" title="Add sheet here" onclick="addSheetTo(event,'${f.id}')">＋</button>
                   <button class="btn folder-edit" title="Rename" onclick="editFolder(event,'${f.id}')">✏️</button>
                   <button class="btn folder-del" title="Delete folder" onclick="delFolder(event,'${f.id}')">✕</button>`:""}
          <span class="grp-caret">${open?"▾":"▸"}</span>
        </div>
        <div class="grp-body ${open?"on":""}" id="grp_${f.id}">
          ${kids.map(row).join("")||'<div class="mc-empty" style="padding:8px 12px">Empty — use ＋ to add a sheet</div>'}
        </div>
      </div>`;
  });

  html+=vis.filter(s=>!s.folder).map(row).join("");

  if(!html){list.innerHTML='<div class="empty-hint">No sheets for your team yet.'+(admin?'<br>Tap <b>📁</b> for a client folder or <b>+</b> for a sheet.':'')+'</div>';return;}
  list.innerHTML=html;

  if(admin&&cloudOn){
    enableDrag(list,":scope > .folder[data-id]",ids=>ids.forEach((id,i)=>db.ref("sheets/"+id+"/order").set(i)));
    folders.forEach(f=>{const b=$("grp_"+f.id);
      if(b&&openFolders[f.id])enableDrag(b,".subsheet[data-id]",ids=>ids.forEach((id,i)=>db.ref("sheets/"+id+"/order").set(i)));});
  }
}
function openSheet(id){
  const s=sheets.find(x=>x.id===id);if(!s||!canSee(s))return;
  const gid=s.gid;
  if(window.innerWidth<861){
    window.open(`https://docs.google.com/spreadsheets/d/${gid}/edit`,"_blank");
    toggleSide(false);return;
  }
  activeId=id;currentView="sheet";renderFolders();toggleSide(false);
  $("stage").innerHTML=`<div class="sheet-frame-wrap"><iframe src="https://docs.google.com/spreadsheets/d/${gid}/edit" allow="clipboard-read; clipboard-write"></iframe></div>`;
  $("stageTitle").innerHTML=`<span class="live-dot"></span>${esc(s.name)}`;
  const ext=$("openExt");ext.style.display="";ext.href=`https://docs.google.com/spreadsheets/d/${gid}/edit`;
}
function openArchive(){
  if(!isAdminNow())return;
  const gid=extractId(settings.archiveUrl||"");if(!gid)return;
  if(window.innerWidth<861){window.open(`https://docs.google.com/spreadsheets/d/${gid}/edit`,"_blank");toggleSide(false);return;}
  activeId="__archive";currentView="sheet";renderFolders();toggleSide(false);
  $("stage").innerHTML=`<div class="sheet-frame-wrap"><iframe src="https://docs.google.com/spreadsheets/d/${gid}/edit" allow="clipboard-read; clipboard-write"></iframe></div>`;
  $("stageTitle").innerHTML=`<span class="live-dot"></span>To-Do / EOD Archive`;
  const ext=$("openExt");ext.style.display="";ext.href=`https://docs.google.com/spreadsheets/d/${gid}/edit`;
}
function showWelcome(){
  currentView="welcome";activeId=null;renderFolders();
  const s=session();
  $("stageTitle").innerHTML=`<span class="live-dot"></span>Welcome${s?", "+esc(displayName(s.user)):""}`;
  $("openExt").style.display="none";
  const msg=isCoordinator()
    ?`Assign tasks to any team or member with the <b style="color:var(--orange)">🔔 Tasks</b> button in the top bar.`
    :`Open your team's sheets from the left, keep your <b style="color:var(--orange)">To-Do / EOD</b> updated from the top bar, and watch for task notifications. Everything syncs live for everyone.`;
  $("stage").innerHTML=`
    <div class="welcome">
      <div class="crest"><img src="logo.png" alt="ODEA"></div>
      <h2>Your team, one <em>royal</em> desk.</h2>
      <p>${msg}</p>
    </div>`;
}

/* ---------- BOARD: unified To-Do / EOD ---------- */
function showBoard(){
  if(isCoordinator())return;
  currentView="board";activeId=null;renderFolders();toggleSide(false);
  $("stageTitle").innerHTML=`<span class="live-dot"></span>To-Do / EOD Board`;
  $("openExt").style.display="none";
  renderBoard();
}
function boardMembers(){
  const seen={},out=[],iam=isAdminNow();
  allUsers().forEach(u=>{
    if(u.role==="coordinator")return;              // no card for coordinators
    if(u.role==="admin"&&!iam)return;              // admin cards: admins only
    if(!seen[u.user]){seen[u.user]=1;out.push(u);}});
  const mine=me().user;
  return out.sort((a,b)=>{
    if(a.user===mine)return -1;          // my own card always first
    if(b.user===mine)return 1;
    return (a.order??999)-(b.order??999);
  });
}
function canDeleteEntry(e){
  if(isAdminNow())return true;
  if(e.user!==me().user)return false;
  if((e.days||1)>1)return false;      // carried from a previous day → admin only
  if(hourIST()>=LOCK_HOUR)return false; // locked after 5 PM
  return true;
}
function renderBoard(){
  if(currentView!=="board")return;
  // remember what people are typing + where they're scrolled
  const drafts={}, act=document.activeElement;
  const focusId=(act&&act.id&&act.id.startsWith("in_"))?act.id:null;
  const caret=focusId?act.selectionStart:null;
    const now=Date.now();
  document.querySelectorAll('[id^="in_"]').forEach(i=>{
    if(_justSent[i.id]&&now-_justSent[i.id]<3000){ delete _justSent[i.id]; return; }
    if(i.value)drafts[i.id]=i.value;
  });
  const scroller=$("stage").querySelector(".board");
  const scrollY=scroller?scroller.scrollTop:0;
  const pageY=$("stage").scrollTop;
  const mine=me().user, locked=isLocked();
  const cards=boardMembers().map(u=>{
    const my=entries.filter(e=>e.user===u.user).sort((a,b)=>(a.ts||0)-(b.ts||0));
    const canAdd=(u.user===mine)||isAdminNow();
    const item=e=>`
      <div class="entry">
        <span class="status-chip ${e.status||"pending"}${(e.user===mine||isAdminNow())?"":" locked-chip"}" title="${(e.user===mine||isAdminNow())?"Tap to change status":"Only "+esc(u.name||u.user)+" can change this"}" ${(e.user===mine||isAdminNow())?`onclick="cycleStatus('${e.id}')"`:""}></span>
        <div class="txt ${e.status==="done"?"done":""}">${esc(e.text)}${(e.days||1)>1?` <small style="color:var(--gold)">(Day ${e.days})</small>`:""}</div>
        ${canDeleteEntry(e)?`<button class="btn entry-edit" title="Edit" onclick="editEntry('${e.id}')">✏️</button><button class="btn entry-del" onclick="delEntry('${e.id}')">✕</button>`:""}
      </div>`;
    return `
    <div class="member-card ${u.user===mine?"me":""}${isBirthdayToday(u.dob)?" bday-card-on":""}" data-id="${esc(u.user)}">
      ${isBirthdayToday(u.dob)?`<div class="bday-bow">🎀</div><div class="bday-ribbon">🎂 BIRTHDAY</div>`:""}
      ${u.user!==mine?`<button class="btn call-btn" title="Ring ${esc(u.name||u.user)}" onclick="startCall('${esc(u.user)}')">📞</button>`:`<button class="btn call-btn dnd-btn ${dnd?"on":""}" title="Do not disturb" onclick="toggleDnd()">${dnd?"🔕":"🔔"}</button>`}
      <div class="mc-head id-open" onclick="showIdCard('${esc(u.user)}')" title="View ID card">
        ${avatarHTML(u.user)}
        <div class="who"><b>${esc(u.name||cap(u.user))}</b><small>${esc(roleLabel(u.role||"member"))}${myTeams(u.user).length?" · "+esc(myTeams(u.user).join(", ")):""}</small></div>
      </div>
      <div class="mc-sec"><h4>To-Do / EOD</h4>
        ${my.map(item).join("")||'<div class="mc-empty">Nothing yet</div>'}
      </div>
      ${canAdd?`
      <div class="mc-addrow">
        <input id="in_${esc(u.user)}" placeholder="Write here…" onkeydown="if(event.key==='Enter')addEntry('${esc(u.user)}')">
        <button class="btn mini-add todo" onclick="addEntry('${esc(u.user)}')">ADD</button>
      </div>`:""}
    </div>`;
  }).join("");
  $("stage").innerHTML=`
    <div class="board">
      <div class="board-head">
        <h3>To-Do / <em>EOD</em> Board</h3>
        <button class="btn md-jump" onclick="showMyDay()">☀️ My Day</button>
        <span class="board-date">${niceDate()}</span>
      </div>
      <div class="legend" style="margin-bottom:14px">
        <span><i style="background:var(--red)"></i>Pending</span>
        <span><i style="background:var(--gold)"></i>In progress</span>
        <span><i style="background:var(--green)"></i>Completed</span>
        <span style="opacity:.7">· Tap the dot to change · Deleting locks at 5 PM · Moves to the archive at 12 AM</span>
        ${locked?`<span style="color:var(--gold);font-weight:700">🔒 Deleting locked (after 5 PM)</span>`:""}
      </div>
      <div class="board-grid">${cards}</div>
    </div>`;
    // put the drafts and scroll position back
  Object.keys(drafts).forEach(id=>{ const el=$(id); if(el)el.value=drafts[id]; });
  const nb=$("stage").querySelector(".board");
  if(nb&&scrollY)nb.scrollTop=scrollY;
  if(pageY)$("stage").scrollTop=pageY;
  if(focusId){
    const el=$(focusId);
    if(el){ el.focus(); try{ el.setSelectionRange(caret,caret); }catch(e){} }
  }
  if(cloudOn)enableDrag($("stage").querySelector(".board-grid"),".member-card[data-id]",ids=>{
    ids.forEach((id,i)=>{ if(cloudUsers.some(u=>u.user===id)) db.ref("users/"+id+"/order").set(i); });
  });
}
let _justSent={};
function addEntry(user){
  const inp=$("in_"+user);if(!inp)return;
  const text=inp.value.trim();if(!text){toast("Write something first");return;}
  if(!cloudOn){toast("Cloud not connected");return;}
  inp.value="";
  _justSent["in_"+user]=Date.now();          // don't restore a draft for this box
  db.ref("entries").push({user,type:"todo",text,status:"pending",date:todayIST(),ts:Date.now()});
}
function cycleStatus(id){
  const e=entries.find(x=>x.id===id);if(!e)return;
  if(e.user!==me().user&&!isAdminNow()){toast("You can only change your own tasks");return;}
    const next={pending:"progress",progress:"done",done:"pending"}[e.status||"pending"];
  const y=$("stage").scrollTop;
  db.ref("entries/"+id+"/status").set(next).then(()=>setTimeout(()=>{$("stage").scrollTop=y;},30));
}
function delEntry(id){
  const e=entries.find(x=>x.id===id);if(!e)return;
  if(!canDeleteEntry(e)){toast((e.days||1)>1?"Carried tasks: admin only":"Locked after 5 PM");return;}
  const y=$("stage").scrollTop, b=$("stage").querySelector(".board"), by=b?b.scrollTop:0;
  db.ref("entries/"+id).remove().then(()=>{
    setTimeout(()=>{
      $("stage").scrollTop=y;
      const nb=$("stage").querySelector(".board"); if(nb)nb.scrollTop=by;
    },30);
  });
}
function editEntry(id){
  const e=entries.find(x=>x.id===id);if(!e)return;
  if(!canDeleteEntry(e)){toast((e.days||1)>1?"Carried tasks can't be edited":"Editing locked after 5 PM");return;}
  const t=prompt("Edit this To-Do / EOD:",e.text);
  if(t===null)return;
  const txt=t.trim();
  if(!txt){toast("Text can't be empty");return;}
  db.ref("entries/"+id+"/text").set(txt).then(()=>toast("Updated ✓"));
}

/* ---------- USERS ---------- */
function openUsers(){renderUsers();renderTeamDependents();resetUserForm();openModal("usersModal");}
function renderUsers(){
  const rows=$("userRows");
  const perm=USERS.map(u=>`<div class="user-row">${avatarHTML(u.user,30)}<div class="who"><b>${esc(u.name||u.user)}</b><small>${roleLabel(u.role)} · ${esc(u.team||"")} · master</small></div></div>`).join("");
  const cloud=cloudUsers.map(u=>`<div class="user-row">${avatarHTML(u.user,30)}<div class="who"><b>${esc(u.name||u.user)}</b><small>${esc(roleLabel(u.role))} · ${esc(myTeams(u.user).join(", ")||"—")}</small></div><button class="btn tiny-btn" title="Edit" onclick="editUser('${esc(u.user)}')">✏️</button><button class="btn tiny-btn danger" title="Delete" onclick="delUser('${esc(u.user)}')">✕</button></div>`).join("");
  rows.innerHTML=perm+cloud;
}
function editUser(key){
  const u=cloudUsers.find(x=>x.user===key);if(!u)return;
  editingUserKey=key;
  $("userFormTitle").textContent="Edit member — "+(u.name||u.user);
  $("nuFull").value=u.name||"";$("nuName").value=u.user;$("nuName").disabled=true;
  $("nuPass").value=u.pass;$("nuRole").value=u.role||"member";
  renderTeamDependents();
  const ut=u.teams||(u.team?{[u.team]:true}:{});
  $("nuTeamChecks").querySelectorAll("input").forEach(i=>i.checked=!!ut[i.value]);
  $("userSaveBtn").textContent="Save changes";
}
function resetUserForm(){
  editingUserKey=null;
  $("userFormTitle").textContent="Add member";
  $("nuFull").value=$("nuPass").value="";$("nuName").value="";$("nuName").disabled=false;
  $("userSaveBtn").textContent="Create member";
  $("nuTeamChecks")&&$("nuTeamChecks").querySelectorAll("input").forEach(i=>i.checked=false);
}
function cancelUserEdit(){
  resetUserForm();
  closeModal("usersModal");
}
function saveUser(){
  if(!isAdminNow())return;
  const full=$("nuFull").value.trim(),name=$("nuName").value.trim(),pass=$("nuPass").value,role=$("nuRole").value,teamsObj=pickedUserTeams();
  if(!name||!pass){toast("Username and password required");return;}
  if(/[.#$\[\]\/\s]/.test(name)){toast("Username: letters/numbers only");return;}
  if(!cloudOn){toast("Cloud not connected");return;}
  if(editingUserKey){
    db.ref("users/"+editingUserKey).update({name:full||cap(name),pass,role,teams:teamsObj,team:Object.keys(teamsObj)[0]||""}).then(()=>toast("Member updated ✓"));
    cancelUserEdit();return;
  }
  if(allUsers().some(u=>u.user.toLowerCase()===name.toLowerCase())){toast("That username already exists");return;}
  db.ref("revoked/"+name).remove();
  db.ref("users/"+name).set({name:full||cap(name),pass,role,teams:teamsObj,team:Object.keys(teamsObj)[0]||""}).then(()=>toast("Member “"+(full||name)+"” created ✓"));
  cancelUserEdit();
}
function delUser(key){
  if(!isAdminNow())return;
  const nm=displayName(key);
  askConfirm("Remove "+nm+"?",
    "They will be signed out immediately and lose access. Their board entries stay in the archive.",
    ()=>{
      db.ref("users/"+key).remove();
      db.ref("revoked/"+key).set(Date.now());   // signal that user to log out
      toast(nm+" removed ✓");
    });
}

/* ---------- PROFILE (self-service) ---------- */
function openProfile(){
  const s=session();if(!s)return;
  const isMaster=!cloudUsers.some(u=>u.user===s.user);
  if(isMaster&&!cloudOn){toast("Cloud not connected");return;}
  const r=userRec(s.user);
  $("pfName").value=r.name||"";
  $("pfRoleTitle").value=r.title||"";$("pfDob").value=r.dob||"";
  $("pfJoined").value=r.joined||"";$("pfPhone").value=r.phone||"";
  $("pfEmail").value=r.email||"";$("pfBlood").value=r.blood||"";
  $("pfSkills").value=r.skills||"";$("pfTag").value=r.tagline||"";
  $("pfPreview").innerHTML=avatarHTML(s.user,72);
  $("pfFile").value="";
  openModal("profileModal");
}
function pfPickPhoto(input){
  const f=input.files&&input.files[0];
  if(!f){toast("No file selected");return;}
  if(!/^image\//.test(f.type)){toast("Please choose an image file");return;}
  const rd=new FileReader();
  rd.onerror=()=>toast("Couldn't read that file — try a JPG or PNG");
  rd.onload=()=>{
    const img=new Image();
    img.onerror=()=>toast("Couldn't open that image (HEIC files aren't supported)");
    img.onload=()=>{
      const S=512;
      const c=document.createElement("canvas");c.width=S;c.height=S;
      const x=c.getContext("2d");
      x.imageSmoothingEnabled=true; x.imageSmoothingQuality="high";
      const side=Math.min(img.naturalWidth,img.naturalHeight);
      x.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,S,S);
      window._pfPhoto=c.toDataURL("image/jpeg",.92);
      $("pfPreview").innerHTML=`<div class="avatar" style="width:72px;height:72px"><img src="${window._pfPhoto}"></div>`;
      toast("Photo ready — click Save");
    };
    img.src=rd.result;          // base64, avoids blob-URL timing issues
  };
  rd.readAsDataURL(f);
}
function saveProfile(){
  const s=session();if(!s||!cloudOn)return;
  const name=$("pfName").value.trim();
  const isMaster=!cloudUsers.some(u=>u.user===s.user);
  const path=isMaster?("masters/"+s.user):("users/"+s.user);
  const upd={
    title:$("pfRoleTitle").value.trim()||null,
    dob:$("pfDob").value||null,
    joined:$("pfJoined").value||null,
    phone:$("pfPhone").value.trim()||null,
    email:$("pfEmail").value.trim()||null,
    blood:$("pfBlood").value.trim()||null,
    skills:$("pfSkills").value.trim()||null,
    tagline:$("pfTag").value.trim()||null
  };
  if(name)upd.name=name;
  if(window._pfPhoto){
    if(window._pfPhoto.length>800000){toast("Photo too large — try a smaller image");return;}
    upd.photo=window._pfPhoto;
  }
  db.ref(path).update(upd).then(()=>{
    if(name){s.name=name;sessionStorage.setItem(LS_SESSION,JSON.stringify(s));}
    window._pfPhoto=null;
    toast("Profile updated ✓");refreshMyChip();
    if(currentView==="board")renderBoard();
    closeModal("profileModal");
  }).catch(err=>{
    console.error("Profile save failed:",err);
    toast("Save failed: "+(err.message||"check connection"));
  });
}

/* ---------- TEAMS (settings) ---------- */
function addTeam(){
  if(!isAdminNow())return;
  const n=$("newTeamName").value.trim();if(!n){toast("Type a team name");return;}
  if(teamNames().some(t=>t.toLowerCase()===n.toLowerCase())){toast("Team already exists");return;}
  db.ref("teams").push({name:n});$("newTeamName").value="";toast("Team added ✓");
}
function delTeam(id){
  if(!isAdminNow())return;
  const t=teams.find(x=>x.id===id);if(!t)return;
  if(!confirm("Remove team “"+t.name+"”? Members of this team keep their accounts."))return;
  db.ref("teams/"+id).remove();
}

/* ---------- SETTINGS ---------- */
function openSettings(){
  $("archiveUrl").value=settings.archiveUrl||"";
  renderTeamDependents();openModal("settingsModal");
}
function saveSettings(){
  if(!isAdminNow())return;
  const url=$("archiveUrl").value.trim();
  if(url&&!extractId(url)){toast("That doesn't look like a Google Sheets link");return;}
  db.ref("settings/archiveUrl").set(url).then(()=>toast("Settings saved ✓"));
}

/* ---------- TASKS (anyone can assign) ---------- */
function myOpenTasks(){
  const m=me();
  return tasks.filter(t=>t.status==="open"&&t.to&&((t.to.users&&t.to.users[m.user])||(t.to.teams&&myTeams().some(x=>t.to.teams[x]))));
}
/* ================= NOTIFICATION ENGINE ================= */
let _notifyReady=false;
function seenKey(){return "odea_seen_"+(me().user||"anon");}
function getSeen(){try{return JSON.parse(localStorage.getItem(seenKey())||"{}")}catch(e){return {}}}
function markSeen(o){localStorage.setItem(seenKey(),JSON.stringify(o));}

function updateTaskBadge(){
  const open=myOpenTasks();
  const b=$("taskBadge");if(b){b.style.display=open.length?"flex":"none";b.textContent=open.length;}
  updateApprBadge&&updateApprBadge();
  notifyCheck();
}
function myOpenTasksLive(){
  const cut=Date.now()-HIDE_AFTER;
  const m=me();
  return tasks.filter(t=>(t.status==="open"||(t.doneAt||0)>cut)&&t.to&&
    ((t.to.users&&t.to.users[m.user])||(t.to.teams&&myTeams().some(x=>t.to.teams[x]))));
}
function notifyCheck(){
  const m=me().user; if(!m) return;
  const seen=getSeen(), fresh=[];
  const add=(k,kind,text,sub,from)=>{ if(!seen[k]){ seen[k]=1; fresh.push({kind,text,sub,from,uid:k}); } };

  myOpenTasks().forEach(t=>add("t_"+t.id,"task","New task",t.title,t.by));
  pendingForMe().forEach(a=>add("a_"+a.id,"approval","Approval needed",a.title,a.by));
  approvals.filter(a=>a.by===m&&a.status==="approved")
    .forEach(a=>add("ad_"+a.id,"approved","Approved",a.title,a.decidedBy));
  approvals.filter(a=>a.by===m&&a.status==="rejected")
    .forEach(a=>add("ar_"+a.id,"rejected","Needs correction",a.title,a.decidedBy));
  approvals.forEach(a=>{ if(!(a.by===m||isApprover(a)))return;
    Object.keys(a.replies||{}).forEach(rid=>{ const r=a.replies[rid];
      if(r.by!==m) add("rp_"+rid,"reply","New reply",displayName(r.by)+" · "+a.title,r.by); }); });
  tasks.forEach(t=>{ const forMe=t.to&&((t.to.users&&t.to.users[m])||(t.to.teams&&myTeams().some(x=>t.to.teams[x])));
    if(!(t.by===m||forMe))return;
    Object.keys(t.replies||{}).forEach(rid=>{ const r=t.replies[rid];
      if(r.by!==m) add("rt_"+rid,"reply","New reply",displayName(r.by)+" · "+t.title,r.by); }); });
  tasks.filter(t=>t.by===m&&t.noted).forEach(t=>Object.keys(t.noted).forEach(u=>{
    if(u!==m) add("nt_"+t.id+u,"noted","Noted",displayName(u)+" · "+t.title,u); }));
  tasks.filter(t=>t.by===m&&t.status==="done").forEach(t=>
    add("td_"+t.id,"approved","Task completed ✓",t.title));
  approvals.filter(a=>isApprover(a)&&a.status!=="pending").forEach(a=>
    add("ax_"+a.id,a.status==="approved"?"approved":"rejected",
        a.status==="approved"?"You approved ✓":"Sent back ✎",a.title));
  approvals.filter(a=>a.by===m&&a.status==="pending"&&a.undoneAt)
    .forEach(a=>add("un_"+a.id+a.undoneAt,"rejected","Decision undone",a.title+" — back to pending",a.undoneBy));

  markSeen(seen);
  if(!_notifyReady){ _notifyReady=true; return; }
  fresh.slice(0,3).forEach((f,i)=>setTimeout(()=>popAlert(f.kind,f.text,f.sub,f.from,f.uid),i*450));
}

/* Build the full list of things this person should be told about */
function activeAlerts(){
  const m=me().user; if(!m) return [];
  const cut=Date.now()-HIDE_AFTER, out=[];
  myOpenTasks().forEach(t=>out.push({kind:"task",text:"Task",sub:t.title,ts:t.ts||0,from:t.by}));
  pendingForMe().forEach(a=>out.push({kind:"approval",text:"Approval needed",sub:a.title,ts:a.ts||0,from:a.by}));
  approvals.filter(a=>a.by===m&&a.status==="pending"&&a.undoneAt&&(Date.now()-a.undoneAt)<HIDE_AFTER)
    .forEach(a=>out.push({kind:"rejected",text:"Decision undone",sub:a.title+" — back to pending",ts:a.undoneAt,from:a.undoneBy}));
  approvals.filter(a=>a.by===m&&a.status==="approved"&&(a.decidedAt||0)>cut)
    .forEach(a=>out.push({kind:"approved",text:"Approved",sub:a.title,ts:a.decidedAt,from:a.decidedBy}));
  approvals.filter(a=>a.by===m&&a.status==="rejected"&&(a.decidedAt||0)>cut)
    .forEach(a=>out.push({kind:"rejected",text:"Needs correction",sub:a.title,ts:a.decidedAt,from:a.decidedBy}));
  tasks.filter(t=>t.by===m&&t.status==="done"&&(t.doneAt||0)>cut)
    .forEach(t=>out.push({kind:"approved",text:"Task completed",sub:t.title,ts:t.doneAt}));
  tasks.filter(t=>t.by===m&&t.noted&&t.status==="open").forEach(t=>Object.keys(t.noted).forEach(u=>{
    if(u!==m)out.push({kind:"noted",text:"Noted",sub:displayName(u)+" · "+t.title,ts:t.noted[u].at||0,from:u});}));
  const recent=Date.now()-24*60*60*1000;              // replies from the last 24h
  approvals.forEach(a=>{ if(!(a.by===m||isApprover(a)))return;
    const rs=Object.values(a.replies||{}).filter(r=>r.by!==m&&r.ts>recent);
    if(!rs.length)return;
    const last=rs.sort((x,y)=>y.ts-x.ts)[0];
    out.push({kind:"reply",text:rs.length>1?rs.length+" new replies":"Reply",
              sub:displayName(last.by)+" · "+a.title,ts:last.ts,from:last.by});});
  tasks.forEach(t=>{const forMe=t.to&&((t.to.users&&t.to.users[m])||(t.to.teams&&myTeams().some(x=>t.to.teams[x])));
    if(!(t.by===m||forMe))return;
    const rs=Object.values(t.replies||{}).filter(r=>r.by!==m&&r.ts>recent);
    if(!rs.length)return;
    const last=rs.sort((x,y)=>y.ts-x.ts)[0];
    out.push({kind:"reply",text:rs.length>1?rs.length+" new replies":"Reply",
              sub:displayName(last.by)+" · "+t.title,ts:last.ts,from:last.by});});
  return out.sort((a,b)=>(b.ts||0)-(a.ts||0));
}
/* Show them all, one after another */
function digestAlert(){
  if(!session())return;
  const list=activeAlerts();
  if(!list.length)return;
  document.querySelectorAll(".task-alert").forEach(e=>e.remove());
  list.slice(0,8).forEach((f,i)=>setTimeout(()=>popAlert(f.kind,f.text,f.sub,f.from,"__digest"),i*900));
}
let _leftAt=0, _bootDigestDone=false;
const AWAY_MIN=2*60*1000;          // must be away 2 minutes to get the digest
function bootDigest(){             // fires on login, refresh, and first load of the day
  if(_bootDigestDone||!session())return;
  _bootDigestDone=true;
  setTimeout(digestAlert,1200);    // wait for Firebase data to arrive
}
// const AWAY_MIN=10*1000;   // 10 seconds, for testing
function markAway(){ _leftAt=Date.now(); }
function maybeDigest(){
  if(!session())return;
  if(!_leftAt)return;                        // never left — nothing to catch up on
  const away=Date.now()-_leftAt;
  _leftAt=0;
  if(away<AWAY_MIN)return;                   // quick tab flick — stay quiet
  digestAlert();
}
document.addEventListener("visibilitychange",()=>{
  document.hidden ? markAway() : maybeDigest();
});
window.addEventListener("blur",markAway);
window.addEventListener("focus",maybeDigest);
/* ---------- native browser notifications ---------- */
function askNotifyPermission(){
  if(!("Notification" in window))return;
  if(Notification.permission==="default"){
    setTimeout(()=>Notification.requestPermission(),1500);
  }
}
function nativeKey(){return "odea_native_"+(me().user||"anon");}
function nativeSent(){try{return JSON.parse(localStorage.getItem(nativeKey())||"{}")}catch(e){return {}}}
function nativeNotify(title,body,kind,photo,id){
  if(!("Notification" in window)||Notification.permission!=="granted")return;
  if(!document.hidden)return;                 // on screen? the glass popup handles it
  const key=id||(kind+"|"+title+"|"+(body||""));
  const sent=nativeSent();
  if(sent[key])return;                        // already notified — ever
  sent[key]=Date.now();
  // keep the list tidy: drop entries older than 30 days
  const cutoff=Date.now()-30*24*60*60*1000;
  Object.keys(sent).forEach(k=>{ if(sent[k]<cutoff) delete sent[k]; });
  localStorage.setItem(nativeKey(),JSON.stringify(sent));
  try{
    const n=new Notification("ODEA Sheets HUB — "+title,{
      body:body||"",
      icon:photo||"Sheets HUB logo.webp",
      badge:"sheets HUB logo.webp",
      tag:key
    });
    n.onclick=()=>{window.focus();n.close();};
    setTimeout(()=>n.close(),8000);
  }catch(e){}
}

const ALERT_STYLE={
  task:{ico:"🔔",cls:"n-task"}, approval:{ico:"✅",cls:"n-appr"},
  approved:{ico:"🎉",cls:"n-ok"}, rejected:{ico:"✎",cls:"n-bad"},
  reply:{ico:"💬",cls:"n-reply"}, noted:{ico:"👁",cls:"n-noted"},
  welcome:{ico:"👋",cls:"n-task"}
};
function popAlert(kind,text,sub,fromUser,uid){
  const photo=fromUser?userRec(fromUser).photo:null;
  nativeNotify(text,sub,kind,photo,uid);
  const s=ALERT_STYLE[kind]||ALERT_STYLE.task;
  const el=document.createElement("div");
  el.className="task-alert "+s.cls;
  el.style.top=(80+document.querySelectorAll(".task-alert").length*92)+"px";
  const face=photo?`<img class="ta-face" src="${photo}" alt="">`
                  :(fromUser?`<div class="ta-face letter">${esc((displayName(fromUser)||"?")[0].toUpperCase())}</div>`:"");
  el.innerHTML=`
    <div class="ta-glass">
      ${face||`<div class="ta-ico">${s.ico}</div>`}
      <div class="ta-txt"><b>${esc(text)} ${s.ico}</b><small>${esc(sub||"")}</small></div>
    </div>
    <div class="shard s1"></div><div class="shard s2"></div><div class="shard s3"></div>
    <div class="shard s4"></div><div class="shard s5"></div><div class="shard s6"></div>`;
  el.onclick=()=>{el.remove(); (kind==="approval"||kind==="approved"||kind==="rejected")?openApprovals():openTasks();};
  document.body.appendChild(el);
  setTimeout(()=>el.classList.add("shatter"),4200);
  setTimeout(()=>el.remove(),5400);
}
function openTasks(){renderTasks();openModal("tasksModal");}
function relevantTasks(){
  if(isAdminNow())return tasks;
  const m=me();
  return tasks.filter(t=>
    (t.by===m.user)||   // tasks I assigned
    (t.to&&((t.to.users&&t.to.users[m.user])||(t.to.teams&&myTeams().some(x=>t.to.teams[x])))));
}
function renderTasks(){
  const admin=isAdminNow();
  $("tasksSub").textContent=admin?"All tasks across the team.":"Tasks assigned to you, and tasks you assigned.";
  const cut=Date.now()-HIDE_AFTER;
  $("taskRows").innerHTML=relevantTasks().filter(t=>t.status==="open"||(t.doneAt||0)>cut).map(t=>{
    const who=[...(t.to?.teams?Object.keys(t.to.teams):[]),...(t.to?.users?Object.keys(t.to.users).map(displayName):[])].join(", ");
    const canDel=admin||t.by===me().user;
    const notedBy=t.noted?Object.keys(t.noted):[];
    const iNoted=notedBy.includes(me().user);
    const isForMe=!!(t.to&&((t.to.users&&t.to.users[me().user])||(t.to.teams&&myTeams().some(x=>t.to.teams[x]))));
    const reps=t.replies?Object.keys(t.replies).map(k=>({id:k,...t.replies[k]})).sort((a,b)=>a.ts-b.ts):[];
    return `<div class="task-card ${t.status==="open"?"open":"done-t"}">
      <div class="task-top"><b>${esc(t.title)}</b></div>
      <div class="task-meta">To: ${esc(who)} · By ${esc(displayName(t.by))} · ${new Date(t.ts).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</div>
      <div class="task-body">${sanitize(t.body||"")}</div>
      <div class="task-actions">
        ${t.status==="open"?`<button class="btn chip-btn ok" onclick="doneTask('${t.id}')">✓ Mark done</button>`:`<span class="chip-btn ok" style="cursor:default">Completed</span>`}
        ${isForMe?(iNoted?`<span class="chip-btn noted-on" style="cursor:default">👁 Noted</span>`
                        :`<button class="btn chip-btn" onclick="noteTask('${t.id}')">👁 Noted</button>`):""}
        <button class="btn chip-btn" onclick="toggleReply('${t.id}')">💬 Reply${reps.length?" ("+reps.length+")":""}</button>
        ${canDel?`<button class="btn chip-btn" onclick="delTask('${t.id}')">Delete</button>`:""}
      </div>
      ${notedBy.length?`<div class="noted-strip">${notedBy.map(n=>`<span class="noted-badge">👁 ${esc(displayName(n))} noted</span>`).join("")}</div>`:""}
      <div class="reply-box" id="rb_${t.id}">
        ${reps.map(r=>`
          <div class="reply ${r.by===me().user?"mine":""}">
            <b>${esc(displayName(r.by))}</b>
            <span>${esc(r.text)}</span>
            <small>${new Date(r.ts).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}</small>
            ${r.edited?`<small style="opacity:.6">(edited)</small>`:""}
            ${(isAdminNow()||r.by===me().user)?`<button class="btn tiny-btn" title="Edit" onclick="editReply('task','${t.id}','${r.id}','${r.by}')">✏️</button><button class="btn tiny-btn danger" onclick="delReply('${t.id}','${r.id}','${r.by}')">✕</button>`:""}
          </div>`).join("")}
        <div class="reply-row">
          <input id="rp_${t.id}" placeholder="Write a reply…" onkeydown="if(event.key==='Enter')sendReply('${t.id}')">
          <button class="btn mini-add todo" onclick="sendReply('${t.id}')">SEND</button>
        </div>
      </div>
    </div>`;
  }).join("")||'<div class="mc-empty" style="padding:10px">No tasks here yet 🎉</div>';
}
function openCompose(){
  $("taskTitle").value="";$("taskBody").innerHTML="";
  const ac=$("assignChecks");
  ac.innerHTML=teamNames().map(n=>`<label class="check-pill"><input type="checkbox" data-kind="team" value="${esc(n)}"> 👥 ${esc(n)}</label>`).join("")+
    allUsers().filter(u=>u.role!=="coordinator").map(u=>`<label class="check-pill"><input type="checkbox" data-kind="user" value="${esc(u.user)}"> ${esc(u.name||cap(u.user))}</label>`).join("");
  openModal("composeModal");
}
function fmt(cmd){document.execCommand(cmd,false,null);$("taskBody").focus();}
function fmtColor(c){document.execCommand("foreColor",false,c);$("taskBody").focus();}
function assignTask(){
  const title=$("taskTitle").value.trim();
  const body=sanitize($("taskBody").innerHTML);
  if(!title){toast("Give the task a title");return;}
  const to={users:{},teams:{}};
  $("assignChecks").querySelectorAll("input:checked").forEach(i=>{
    if(i.dataset.kind==="team")to.teams[i.value]=true;else to.users[i.value]=true;});
  if(!Object.keys(to.users).length&&!Object.keys(to.teams).length){toast("Tick at least one person or team");return;}
  db.ref("tasks").push({title,body,to,by:me().user,ts:Date.now(),status:"open"})
    .then(()=>toast("Task assigned ✓"));
  closeModal("composeModal");
}
function doneTask(id){db.ref("tasks/"+id).update({status:"done",doneAt:Date.now()});}

/* ================= APPROVALS ================= */
function isApprover(a){
  const m=me();
  return !!(a.to&&((a.to.users&&a.to.users[m.user])||(a.to.teams&&myTeams().some(x=>a.to.teams[x]))));
}
function liveApprovals(){
  const cut=Date.now()-HIDE_AFTER;
  return approvals.filter(a=>a.status==="pending"||(a.decidedAt||0)>cut);
}
function myApprovals(){
  const m=me().user;
  return liveApprovals().filter(a=>isAdminNow()||a.by===m||isApprover(a));
}
function pendingForMe(){return liveApprovals().filter(a=>a.status==="pending"&&isApprover(a));}
function updateApprBadge(){
  const b=$("apprBadge");if(!b)return;
  const n=pendingForMe().length;
  b.style.display=n?"flex":"none";b.textContent=n;
}
function openApprovals(){renderApprovals();openModal("apprModal");}
function setApprFilter(f){
  apprFilter=f;
  document.querySelectorAll(".af").forEach(b=>b.classList.toggle("on",b.dataset.f===f));
  renderApprovals();
}
function openApprCompose(){
  $("apprTitle").value="";$("apprLink").value="";$("apprBody").innerHTML="";$("apprPriority").value="normal";
  $("apprChecks").innerHTML=teamNames().map(n=>`<label class="check-pill"><input type="checkbox" data-kind="team" value="${esc(n)}"> 👥 ${esc(n)}</label>`).join("")+
    allUsers().filter(u=>u.user!==me().user).map(u=>`<label class="check-pill"><input type="checkbox" data-kind="user" value="${esc(u.user)}"> ${esc(u.name||cap(u.user))}</label>`).join("");
  openModal("apprCompose");
}
function afmt(c){document.execCommand(c,false,null);$("apprBody").focus();}
function afmtColor(c){document.execCommand("foreColor",false,c);$("apprBody").focus();}
function sendApproval(){
  const title=$("apprTitle").value.trim();
  if(!title){toast("Give the request a title");return;}
  const to={users:{},teams:{}};
  $("apprChecks").querySelectorAll("input:checked").forEach(i=>{
    if(i.dataset.kind==="team")to.teams[i.value]=true;else to.users[i.value]=true;});
  if(!Object.keys(to.users).length&&!Object.keys(to.teams).length){toast("Choose who should approve");return;}
  db.ref("approvals").push({
    title, body:sanitize($("apprBody").innerHTML), link:$("apprLink").value.trim(),
    priority:$("apprPriority").value, to, by:me().user, ts:Date.now(), status:"pending"
  }).then(()=>toast("Approval request sent ✓"));
  closeModal("apprCompose");
}
function approveIt(id){
  const a=approvals.find(x=>x.id===id);if(!a||!isApprover(a))return;
  db.ref("approvals/"+id).update({status:"approved",decidedBy:me().user,decidedAt:Date.now()})
    .then(()=>toast("Approved ✓"));
}
function rejectIt(id){
  const a=approvals.find(x=>x.id===id);if(!a||!isApprover(a))return;
  const why=prompt("What needs correcting? (this is sent to them)");
  if(why===null)return;
  db.ref("approvals/"+id).update({status:"rejected",decidedBy:me().user,decidedAt:Date.now(),reason:why.trim()})
    .then(()=>toast("Sent back for correction"));
}
function reopenAppr(id){
  const a=approvals.find(x=>x.id===id);if(!a||a.by!==me().user)return;
  db.ref("approvals/"+id).update({status:"pending",decidedBy:null,decidedAt:null,reason:null})
    .then(()=>toast("Resubmitted for approval ✓"));
}
const UNDO_WINDOW=15*60*1000;   // 15 minutes to undo a decision
function canUndo(a){
  return a.status!=="pending" && a.decidedBy===me().user &&
         (Date.now()-(a.decidedAt||0))<UNDO_WINDOW;
}
function undoDecision(id){
  const a=approvals.find(x=>x.id===id);if(!a)return;
  if(!canUndo(a)&&!isAdminNow()){toast("The undo window has passed");return;}
  askConfirm("Undo this decision?",
    "It goes back to pending and "+displayName(a.by)+" will be notified again.",
    ()=>{
      db.ref("approvals/"+id).update({
        status:"pending",decidedBy:null,decidedAt:null,reason:null,
        undoneBy:me().user,undoneAt:Date.now()
      }).then(()=>toast("Decision undone — back to pending ✓"));
    },"Yes, undo");
}
function delApproval(id){
  const a=approvals.find(x=>x.id===id);if(!a)return;
  if(!isAdminNow()&&a.by!==me().user)return;
  askConfirm("Delete this request?","The whole thread and its replies will be removed.",
    ()=>db.ref("approvals/"+id).remove(),"Yes, delete");
}
function sendApprReply(id){
  const box=$("ar_"+id);if(!box)return;
  const t=box.value.trim();if(!t){toast("Write a reply first");return;}
  db.ref("approvals/"+id+"/replies").push({by:me().user,text:t,ts:Date.now()}).then(()=>{box.value="";});
}
function toggleApprReply(id){
  const b=$("ab_"+id);if(!b)return;
  b.classList.toggle("on");
  if(b.classList.contains("on")){const i=$("ar_"+id);i&&i.focus();}
}
function renderApprovals(){
  const m=me().user;
  let list=myApprovals();
  if(apprFilter==="pending")list=list.filter(a=>a.status==="pending");
  if(apprFilter==="mine")list=list.filter(a=>a.by===m);
  $("apprSub").textContent=isAdminNow()?"All approval requests across the team.":"Requests waiting on you, and requests you sent.";
  $("apprRows").innerHTML=list.map(a=>{
    const who=[...(a.to?.teams?Object.keys(a.to.teams):[]),...(a.to?.users?Object.keys(a.to.users).map(displayName):[])].join(", ");
    const reps=a.replies?Object.keys(a.replies).map(k=>({id:k,...a.replies[k]})).sort((x,y)=>x.ts-y.ts):[];
    const mineReq=a.by===m, canApprove=isApprover(a)&&a.status==="pending";
    const left=a.decidedAt?Math.max(0,Math.round((a.decidedAt+HIDE_AFTER-Date.now())/3600000)):0;
    return `<div class="appr-card ${a.status}">
      <div class="appr-top">
        <span class="appr-state ${a.status}">${a.status==="approved"?"✓ Approved":a.status==="rejected"?"✕ Needs correction":"⏳ Pending"}</span>
        ${a.priority==="high"?`<span class="pri high">HIGH</span>`:a.priority==="low"?`<span class="pri low">LOW</span>`:""}
        <b>${esc(a.title)}</b>
      </div>
      <div class="task-meta">From ${esc(displayName(a.by))} · To ${esc(who)} · ${new Date(a.ts).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}
      ${a.decidedAt?` · by ${esc(displayName(a.decidedBy))} · hides in ${left}h`:""}
      ${a.undoneBy&&a.status==="pending"?` · <span style="color:var(--gold)">↩ undone by ${esc(displayName(a.undoneBy))}</span>`:""}</div>
      ${a.body?`<div class="task-body">${sanitize(a.body)}</div>`:""}
      ${a.link?`<a class="appr-link" href="${esc(a.link)}" target="_blank">🔗 Open attachment</a>`:""}
      ${a.reason?`<div class="appr-reason">✎ ${esc(a.reason)}
        ${(a.decidedBy===m||isAdminNow())?`<button class="btn tiny-btn" title="Edit message" onclick="editReason('${a.id}')">✏️</button>`:""}</div>`:""}
      <div class="task-actions">
        ${canApprove?`<button class="btn chip-btn ok" onclick="approveIt('${a.id}')">✓ Approve</button>
        <button class="btn chip-btn danger" onclick="rejectIt('${a.id}')">✕ Needs correction</button>`:""}
        ${(mineReq&&a.status==="rejected")?`<button class="btn chip-btn" onclick="reopenAppr('${a.id}')">↻ Resubmit</button>`:""}
        ${(canUndo(a)||(isAdminNow()&&a.status!=="pending"))?`<button class="btn chip-btn undo-btn" onclick="undoDecision('${a.id}')">↩ Undo${canUndo(a)?" ("+Math.max(1,Math.ceil((UNDO_WINDOW-(Date.now()-(a.decidedAt||0)))/60000))+"m)":""}</button>`:""}
        <button class="btn chip-btn" onclick="toggleApprReply('${a.id}')">💬 Reply${reps.length?" ("+reps.length+")":""}</button>
        ${(mineReq||isAdminNow())?`<button class="btn chip-btn" onclick="delApproval('${a.id}')">Delete</button>`:""}
      </div>
      <div class="reply-box" id="ab_${a.id}">
        ${reps.map(r=>`<div class="reply ${r.by===m?"mine":""}"><b>${esc(displayName(r.by))}</b><span>${esc(r.text)}</span>
          <small>${new Date(r.ts).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}${r.edited?" (edited)":""}</small>
          ${(isAdminNow()||r.by===m)?`<button class="btn tiny-btn" title="Edit" onclick="editReply('appr','${a.id}','${r.id}','${r.by}')">✏️</button>`:""}
          </div>`).join("")}
        <div class="reply-row">
          <input id="ar_${a.id}" placeholder="Write a reply…" onkeydown="if(event.key==='Enter')sendApprReply('${a.id}')">
          <button class="btn mini-add todo" onclick="sendApprReply('${a.id}')">SEND</button>
        </div>
      </div>
    </div>`;
  }).join("")||'<div class="mc-empty" style="padding:14px">Nothing here 🎉</div>';
}

/* ---------- NOTED ---------- */
function noteTask(id){
  const m=me().user;
  db.ref("tasks/"+id+"/noted/"+m).set({at:Date.now()}).then(()=>toast("Marked as noted ✓"));
}
/* ---------- REPLIES ---------- */
function sendReply(id){
  const box=$("rp_"+id); if(!box)return;
  const txt=box.value.trim(); if(!txt){toast("Write a reply first");return;}
  db.ref("tasks/"+id+"/replies").push({by:me().user,text:txt,ts:Date.now()})
    .then(()=>{box.value="";});
}
function editReply(kind,pid,rid,by){
  if(!isAdminNow()&&by!==me().user){toast("You can only edit your own reply");return;}
  const base=kind==="task"?tasks:approvals;
  const p=base.find(x=>x.id===pid); if(!p||!p.replies||!p.replies[rid])return;
  const t=prompt("Edit your reply:",p.replies[rid].text);
  if(t===null)return;
  const txt=t.trim(); if(!txt){toast("Reply can't be empty");return;}
  db.ref((kind==="task"?"tasks/":"approvals/")+pid+"/replies/"+rid)
    .update({text:txt,edited:Date.now()}).then(()=>toast("Reply updated ✓"));
}
function editReason(id){
  const a=approvals.find(x=>x.id===id); if(!a)return;
  if(a.decidedBy!==me().user&&!isAdminNow()){toast("Only the approver can edit this");return;}
  const t=prompt("Edit the correction message:",a.reason||"");
  if(t===null)return;
  db.ref("approvals/"+id+"/reason").set(t.trim()).then(()=>toast("Message updated ✓"));
}
function toggleReply(id){
  const b=$("rb_"+id); if(!b)return;
  b.classList.toggle("on");
  if(b.classList.contains("on")){const i=$("rp_"+id); i&&i.focus();}
}
function delReply(tid,rid,by){
  if(!isAdminNow()&&by!==me().user)return;
  db.ref("tasks/"+tid+"/replies/"+rid).remove();
}
function delTask(id){
  const t=tasks.find(x=>x.id===id);if(!t)return;
  if(!isAdminNow()&&t.by!==me().user)return;
  if(confirm("Delete this task?"))db.ref("tasks/"+id).remove();
}

/* ---------- boot ---------- */
bootCloud();
if(session())enterApp();

/* ---------- drag & drop reorder ---------- */
let dragEl=null;
function enableDrag(listEl, selector, onReorder){
  listEl.querySelectorAll(selector).forEach(el=>{
    el.draggable=true;
    el.addEventListener("dragstart",()=>{dragEl=el;el.style.opacity=.4;});
    el.addEventListener("dragend",()=>{
      el.style.opacity=1;
      if(!dragEl)return;
      const ids=[...listEl.querySelectorAll(selector)].map(x=>x.dataset.id);
      onReorder(ids); dragEl=null;
    });
    el.addEventListener("dragover",e=>{
      e.preventDefault();
      if(!dragEl||dragEl===el)return;
      const r=el.getBoundingClientRect();
      const after=(e.clientY-r.top)>r.height/2;
      el.parentNode.insertBefore(dragEl, after?el.nextSibling:el);
    });
  });
}


/* ---------- click the dark backdrop to close any modal ---------- */
document.querySelectorAll(".overlay").forEach(ov=>{
  ov.addEventListener("mousedown",e=>{ if(e.target===ov) ov.classList.remove("on"); });
});
document.addEventListener("keydown",e=>{           // bonus: Esc also closes
  if(e.key==="Escape") document.querySelectorAll(".overlay.on").forEach(o=>o.classList.remove("on"));
});


function clearPhoto(){
  const s=session();if(!s||!cloudOn)return;
  const isMaster=!cloudUsers.some(u=>u.user===s.user);
  window._pfPhoto=null;$("pfFile").value="";
  db.ref((isMaster?"masters/":"users/")+s.user+"/photo").remove().then(()=>{
    $("pfPreview").innerHTML=`<div class="avatar" style="width:72px;height:72px">${(s.name||s.user)[0].toUpperCase()}</div>`;
    toast("Photo removed ✓");refreshMyChip();
  });
}


function askConfirm(title,msg,onYes,yesLabel){
  $("cfTitle").textContent=title;
  $("cfMsg").textContent=msg;
  const y=$("cfYes");
  y.textContent=yesLabel||"Yes, remove";
  const fresh=y.cloneNode(true);          // clear old handlers
  y.parentNode.replaceChild(fresh,y);
  fresh.addEventListener("click",()=>{closeModal("confirmModal");onYes();});
  openModal("confirmModal");
}


/* ---------- right-click: open sheet in a new dashboard tab ---------- */
function openInNewTab(id){
  hideCtx();
  window.open(location.pathname+"?sheet="+encodeURIComponent(id),"_blank");
}
function showCtx(ev,id){
  ev.preventDefault(); ev.stopPropagation();
  hideCtx();
  const m=document.createElement("div");
  m.className="ctx-menu"; m.id="ctxMenu";
  m.innerHTML=`<button onclick="openInNewTab('${id}')">🗗 Open in new tab</button>
               <button onclick="openSheet('${id}');hideCtx()">↳ Open here</button>`;
  document.body.appendChild(m);
  const w=210,h=90;
  m.style.left=Math.min(ev.clientX,window.innerWidth-w-8)+"px";
  m.style.top=Math.min(ev.clientY,window.innerHeight-h-8)+"px";
}
function hideCtx(){const m=$("ctxMenu");if(m)m.remove();}
document.addEventListener("click",hideCtx);
document.addEventListener("scroll",hideCtx,true);

/* ================= ARCHIVED DATA ================= */
function monthKey(ts){const d=new Date(ts);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");}
function monthLabel(k){const[y,m]=k.split("-");return new Date(y,m-1,1).toLocaleDateString("en-IN",{month:"long",year:"numeric"});}
function daysBetween(a,b){if(!a||!b)return null;return Math.max(0,Math.round((b-a)/86400000));}
function fmtDate(ts){return ts?new Date(ts).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"2-digit"}):"—";}
function fmtDateTime(ts){return ts?new Date(ts).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"numeric",minute:"2-digit"}):"—";}
function namesOf(to){
  if(!to)return "—";
  return [...(to.teams?Object.keys(to.teams):[]),...(to.users?Object.keys(to.users).map(displayName):[])].join(", ")||"—";
}

function archRows(){
  if(archTab==="appr"){
    return approvals.map(a=>({
      id:a.id, title:a.title||"—",
      from:displayName(a.by), to:namesOf(a.to),
      status:a.status||"pending",
      decidedBy:a.decidedBy?displayName(a.decidedBy):"—",
      created:a.ts||0, closed:a.decidedAt||0,
      days:daysBetween(a.ts,a.decidedAt),
      priority:a.priority||"normal",
      replies:a.replies?Object.keys(a.replies).length:0,
      note:a.reason||""
    }));
  }
  return tasks.map(t=>({
    id:t.id, title:t.title||"—",
    from:displayName(t.by), to:namesOf(t.to),
    status:t.status==="done"?"completed":"open",
    decidedBy:t.noted?Object.keys(t.noted).map(displayName).join(", "):"—",
    created:t.ts||0, closed:t.doneAt||0,
    days:daysBetween(t.ts,t.doneAt),
    priority:"—",
    replies:t.replies?Object.keys(t.replies).length:0,
    note:""
  }));
}
function archMonths(){
  const set={};
  archRows().forEach(r=>{ if(r.created)set[monthKey(r.created)]=1; });
  const keys=Object.keys(set).sort().reverse();
  if(!keys.length)keys.push(monthKey(Date.now()));
  return keys;
}
function setArchTab(t){
  archTab=t;
  document.querySelectorAll(".arch-tab").forEach(b=>b.classList.toggle("on",b.dataset.t===t));
  $("archSearch").value="";
  buildArchSelects();
  renderArchive();
}
function buildArchSelects(){
  const ms=$("archMonth"), cur=ms.value;
  const months=archMonths();
  ms.innerHTML=`<option value="all">All months</option>`+months.map(k=>`<option value="${k}">${monthLabel(k)}</option>`).join("");
  ms.value=(cur&&[...ms.options].some(o=>o.value===cur))?cur:months[0];
  const st=$("archStatus");
  st.innerHTML=archTab==="appr"
    ? `<option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Needs correction</option>`
    : `<option value="">All statuses</option><option value="open">Open</option><option value="completed">Completed</option>`;
}
function openArchiveData(){
  if(isCoordinator())return;
  buildArchSelects();
  renderArchive();
  openModal("archModal");
}
function sortArch(col){
  archSort = (archSort.col===col) ? {col,dir:-archSort.dir} : {col,dir:-1};
  renderArchive();
}
function archFiltered(){
  const mk=$("archMonth").value, q=$("archSearch").value.trim().toLowerCase(), st=$("archStatus").value;
  let rows=archRows();
  if(mk&&mk!=="all")rows=rows.filter(r=>r.created&&monthKey(r.created)===mk);
  if(st)rows=rows.filter(r=>r.status===st);
  if(q)rows=rows.filter(r=>(r.title+" "+r.from+" "+r.to+" "+r.decidedBy+" "+r.note).toLowerCase().includes(q));
  const c=archSort.col,d=archSort.dir;
  return rows.sort((a,b)=>{
    const x=a[c]??"",y=b[c]??"";
    if(typeof x==="number"&&typeof y==="number")return (x-y)*d;
    return String(x).localeCompare(String(y))*d;
  });
}
function renderArchive(){
  const rows=archFiltered(), isAppr=archTab==="appr";
  // stat cards
  const done=rows.filter(r=>r.status==="approved"||r.status==="completed").length;
  const open=rows.filter(r=>r.status==="pending"||r.status==="open").length;
  const redo=rows.filter(r=>r.status==="rejected").length;
  const withDays=rows.filter(r=>r.days!==null);
  const avg=withDays.length?(withDays.reduce((s,r)=>s+r.days,0)/withDays.length).toFixed(1):"—";
  $("archStats").innerHTML=`
    <div class="stat"><b>${rows.length}</b><small>Total</small></div>
    <div class="stat ok"><b>${done}</b><small>${isAppr?"Approved":"Completed"}</small></div>
    <div class="stat warn"><b>${open}</b><small>${isAppr?"Pending":"Open"}</small></div>
    ${isAppr?`<div class="stat bad"><b>${redo}</b><small>Corrections</small></div>`:""}
    <div class="stat"><b>${avg}</b><small>Avg days to close</small></div>`;
  // table
  const th=(k,l)=>`<th onclick="sortArch('${k}')" class="${archSort.col===k?"sorted":""}">${l}${archSort.col===k?(archSort.dir>0?" ▲":" ▼"):""}</th>`;
  $("archTable").innerHTML=`
    <thead><tr>
      ${th("title",isAppr?"Request":"Task")}
      ${th("from","Raised by")}
      ${th("to","Sent to")}
      ${th("status","Status")}
      ${th("decidedBy",isAppr?"Decided by":"Noted by")}
      ${th("created","Created")}
      ${th("closed",isAppr?"Decided":"Completed")}
      ${th("days","Days")}
      ${isAppr?th("priority","Priority"):""}
      ${th("replies","💬")}
    </tr></thead>
    <tbody>${rows.map(r=>`
      <tr>
        <td class="t-title"><b>${esc(r.title)}</b>${r.note?`<small class="t-note">✎ ${esc(r.note)}</small>`:""}</td>
        <td>${esc(r.from)}</td>
        <td class="t-wrap">${esc(r.to)}</td>
        <td><span class="st-pill ${r.status}">${r.status==="approved"?"Approved":r.status==="rejected"?"Correction":r.status==="completed"?"Completed":r.status==="pending"?"Pending":"Open"}</span></td>
        <td>${esc(r.decidedBy)}</td>
        <td>${fmtDate(r.created)}</td>
        <td>${fmtDate(r.closed)}</td>
        <td class="t-days">${r.days===null?"—":r.days===0?"same day":r.days+"d"}</td>
        ${isAppr?`<td><span class="pri ${r.priority}">${r.priority==="high"?"HIGH":r.priority==="low"?"LOW":"—"}</span></td>`:""}
        <td>${r.replies||"—"}</td>
      </tr>`).join("")||`<tr><td colspan="10" class="arch-empty">Nothing found for this month</td></tr>`}
    </tbody>`;
  const mk=$("archMonth").value;
  $("archFoot").textContent=`${rows.length} record${rows.length===1?"":"s"} · ${mk==="all"?"all months":monthLabel(mk)}`;
}
function exportArchive(){
  const rows=archFiltered(), isAppr=archTab==="appr";
  const head=["Title","Raised by","Sent to","Status",isAppr?"Decided by":"Noted by","Created","Closed","Days",isAppr?"Priority":"","Replies","Note"];
  const csv=[head.join(",")].concat(rows.map(r=>[
    r.title,r.from,r.to,r.status,r.decidedBy,fmtDateTime(r.created),fmtDateTime(r.closed),
    r.days===null?"":r.days,isAppr?r.priority:"",r.replies,r.note
  ].map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(","))).join("\n");
  const mk=$("archMonth").value;
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download="ODEA_"+(isAppr?"Approvals_":"Tasks_")+(mk==="all"?"all":mk)+".csv";
  a.click();
  toast("CSV downloaded ✓");
}

/* ================= EMPLOYEE ID CARD ================= */
function ageFrom(d){ if(!d)return null; const b=new Date(d),n=new Date();
  let a=n.getFullYear()-b.getFullYear(); const m=n.getMonth()-b.getMonth();
  if(m<0||(m===0&&n.getDate()<b.getDate()))a--; return a; }
function tenure(d){ if(!d)return null; const j=new Date(d),n=new Date();
  const mo=(n.getFullYear()-j.getFullYear())*12+(n.getMonth()-j.getMonth());
  if(mo<1)return "New joiner";
  if(mo<12)return mo+" month"+(mo>1?"s":"");
  const y=Math.floor(mo/12),r=mo%12;
  return y+" yr"+(y>1?"s":"")+(r?" "+r+" mo":""); }
function isBirthdayToday(d){ if(!d)return false; const b=new Date(d),n=new Date();
  return b.getDate()===n.getDate()&&b.getMonth()===n.getMonth(); }
function empId(u){ let h=0; for(let i=0;i<u.length;i++)h=(h*31+u.charCodeAt(i))>>>0;
  return "ODEA-"+String(h%9000+1000); }

function showIdCard(user){
  const r=userRec(user); if(!r||!r.user&&!r.name)return;
  const my=entries.filter(e=>e.user===user);
  const doneToday=my.filter(e=>e.status==="done").length;
  const openNow=my.filter(e=>e.status!=="done").length;
  const myTasks=tasks.filter(t=>t.to&&((t.to.users&&t.to.users[user])||(t.to.teams&&(r.teams?Object.keys(r.teams):r.team?[r.team]:[]).some(x=>t.to.teams[x]))));
  const tDone=myTasks.filter(t=>t.status==="done").length;
  const bday=isBirthdayToday(r.dob);
  const age=ageFrom(r.dob), ten=tenure(r.joined);
  const teamsTxt=myTeams(user).join(" · ")||"—";
  const line=(l,v)=>v?`<div class="idr"><span>${l}</span><b>${esc(v)}</b></div>`:"";


  const cell=(l,v)=>`<div class="idc"><span>${l}</span><b>${v?esc(v):"—"}</b></div>`;
  $("idCard").innerHTML=`
    ${bday?`<div class="id-bday">🎂 BIRTHDAY</div>`:""}
    <div class="id-strip"><img src="logo.png" alt=""><span>ODEA <em>Edu Development</em></span></div>
    <div class="id-hero">
      <div class="id-photo">${avatarHTML(user,110)}</div>
      <div class="id-hero-txt">
        <h3 class="id-name">${esc(r.name||cap(user))}</h3>
        <div class="id-title">${esc(r.title||roleLabel(r.role||"member"))}</div>
        <div class="id-team">${esc(teamsTxt)}</div>
      </div>
    </div>
    ${r.tagline?`<div class="id-tag">"${esc(r.tagline)}"</div>`:""}
    <div class="id-grid">
      ${cell("ID",empId(user))}
      ${cell("Blood",r.blood)}
      ${cell("Born",r.dob?new Date(r.dob).toLocaleDateString("en-IN",{day:"numeric",month:"short"})+(age?" · "+age:""):"")}
      ${cell("Tenure",ten)}
      ${cell("Phone",r.phone)}
      ${cell("Email",r.email)}
    </div>
    ${r.skills?`<div class="id-skills">${r.skills.split(",").map(s=>s.trim()).filter(Boolean).map(s=>`<span>${esc(s)}</span>`).join("")}</div>`:""}
    <div class="id-stats">
      <div><b>${doneToday}</b><small>Done</small></div>
      <div><b>${openNow}</b><small>Open</small></div>
      <div><b>${tDone}/${myTasks.length}</b><small>Tasks</small></div>
    </div>
    <div class="id-foot"><span>@${esc(user)}</span><small>ODEA EDU DEVELOPMENT · COIMBATORE</small></div>`;
  openModal("idModal");
  const c=$("idCard");
  c.classList.remove("swing"); void c.offsetWidth; c.classList.add("swing");
}




/* ================= BIRTHDAY CELEBRATION ================= */
const BDAY_WISHES=[
  "Another year of legendary work 🚀",
  "May your renders never crash today 🎬",
  "Cake first, deadlines later 🍰",
  "The whole ODEA family is celebrating you 🧡",
  "Wishing you zero revisions this year ✨",
  "Officially one year more experienced 😎",
  "Today your To-Do list is just: enjoy 🎉"
];
const BDAY_EMOJI=["🎈","🎉","🎂","🥳","🎁","✨","🎊","🍰","🧁","💛","🎀","⭐"];

function bdayKey(){return "odea_bday_"+(me().user||"anon")+"_"+todayIST();}
function checkMyBirthday(){
  const s=session(); if(!s)return;
  const r=userRec(s.user);
  if(!isBirthdayToday(r.dob))return;
  setTimeout(()=>showBirthday(s.user),1600);      // every login & refresh, all day
}
function showBirthday(user){
  const r=userRec(user);
  const age=ageFrom(r.dob);
  const wish=BDAY_WISHES[Math.floor(Math.random()*BDAY_WISHES.length)];
  $("bdayCard").innerHTML=`
    <div class="bd-glow"></div>
    <div class="bd-bow">🎀</div>
    <div class="bd-cake">🎂</div>
    <h2>Happy Birthday,<br><em>${esc(r.name||cap(user))}</em>!</h2>
    ${age?`<div class="bd-age">${age}<small>years young</small></div>`:""}
    <p class="bd-wish">${wish}</p>
    <div class="bd-emojis">${BDAY_EMOJI.slice(0,7).map(e=>`<span>${e}</span>`).join("")}</div>
    <div class="bd-from">— from everyone at <b>ODEA Edu Development</b> 🧡</div>
    <button class="btn btn-royal bd-btn" onclick="closeModal('bdayModal')">Thank you! 🥳</button>`;
  buildBdayFx();
  openModal("bdayModal");
  burstConfetti(90);
  setTimeout(()=>burstConfetti(60),900);
  setTimeout(()=>burstConfetti(60),1900);
}
function buildBdayFx(){
  const fx=$("bdayFx"); fx.innerHTML="";
  for(let i=0;i<16;i++){                          // floating balloons
    const b=document.createElement("div");
    b.className="balloon";
    b.style.left=(Math.random()*96)+"%";
    b.style.setProperty("--h",["#F15A22","#E8B44A","#7A5CE0","#3DC97A","#E85A4F","#FF7300"][i%6]);
    b.style.animationDelay=(Math.random()*6)+"s";
    b.style.animationDuration=(7+Math.random()*6)+"s";
    b.style.setProperty("--sc",(.7+Math.random()*.6).toFixed(2));
    fx.appendChild(b);
  }
  for(let i=0;i<14;i++){                          // drifting emojis
    const e=document.createElement("div");
    e.className="floaty";
    e.textContent=BDAY_EMOJI[Math.floor(Math.random()*BDAY_EMOJI.length)];
    e.style.left=(Math.random()*94)+"%";
    e.style.animationDelay=(Math.random()*8)+"s";
    e.style.animationDuration=(9+Math.random()*7)+"s";
    e.style.fontSize=(18+Math.random()*22)+"px";
    fx.appendChild(e);
  }
}
function burstConfetti(n){
  const fx=$("bdayFx"); if(!fx)return;
  const cols=["#F15A22","#E8B44A","#7A5CE0","#3DC97A","#FF7300","#FFD966","#E85A4F"];
  for(let i=0;i<n;i++){
    const c=document.createElement("i");
    c.className="conf";
    c.style.left=(Math.random()*100)+"%";
    c.style.background=cols[Math.floor(Math.random()*cols.length)];
    c.style.animationDelay=(Math.random()*.5)+"s";
    c.style.animationDuration=(2.4+Math.random()*2.2)+"s";
    c.style.setProperty("--x",(Math.random()*280-140)+"px");
    c.style.setProperty("--r",(Math.random()*900-450)+"deg");
    if(Math.random()>.6)c.style.borderRadius="50%";
    fx.appendChild(c);
    setTimeout(()=>c.remove(),5200);
  }
}
/* birthday wishes for OTHERS — a gentle heads-up popup */
function birthdayHeads(){
  const s=session(); if(!s)return;
  const others=allUsers().filter(u=>u.user!==s.user&&isBirthdayToday(u.dob));
  others.forEach((u,i)=>{
    const k="odea_bdnote_"+s.user+"_"+u.user+"_"+todayIST();
    if(localStorage.getItem(k))return;
    localStorage.setItem(k,"1");
    setTimeout(()=>popAlert("noted","🎂 It's "+displayName(u.user)+"'s birthday!","Send them your wishes",u.user,"bd_"+u.user),2600+i*1100);
  });
}





/* ================= ODEA INTERCOM (call / ping) ================= */
function toggleDnd(){
  dnd=!dnd; localStorage.setItem("odea_dnd",dnd?"1":"0");
  toast(dnd?"Do not disturb ON — calls stay silent":"Do not disturb OFF");
  if(currentView==="board")renderBoard();
}
function isBusy(u){
  const now=Date.now();
  return calls.some(c=>
    (c.from===u||c.to===u) &&
    (c.status==="ringing"||c.status==="answered") &&
    (now-c.ts)<RING_SECONDS*1000
  );
}
function startCall(to){
  if(!cloudOn)return;
  if(activeCall){toast("You're already on a call");return;}
  if(isBusy(to)){
    popAlert("rejected","📞 Line busy",displayName(to)+" is on another call — try again shortly",to,"busy_"+to+"_"+Date.now());
    return;
  }
  const note=prompt("Optional — what's it about? (leave blank to just ring)","");
  if(note===null)return;
  const ref=db.ref("calls").push({
    from:me().user,to,ts:Date.now(),status:"ringing",note:(note||"").trim()
  });
  activeCall={id:ref.key,role:"caller",to};
  showCallUI("caller",{from:me().user,to,note:(note||"").trim()});
  setTimeout(()=>{
    if(activeCall&&activeCall.id===ref.key){
      db.ref("calls/"+ref.key).update({status:"missed"});
      endCallUI("No answer");
    }
  },RING_SECONDS*1000);
}
function handleCalls(){
  const m=me().user; if(!m)return;
  const now=Date.now();
  // incoming ring for me
    const inc=calls.find(c=>c.to===m&&c.status==="ringing"&&(now-c.ts)<RING_SECONDS*1000);
  // already on a call? tell the new caller the line is busy
  if(inc&&activeCall&&activeCall.id!==inc.id){
    db.ref("calls/"+inc.id).update({status:"busy"});
    return;
  }
  if(inc&&(!activeCall||activeCall.id!==inc.id)){
    activeCall={id:inc.id,role:"receiver",from:inc.from};
    showCallUI("receiver",inc);
    if(!dnd)startRinging(inc.from,m);
    if(navigator.vibrate)try{navigator.vibrate([400,200,400,200,400]);}catch(e){}
    setTimeout(()=>{ if(activeCall&&activeCall.id===inc.id){
      db.ref("calls/"+inc.id).update({status:"missed"}); endCallUI("Missed call"); } },RING_SECONDS*1000);
  }
  // my active call changed state elsewhere
  if(activeCall){
    const c=calls.find(x=>x.id===activeCall.id);
    if(!c){endCallUI("Call ended");return;}
    if(c.status==="answered"&&activeCall.role==="caller"){stopRinging();updateCallUI("connected",c);}
        if(c.status==="declined")endCallUI(activeCall.role==="caller"?"Call declined":"Declined");
    if(c.status==="busy"){
      const who=displayName(c.to);
      endCallUI(null);
      popAlert("rejected","📞 Line busy",who+" is on another call",c.to,"busy2_"+c.id);
    }
    if(c.status==="cancelled")endCallUI("Caller hung up");
    if(c.status==="ended")endCallUI("Call ended");
  }
  // missed-call note for me
    calls.filter(c=>c.to===m&&(c.status==="missed"||c.status==="busy")).forEach(c=>{
    const k="odea_missed_"+c.id;
    if(localStorage.getItem(k))return;
    localStorage.setItem(k,"1");
    popAlert("task","📞 Missed call",displayName(c.from)+(c.note?" · "+c.note:""),c.from,"mc_"+c.id);
  });
}

/* ---------- ring sound: two-tone chime + spoken name ---------- */
function startRinging(fromUser,toUser){
  stopRinging();
  try{
    ringCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(ringCtx.state==="suspended")ringCtx.resume();
  }catch(e){ringCtx=null;}
  const speakLine=()=>{
    if(!("speechSynthesis" in window))return;
    const line=firstName(toUser)+", "+firstName(fromUser)+" is calling you";
    const u=new SpeechSynthesisUtterance(line);
    u.rate=.95; u.pitch=1.03; u.volume=1;
    const vs=speechSynthesis.getVoices();
    const pick=vs.find(v=>/en-IN/i.test(v.lang))||vs.find(v=>/en-GB/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang));
    if(pick)u.voice=pick;
    try{speechSynthesis.cancel();speechSynthesis.speak(u);}catch(e){}
  };
  const cycle=()=>{ chime(); setTimeout(speakLine,900); };
  cycle();
  ringTimer=setInterval(cycle,4200);
  ringStop=setTimeout(stopRinging,RING_SECONDS*1000);
}
function chime(){                       // soft professional two-note tone
  if(!ringCtx)return;
  const notes=[[880,0],[1174,.22],[880,.62],[1174,.84]];
  notes.forEach(([f,t])=>{
    const o=ringCtx.createOscillator(),g=ringCtx.createGain();
    o.type="sine"; o.frequency.value=f;
    const s=ringCtx.currentTime+t;
    g.gain.setValueAtTime(0,s);
    g.gain.linearRampToValueAtTime(.22,s+.03);
    g.gain.exponentialRampToValueAtTime(.001,s+.35);
    o.connect(g).connect(ringCtx.destination);
    o.start(s); o.stop(s+.4);
  });
  // warm pad underneath
  const p=ringCtx.createOscillator(),pg=ringCtx.createGain();
  p.type="triangle"; p.frequency.value=220;
  const s=ringCtx.currentTime;
  pg.gain.setValueAtTime(0,s);
  pg.gain.linearRampToValueAtTime(.06,s+.15);
  pg.gain.exponentialRampToValueAtTime(.001,s+1.3);
  p.connect(pg).connect(ringCtx.destination);
  p.start(s); p.stop(s+1.4);
}
function stopRinging(){
  clearInterval(ringTimer); clearTimeout(ringStop); ringTimer=ringStop=null;
  if("speechSynthesis" in window)try{speechSynthesis.cancel();}catch(e){}
  if(ringCtx){try{ringCtx.close();}catch(e){} ringCtx=null;}
  if(navigator.vibrate)try{navigator.vibrate(0);}catch(e){}
}
function firstName(u){
  const r=userRec(u);
  return String(r.name||cap(u)).trim().split(/\s+/)[0];
}

/* ---------- call UI ---------- */
function showCallUI(role,c){
  const other=role==="caller"?c.to:c.from;
  $("callBox").innerHTML=`
    <div class="call-rings"><span></span><span></span><span></span></div>
    <div class="call-face">${avatarHTML(other,110)}</div>
    <h3>${esc(displayName(other))}</h3>
    <div class="call-sub" id="callSub">${role==="caller"?"Ringing…":"is calling you"}</div>
    ${c.note?`<div class="call-note">💬 ${esc(c.note)}</div>`:""}
    <div class="call-timer" id="callTimer">${RING_SECONDS}s</div>
    <div class="call-actions">
      ${role==="receiver"?`
        <button class="btn call-act decline" onclick="declineCall()">✕<small>Decline</small></button>
        <button class="btn call-act accept" onclick="answerCall()">✓<small>Answer</small></button>`
      :`<button class="btn call-act decline" onclick="cancelCall()">✕<small>Cancel</small></button>`}
    </div>`;
  openModal("callModal");
  let left=RING_SECONDS;
  activeCall._tick=setInterval(()=>{
    left--; const t=$("callTimer");
    if(t)t.textContent=left>0?left+"s":"";
    if(left<=0)clearInterval(activeCall._tick);
  },1000);
}
function updateCallUI(state,c){
  const sub=$("callSub"); if(sub)sub.textContent="Connected — go talk to them 🎉";
  const t=$("callTimer"); if(t)t.textContent="";
  $("callBox").querySelector(".call-actions").innerHTML=
    `<button class="btn call-act decline" onclick="hangUp()">✕<small>End</small></button>`;
  $("callBox").classList.add("connected");
}
function answerCall(){
  if(!activeCall)return;
  stopRinging();
  db.ref("calls/"+activeCall.id).update({status:"answered",answeredAt:Date.now()});
  updateCallUI("connected");
  toast("Answered — they've been told 👍");
  setTimeout(()=>{ if(activeCall)hangUp(); },4000);
}
function declineCall(){
  if(!activeCall)return;
  stopRinging();
  db.ref("calls/"+activeCall.id).update({status:"declined"});
  endCallUI("Declined");
}
function cancelCall(){
  if(!activeCall)return;
  db.ref("calls/"+activeCall.id).update({status:"cancelled"});
  endCallUI("Cancelled");
}
function hangUp(){
  if(!activeCall)return;
  db.ref("calls/"+activeCall.id).update({status:"ended"});
  endCallUI("Call ended");
}
function endCallUI(msg){
  stopRinging();
  if(activeCall&&activeCall._tick)clearInterval(activeCall._tick);
  activeCall=null;
  closeModal("callModal");
  $("callBox").classList.remove("connected");
  if(msg)toast(msg);
}
/* tidy old call records once a day */
function purgeCalls(){
  if(!cloudOn||!isAdminNow())return;
  const cut=Date.now()-24*60*60*1000;
  calls.filter(c=>c.ts<cut).forEach(c=>db.ref("calls/"+c.id).remove());
}
setTimeout(purgeCalls,20000);




/* ================= MY DAY ================= */
function greetWord(){
  const h=hourIST();
  return h<12?"Good morning":h<17?"Good afternoon":"Good evening";
}
function timeAgo(ts){
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<60)return "now";
  if(s<3600)return Math.floor(s/60)+"m";
  if(s<86400)return Math.floor(s/3600)+"h";
  return Math.floor(s/86400)+"d";
}
function showMyDay(){
  if(isCoordinator())return;
  currentView="myday";activeId=null;renderFolders();toggleSide(false);
  $("stageTitle").innerHTML=`<span class="live-dot"></span>My Day`;
  $("openExt").style.display="none";
  renderMyDay();
}
function renderMyDay(){
  if(currentView!=="myday")return;
  const m=me().user, r=userRec(m);
  const draft=$("in_"+m)?$("in_"+m).value:"";
  const wrap=$("stage").querySelector(".myday");
  const sy=wrap?wrap.scrollTop:0;
  const wasFocused=document.activeElement&&document.activeElement.id==="in_"+m;
  const mine=entries.filter(e=>e.user===m).sort((a,b)=>(a.ts||0)-(b.ts||0));
  const done=mine.filter(e=>e.status==="done").length;
  const prog=mine.filter(e=>e.status==="progress").length;
  const pend=mine.filter(e=>e.status==="pending").length;
  const total=mine.length;
  const pct=total?Math.round(done*100/total):0;
  const carried=mine.filter(e=>(e.days||1)>1).length;

  const myTasks=tasks.filter(t=>t.status==="open"&&t.to&&
    ((t.to.users&&t.to.users[m])||(t.to.teams&&myTeams().some(x=>t.to.teams[x]))));
  const sentTasks=tasks.filter(t=>t.by===m&&t.status==="open");
  const toApprove=pendingForMe();
  const myReqs=liveApprovals().filter(a=>a.by===m&&a.status!=="approved");

  const entryRow=e=>`
    <div class="entry md-entry">
      <span class="status-chip ${e.status||"pending"}" title="Tap to change" onclick="cycleStatus('${e.id}')"></span>
      <div class="txt ${e.status==="done"?"done":""}">${esc(e.text)}${(e.days||1)>1?` <small style="color:var(--gold)">(Day ${e.days})</small>`:""}</div>
      ${canDeleteEntry(e)?`<button class="btn entry-edit" title="Edit" onclick="editEntry('${e.id}')">✏️</button><button class="btn entry-del" onclick="delEntry('${e.id}')">✕</button>`:""}
    </div>`;
  const taskRow=(t,sent)=>{
    const age=Math.floor((Date.now()-(t.ts||Date.now()))/86400000);
    const who=sent?namesOf(t.to):displayName(t.by);
    return `<div class="md-item">
      <div class="md-item-top"><b>${esc(t.title)}</b>
        ${age>2?`<span class="md-age ${age>6?"hot":""}">${age}d</span>`:""}</div>
      <small>${sent?"To":"From"} ${esc(who)}</small>
      <div class="md-item-act">
        ${!sent?`<button class="btn chip-btn ok" onclick="doneTask('${t.id}')">✓ Done</button>`:""}
        <button class="btn chip-btn" onclick="openTasks()">Open</button>
      </div></div>`;
  };
  const apprRow=(a,mineReq)=>{
    const age=Math.floor((Date.now()-(a.ts||Date.now()))/86400000);
    return `<div class="md-item ${a.status==="rejected"?"bad":""}">
      <div class="md-item-top"><b>${esc(a.title)}</b>
        ${a.priority==="high"?`<span class="pri high">HIGH</span>`:""}
        ${age>2?`<span class="md-age ${age>6?"hot":""}">${age}d</span>`:""}</div>
      <small>${mineReq?"Waiting on "+esc(namesOf(a.to)):"From "+esc(displayName(a.by))}${a.status==="rejected"?" · needs correction":""}</small>
      <div class="md-item-act">
        ${!mineReq?`<button class="btn chip-btn ok" onclick="approveIt('${a.id}')">✓ Approve</button>
                    <button class="btn chip-btn danger" onclick="rejectIt('${a.id}')">✕ Correct</button>`:""}
        <button class="btn chip-btn" onclick="openApprovals()">Open</button>
      </div></div>`;
  };
  const notes=activeAlerts().slice(0,8);
  const noteRow=n=>`
    <div class="md-note" onclick="${n.kind==="approval"||n.kind==="approved"||n.kind==="rejected"?"openApprovals()":"openTasks()"}">
      <div class="md-note-ico ${ALERT_STYLE[n.kind]?ALERT_STYLE[n.kind].cls:"n-task"}">${ALERT_STYLE[n.kind]?ALERT_STYLE[n.kind].ico:"🔔"}</div>
      <div class="md-note-txt"><b>${esc(n.text)}</b><small>${esc(n.sub||"")}</small></div>
      <span class="md-note-time">${n.ts?timeAgo(n.ts):""}</span>
    </div>`;
  const bdays=allUsers().filter(u=>isBirthdayToday(u.dob));

  $("stage").innerHTML=`
  <div class="myday">
    <div class="md-hero">
      <div class="md-hero-l">
        ${avatarHTML(m,64)}
        <div><h2>${greetWord()}, <em>${esc(displayName(m))}</em></h2>
        <span class="md-date">${niceDate()}${r.title?" · "+esc(r.title):""}</span></div>
      </div>
      <div class="md-ring" style="--p:${pct}">
        <svg viewBox="0 0 44 44"><circle class="rb" cx="22" cy="22" r="19"/><circle class="rf" cx="22" cy="22" r="19"/></svg>
        <b>${pct}<i>%</i></b>
      </div>
    </div>
    ${bdays.length?`<div class="md-bday">🎂 It's ${bdays.map(b=>esc(displayName(b.user))).join(" & ")}'s birthday today — send your wishes! 🎀</div>`:""}
    ${carried?`<div class="md-warn">⏳ ${carried} item${carried>1?"s":""} carried from earlier — try to close ${carried>1?"them":"it"} today</div>`:""}
    <div class="md-stats">
      <div class="md-stat"><b>${total}</b><small>Today</small></div>
      <div class="md-stat ok"><b>${done}</b><small>Done</small></div>
      <div class="md-stat warn"><b>${prog}</b><small>In progress</small></div>
      <div class="md-stat bad"><b>${pend}</b><small>Pending</small></div>
      <div class="md-stat"><b>${myTasks.length}</b><small>Tasks</small></div>
      <div class="md-stat"><b>${toApprove.length}</b><small>To approve</small></div>
    </div>
    <div class="md-grid">
      <section class="md-panel md-wide">
        <h3>📋 My To-Do / EOD <span class="md-count">${total}</span></h3>
        <div class="md-addrow">
          <input id="in_${esc(m)}" placeholder="Add something for today…" onkeydown="if(event.key==='Enter')addEntry('${esc(m)}')">
          <button class="btn mini-add todo" onclick="addEntry('${esc(m)}')">ADD</button>
        </div>
        <div class="md-list">${mine.map(entryRow).join("")||'<div class="mc-empty">Nothing yet — add your first item above</div>'}</div>
      </section>
      <section class="md-panel">
        <h3>🔔 Tasks for me <span class="md-count">${myTasks.length}</span></h3>
        <div class="md-list">${myTasks.map(t=>taskRow(t,false)).join("")||'<div class="mc-empty">All clear 🎉</div>'}</div>
        ${sentTasks.length?`<h4 class="md-sub">Assigned by me (${sentTasks.length})</h4>
          <div class="md-list">${sentTasks.slice(0,4).map(t=>taskRow(t,true)).join("")}</div>`:""}
      </section>
      <section class="md-panel">
        <h3>✅ Approvals <span class="md-count">${toApprove.length+myReqs.length}</span></h3>
        ${toApprove.length?`<h4 class="md-sub">Waiting on me</h4><div class="md-list">${toApprove.map(a=>apprRow(a,false)).join("")}</div>`:""}
        ${myReqs.length?`<h4 class="md-sub">My requests</h4><div class="md-list">${myReqs.map(a=>apprRow(a,true)).join("")}</div>`:""}
        ${!toApprove.length&&!myReqs.length?'<div class="mc-empty">Nothing pending 🎉</div>':""}
      </section>
      <section class="md-panel md-wide">
        <h3>🔕 Recent activity <span class="md-count">${notes.length}</span></h3>
        <div class="md-notes">${notes.map(noteRow).join("")||'<div class="mc-empty">Nothing new</div>'}</div>
      </section>
    </div>
    <div class="md-quick">
      <button class="btn ghost-btn" onclick="showBoard()">👥 Team board</button>
      <button class="btn ghost-btn" onclick="openCompose()">➕ Assign task</button>
      <button class="btn ghost-btn" onclick="openApprCompose()">📤 Request approval</button>
      <button class="btn ghost-btn" onclick="openArchiveData()">🗄️ Archive</button>
    </div>
  </div>`;
  if(draft&&$("in_"+m))$("in_"+m).value=draft;
  const nw=$("stage").querySelector(".myday");
  if(nw&&sy)nw.scrollTop=sy;
  if(wasFocused&&$("in_"+m))$("in_"+m).focus();
}