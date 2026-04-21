// ============================================================
//  DIAMOND ENCLAVE — Ledger Tab Logic
// ============================================================

function renderTreasurerTab() {
  const canEdit = state.isTreasurer || state.isAdmin;
  const addSection = document.getElementById("addEntrySection");
  if(addSection) addSection.style.display = canEdit ? "block" : "none";
  const prompt = document.getElementById("treasurerLoginPrompt");
  if(prompt) prompt.style.display = canEdit ? "none" : "flex";
  document.getElementById("ledgerActionHeader")?.classList.toggle("hidden", !canEdit);
  // Admin-only buttons
  document.getElementById("annualReportBtn")?.classList.toggle("hidden", !canEdit);
  document.getElementById("purgeDataBtn")?.classList.toggle("hidden", !state.isAdmin);
  document.getElementById("openingBalanceBtn")?.classList.toggle("hidden", !canEdit);
  if(state.isAdmin) _checkMissingLedgerEntries();
  renderBalanceGrid(); renderLedger(); renderLedgerStats();
}

// ── Per-flat balance grid ─────────────────────────────────────
function renderBalanceGrid(){
  const grid=document.getElementById("balanceGrid");
  grid.innerHTML="";
  CONFIG.FLATS.filter(f=>!f.parking).forEach(flat=>{
    const bal=Sheets.calcBalance(flat.id,state.currentYear,state.currentMonth);
    const own=Sheets.getCurrentOwner(flat.id,state.currentYear,state.currentMonth);
    const card=document.createElement("div");
    card.className="balance-card";
    card.innerHTML=`
      <div class="balance-flat">${flat.label}</div>
      <div class="balance-owner">${own?own.name:"—"}</div>
      <div class="balance-amount ${bal>0?"bal-credit":bal<0?"bal-due":"bal-neutral"}">
        ${bal>0?"+":bal<0?"-":""}₹${Math.abs(bal)}
      </div>
      <div class="balance-label">${bal>0?"Credit":bal<0?"Due":"Settled"}</div>
    `;
    grid.appendChild(card);
  });
}

// ── Ledger Stats ──────────────────────────────────────────────
function renderLedgerStats(){
  const entries=Sheets.getLedger();
  let credit=0,debit=0;
  entries.forEach(e=>{if(e.type==="Credit")credit+=e.amount;else debit+=e.amount;});
  const net=credit-debit;
  document.getElementById("ledgerCredit").textContent  ="₹"+credit.toLocaleString("en-IN");
  document.getElementById("ledgerDebit").textContent   ="₹"+debit.toLocaleString("en-IN");
  document.getElementById("ledgerBalance").textContent =(net>=0?"₹":"−₹")+Math.abs(net).toLocaleString("en-IN");
  document.getElementById("ledgerEntries").textContent =entries.length;
  const el=document.getElementById("ledgerBalance").parentElement;
  el.classList.toggle("accent",net>=0); el.classList.toggle("warn",net<0);
}

// ── Render Ledger Table ───────────────────────────────────────
function renderLedger(){
  const search =(document.getElementById("ledgerSearch")?.value||"").toLowerCase();
  const filter = document.getElementById("ledgerFilter")?.value||"All";
  const canEdit= state.isTreasurer||state.isAdmin;

  // Get entries in ASCENDING order for correct running balance
  const allAsc=[...Sheets.getLedger()].sort((a,b)=>{
    const dc=a.date.localeCompare(b.date);
    return dc!==0?dc:a.createdAt.localeCompare(b.createdAt);
  });

  // Build running balance for each entry
  let running=0;
  const balAfter={};
  allAsc.forEach(e=>{
    running += e.type==="Credit"?e.amount:-e.amount;
    balAfter[e.id]=running;
  });

  // Filter and sort DESCENDING for display
  const entries=allAsc
    .filter(e=>filter==="All"||e.type===filter)
    .filter(e=>!search||
      e.description.toLowerCase().includes(search)||
      e.type.toLowerCase().includes(search)||
      String(e.amount).includes(search))
    .reverse(); // latest first

  const tbody=document.getElementById("ledgerBody");
  tbody.innerHTML="";
  if(!entries.length){
    tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:30px">No entries yet. Payments marked as paid will appear here automatically.</td></tr>`;
    return;
  }
  entries.forEach(entry=>{
    const tr       =document.createElement("tr");
    const isCredit =entry.type==="Credit";
    const isAuto   =(entry.addedBy||"").startsWith("Auto");
    const canDelete=canEdit&&(!isAuto||state.isAdmin);
    const bal      =balAfter[entry.id]??0;
    const balColor =bal>0?"var(--paid-text)":bal<0?"var(--warn)":"var(--text3)";
    const balText  =(bal>=0?"₹":"−₹")+Math.abs(bal).toLocaleString("en-IN");
    tr.innerHTML=`
      <td><span class="date-text">${formatDate(entry.date)}</span></td>
      <td>
        <span class="status-badge ${isCredit?"status-paid":"status-pending"}">${entry.type.toUpperCase()}</span>
        ${isAuto?'<span class="auto-tag">auto</span>':""}
      </td>
      <td><span style="color:var(--text)">${entry.description||"—"}</span></td>
      <td><span class="amount-text" style="color:${isCredit?"var(--paid-text)":"var(--warn)"}">
        ${isCredit?"+":"-"}₹${Number(entry.amount).toLocaleString("en-IN")}
      </span></td>
      <td><span class="amount-text" style="color:${balColor};font-size:14px">${balText}</span></td>
      <td><span class="date-text">${entry.addedBy||"—"}</span></td>
      <td class="${canEdit?"":"hidden"}">
        ${canDelete
          ?`<button class="btn-revoke" onclick="openDeleteLedgerModal('${entry.id}','${(entry.description||"").replace(/'/g,"\\'")}')">✕</button>`
          :`<span style="color:var(--text3);font-size:11px">Auto</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Missing ledger check ──────────────────────────────────────
function _checkMissingLedgerEntries(){
  const allData=Sheets.getAllData();
  let missing=0;
  Object.values(allData).forEach(md=>Object.values(md).forEach(rec=>{if(rec.paid&&!rec.ledgerRef)missing++;}));
  const banner=document.getElementById("syncLedgerBanner");
  const msg   =document.getElementById("syncBannerMsg");
  if(banner){
    banner.classList.toggle("hidden",missing===0);
    if(msg) msg.textContent=` — ${missing} payment${missing>1?"s":""} found with no ledger entry.`;
  }
}

// ── Sync missing entries ──────────────────────────────────────
async function syncMissingLedgerEntries(){
  const allData=Sheets.getAllData();
  const MONTHS_ARR=["January","February","March","April","May","June","July","August","September","October","November","December"];
  let synced=0; showToast("Syncing missing entries…");
  for(const [mk,monthData] of Object.entries(allData)){
    const [year,month]=mk.split("-").map(Number);
    for(const [flatId,rec] of Object.entries(monthData)){
      if(!rec.paid||rec.ledgerRef) continue;
      const flatCfg=CONFIG.FLATS.find(f=>f.id===flatId)||{};
      const owner=Sheets.getCurrentOwner(flatId,year,month);
      const ml=`${MONTHS_ARR[month-1]} ${year}`;
      const desc=`Maintenance collected — ${flatCfg.label||flatId}${owner?" ("+owner.name+")":""} · ${ml}`;
      const entry=await Sheets.addLedgerEntry({
        date:rec.date||`${year}-${String(month).padStart(2,"0")}-01`,
        type:"Credit", amount:rec.amount||flatCfg.charge||500,
        description:desc, addedBy:"Auto (Sync)",
      });
      await Sheets.linkLedgerRef(flatId,year,month,entry.id);
      synced++;
    }
  }
  showToast(`✓ Synced ${synced} missing entr${synced===1?"y":"ies"}`);
  document.getElementById("syncLedgerBanner").classList.add("hidden");
  await Sheets.loadAll();
  renderLedger(); renderLedgerStats(); renderBalanceGrid();
}

// ── Add Entry ─────────────────────────────────────────────────
async function addLedgerEntry(){
  const type  =document.getElementById("entryType").value;
  const amount=Number(document.getElementById("entryAmount").value);
  const date  =document.getElementById("entryDate").value;
  const desc  =document.getElementById("entryDesc").value.trim();
  if(!amount||amount<=0){showToast("Please enter a valid amount");return;}
  if(!date)             {showToast("Please select a date");return;}
  if(!desc)             {showToast("Please enter a description");return;}
  await Sheets.addLedgerEntry({date,type,amount,description:desc,addedBy:state.isAdmin?"Admin":"Treasurer"});
  document.getElementById("entryAmount").value="";
  document.getElementById("entryDesc").value="";
  document.getElementById("entryDate").value=todayISO();
  renderLedger(); renderLedgerStats(); renderBalanceGrid();
  showToast(`✓ ${type} entry added`);
}

// ── Delete Entry ──────────────────────────────────────────────
function openDeleteLedgerModal(id,desc){
  state.deleteLedgerId=id;
  document.getElementById("deleteLedgerSub").textContent=`"${desc}" — this cannot be undone.`;
  document.getElementById("deleteLedgerModal").classList.remove("hidden");
}
function closeDeleteLedgerModal(){
  document.getElementById("deleteLedgerModal").classList.add("hidden");
  state.deleteLedgerId=null;
}
async function confirmDeleteLedger(){
  if(!state.deleteLedgerId) return;
  await Sheets.deleteLedgerEntry(state.deleteLedgerId);
  closeDeleteLedgerModal();
  renderLedger(); renderLedgerStats(); renderBalanceGrid();
  showToast("Entry deleted");
}

// ── Opening Balance ───────────────────────────────────────────
async function recordOpeningBalance(){
  showToast("Recording opening balance…");
  await Sheets.recordOpeningBalance();
  await Sheets.loadAll();
  renderLedger(); renderLedgerStats();
  // showToast is called inside Sheets.recordOpeningBalance with the amount
}

// ── Annual Report ─────────────────────────────────────────────
async function sendAnnualReport(){
  showToast("Preparing annual report…");
  const fy = Sheets.getCurrentFY();

  // Reload fresh data first
  if(Sheets.isConfigured()) await Sheets.loadAll();

  const entries = Sheets.getLedgerForFY(fy);
  if(!entries.length){
    showToast(`No ledger entries found for FY ${fy.label} (Apr ${fy.start.split("-")[0]} – Mar ${fy.end.split("-")[0]})`);
    return;
  }

  // Build Excel in chronological order
  const headers = ["Date","Type","Description","Amount (₹)","Balance (₹)","Added By"];
  let running=0, credit=0, debit=0;
  const rows = [...entries]
    .sort((a,b) => a.date.localeCompare(b.date))
    .map(e => {
      running += e.type==="Credit" ? e.amount : -e.amount;
      if(e.type==="Credit") credit+=e.amount; else debit+=e.amount;
      return [
        formatDate(e.date), e.type, e.description, e.amount,
        (running>=0?"₹":"−₹")+Math.abs(running).toLocaleString("en-IN"),
        e.addedBy||""
      ];
    });
  rows.push([]);
  rows.push(["","","Total Credits (₹)",  credit,        "","]);
  rows.push(["","","Total Debits (₹)",   debit,         "","]);
  rows.push(["","","Net Balance (₹)",    credit-debit,  "","]);

  const csv = [headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");

  // Always download for admin first
  _downloadAnnualCSV(csv, fy);

  // Send emails to all current owners with email addresses
  const allOwners = Sheets.getOwners();
  const owners = allOwners.filter(o => o.email && o.email.trim() && (!o.moveOut || o.moveOut.trim()===""));

  if(!owners.length){
    showToast(`📥 Report downloaded. No owner emails found — add emails in Owners tab.`);
    return;
  }

  showToast(`Sending to ${owners.length} owner${owners.length>1?"s":""}…`);
  let sent=0, failed=0;
  for(const owner of owners){
    const ok = await EmailManager.sendAnnualReport(owner, fy.label, csv);
    if(ok) sent++; else failed++;
  }

  if(failed===0)
    showToast(`✓ Annual report sent to ${sent} owner${sent>1?"s":""} & downloaded`);
  else
    showToast(`⚠ Sent to ${sent}, failed for ${failed} — check EmailJS config`);
}

function _downloadAnnualCSV(csv,fy){
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`DiamondEnclave_AnnualReport_FY${fy.label}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Purge Old Data ────────────────────────────────────────────
async function purgeOldData(){
  if(!confirm("This will permanently delete all payment and ledger data older than 2 years from Airtable. This cannot be undone. Proceed?")) return;
  showToast("Purging old data…");
  const deleted=await Sheets.purgeOldData();
  await Sheets.loadAll();
  renderLedger(); renderLedgerStats(); renderBalanceGrid();
  showToast(`✓ Purged ${deleted} old records`);
}

// ── Export Ledger ─────────────────────────────────────────────
function exportLedgerExcel(){
  const entries=[...Sheets.getLedger()].sort((a,b)=>a.date.localeCompare(b.date));
  const headers=["Date","Type","Description","Amount (₹)","Balance (₹)","Added By"];
  let credit=0,debit=0,running=0;
  const rows=entries.map(e=>{
    running+=e.type==="Credit"?e.amount:-e.amount;
    if(e.type==="Credit")credit+=e.amount; else debit+=e.amount;
    return[formatDate(e.date),e.type,e.description,e.amount,(running>=0?"₹":"−₹")+Math.abs(running).toLocaleString("en-IN"),e.addedBy||""];
  });
  rows.push([]); rows.push(["","","Total Credits",credit,"",""]); rows.push(["","","Total Debits",debit,"",""]); rows.push(["","","Net Balance",credit-debit,"",""]);
  const csv=[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`DiamondEnclave_Ledger_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast("📥 Ledger exported");
}
