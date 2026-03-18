// ============================================================
//  DIAMOND ENCLAVE — Treasurer Tab Logic
// ============================================================

function renderTreasurerTab() {
  const canEdit = state.isTreasurer || state.isAdmin;

  // Add entry form — only treasurer/admin
  const addSection = document.getElementById("addEntrySection");
  if (addSection) addSection.style.display = canEdit ? "block" : "none";

  // Login prompt — shown only when not logged in
  const prompt = document.getElementById("treasurerLoginPrompt");
  if (prompt) prompt.style.display = canEdit ? "none" : "flex";

  // Action column header — only treasurer/admin
  document.getElementById("ledgerActionHeader")?.classList.toggle("hidden", !canEdit);

  renderBalanceGrid();
  renderLedger();
  renderLedgerStats();
}

// ── Per-flat balance grid ─────────────────────────────────────
function renderBalanceGrid() {
  const grid = document.getElementById("balanceGrid");
  grid.innerHTML = "";
  CONFIG.FLATS.filter(f=>!f.parking).forEach(flat => {
    const bal = Sheets.calcBalance(flat.id, state.currentYear, state.currentMonth);
    const own = Sheets.getCurrentOwner(flat.id, state.currentYear, state.currentMonth);
    const card = document.createElement("div");
    card.className = "balance-card";
    card.innerHTML = `
      <div class="balance-flat">${flat.label}</div>
      <div class="balance-owner">${own ? own.name : "—"}</div>
      <div class="balance-amount ${bal>0?"bal-credit":bal<0?"bal-due":"bal-neutral"}">
        ${bal>0?"+":bal<0?"-":""}₹${Math.abs(bal)}
      </div>
      <div class="balance-label">${bal>0?"Credit":bal<0?"Due":"Settled"}</div>
    `;
    grid.appendChild(card);
  });
}

// ── Ledger Stats ──────────────────────────────────────────────
function renderLedgerStats() {
  const entries = Sheets.getLedger();
  let credit=0, debit=0;
  entries.forEach(e => { if(e.type==="Credit") credit+=e.amount; else debit+=e.amount; });
  const net = credit - debit;
  document.getElementById("ledgerCredit").textContent  = "₹"+credit.toLocaleString("en-IN");
  document.getElementById("ledgerDebit").textContent   = "₹"+debit.toLocaleString("en-IN");
  document.getElementById("ledgerBalance").textContent = (net>=0?"₹":"−₹")+Math.abs(net).toLocaleString("en-IN");
  document.getElementById("ledgerEntries").textContent = entries.length;
  const el = document.getElementById("ledgerBalance").parentElement;
  el.classList.toggle("accent", net>=0);
  el.classList.toggle("warn",   net<0);
}

// ── Render Ledger Table ───────────────────────────────────────
function renderLedger() {
  const search  = (document.getElementById("ledgerSearch")?.value||"").toLowerCase();
  const filter  = document.getElementById("ledgerFilter")?.value||"All";
  const canEdit = state.isTreasurer || state.isAdmin;

  // All entries sorted by date — needed for running balance calculation
  const allEntries = Sheets.getLedger(); // already sorted by date

  // Build running balance map: entry.id -> balance after that entry
  let running = 0;
  const balanceAfter = {};
  allEntries.forEach(e => {
    running += e.type === "Credit" ? e.amount : -e.amount;
    balanceAfter[e.id] = running;
  });

  // Apply search/filter for display
  const entries = allEntries
    .filter(e => filter==="All" || e.type===filter)
    .filter(e => !search ||
      e.description.toLowerCase().includes(search) ||
      e.type.toLowerCase().includes(search) ||
      String(e.amount).includes(search));

  const tbody = document.getElementById("ledgerBody");
  tbody.innerHTML = "";

  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:30px">No ledger entries yet. Payments marked as paid will appear here automatically.</td></tr>`;
    return;
  }

  entries.forEach(entry => {
    const tr        = document.createElement("tr");
    const isCredit  = entry.type === "Credit";
    const isAuto    = (entry.addedBy||"").startsWith("Auto");
    const canDelete = canEdit && (!isAuto || state.isAdmin);
    const bal       = balanceAfter[entry.id] ?? 0;
    const balColor  = bal > 0 ? "var(--paid-text)" : bal < 0 ? "var(--warn)" : "var(--text3)";
    const balText   = (bal >= 0 ? "₹" : "−₹") + Math.abs(bal).toLocaleString("en-IN");

    tr.innerHTML = `
      <td><span class="date-text">${formatDate(entry.date)}</span></td>
      <td>
        <span class="status-badge ${isCredit?"status-paid":"status-pending"}">${entry.type.toUpperCase()}</span>
        ${isAuto ? '<span class="auto-tag">auto</span>' : ""}
      </td>
      <td><span style="color:var(--text)">${entry.description||"—"}</span></td>
      <td><span class="amount-text" style="color:${isCredit?"var(--paid-text)":"var(--warn)"}">
        ${isCredit?"+":"-"}₹${Number(entry.amount).toLocaleString("en-IN")}
      </span></td>
      <td><span class="amount-text" style="color:${balColor};font-size:14px">${balText}</span></td>
      <td><span class="date-text">${entry.addedBy||"—"}</span></td>
      <td class="${canEdit?"":"hidden"}">
        ${canDelete
          ? `<button class="btn-revoke" onclick="openDeleteLedgerModal('${entry.id}','${(entry.description||"").replace(/'/g,"\\'")}')">✕</button>`
          : `<span style="color:var(--text3);font-size:11px">Auto</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Add Entry ─────────────────────────────────────────────────
async function addLedgerEntry() {
  const type   = document.getElementById("entryType").value;
  const amount = Number(document.getElementById("entryAmount").value);
  const date   = document.getElementById("entryDate").value;
  const desc   = document.getElementById("entryDesc").value.trim();

  if (!amount||amount<=0) { showToast("Please enter a valid amount"); return; }
  if (!date)              { showToast("Please select a date"); return; }
  if (!desc)              { showToast("Please enter a description"); return; }

  const addedBy = state.isAdmin ? "Admin" : "Treasurer";
  await Sheets.addLedgerEntry({ date, type, amount, description: desc, addedBy });

  document.getElementById("entryAmount").value = "";
  document.getElementById("entryDesc").value   = "";
  document.getElementById("entryDate").value   = todayISO();

  renderLedger(); renderLedgerStats(); renderBalanceGrid();
  showToast(`✓ ${type} entry added`);
}

// ── Delete Entry ──────────────────────────────────────────────
function openDeleteLedgerModal(id, desc) {
  state.deleteLedgerId = id;
  document.getElementById("deleteLedgerSub").textContent = `"${desc}" — this cannot be undone.`;
  document.getElementById("deleteLedgerModal").classList.remove("hidden");
}
function closeDeleteLedgerModal() {
  document.getElementById("deleteLedgerModal").classList.add("hidden");
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
  const entries = Sheets.getLedger();
  const headers = ["Date","Type","Description","Amount (₹)","Balance (₹)","Added By"];
  let credit=0, debit=0, running=0;
  const rows = entries.map(e => {
    running += e.type==="Credit" ? e.amount : -e.amount;
    if(e.type==="Credit") credit+=e.amount; else debit+=e.amount;
    const balText = (running>=0?"":"−")+"₹"+Math.abs(running).toLocaleString("en-IN");
    return [formatDate(e.date), e.type, e.description, e.amount, balText, e.addedBy||""];
  });
  rows.push([]);
  rows.push(["","","Total Credits (₹)", credit, "", ""]);
  rows.push(["","","Total Debits (₹)",  debit,  "", ""]);
  rows.push(["","","Net Balance (₹)",   credit-debit, "", ""]);

  const csv = [headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=`DiamondEnclave_Ledger_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast("📥 Ledger exported");
}
