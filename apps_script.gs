/**********************************************************************
 * ODEA SHEETS HUB — Nightly To-Do / EOD Export
 * Runs every night at 12 AM (IST), reads the board from Firebase,
 * writes it into the archive Google Sheet (the link saved in the
 * dashboard's Settings), formatted cleanly per person, then clears
 * the exported entries so the board starts fresh each day.
 *
 * SETUP (one time):
 * 1. Go to script.google.com → New project
 * 2. Delete everything, paste this whole file
 * 3. Change DB_URL below to YOUR Firebase database URL
 * 4. Run the function "exportDaily" once → Google asks permission → Allow
 * 5. Left menu: Triggers (clock icon) → Add Trigger →
 *      function: exportDaily · event: Time-driven ·
 *      type: Day timer · time: Midnight to 1am → Save
 * Done. It now runs automatically every night.
 **********************************************************************/

var DB_URL = "https://odea-hub-default-rtdb.asia-southeast1.firebasedatabase.app"; // ← change to yours
var TZ = "Asia/Kolkata";

function exportDaily() {
  // The board being exported belongs to "yesterday" (the day that just ended at midnight)
  var d = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12h back = the day that just ended
  var dateKey = Utilities.formatDate(d, TZ, "yyyy-MM-dd");
  var dateNice = Utilities.formatDate(d, TZ, "dd MMM yyyy (EEEE)");

  var settings = fb("/settings") || {};
  var url = settings.archiveUrl;
  if (!url) { Logger.log("No archive sheet set in dashboard Settings. Skipping."); return; }
  var m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/);
  if (!m) { Logger.log("Archive URL invalid."); return; }

  var users = fb("/users") || {};
  var allEntries = fb("/entries") || {};

  // group yesterday's entries by user
  var byUser = {};
  var toDelete = [];
  Object.keys(allEntries).forEach(function (id) {
    var e = allEntries[id];
    if (e.date !== dateKey) return;
    (byUser[e.user] = byUser[e.user] || []).push(e);
    toDelete.push(id);
  });

  var ss = SpreadsheetApp.openById(m[1]);
  var sh = ss.getSheetByName("EOD Log") || ss.insertSheet("EOD Log");

  // header (once)
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Date", "Name", "Team", "Type", "Entry", "Status"]);
    var h = sh.getRange(1, 1, 1, 6);
    h.setBackground("#1A1A1A").setFontColor("#EEEEE4").setFontWeight("bold").setFontSize(11);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 130); sh.setColumnWidth(2, 150); sh.setColumnWidth(3, 130);
    sh.setColumnWidth(4, 70);  sh.setColumnWidth(5, 420); sh.setColumnWidth(6, 110);
  }

  var statusColor = { pending: "#F8CCC7", progress: "#F7E3B0", done: "#C9EFD8" };
  var statusText  = { pending: "Pending",  progress: "In progress", done: "Completed" };

  var names = Object.keys(byUser).sort();
  if (!names.length) { Logger.log("No entries for " + dateKey); return; }

  names.forEach(function (uname) {
    var u = users[uname] || {};
    var display = u.name || uname;
    var team = u.team || "";

    // date separator band per person block start
    var startRow = sh.getLastRow() + 1;

    // to-dos first, then EODs — never merged between people
    var rows = [];
    ["todo", "eod"].forEach(function (type) {
      byUser[uname].filter(function (e) { return e.type === type; })
        .sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); })
        .forEach(function (e) {
          rows.push([dateNice, display, team, type === "todo" ? "To-Do" : "EOD",
                     e.text, statusText[e.status] || "Pending"]);
        });
    });
    if (!rows.length) return;

    sh.getRange(startRow, 1, rows.length, 6).setValues(rows);

    // pretty formatting: person block band + status cell colors
    sh.getRange(startRow, 1, rows.length, 6).setBorder(true, true, true, true, false, false, "#DDD6C8", SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(startRow, 2, rows.length, 1).setFontWeight("bold").setFontColor("#F15A22");
    for (var r = 0; r < rows.length; r++) {
      var st = rows[r][5] === "Completed" ? "done" : rows[r][5] === "In progress" ? "progress" : "pending";
      sh.getRange(startRow + r, 6).setBackground(statusColor[st]).setFontWeight("bold");
    }
  });

  // clear exported entries so the dashboard board starts fresh
  toDelete.forEach(function (id) { fbDelete("/entries/" + id); });

  Logger.log("Exported " + toDelete.length + " entries for " + dateKey);
}

/* ---- Firebase REST helpers ---- */
function fb(path) {
  var res = UrlFetchApp.fetch(DB_URL + path + ".json", { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  return JSON.parse(res.getContentText());
}
function fbDelete(path) {
  UrlFetchApp.fetch(DB_URL + path + ".json", { method: "delete", muteHttpExceptions: true });
}
