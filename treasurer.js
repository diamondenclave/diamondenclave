// ============================================================
//  DIAMOND ENCLAVE - Ledger Tab Logic
// ============================================================

function renderTreasurerTab() {
  var canEdit = state.isTreasurer || state.isAdmin;

  var addSection = document.getElementById("addEntrySection");
  if (addSection) addSection.style.display = canEdit ? "block" : "none";

  var prompt = document.getElementById("treasurerLoginPrompt");
  if (prompt) prompt.style.display = canEdit ? "none" : "flex";

  var actionHdr = document.getElementById("ledgerActionHeader");
  if (actionHdr) actionHdr.classList.toggle("hidden", !canEdit);

  if (state.isAdmin) _checkMissingLedgerEntries();

  renderBalanceGrid();
  renderLedger();
  renderLedgerStats();
}

// ── Per-flat balance grid ─────────────────────────────────────
function renderBalanceGrid() {
  var grid = document.getElementById("balanceGrid");
  if (!grid) return;
  grid.innerHTML = "";
  CONFIG.FLATS.filter(function(f) { return !f.parking; }).forEach(function(flat) {
    var bal = Sheets.calcBalance(flat.id, state.currentYear, state.currentMonth);
    var own = Sheets.getCurrentOwner(flat.id, state.currentYear, state.currentMonth);
    var card = document.createElement("div");
    card.className = "balance-card";
    var balClass = bal > 0 ? "bal-credit" : bal < 0 ? "bal-due" : "bal-neutral";
    var balSign  = bal > 0 ? "+" : bal < 0 ? "-" : "";
    var balLabel = bal > 0 ? "Credit" : bal < 0 ? "Due" : "Settled";
    card.innerHTML =
      '<div class="balance-flat">' + flat.label + '</div>' +
      '<div class="balance-owner">' + (own ? own.name : "No owner") + '</div>' +
      '<div class="balance-amount ' + balClass + '">' + balSign + 'Rs.' + Math.abs(bal) + '</div>' +
      '<div class="balance-label">' + balLabel + '</div>';
    grid.appendChild(card);
  });
}

// ── Ledger Stats ──────────────────────────────────────────────
function renderLedgerStats() {
  var entries = Sheets.getLedger();
  var credit = 0, debit = 0;
  entries.forEach(function(e) {
    if (e.type === "Credit") credit += e.amount;
    else debit += e.amount;
  });
  var net = credit - debit;
  var el;
  el = document.getElementById("ledgerCredit");  if (el) el.textContent = "Rs." + credit.toLocaleString("en-IN");
  el = document.getElementById("ledgerDebit");   if (el) el.textContent = "Rs." + debit.toLocaleString("en-IN");
  el = document.getElementById("ledgerBalance"); if (el) el.textContent = (net >= 0 ? "Rs." : "-Rs.") + Math.abs(net).toLocaleString("en-IN");
  el = document.getElementById("ledgerEntries"); if (el) el.textContent = entries.length;
  var balCard = document.getElementById("ledgerBalance");
  if (balCard && balCard.parentElement) {
    balCard.parentElement.classList.toggle("accent", net >= 0);
    balCard.parentElement.classList.toggle("warn",   net < 0);
  }
}

// ── Render Ledger Table ───────────────────────────────────────
function renderLedger() {
  var rawSearch = document.getElementById("ledgerSearch");
  var search = rawSearch ? rawSearch.value.toLowerCase() : "";
  var rawFilter = document.getElementById("ledgerFilter");
  var filter = rawFilter ? rawFilter.value : "All";
  var canEdit = state.isTreasurer || state.isAdmin;

  // Build running balance using ascending order
  var allAsc = Sheets.getLedger().slice().sort(function(a, b) {
    var dc = (a.date || "").localeCompare(b.date || "");
    if (dc !== 0) return dc;
    return (a.createdAt || a.date || "").localeCompare(b.createdAt || b.date || "");
  });

  var running = 0;
  var balAfter = {};
  allAsc.forEach(function(e) {
    running += e.type === "Credit" ? e.amount : -e.amount;
    balAfter[e.id] = running;
  });

  // Filter then display descending (latest first)
  var entries = allAsc
    .filter(function(e) { return filter === "All" || e.type === filter; })
    .filter(function(e) {
      if (!search) return true;
      return (e.description || "").toLowerCase().indexOf(search) !== -1 ||
             (e.type || "").toLowerCase().indexOf(search) !== -1 ||
             String(e.amount).indexOf(search) !== -1;
    })
    .reverse();

  var tbody = document.getElementById("ledgerBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:30px">No entries yet. Payments marked as paid will appear here automatically.</td></tr>';
    return;
  }

  entries.forEach(function(entry) {
    var tr = document.createElement("tr");
    var isCredit  = entry.type === "Credit";
    var isAuto    = (entry.addedBy || "").indexOf("Auto") === 0;
    var canDelete = canEdit && (!isAuto || state.isAdmin);
    var bal       = balAfter[entry.id] !== undefined ? balAfter[entry.id] : 0;
    var balColor  = bal > 0 ? "var(--paid-text)" : bal < 0 ? "var(--warn)" : "var(--text3)";
    var balText   = (bal >= 0 ? "Rs." : "-Rs.") + Math.abs(bal).toLocaleString("en-IN");
    var amtColor  = isCredit ? "var(--paid-text)" : "var(--warn)";
    var amtSign   = isCredit ? "+" : "-";
    var safeDesc  = (entry.description || "No description").replace(/'/g, "\\'");

    tr.innerHTML =
      '<td><span class="date-text">'  + formatDate(entry.date) + '</span></td>' +
      '<td><span class="status-badge ' + (isCredit ? "status-paid" : "status-pending") + '">' + (entry.type || "").toUpperCase() + '</span>' +
      (isAuto ? '<span class="auto-tag">auto</span>' : '') + '</td>' +
      '<td><span style="color:var(--text)">' + (entry.description || "—") + '</span></td>' +
      '<td><span class="amount-text" style="color:' + amtColor + '">' + amtSign + 'Rs.' + Number(entry.amount).toLocaleString("en-IN") + '</span></td>' +
      '<td><span class="amount-text" style="color:' + balColor + ';font-size:14px">' + balText + '</span></td>' +
      '<td><span class="date-text">' + (entry.addedBy || "—") + '</span></td>' +
      '<td class="' + (canEdit ? "" : "hidden") + '">' +
      (canDelete
        ? '<button class="btn-revoke" onclick="openDeleteLedgerModal(\'' + entry.id + '\',\'' + safeDesc + '\')">X</button>'
        : '<span style="color:var(--text3);font-size:11px">Auto</span>') +
      '</td>';
    tbody.appendChild(tr);
  });
}

// ── Missing ledger check ──────────────────────────────────────
function _checkMissingLedgerEntries() {
  var allData = Sheets.getAllData();
  var missing = 0;
  Object.keys(allData).forEach(function(mk) {
    var monthData = allData[mk];
    Object.keys(monthData).forEach(function(fid) {
      var rec = monthData[fid];
      if (rec.paid && !rec.ledgerRef) missing++;
    });
  });
  var banner = document.getElementById("syncLedgerBanner");
  var msg    = document.getElementById("syncBannerMsg");
  if (banner) {
    banner.classList.toggle("hidden", missing === 0);
    if (msg) msg.textContent = " - " + missing + " payment" + (missing > 1 ? "s" : "") + " found with no ledger entry.";
  }
}

// ── Sync missing entries ──────────────────────────────────────
async function syncMissingLedgerEntries() {
  var allData = Sheets.getAllData();
  var MONTHS_ARR = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var synced = 0;
  showToast("Syncing missing entries...");
  var mks = Object.keys(allData);
  for (var i = 0; i < mks.length; i++) {
    var mk = mks[i];
    var parts = mk.split("-");
    var year  = parseInt(parts[0]);
    var month = parseInt(parts[1]);
    var monthData = allData[mk];
    var fids = Object.keys(monthData);
    for (var j = 0; j < fids.length; j++) {
      var flatId = fids[j];
      var rec = monthData[flatId];
      if (!rec.paid || rec.ledgerRef) continue;
      var flatCfg = CONFIG.FLATS.find(function(f) { return f.id === flatId; }) || {};
      var owner = Sheets.getCurrentOwner(flatId, year, month);
      var ml = MONTHS_ARR[month - 1] + " " + year;
      var desc = "Maintenance collected - " + (flatCfg.label || flatId) + (owner ? " (" + owner.name + ")" : "") + " - " + ml;
      var entry = await Sheets.addLedgerEntry({ date: rec.date || (year + "-" + String(month).padStart(2,"0") + "-01"), type: "Credit", amount: rec.amount || flatCfg.charge || 500, description: desc, addedBy: "Auto (Sync)" });
      await Sheets.linkLedgerRef(flatId, year, month, entry.id);
      synced++;
    }
  }
  showToast("Synced " + synced + " missing " + (synced === 1 ? "entry" : "entries"));
  var banner = document.getElementById("syncLedgerBanner");
  if (banner) banner.classList.add("hidden");
  await Sheets.loadAll();
  renderLedger(); renderLedgerStats(); renderBalanceGrid();
}

// ── Add Entry ─────────────────────────────────────────────────
async function addLedgerEntry() {
  var type   = document.getElementById("entryType").value;
  var amount = Number(document.getElementById("entryAmount").value);
  var date   = document.getElementById("entryDate").value;
  var desc   = document.getElementById("entryDesc").value.trim();
  if (!amount || amount <= 0) { showToast("Please enter a valid amount"); return; }
  if (!date)                  { showToast("Please select a date"); return; }
  if (!desc)                  { showToast("Please enter a description"); return; }
  var addedBy = state.isAdmin ? "Admin" : "Treasurer";
  await Sheets.addLedgerEntry({ date: date, type: type, amount: amount, description: desc, addedBy: addedBy });
  document.getElementById("entryAmount").value = "";
  document.getElementById("entryDesc").value   = "";
  document.getElementById("entryDate").value   = todayISO();
  renderLedger(); renderLedgerStats(); renderBalanceGrid();
  showToast(type + " entry added");
}

// ── Delete Entry ──────────────────────────────────────────────
function openDeleteLedgerModal(id, desc) {
  state.deleteLedgerId = id;
  var sub = document.getElementById("deleteLedgerSub");
  if (sub) sub.textContent = '"' + desc + '" - this cannot be undone.';
  var modal = document.getElementById("deleteLedgerModal");
  if (modal) modal.classList.remove("hidden");
}
function closeDeleteLedgerModal() {
  var modal = document.getElementById("deleteLedgerModal");
  if (modal) modal.classList.add("hidden");
  state.deleteLedgerId = null;
}
async function confirmDeleteLedger() {
  if (!state.deleteLedgerId) return;
  await Sheets.deleteLedgerEntry(state.deleteLedgerId);
  closeDeleteLedgerModal();
  renderLedger(); renderLedgerStats(); renderBalanceGrid();
  showToast("Entry deleted");
}

// ── Export Ledger Excel ───────────────────────────────────────
function exportLedgerExcel() {
  var entries = Sheets.getLedger().slice().sort(function(a, b) {
    return (a.date || "").localeCompare(b.date || "");
  });
  var headers = ["Date", "Type", "Description", "Amount (Rs.)", "Balance (Rs.)", "Added By"];
  var credit = 0, debit = 0, running = 0;
  var rows = entries.map(function(e) {
    running += e.type === "Credit" ? e.amount : -e.amount;
    if (e.type === "Credit") credit += e.amount; else debit += e.amount;
    var balText = (running >= 0 ? "Rs." : "-Rs.") + Math.abs(running).toLocaleString("en-IN");
    return [formatDate(e.date), e.type, e.description, e.amount, balText, e.addedBy || ""];
  });
  rows.push([]);
  rows.push(["", "", "Total Credits (Rs.)",  credit,       "", ""]);
  rows.push(["", "", "Total Debits (Rs.)",   debit,        "", ""]);
  rows.push(["", "", "Net Balance (Rs.)",    credit-debit, "", ""]);
  var csv = [headers].concat(rows).map(function(r) {
    return r.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
  }).join("\n");
  var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href = url;
  a.download = "DiamondEnclave_Ledger_" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast("Ledger exported");
}
