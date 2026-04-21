// ============================================================
//  DIAMOND ENCLAVE — Core App Logic
// ============================================================
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

let state = {
  isAdmin:false, isTreasurer:false, loginRole:"admin",
  currentYear:  new Date().getFullYear(),
  currentMonth: new Date().getMonth()+1,
  pendingFlat:null, revokeFlat:null, receiptFlat:null, billFlat:null,
  deleteLedgerId:null,
  ownerModalMode:null, ownerFlatId:null, ownerRecordId:null,
  transferFlatId:null, transferCurrentId:null,
  refusedFlat:null,
  overwriteFlat:null, overwriteDue:null,  // for duplicate confirmation
};

// ── Init ──────────────────────────────────────────────────────
(async function init() {
  const el=document.getElementById("entryDate");
  if(el) el.value=todayISO();
  const msgs=[];
  if(!Sheets.isConfigured())            msgs.push("Airtable not connected — using local storage.");
  if(!EmailManager.isEmailConfigured()) msgs.push("EmailJS not configured — emails disabled.");
  if(msgs.length){
    document.getElementById("bannerMsg").textContent=" "+msgs.join("  |  ")+"  ";
    document.getElementById("setupBanner").classList.remove("hidden");
  }
  await Sheets.loadAll();
  renderTable(); renderStats(); renderYearly();
  renderTreasurerTab();
  // Check if 1st April — prompt for opening balance
  _checkNewFYPrompt();
})();

function _checkNewFYPrompt() {
  const now=new Date();
  if(now.getMonth()===3&&now.getDate()===1) {  // April 1
    const fy=Sheets.getCurrentFY();
    const already=Sheets.getLedger().find(e=>e.description&&e.description.includes(`Opening Balance FY ${fy.label}`));
    if(!already) {
      document.getElementById("fyPromptBanner").classList.remove("hidden");
      document.getElementById("fyPromptLabel").textContent=`New Financial Year ${fy.label} — Record opening balance and send annual report?`;
    }
  }
}

// ── Tab Switching ─────────────────────────────────────────────
function switchTab(tab) {
  ["payments","treasurer","owners"].forEach(t=>{
    document.getElementById("page_"+t)?.classList.toggle("hidden",t!==tab);
    document.getElementById("tab_" +t)?.classList.toggle("active",t===tab);
  });
  if(tab==="treasurer"){
    if(Sheets.isConfigured()) Sheets.loadAll().then(()=>renderTreasurerTab());
    else renderTreasurerTab();
  }
  if(tab==="owners") renderOwnersTab();
}

// ── Month Navigation ──────────────────────────────────────────
function changeMonth(dir){
  let m=state.currentMonth+dir, y=state.currentYear;
  if(m<1){m=12;y--;} if(m>12){m=1;y++;}
  if(y<CONFIG.START_YEAR||(y===CONFIG.START_YEAR&&m<CONFIG.START_MONTH)) return;
  state.currentYear=y; state.currentMonth=m;
  renderTable(); renderStats();
}

// ── Render Payments Table ─────────────────────────────────────
function renderTable(){
  document.getElementById("monthDisplay").textContent=`${MONTHS[state.currentMonth-1]} ${state.currentYear}`;
  const md=Sheets.getMonth(state.currentYear,state.currentMonth);
  const tbody=document.getElementById("tableBody");
  tbody.innerHTML="";
  document.getElementById("actionHeader").classList.toggle("hidden",!state.isAdmin);

  CONFIG.FLATS.filter(f=>!f.parking).forEach(flat=>{
    const rec       = md[flat.id]||{paid:false,refused:false,date:"",amount:0};
    const isPaid    = rec.paid;
    const isRefused = rec.refused;
    const owner     = Sheets.getCurrentOwner(flat.id,state.currentYear,state.currentMonth);
    const charge    = Sheets.getChargeForMonth(flat.id,state.currentYear,state.currentMonth);
    const bal       = Sheets.calcBalance(flat.id,state.currentYear,state.currentMonth);
    const balBefore = Sheets.calcBalanceBefore(flat.id,state.currentYear,state.currentMonth);
    const due       = charge - balBefore;

    const balHtml = bal===0?`<span class="bal-neutral">₹0</span>`
      :bal>0?`<span class="bal-credit">+₹${bal} credit</span>`
      :      `<span class="bal-due">-₹${Math.abs(bal)} due</span>`;

    const dueHtml = isPaid?`<span class="bal-credit">Nil</span>`
      :due<=0?`<span class="bal-credit">Nil</span>`:`₹${due}`;

    let statusBadge;
    if(isPaid)       statusBadge=`<span class="status-badge status-paid">PAID</span>`;
    else if(isRefused) statusBadge=`<span class="status-badge status-refused" title="${rec.reason||""}">REFUSED${rec.reason?" ⓘ":""}</span>`;
    else             statusBadge=`<span class="status-badge status-pending">PENDING</span>`;

    let actionCell="";
    if(state.isAdmin){
      let payBtn,refuseBtn;
      if(isPaid){
        payBtn=`<button class="btn-revoke" onclick="openRevokeModal('${flat.id}')">✕ Revoke</button>`;
        refuseBtn="";
      } else if(isRefused){
        payBtn=`<button class="btn-pay" onclick="openPaymentModal('${flat.id}',${due})">✓ Mark Paid</button>`;
        refuseBtn=`<button class="btn-revoke" onclick="clearRefused('${flat.id}')">✕ Clear</button>`;
      } else {
        payBtn=`<button class="btn-pay" onclick="openPaymentModal('${flat.id}',${due})">✓ Mark Paid</button>`;
        refuseBtn=`<button class="btn-refused" onclick="openRefusedModal('${flat.id}')">✗ Refused</button>`;
      }
      const email=owner?.email||"";
      const billBtn=email&&!isRefused?`<button class="btn-bill" onclick="openSendBillModal('${flat.id}')">✉ Bill</button>`:"";
      actionCell=`<div class="action-group">${payBtn}${refuseBtn}${billBtn}</div>`;
    }

    const tr=document.createElement("tr");
    tr.classList.toggle("refused-row",isRefused);
    tr.innerHTML=`
      <td><span class="flat-badge">${flat.label}</span></td>
      <td><span class="owner-name">${owner?owner.name:"—"}</span></td>
      <td><span class="amount-text">₹${charge}</span></td>
      <td>${balHtml}</td>
      <td>${dueHtml}</td>
      <td>${statusBadge}</td>
      <td><span class="amount-text" style="font-size:15px">${isPaid&&rec.amount?"₹"+rec.amount:"—"}</span></td>
      <td><span class="date-text">${isPaid&&rec.date?formatDate(rec.date):"—"}</span></td>
      <td class="${state.isAdmin?"":"hidden"}">${actionCell}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Render Stats ──────────────────────────────────────────────
function renderStats(){
  const md=Sheets.getMonth(state.currentYear,state.currentMonth);
  let paid=0,collected=0;
  const flats=CONFIG.FLATS.filter(f=>!f.parking);
  flats.forEach(f=>{const r=md[f.id]||{};if(r.paid){paid++;collected+=r.amount||Sheets.getChargeForMonth(f.id,state.currentYear,state.currentMonth);}});
  document.getElementById("statPaid").textContent      =paid;
  document.getElementById("statPending").textContent   =flats.length-paid;
  document.getElementById("statCollected").textContent ="₹"+collected.toLocaleString("en-IN");
}

// ── Yearly Summary ────────────────────────────────────────────
function renderYearly(){
  const all=Sheets.getAllData(),months=[];
  let y=CONFIG.START_YEAR,m=CONFIG.START_MONTH;
  while(y<state.currentYear||(y===state.currentYear&&m<=state.currentMonth)){
    months.push({y,m});m++;if(m>12){m=1;y++;}
  }
  let html=`<table class="yearly-table"><thead><tr>
    <th>Flat</th>${months.map(({y,m})=>`<th>${MONTHS[m-1].slice(0,3)} ${y}</th>`).join("")}
    <th>Paid</th><th>Balance</th></tr></thead><tbody>`;
  CONFIG.FLATS.filter(f=>!f.parking).forEach(flat=>{
    let tp=0;
    const cells=months.map(({y,m})=>{
      const r=(all[Sheets.monthKey(y,m)]||{})[flat.id]||{};
      const ch=Sheets.getChargeForMonth(flat.id,y,m);
      if(r.paid){tp++;return `<td class="y-paid" title="₹${r.amount||ch}">✓</td>`;}
      if(r.refused) return `<td class="y-refused" title="${r.reason||""}">✗</td>`;
      return `<td class="y-pend">—</td>`;
    }).join("");
    const bal=Sheets.calcBalance(flat.id,state.currentYear,state.currentMonth);
    const bh=bal>0?`<span class="bal-credit">+₹${bal}</span>`:bal<0?`<span class="bal-due">-₹${Math.abs(bal)}</span>`:`<span class="bal-neutral">₹0</span>`;
    const own=Sheets.getCurrentOwner(flat.id,state.currentYear,state.currentMonth);
    html+=`<tr><td><strong>${flat.label}</strong><br><span style="color:var(--text2);font-size:11px">${own?own.name:"—"}</span></td>${cells}<td><strong style="color:var(--teal)">${tp}/${months.length}</strong></td><td>${bh}</td></tr>`;
  });
  document.getElementById("yearlyContent").innerHTML=html+"</tbody></table>";
}
function toggleYearly(){
  const p=document.getElementById("yearlyPanel"),open=p.classList.toggle("hidden");
  document.getElementById("yearlyArrow").textContent=open?"▼":"▲";
  if(!open) renderYearly();
}

// ── Update Charges ────────────────────────────────────────────
function openChargeModal(){
  document.getElementById("chargeModal").classList.remove("hidden");
  _renderChargeForm();
}
function closeChargeModal(){ document.getElementById("chargeModal").classList.add("hidden"); }

function _renderChargeForm(){
  const container=document.getElementById("chargeFormList");
  container.innerHTML="";
  // "All flats" row
  const allRow=document.createElement("div");
  allRow.className="charge-form-row";
  allRow.innerHTML=`
    <div class="charge-flat-info"><span class="email-flat-label">All Flats</span></div>
    <input type="number" class="modal-input charge-input" data-flat="ALL" placeholder="Leave blank to set individually" min="0" style="margin-bottom:0"/>
  `;
  container.appendChild(allRow);
  // Individual flat rows
  CONFIG.FLATS.filter(f=>!f.parking).forEach(flat=>{
    const current=Sheets.getChargeForMonth(flat.id,state.currentYear,state.currentMonth);
    const row=document.createElement("div");
    row.className="charge-form-row";
    row.innerHTML=`
      <div class="charge-flat-info">
        <span class="email-flat-label">${flat.label}</span>
        <span class="email-owner-label">Current: ₹${current}</span>
      </div>
      <input type="number" class="modal-input charge-input" data-flat="${flat.id}" placeholder="₹${current}" min="0" style="margin-bottom:0"/>
    `;
    container.appendChild(row);
  });
  // Effective from
  const now=new Date();
  document.getElementById("chargeEffectiveFrom").value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
}

async function confirmChargeUpdate(){
  const effectiveFrom=document.getElementById("chargeEffectiveFrom").value;
  if(!effectiveFrom){showToast("Please select effective month");return;}
  const inputs=document.querySelectorAll(".charge-input");
  let allVal=null;
  inputs.forEach(inp=>{if(inp.dataset.flat==="ALL"&&inp.value) allVal=Number(inp.value);});
  showToast("Saving charge updates…");
  for(const inp of inputs){
    const flatId=inp.dataset.flat;
    if(flatId==="ALL") continue;
    const val=allVal!==null?allVal:(inp.value?Number(inp.value):null);
    if(val!==null&&val>0) await Sheets.addChargeEntry(flatId,val,effectiveFrom);
  }
  closeChargeModal();
  renderTable(); renderStats();
  showToast("✓ Charges updated from "+fmtMonthKey(effectiveFrom));
}

// ── Login ─────────────────────────────────────────────────────
function openLoginModal(role){
  state.loginRole=role||"admin";
  setLoginRole(state.loginRole);
  document.getElementById("loginModal").classList.remove("hidden");
  document.getElementById("loginPasswordInput").value="";
  document.getElementById("loginError").classList.add("hidden");
  setTimeout(()=>document.getElementById("loginPasswordInput").focus(),100);
}
function closeLoginModal(){ document.getElementById("loginModal").classList.add("hidden"); }
function setLoginRole(role){
  state.loginRole=role;
  document.getElementById("roleTabAdmin").classList.toggle("active",role==="admin");
  document.getElementById("roleTabTreasurer").classList.toggle("active",role==="treasurer");
}
function verifyLogin(){
  const pw=document.getElementById("loginPasswordInput").value;
  const ok=(state.loginRole==="admin"&&pw===CONFIG.ADMIN_PASSWORD)||
            (state.loginRole==="treasurer"&&pw===CONFIG.TREASURER_PASSWORD);
  if(ok){
    if(state.loginRole==="admin")     state.isAdmin=true;
    if(state.loginRole==="treasurer") state.isTreasurer=true;
    closeLoginModal(); _updateAuthUI(); renderTable();
    if(state.loginRole==="treasurer") switchTab("treasurer");
    else if(state.currentTab==="treasurer") renderTreasurerTab();
    if(state.loginRole==="admin") document.getElementById("tab_owners").classList.remove("hidden");
    showToast(`✓ Logged in as ${state.loginRole}`);
  } else {
    document.getElementById("loginError").classList.remove("hidden");
    document.getElementById("loginPasswordInput").value="";
    document.getElementById("loginPasswordInput").focus();
  }
}
function doLogout(){
  state.isAdmin=false; state.isTreasurer=false;
  document.getElementById("tab_owners").classList.add("hidden");
  _updateAuthUI(); renderTable(); switchTab("payments");
  showToast("Logged out");
}
function _updateAuthUI(){
  const li=state.isAdmin||state.isTreasurer;
  document.getElementById("loginBtn").classList.toggle("hidden",li);
  document.getElementById("adminLogoutBtn").classList.toggle("hidden",!li);
  document.getElementById("adminBadge").classList.toggle("hidden",!state.isAdmin);
  document.getElementById("treasurerBadge").classList.toggle("hidden",!state.isTreasurer);
  document.getElementById("updateChargesBtn")?.classList.toggle("hidden",!state.isAdmin);
}

// ── Payment Modal (with duplicate check) ─────────────────────
function openPaymentModal(flatId,due){
  // Duplicate check
  if(Sheets.paymentExists(state.currentYear,state.currentMonth,flatId)){
    state.overwriteFlat=flatId; state.overwriteDue=due;
    const flat=getFlatCfg(flatId);
    const own=Sheets.getCurrentOwner(flatId,state.currentYear,state.currentMonth);
    document.getElementById("overwriteSub").textContent=
      `${flat.label} · ${own?own.name:"—"} already has a payment for ${MONTHS[state.currentMonth-1]} ${state.currentYear}. Overwrite?`;
    document.getElementById("overwriteModal").classList.remove("hidden");
    return;
  }
  _doOpenPaymentModal(flatId,due);
}
function confirmOverwrite(){
  document.getElementById("overwriteModal").classList.add("hidden");
  _doOpenPaymentModal(state.overwriteFlat,state.overwriteDue);
  state.overwriteFlat=null; state.overwriteDue=null;
}
function closeOverwriteModal(){
  document.getElementById("overwriteModal").classList.add("hidden");
  state.overwriteFlat=null; state.overwriteDue=null;
}
function _doOpenPaymentModal(flatId,due){
  state.pendingFlat=flatId;
  const flat=getFlatCfg(flatId);
  const own=Sheets.getCurrentOwner(flatId,state.currentYear,state.currentMonth);
  const charge=Sheets.getChargeForMonth(flatId,state.currentYear,state.currentMonth);
  document.getElementById("payModalTitle").textContent=`Mark ${flat.label} as Paid`;
  document.getElementById("payModalSub").textContent=`Owner: ${own?own.name:"—"}`;
  const notice=document.getElementById("payDueNotice");
  if(due!==charge){
    notice.textContent=due>0?`Adjusted due: ₹${due} (balance applied)`:`Credit covers this month — no payment needed`;
    notice.classList.remove("hidden");
  } else notice.classList.add("hidden");
  document.getElementById("paymentDateInput").value=todayISO();
  document.getElementById("paymentAmountInput").value=Math.max(0,due);
  document.getElementById("paymentModal").classList.remove("hidden");
}
function closePaymentModal(){
  document.getElementById("paymentModal").classList.add("hidden"); state.pendingFlat=null;
}
async function confirmPayment(){
  if(!state.pendingFlat) return;
  const date=document.getElementById("paymentDateInput").value||todayISO();
  const amt =Number(document.getElementById("paymentAmountInput").value)||0;
  const fid =state.pendingFlat;
  await Sheets.markPaid(state.currentYear,state.currentMonth,fid,date,true,amt);
  closePaymentModal(); renderTable(); renderStats(); renderYearly();
  if(typeof renderTreasurerTab==="function") renderTreasurerTab();
  const own=Sheets.getCurrentOwner(fid,state.currentYear,state.currentMonth);
  state.receiptFlat={flatId:fid,date,amount:amt};
  document.getElementById("receiptModalSub").textContent=`${own?own.name:fid} · ${getFlatCfg(fid).label} · ₹${amt}`;
  document.getElementById("receiptEmailInput").value=own?.email||"";
  document.getElementById("receiptModal").classList.remove("hidden");
}

// ── Revoke ────────────────────────────────────────────────────
function openRevokeModal(flatId){
  state.revokeFlat=flatId;
  const own=Sheets.getCurrentOwner(flatId,state.currentYear,state.currentMonth);
  document.getElementById("revokeModalSub").textContent=`${getFlatCfg(flatId).label} · ${own?own.name:"—"}`;
  document.getElementById("revokeModal").classList.remove("hidden");
}
function closeRevokeModal(){ document.getElementById("revokeModal").classList.add("hidden"); state.revokeFlat=null; }
async function confirmRevoke(){
  if(!state.revokeFlat) return;
  if(Sheets.isConfigured()) await Sheets.loadAll();
  await Sheets.markPaid(state.currentYear,state.currentMonth,state.revokeFlat,"",false,0);
  closeRevokeModal(); renderTable(); renderStats(); renderYearly();
  if(typeof renderTreasurerTab==="function") renderTreasurerTab();
  showToast("Payment revoked");
}

// ── Refused ───────────────────────────────────────────────────
function openRefusedModal(flatId){
  state.refusedFlat=flatId;
  const flat=getFlatCfg(flatId);
  const own=Sheets.getCurrentOwner(flatId,state.currentYear,state.currentMonth);
  document.getElementById("refusedModalTitle").textContent=`Mark Refused — ${flat.label}`;
  document.getElementById("refusedModalSub").textContent=`Owner: ${own?own.name:"—"}`;
  document.getElementById("refusedReasonInput").value="";
  document.getElementById("refusedModal").classList.remove("hidden");
}
function closeRefusedModal(){ document.getElementById("refusedModal").classList.add("hidden"); state.refusedFlat=null; }
async function confirmRefused(){
  if(!state.refusedFlat) return;
  const reason=document.getElementById("refusedReasonInput").value.trim();
  await Sheets.markRefused(state.currentYear,state.currentMonth,state.refusedFlat,reason||"Refused");
  closeRefusedModal(); renderTable(); renderStats();
  if(typeof renderTreasurerTab==="function") renderTreasurerTab();
  showToast(`⚠ Flat ${state.refusedFlat} marked as refused`);
}
async function clearRefused(flatId){
  await Sheets.markPaid(state.currentYear,state.currentMonth,flatId,"",false,0);
  renderTable(); renderStats();
  showToast(`Refused status cleared`);
}

// ── Send Bill ─────────────────────────────────────────────────
function openSendBillModal(flatId){
  const flat=getFlatCfg(flatId);
  const own=Sheets.getCurrentOwner(flatId,state.currentYear,state.currentMonth);
  const bal=Sheets.calcBalance(flatId,state.currentYear,state.currentMonth);
  const charge=Sheets.getChargeForMonth(flatId,state.currentYear,state.currentMonth);
  const due=charge-Sheets.calcBalanceBefore(flatId,state.currentYear,state.currentMonth);
  state.billFlat=flatId;
  document.getElementById("billModalTitle").textContent=`Send Bill — ${flat.label}`;
  document.getElementById("billModalSub").textContent=`${own?own.name:"—"} · ₹${Math.max(0,due)} due`;
  document.getElementById("billEmailInput").value=own?.email||"";
  const ml=`${MONTHS[state.currentMonth-1]} ${state.currentYear}`;
  document.getElementById("billPreview").innerHTML=`<div class="bill-preview-inner">
    <div class="bp-header">Diamond Enclave</div><div class="bp-sub">Bill · ${ml}</div>
    <div class="bp-row"><span>Flat</span><span>${flat.label}</span></div>
    <div class="bp-row"><span>Owner</span><span>${own?own.name:"—"}</span></div>
    <div class="bp-row"><span>Standard</span><span>₹${charge}</span></div>
    ${bal!==0?`<div class="bp-row"><span>Balance</span><span>${bal>0?"+":"-"}₹${Math.abs(bal)}</span></div>`:""}
    <div class="bp-row bp-total"><span>Amount Due</span><span>₹${Math.max(0,due)}</span></div>
  </div>`;
  document.getElementById("sendBillModal").classList.remove("hidden");
}
function closeSendBillModal(){ document.getElementById("sendBillModal").classList.add("hidden"); state.billFlat=null; }
async function confirmSendBill(){
  const email=document.getElementById("billEmailInput").value.trim();
  if(!email){showToast("Please enter an email");return;}
  const flat=getFlatCfg(state.billFlat);
  const bal=Sheets.calcBalance(state.billFlat,state.currentYear,state.currentMonth);
  const ml=`${MONTHS[state.currentMonth-1]} ${state.currentYear}`;
  closeSendBillModal(); showToast("Sending…");
  const ok=await EmailManager.sendBill(flat,email,ml,bal);
  showToast(ok?`✉ Bill sent to ${email}`:`❌ Send failed — check EmailJS config`);
}

// ── Receipt ───────────────────────────────────────────────────
function closeReceiptModal(){
  document.getElementById("receiptModal").classList.add("hidden");
  state.receiptFlat=null; showToast("✓ Payment recorded");
}
async function confirmSendReceipt(){
  const email=document.getElementById("receiptEmailInput").value.trim();
  if(!email){closeReceiptModal();return;}
  const {flatId,date,amount}=state.receiptFlat;
  closeReceiptModal(); showToast("Sending receipt…");
  const ok=await EmailManager.sendReceipt(getFlatCfg(flatId),date,email,
    MONTHS[state.currentMonth-1],state.currentYear,amount);
  showToast(ok?`✉ Receipt sent to ${email}`:`✓ Paid — receipt failed`);
}

// ── Close modals on backdrop ──────────────────────────────────
function closeModalOutside(e){
  if(e.target!==e.currentTarget) return;
  closeLoginModal(); closePaymentModal(); closeRevokeModal();
  closeSendBillModal(); closeReceiptModal(); closeDeleteLedgerModal();
  closeOwnerModal(); closeTransferModal(); closeRefusedModal();
  closeOverwriteModal(); closeChargeModal();
}

// ── Excel Export (Payments) ───────────────────────────────────
function exportExcel(){
  const all=Sheets.getAllData(),months=[];
  let y=CONFIG.START_YEAR,m=CONFIG.START_MONTH;
  while(y<state.currentYear||(y===state.currentYear&&m<=state.currentMonth)){months.push({y,m});m++;if(m>12){m=1;y++;}}
  const hdr=["Flat","Owner","Balance (₹)",...months.map(({y,m})=>`${MONTHS[m-1]} ${y} Status`),...months.map(({y,m})=>`${MONTHS[m-1]} ${y} Amount`),"Total Paid Months"];
  const rows=CONFIG.FLATS.filter(f=>!f.parking).map(flat=>{
    const own=Sheets.getCurrentOwner(flat.id,state.currentYear,state.currentMonth);
    const bal=Sheets.calcBalance(flat.id,state.currentYear,state.currentMonth);
    let tp=0;
    const sc=months.map(({y,m})=>{const r=(all[Sheets.monthKey(y,m)]||{})[flat.id]||{};if(r.paid)tp++;return r.paid?`Paid (${formatDate(r.date)})`:r.refused?"Refused":"Pending";});
    const ac=months.map(({y,m})=>{const r=(all[Sheets.monthKey(y,m)]||{})[flat.id]||{};return r.paid?(r.amount||Sheets.getChargeForMonth(flat.id,y,m)):"";});
    return[flat.label,own?own.name:"—",bal,...sc,...ac,tp];
  });
  _downloadCSV([hdr,...rows],`DiamondEnclave_${MONTHS[state.currentMonth-1]}_${state.currentYear}.csv`);
  showToast("📥 Downloaded");
}

function _downloadCSV(rows, filename){
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Utilities ─────────────────────────────────────────────────
function getFlatCfg(id){ return CONFIG.FLATS.find(f=>f.id===id)||{label:id,charge:500}; }
function todayISO()    { return new Date().toISOString().split("T")[0]; }
function formatDate(iso){ if(!iso)return"—";const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`; }
function fmtMonthKey(mk){ if(!mk)return"—";const[y,m]=mk.split("-");return`${MONTHS[parseInt(m)-1]} ${y}`; }
let _tt;
function showToast(msg){
  const t=document.getElementById("toast");
  t.textContent=msg;t.classList.remove("hidden");t.classList.add("show");
  clearTimeout(_tt);_tt=setTimeout(()=>{t.classList.remove("show");setTimeout(()=>t.classList.add("hidden"),300);},2800);
}
