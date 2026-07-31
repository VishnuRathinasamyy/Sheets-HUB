// /* =====================================================================
//    ODEA SHEETS HUB v2 — app logic
//    ⚙️ SETTINGS — the only things you ever edit in code:
// ===================================================================== */
// const USERS = [
//   { user: "admin", pass: "Odea@2026", role: "admin", team: "Admin", name: "Master Admin" },
// ];

// // const FIREBASE_CONFIG = {
// //   apiKey: "PASTE-YOURS",
// //   authDomain: "odea-hub.firebaseapp.com",
// //   databaseURL: "https://odea-hub-default-rtdb.asia-southeast1.firebasedatabase.app",
// //   projectId: "odea-hub",
// //   storageBucket: "odea-hub.firebasestorage.app",
// //   messagingSenderId: "PASTE-YOURS",
// //   appId: "PASTE-YOURS"
// // };

// const FIREBASE_CONFIG = {
//   apiKey: "AIzaSyDJQwWDb2csMhg-i_84TZH0VNpswFm1yh4",
//   authDomain: "odea-hub.firebaseapp.com",
//   databaseURL: "https://odea-hub-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "odea-hub",
//   storageBucket: "odea-hub.firebasestorage.app",
//   messagingSenderId: "198528619994",
//   appId: "1:198528619994:web:093b8522eb4fcd3c239ce3"
// };

// const DEFAULT_TEAMS = ["Tech Team","Creative Team","BDE Team","Production Team","Admin"];
// /* ===================== end of settings ============================ */

// const LS_SESSION="odea_session", LS_THEME="odea_theme";
// let db=null, cloudOn=false;
// let sheets=[], cloudUsers=[], teams=[], entries=[], tasks=[], settings={};
// let activeId=null, editingSheetId=null, editingUserKey=null, currentView="welcome";

// /* ---------- tiny helpers ---------- */
// const $=id=>document.getElementById(id);
// function toast(m){const t=$("toast");t.textContent=m;t.classList.add("on");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("on"),2600);}
// function openModal(id){$(id).classList.add("on")}
// function closeModal(id){$(id).classList.remove("on")}
// function esc(t){return String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
// function session(){try{return JSON.parse(sessionStorage.getItem(LS_SESSION))}catch(e){return null}}
// function me(){return session()||{};}
// function isAdminNow(){return me().role==="admin";}
// function setPill(state,text){const p=$("syncPill");if(!p)return;p.className="sync-pill "+state;$("syncText").textContent=text;}
// function todayIST(){return new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});}
// function niceDate(){return new Date().toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata",weekday:"long",day:"numeric",month:"long"});}
// function cap(s){return s?s[0].toUpperCase()+s.slice(1):s;}
// function sanitize(html){
//   const doc=new DOMParser().parseFromString(html,"text/html");
//   doc.querySelectorAll("script,style,iframe,object,embed,link").forEach(n=>n.remove());
//   doc.querySelectorAll("*").forEach(n=>{[...n.attributes].forEach(a=>{
//     if(/^on/i.test(a.name)||(a.name==="href"&&/^javascript:/i.test(a.value)))n.removeAttribute(a.name);
//   });});
//   return doc.body.innerHTML;
// }

// /* ---------- cloud boot ---------- */
// function bootCloud(){
//   if(!FIREBASE_CONFIG.apiKey||FIREBASE_CONFIG.apiKey==="PASTE-YOURS"){setPill("off","Local mode — cloud config missing");return;}
//   try{
//     firebase.initializeApp(FIREBASE_CONFIG);
//     db=firebase.database(); cloudOn=true;
//     setPill("ok","Cloud sync on");
//     db.ref("sheets").on("value",s=>{const v=s.val()||{};
//       sheets=Object.keys(v).map(k=>({id:k,...v[k]})).sort((a,b)=>((a.order??a.ts??0)-(b.order??b.ts??0)));
//       renderFolders();});
//     db.ref("users").on("value",s=>{const v=s.val()||{};
//       cloudUsers=Object.keys(v).map(k=>({user:k,...v[k]}));
//       if($("usersModal").classList.contains("on"))renderUsers();
//       if(currentView==="board")renderBoard();});
//     db.ref("teams").on("value",s=>{const v=s.val()||{};
//       teams=Object.keys(v).map(k=>({id:k,name:v[k].name}));
//       if(!teams.length&&isAdminNow())seedTeams();
//       renderTeamDependents();});
//     db.ref("entries").on("value",s=>{const v=s.val()||{};
//       entries=Object.keys(v).map(k=>({id:k,...v[k]}));
//       if(currentView==="board")renderBoard();});
//     db.ref("tasks").on("value",s=>{const v=s.val()||{};
//       tasks=Object.keys(v).map(k=>({id:k,...v[k]})).sort((a,b)=>(b.ts||0)-(a.ts||0));
//       updateTaskBadge();
//       if($("tasksModal").classList.contains("on"))renderTasks();});
//     db.ref("settings").on("value",s=>{settings=s.val()||{};
//       if($("settingsModal").classList.contains("on"))$("archiveUrl").value=settings.archiveUrl||"";
//       renderFolders();});
//   }catch(e){setPill("off","Local mode");}
// }
// function seedTeams(){DEFAULT_TEAMS.forEach(n=>db.ref("teams").push({name:n}));}
// function teamNames(){return teams.length?teams.map(t=>t.name):DEFAULT_TEAMS;}
// function allUsers(){return USERS.concat(cloudUsers);}
// function displayName(u){const x=allUsers().find(a=>a.user===u);return (x&&x.name)||cap(u);}

// /* ---------- auth ---------- */
// function doLogin(){
//   const u=$("u").value.trim(),p=$("p").value;
//   const hit=allUsers().find(x=>x.user.toLowerCase()===u.toLowerCase()&&x.pass===p);
//   if(!hit){$("loginErr").style.display="block";return;}
//   sessionStorage.setItem(LS_SESSION,JSON.stringify({user:hit.user,role:hit.role,team:hit.team||"",name:hit.name||cap(hit.user)}));
//   enterApp();
// }
// function doLogout(){sessionStorage.removeItem(LS_SESSION);location.reload();}
// document.addEventListener("keydown",e=>{
//   if(e.key==="Enter"&&$("loginView").style.display!=="none"&&!$("appView").classList.contains("on"))doLogin();
// });

// function enterApp(){
//   const s=session();if(!s)return;
//   $("loginView").style.display="none";
//   $("appView").classList.add("on");
//   $("whoName").textContent=s.name||s.user;
//   $("whoRole").textContent=(s.role||"")+(s.team?" · "+s.team:"");
//   $("avatar").textContent=(s.name||s.user)[0].toUpperCase();
//   const a=isAdminNow();
//   $("usersBtn").style.display=a?"":"none";
//   $("settingsBtn").style.display=a?"":"none";
//   $("addBtn").style.display=a?"":"none";
//   $("newTaskBtn")&&($("newTaskBtn").style.display=a?"":"none");
//   showWelcome(); renderFolders(); updateTaskBadge();
// }

// /* ---------- theme ---------- */
// function applyTheme(t){
//   document.body.classList.toggle("light",t==="light");
//   const b=$("themeBtn");if(b)b.textContent=t==="light"?"☀️":"🌙";
//   localStorage.setItem(LS_THEME,t);
// }
// function toggleTheme(){applyTheme(document.body.classList.contains("light")?"dark":"light");}
// applyTheme(localStorage.getItem(LS_THEME)||"dark");

// /* ---------- sidebar toggle ---------- */
// function smartToggle(){
//   const b=$("burgerBtn");
//   if(window.innerWidth>860){
//     const closed=$("sidebar").classList.toggle("closed");
//     b.textContent=closed?"☰":"◀";
//   }else{
//     const willOpen=!$("sidebar").classList.contains("open");
//     toggleSide(willOpen);
//   }
// }
// function toggleSide(force){
//   const sb=$("sidebar"),sc=$("scrim");
//   const on=force!==undefined?force:!sb.classList.contains("open");
//   sb.classList.toggle("open",on);sc.classList.toggle("on",on);
//   if(window.innerWidth<=860&&$("burgerBtn"))$("burgerBtn").textContent=on?"✕":"☰";
// }

// /* ---------- sheets ---------- */
// function extractId(url){const m=String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/);return m?m[1]:null;}
// function canSee(s){
//   if(isAdminNow())return true;
//   const t=s.teams;
//   if(!t||t.All)return true;
//   return !!t[me().team];
// }
// function visibleSheets(){return sheets.filter(canSee);}

// function renderTeamDependents(){
//   // team checkboxes in add-sheet modal
//   const tc=$("teamChecks");
//   if(tc){tc.innerHTML=`<label class="check-pill all"><input type="checkbox" value="All" onchange="allTeamToggle(this)"> All teams</label>`+
//     teamNames().map(n=>`<label class="check-pill"><input type="checkbox" value="${esc(n)}"> ${esc(n)}</label>`).join("");}
//   // team select in user form
//   const sel=$("nuTeam");
//   if(sel)sel.innerHTML=teamNames().map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
//   // team chips in settings
//   const chips=$("teamChips");
//   if(chips)chips.innerHTML=teams.map(t=>`<span class="team-chip">${esc(t.name)}<button onclick="delTeam('${t.id}')" title="Remove">✕</button></span>`).join("")||'<small style="color:var(--cream-dim)">No teams yet</small>';
// }
// function allTeamToggle(cb){
//   $("teamChecks").querySelectorAll("input").forEach(i=>{if(i!==cb)i.checked=false;});
// }
// function pickedTeams(){
//   const out={};
//   $("teamChecks").querySelectorAll("input:checked").forEach(i=>out[i.value]=true);
//   return Object.keys(out).length?out:{All:true};
// }

// function openAddSheet(){
//   editingSheetId=null;
//   $("addModalTitle").textContent="Add a Google Sheet";
//   $("sheetSaveBtn").textContent="Add sheet";
//   $("sheetName").value=$("sheetUrl").value=$("sheetIcon").value="";
//   renderTeamDependents();
//   openModal("addModal");
// }
// function editSheet(ev,id){
//   ev.stopPropagation();
//   if(!isAdminNow())return;
//   const s=sheets.find(x=>x.id===id);if(!s)return;
//   editingSheetId=id;
//   $("addModalTitle").textContent="Edit sheet";
//   $("sheetSaveBtn").textContent="Save changes";
//   $("sheetName").value=s.name;$("sheetIcon").value=s.icon||"";
//   $("sheetUrl").value="https://docs.google.com/spreadsheets/d/"+s.gid+"/edit";
//   renderTeamDependents();
//   const t=s.teams||{All:true};
//   $("teamChecks").querySelectorAll("input").forEach(i=>i.checked=!!t[i.value]);
//   openModal("addModal");
// }
// function saveSheet(){
//   if(!isAdminNow()){toast("Only admins can manage sheets");return;}
//   const name=$("sheetName").value.trim(),url=$("sheetUrl").value.trim();
//   const icon=$("sheetIcon").value.trim()||"📄";
//   if(!name){toast("Give the sheet a display name");return;}
//   const gid=extractId(url);
//   if(!gid){toast("That doesn't look like a Google Sheets link");return;}
//   const data={name,gid,icon,teams:pickedTeams()};
//   if(!cloudOn){toast("Cloud not connected");return;}
//   if(editingSheetId){db.ref("sheets/"+editingSheetId).update(data).then(()=>toast("Sheet updated ✓"));}
//   else{data.ts=Date.now();db.ref("sheets").push(data).then(()=>toast("“"+name+"” added ✓"));}
//   closeModal("addModal");
// }
// function delSheet(ev,id){
//   ev.stopPropagation();
//   if(!isAdminNow())return;
//   const s=sheets.find(x=>x.id===id);if(!s)return;
//   if(!confirm("Remove “"+s.name+"” from the dashboard? (The Google Sheet itself is not deleted.)"))return;
//   db.ref("sheets/"+id).remove();
//   if(activeId===id){activeId=null;showWelcome();}
// }
// function renderFolders(){
//   const list=$("folderList");if(!list)return;
//   const vis=visibleSheets();
//   let html="";
//   if(settings.archiveUrl){
//     const agid=extractId(settings.archiveUrl);
//     if(agid)html+=`<div class="folder ${activeId==="__archive"?"active":""}" onclick="openArchive()">
//       <div class="folder-ico">🗂️</div>
//       <div class="folder-meta"><b>To-Do / EOD Archive</b><small>Daily records</small></div></div>`;
//   }
//   if(!vis.length&&!html){list.innerHTML='<div class="empty-hint">No sheets for your team yet.'+(isAdminNow()?'<br>Tap the <b>+</b> to add one.':'')+'</div>';return;}
//   html+=vis.map(s=>`
//     <div class="folder ${s.id===activeId?"active":""}" data-id="${s.id}" onclick="openSheet('${s.id}')">
//       <div class="folder-ico">${s.icon||"📄"}</div>
//       <div class="folder-meta"><b>${esc(s.name)}</b><small>${s.teams&&!s.teams.All?esc(Object.keys(s.teams).join(", ")):"All teams"}</small></div>
//       ${isAdminNow()?`<button class="btn folder-edit" title="Edit" onclick="editSheet(event,'${s.id}')">✏️</button><button class="btn folder-del" title="Remove" onclick="delSheet(event,'${s.id}')">✕</button>`:""}
//     </div>`).join("");
//   list.innerHTML=html;
//   if(isAdminNow()&&cloudOn)enableDrag(list,".folder[data-id]",ids=>{
//     ids.forEach((id,i)=>db.ref("sheets/"+id+"/order").set(i));
//   });
// }
// function openSheet(id){
//   const s=sheets.find(x=>x.id===id);if(!s||!canSee(s))return;
//   const gid=s.gid;
//   if(window.innerWidth<861){
//     window.open(`https://docs.google.com/spreadsheets/d/${gid}/edit`,"_blank");
//     toggleSide(false);return;
//   }
//   activeId=id;currentView="sheet";renderFolders();toggleSide(false);
//   // FULL editor (toolbar, colors, formatting) — no rm=minimal
//   $("stage").innerHTML=`<div class="sheet-frame-wrap"><iframe src="https://docs.google.com/spreadsheets/d/${gid}/edit" allow="clipboard-read; clipboard-write"></iframe></div>`;
//   $("stageTitle").innerHTML=`<span class="live-dot"></span>${esc(s.name)}`;
//   const ext=$("openExt");ext.style.display="";ext.href=`https://docs.google.com/spreadsheets/d/${gid}/edit`;
// }
// function openArchive(){
//   const gid=extractId(settings.archiveUrl||"");if(!gid)return;
//   if(window.innerWidth<861){window.open(`https://docs.google.com/spreadsheets/d/${gid}/edit`,"_blank");toggleSide(false);return;}
//   activeId="__archive";currentView="sheet";renderFolders();toggleSide(false);
//   $("stage").innerHTML=`<div class="sheet-frame-wrap"><iframe src="https://docs.google.com/spreadsheets/d/${gid}/edit" allow="clipboard-read; clipboard-write"></iframe></div>`;
//   $("stageTitle").innerHTML=`<span class="live-dot"></span>To-Do / EOD Archive`;
//   const ext=$("openExt");ext.style.display="";ext.href=`https://docs.google.com/spreadsheets/d/${gid}/edit`;
// }
// function showWelcome(){
//   currentView="welcome";activeId=null;renderFolders();
//   const s=session();
//   $("stageTitle").innerHTML=`<span class="live-dot"></span>Welcome${s?", "+esc(s.name||cap(s.user)):""}`;
//   $("openExt").style.display="none";
//   $("stage").innerHTML=`
//     <div class="welcome">
//       <div class="crest"><img src="logo.png" alt="ODEA"></div>
//       <h2>Your team, one <em>royal</em> desk.</h2>
//       <p>Open your team's sheets from the left, check the <b style="color:var(--orange)">To-Do / EOD</b> board from the top bar, and watch for task notifications. Everything syncs live for everyone.</p>
//     </div>`;
// }

// /* ---------- BOARD: To-Do / EOD ---------- */
// function showBoard(){
//   currentView="board";activeId=null;renderFolders();toggleSide(false);
//   $("stageTitle").innerHTML=`<span class="live-dot"></span>To-Do & EOD Board`;
//   $("openExt").style.display="none";
//   renderBoard();
// }
// function boardMembers(){
//   // all cloud users + master admins, one card each
//   const seen={},out=[];
//   allUsers().forEach(u=>{if(!seen[u.user]){seen[u.user]=1;out.push(u);}});
//   return out.sort((a,b)=>((a.order??999)-(b.order??999)));
// }
// function renderBoard(){
//   if(currentView!=="board")return;
//   const mine=me().user;
//   const cards=boardMembers().map(u=>{
//     const my=entries.filter(e=>e.user===u.user);
//     const todos=my.filter(e=>e.type==="todo"),eods=my.filter(e=>e.type==="eod");
//     const canAdd=(u.user===mine)||isAdminNow();
//     const item=e=>`
//       <div class="entry">
//         <span class="status-chip ${e.status||"pending"}" title="Tap to change status" onclick="cycleStatus('${e.id}')"></span>
//         <div class="txt ${e.status==="done"?"done":""}">${esc(e.text)}</div>
//         ${(e.user===mine||isAdminNow())?`<button class="btn entry-del" onclick="delEntry('${e.id}')">✕</button>`:""}
//       </div>`;
//     return `
//     <div class="member-card ${u.user===mine?"me":""}" data-id="${esc(u.user)}">
//       <div class="mc-head">
//         <div class="avatar">${(u.name||u.user)[0].toUpperCase()}</div>
//         <div class="who"><b>${esc(u.name||cap(u.user))}</b><small>${esc(u.role||"member")}${u.team?" · "+esc(u.team):""}</small></div>
//       </div>
//       <div class="mc-sec"><h4>To-Do</h4>
//         ${todos.map(item).join("")||'<div class="mc-empty">Nothing yet</div>'}
//       </div>
//       <div class="mc-sec eod"><h4>EOD</h4>
//         ${eods.map(item).join("")||'<div class="mc-empty">Nothing yet</div>'}
//       </div>
//       ${canAdd?`
//       <div class="mc-addrow">
//         <input id="in_${esc(u.user)}" placeholder="Write here…" onkeydown="if(event.key==='Enter')addEntry('${esc(u.user)}','todo')">
//         <button class="btn mini-add todo" onclick="addEntry('${esc(u.user)}','todo')">TO-DO</button>
//         <button class="btn mini-add eod" onclick="addEntry('${esc(u.user)}','eod')">EOD</button>
//       </div>`:""}
//     </div>`;
//   }).join("");
//   $("stage").innerHTML=`
//     <div class="board">
//       <div class="board-head">
//         <h3>To-Do & <em>EOD</em> Board</h3>
//         <span class="board-date">${niceDate()}</span>
//       </div>
//       <div class="legend" style="margin-bottom:14px">
//         <span><i style="background:var(--red)"></i>Pending</span>
//         <span><i style="background:var(--gold)"></i>In progress</span>
//         <span><i style="background:var(--green)"></i>Completed</span>
//         <span style="opacity:.7">· Tap the dot to change · Moves to the archive sheet at 12 AM</span>
//       </div>
//       <div class="board-grid">${cards}</div>
//     </div>`;
//   if(cloudOn)enableDrag($("stage").querySelector(".board-grid"),".member-card[data-id]",ids=>{
//     ids.forEach((id,i)=>{ if(cloudUsers.some(u=>u.user===id)) db.ref("users/"+id+"/order").set(i); });
//   });
// }
// function addEntry(user,type){
//   const inp=$("in_"+user);if(!inp)return;
//   const text=inp.value.trim();if(!text){toast("Write something first");return;}
//   if(!cloudOn){toast("Cloud not connected");return;}
//   db.ref("entries").push({user,type,text,status:"pending",date:todayIST(),ts:Date.now()});
//   inp.value="";
// }
// function cycleStatus(id){
//   const e=entries.find(x=>x.id===id);if(!e)return;
//   const next={pending:"progress",progress:"done",done:"pending"}[e.status||"pending"];
//   db.ref("entries/"+id+"/status").set(next);
// }
// function delEntry(id){
//   const e=entries.find(x=>x.id===id);if(!e)return;
//   if(e.user!==me().user&&!isAdminNow())return;
//   db.ref("entries/"+id).remove();
// }

// /* ---------- USERS ---------- */
// function openUsers(){renderUsers();renderTeamDependents();resetUserForm();openModal("usersModal");}
// function renderUsers(){
//   const rows=$("userRows");
//   const perm=USERS.map(u=>`<div class="user-row"><div class="avatar" style="width:30px;height:30px;font-size:12px">${(u.name||u.user)[0].toUpperCase()}</div><div class="who"><b>${esc(u.name||u.user)}</b><small>${u.role} · ${esc(u.team||"")} · master</small></div></div>`).join("");
//   const cloud=cloudUsers.map(u=>`<div class="user-row"><div class="avatar" style="width:30px;height:30px;font-size:12px;background:linear-gradient(135deg,#7A5CE0,#E8B44A)">${(u.name||u.user)[0].toUpperCase()}</div><div class="who"><b>${esc(u.name||u.user)}</b><small>${esc(u.role)} · ${esc(u.team||"—")}</small></div><button class="btn tiny-btn" title="Edit" onclick="editUser('${esc(u.user)}')">✏️</button><button class="btn tiny-btn danger" title="Delete" onclick="delUser('${esc(u.user)}')">✕</button></div>`).join("");
//   rows.innerHTML=perm+cloud;
// }
// function editUser(key){
//   const u=cloudUsers.find(x=>x.user===key);if(!u)return;
//   editingUserKey=key;
//   $("userFormTitle").textContent="Edit member — "+(u.name||u.user);
//   $("nuFull").value=u.name||"";$("nuName").value=u.user;$("nuName").disabled=true;
//   $("nuPass").value=u.pass;$("nuRole").value=u.role||"member";
//   renderTeamDependents();$("nuTeam").value=u.team||teamNames()[0];
//   $("userSaveBtn").textContent="Save changes";
// }
// function resetUserForm(){
//   editingUserKey=null;
//   $("userFormTitle").textContent="Add member";
//   $("nuFull").value=$("nuPass").value="";$("nuName").value="";$("nuName").disabled=false;
//   $("userSaveBtn").textContent="Create member";
// }
// function cancelUserEdit(){
//   resetUserForm();
//   closeModal("usersModal");
// }
// function saveUser(){
//   if(!isAdminNow())return;
//   const full=$("nuFull").value.trim(),name=$("nuName").value.trim(),pass=$("nuPass").value,role=$("nuRole").value,team=$("nuTeam").value;
//   if(!name||!pass){toast("Username and password required");return;}
//   if(/[.#$\[\]\/\s]/.test(name)){toast("Username: letters/numbers only");return;}
//   if(!cloudOn){toast("Cloud not connected");return;}
//   if(editingUserKey){
//     db.ref("users/"+editingUserKey).update({name:full||cap(name),pass,role,team}).then(()=>toast("Member updated ✓"));
//     cancelUserEdit();return;
//   }
//   if(allUsers().some(u=>u.user.toLowerCase()===name.toLowerCase())){toast("That username already exists");return;}
//   db.ref("users/"+name).set({name:full||cap(name),pass,role,team}).then(()=>toast("Member “"+(full||name)+"” created ✓"));
//   cancelUserEdit();
// }
// function delUser(key){
//   if(!isAdminNow())return;
//   if(!confirm("Delete member “"+key+"”? Their board entries stay in the archive."))return;
//   db.ref("users/"+key).remove();
// }

// /* ---------- TEAMS (settings) ---------- */
// function addTeam(){
//   if(!isAdminNow())return;
//   const n=$("newTeamName").value.trim();if(!n){toast("Type a team name");return;}
//   if(teamNames().some(t=>t.toLowerCase()===n.toLowerCase())){toast("Team already exists");return;}
//   db.ref("teams").push({name:n});$("newTeamName").value="";toast("Team added ✓");
// }
// function delTeam(id){
//   if(!isAdminNow())return;
//   const t=teams.find(x=>x.id===id);if(!t)return;
//   if(!confirm("Remove team “"+t.name+"”? Members of this team keep their accounts."))return;
//   db.ref("teams/"+id).remove();
// }

// /* ---------- SETTINGS ---------- */
// function openSettings(){
//   $("archiveUrl").value=settings.archiveUrl||"";
//   renderTeamDependents();openModal("settingsModal");
// }
// function saveSettings(){
//   if(!isAdminNow())return;
//   const url=$("archiveUrl").value.trim();
//   if(url&&!extractId(url)){toast("That doesn't look like a Google Sheets link");return;}
//   db.ref("settings/archiveUrl").set(url).then(()=>toast("Settings saved ✓"));
// }

// /* ---------- TASKS ---------- */
// function myOpenTasks(){
//   const m=me();
//   return tasks.filter(t=>t.status==="open"&&t.to&&((t.to.users&&t.to.users[m.user])||(t.to.teams&&t.to.teams[m.team])));
// }
// function updateTaskBadge(){
//   const n=myOpenTasks().length;
//   const b=$("taskBadge");if(!b)return;
//   b.style.display=n?"flex":"none";b.textContent=n;
// }
// function openTasks(){renderTasks();openModal("tasksModal");}
// function renderTasks(){
//   const admin=isAdminNow();
//   $("tasksSub").textContent=admin?"All tasks across the team.":"Tasks assigned to you.";
//   const list=admin?tasks:tasks.filter(t=>t.to&&((t.to.users&&t.to.users[me().user])||(t.to.teams&&t.to.teams[me().team])));
//   $("taskRows").innerHTML=list.map(t=>{
//     const who=[...(t.to?.teams?Object.keys(t.to.teams):[]),...(t.to?.users?Object.keys(t.to.users).map(displayName):[])].join(", ");
//     return `<div class="task-card ${t.status==="open"?"open":"done-t"}">
//       <div class="task-top"><b>${esc(t.title)}</b></div>
//       <div class="task-meta">To: ${esc(who)} · By ${esc(displayName(t.by))} · ${new Date(t.ts).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</div>
//       <div class="task-body">${sanitize(t.body||"")}</div>
//       <div class="task-actions">
//         ${t.status==="open"?`<button class="btn chip-btn ok" onclick="doneTask('${t.id}')">✓ Mark done</button>`:`<span class="chip-btn ok" style="cursor:default">Completed</span>`}
//         ${admin?`<button class="btn chip-btn" onclick="delTask('${t.id}')">Delete</button>`:""}
//       </div>
//     </div>`;
//   }).join("")||'<div class="mc-empty" style="padding:10px">No tasks here yet 🎉</div>';
// }
// function openCompose(){
//   $("taskTitle").value="";$("taskBody").innerHTML="";
//   const ac=$("assignChecks");
//   ac.innerHTML=teamNames().map(n=>`<label class="check-pill"><input type="checkbox" data-kind="team" value="${esc(n)}"> 👥 ${esc(n)}</label>`).join("")+
//     boardMembers().map(u=>`<label class="check-pill"><input type="checkbox" data-kind="user" value="${esc(u.user)}"> ${esc(u.name||cap(u.user))}</label>`).join("");
//   openModal("composeModal");
// }
// function fmt(cmd){document.execCommand(cmd,false,null);$("taskBody").focus();}
// function fmtColor(c){document.execCommand("foreColor",false,c);$("taskBody").focus();}
// function assignTask(){
//   if(!isAdminNow())return;
//   const title=$("taskTitle").value.trim();
//   const body=sanitize($("taskBody").innerHTML);
//   if(!title){toast("Give the task a title");return;}
//   const to={users:{},teams:{}};
//   $("assignChecks").querySelectorAll("input:checked").forEach(i=>{
//     if(i.dataset.kind==="team")to.teams[i.value]=true;else to.users[i.value]=true;});
//   if(!Object.keys(to.users).length&&!Object.keys(to.teams).length){toast("Tick at least one person or team");return;}
//   db.ref("tasks").push({title,body,to,by:me().user,ts:Date.now(),status:"open"})
//     .then(()=>toast("Task assigned ✓"));
//   closeModal("composeModal");
// }
// function doneTask(id){db.ref("tasks/"+id+"/status").set("done");}
// function delTask(id){if(!isAdminNow())return;if(confirm("Delete this task?"))db.ref("tasks/"+id).remove();}

// /* ---------- boot ---------- */
// bootCloud();
// if(session())enterApp();

// /* ---------- drag & drop reorder ---------- */
// let dragEl=null;
// function enableDrag(listEl, selector, onReorder){
//   listEl.querySelectorAll(selector).forEach(el=>{
//     el.draggable=true;
//     el.addEventListener("dragstart",()=>{dragEl=el;el.style.opacity=.4;});
//     el.addEventListener("dragend",()=>{
//       el.style.opacity=1;
//       if(!dragEl)return;
//       const ids=[...listEl.querySelectorAll(selector)].map(x=>x.dataset.id);
//       onReorder(ids); dragEl=null;
//     });
//     el.addEventListener("dragover",e=>{
//       e.preventDefault();
//       if(!dragEl||dragEl===el)return;
//       const r=el.getBoundingClientRect();
//       const after=(e.clientY-r.top)>r.height/2;
//       el.parentNode.insertBefore(dragEl, after?el.nextSibling:el);
//     });
//   });
// }
/* =====================================================================
   ODEA SHEETS HUB v3 — app logic
   ⚙️ SETTINGS — the only things you ever edit in code:
===================================================================== */
const USERS = [
  { user: "admin", pass: "Odea@2026", role: "admin", team: "Admin", name: "Master Admin" },
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

/* ---------- tiny helpers ---------- */
const $=id=>document.getElementById(id);
function toast(m){const t=$("toast");t.textContent=m;t.classList.add("on");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("on"),2600);}
function openModal(id){$(id).classList.add("on")}
function closeModal(id){$(id).classList.remove("on")}
function esc(t){return String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function session(){try{return JSON.parse(sessionStorage.getItem(LS_SESSION))}catch(e){return null}}
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
      if(currentView==="board")renderBoard();
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
    db.ref("folders").on("value",s=>{const v=s.val()||{};
      folders=Object.keys(v).map(k=>({id:k,...v[k]})).sort((a,b)=>((a.order??a.ts??0)-(b.order??b.ts??0)));
      renderFolders(); renderFolderSelect();});
    db.ref("teams").on("value",s=>{const v=s.val()||{};
      teams=Object.keys(v).map(k=>({id:k,name:v[k].name}));
      if(!teams.length&&isAdminNow())seedTeams();
      renderTeamDependents();});
    db.ref("entries").on("value",s=>{const v=s.val()||{};
      entries=Object.keys(v).map(k=>({id:k,...v[k]}));
      if(currentView==="board")renderBoard();});
    db.ref("tasks").on("value",s=>{const v=s.val()||{};
      tasks=Object.keys(v).map(k=>({id:k,...v[k]})).sort((a,b)=>(b.ts||0)-(a.ts||0));
      updateTaskBadge();
      if($("tasksModal").classList.contains("on"))renderTasks();});
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
  alert("Your access has been removed by an administrator.");
  location.reload();
}

/* ---------- auth ---------- */
function doLogin(){
  const u=$("u").value.trim(),p=$("p").value;
  const hit=allUsers().find(x=>x.user.toLowerCase()===u.toLowerCase()&&x.pass===p);
  if(!hit){$("loginErr").style.display="block";return;}
  sessionStorage.setItem(LS_SESSION,JSON.stringify({user:hit.user,role:hit.role,team:hit.team||"",name:hit.name||cap(hit.user)}));
  enterApp();
}
function doLogout(){sessionStorage.removeItem(LS_SESSION);location.reload();}
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
  showWelcome(); renderFolders(); updateTaskBadge();
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

function myTeams(u){                     // works with old single team + new list
  const r=u?userRec(u):me();
  if(r.teams)return Object.keys(r.teams);
  return r.team?[r.team]:[];
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

function openAddSheet(){
  editingSheetId=null;
  $("addModalTitle").textContent="Add a Google Sheet";
  $("sheetSaveBtn").textContent="Add sheet";
  $("sheetName").value=$("sheetUrl").value=$("sheetIcon").value="";
  renderTeamDependents();
  renderFolderSelect(); $("sheetFolder").value="";
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
  openModal("addModal");
}
function saveSheet(){
  if(!isAdminNow()){toast("Only admins can manage sheets");return;}
  const name=$("sheetName").value.trim(),url=$("sheetUrl").value.trim();
  const icon=$("sheetIcon").value.trim()||"📄";
  if(!name){toast("Give the sheet a display name");return;}
  const gid=extractId(url);
  if(!gid){toast("That doesn't look like a Google Sheets link");return;}
  const data={name,gid,icon,teams:pickedTeams(),folder:$("sheetFolder").value||""};
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
  const vis=visibleSheets();
  const admin=isAdminNow();
  const row=s=>`
    <div class="folder subsheet ${s.id===activeId?"active":""}" data-id="${s.id}" onclick="openSheet('${s.id}')">
      <div class="folder-ico">${s.icon||"📄"}</div>
      <div class="folder-meta"><b>${esc(s.name)}</b><small>${s.teams&&!s.teams.All?esc(Object.keys(s.teams).join(", ")):"All teams"}</small></div>
      ${admin?`<button class="btn folder-edit" title="Edit" onclick="editSheet(event,'${s.id}')">✏️</button><button class="btn folder-del" title="Remove" onclick="delSheet(event,'${s.id}')">✕</button>`:""}
    </div>`;

  let html="";
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
  const mine=me().user, locked=isLocked();
  const cards=boardMembers().map(u=>{
    const my=entries.filter(e=>e.user===u.user).sort((a,b)=>(a.ts||0)-(b.ts||0));
    const canAdd=(u.user===mine)||isAdminNow();
    const item=e=>`
      <div class="entry">
        <span class="status-chip ${e.status||"pending"}${(e.user===mine||isAdminNow())?"":" locked-chip"}" title="${(e.user===mine||isAdminNow())?"Tap to change status":"Only "+esc(u.name||u.user)+" can change this"}" ${(e.user===mine||isAdminNow())?`onclick="cycleStatus('${e.id}')"`:""}></span>
        <div class="txt ${e.status==="done"?"done":""}">${esc(e.text)}${(e.days||1)>1?` <small style="color:var(--gold)">(Day ${e.days})</small>`:""}</div>
        ${canDeleteEntry(e)?`<button class="btn entry-del" onclick="delEntry('${e.id}')">✕</button>`:""}
      </div>`;
    return `
    <div class="member-card ${u.user===mine?"me":""}" data-id="${esc(u.user)}">
      <div class="mc-head">
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
  if(cloudOn)enableDrag($("stage").querySelector(".board-grid"),".member-card[data-id]",ids=>{
    ids.forEach((id,i)=>{ if(cloudUsers.some(u=>u.user===id)) db.ref("users/"+id+"/order").set(i); });
  });
}
function addEntry(user){
  // if(!isAdminNow()&&isLocked()){toast("Board is locked after 5 PM — ask an admin");return;}
  const inp=$("in_"+user);if(!inp)return;
  const text=inp.value.trim();if(!text){toast("Write something first");return;}
  if(!cloudOn){toast("Cloud not connected");return;}
  db.ref("entries").push({user,type:"todo",text,status:"pending",date:todayIST(),ts:Date.now()});
  inp.value="";
}
function cycleStatus(id){
  const e=entries.find(x=>x.id===id);if(!e)return;
  if(e.user!==me().user&&!isAdminNow()){toast("You can only change your own tasks");return;}
  const next={pending:"progress",progress:"done",done:"pending"}[e.status||"pending"];
  db.ref("entries/"+id+"/status").set(next);
}
function delEntry(id){
  const e=entries.find(x=>x.id===id);if(!e)return;
  if(!canDeleteEntry(e)){toast((e.days||1)>1?"Carried tasks: admin only":"Locked after 5 PM");return;}
  db.ref("entries/"+id).remove();
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
  $("pfPreview").innerHTML=avatarHTML(s.user,72);
  $("pfFile").value="";
  openModal("profileModal");
}
function pfPickPhoto(input){
  const f=input.files&&input.files[0];if(!f)return;
  const img=new Image();
  img.onload=()=>{
    const c=document.createElement("canvas");const S=96;c.width=S;c.height=S;
    const x=c.getContext("2d");
    const side=Math.min(img.width,img.height);
    x.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,S,S);
    window._pfPhoto=c.toDataURL("image/jpeg",.82);
    $("pfPreview").innerHTML=`<div class="avatar" style="width:72px;height:72px"><img src="${window._pfPhoto}"></div>`;
  };
  img.src=URL.createObjectURL(f);
}
function saveProfile(){
  const s=session();if(!s||!cloudOn)return;
  const name=$("pfName").value.trim();
  const isMaster=!cloudUsers.some(u=>u.user===s.user);
  const path=isMaster?("masters/"+s.user):("users/"+s.user);
  const upd={};
  if(name)upd.name=name;
  if(window._pfPhoto)upd.photo=window._pfPhoto;
  if(!Object.keys(upd).length){closeModal("profileModal");return;}
  db.ref(path).update(upd).then(()=>{
    if(name){s.name=name;sessionStorage.setItem(LS_SESSION,JSON.stringify(s));}
    window._pfPhoto=null;
    toast("Profile updated ✓");refreshMyChip();closeModal("profileModal");
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
function updateTaskBadge(){
  const n=myOpenTasks().length;
  const b=$("taskBadge");if(!b)return;
  b.style.display=n?"flex":"none";b.textContent=n;
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
  $("taskRows").innerHTML=relevantTasks().map(t=>{
    const who=[...(t.to?.teams?Object.keys(t.to.teams):[]),...(t.to?.users?Object.keys(t.to.users).map(displayName):[])].join(", ");
    const canDel=admin||t.by===me().user;
    return `<div class="task-card ${t.status==="open"?"open":"done-t"}">
      <div class="task-top"><b>${esc(t.title)}</b></div>
      <div class="task-meta">To: ${esc(who)} · By ${esc(displayName(t.by))} · ${new Date(t.ts).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</div>
      <div class="task-body">${sanitize(t.body||"")}</div>
      <div class="task-actions">
        ${t.status==="open"?`<button class="btn chip-btn ok" onclick="doneTask('${t.id}')">✓ Mark done</button>`:`<span class="chip-btn ok" style="cursor:default">Completed</span>`}
        ${canDel?`<button class="btn chip-btn" onclick="delTask('${t.id}')">Delete</button>`:""}
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
function doneTask(id){db.ref("tasks/"+id+"/status").set("done");}
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