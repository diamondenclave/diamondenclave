// ============================================================
//  DIAMOND ENCLAVE — Main Application Logic
// ============================================================

// ── State ───────────────────────────────────────────────────
let state = {
  isAdmin:      false,
  currentYear:  CONFIG.START_YEAR,
  currentMonth: CONFIG.START_MONTH,
  pendingFlat:  null,   // for mark-paid flow
  revokeFlat:   null,   // for revoke flow
  receiptFlat:  null,   // for post-payment receipt
  billFlat:     null,   // for manual send-bill flow
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// ── Init ────────────────────────────────────────────────────
(async function init() {
  const msgs = [];
  if (!Sheets.isConfigured())               msgs.push("Google Sheets not connected (using local storage).");
  if (!EmailManager.isEmailConfigured())    msgs.push("EmailJS not configured — emails disabled.");
  if (msgs.length) {
    document.getElementById("bannerMsg").textContent = " " + msgs.join("  |  ") + "  ";
    document.getElementById("setupBanner").classList.remove("hidden");
  }
  await Sheets.loadAll();
  renderTable();
  renderStats();
  renderYearly();
})();

// ── Month Navigation ─────────────────────────────────────────
function changeMonth(dir) {
  let m = state.currentMonth + dir;
  let y = state.currentYear;
  if (m < 1)  { m = 12; y--; }
  if (m > 12) { m = 1;  y++; }

  // Don't go before start
  if (y < CONFIG.START_YEAR || (y === CONFIG.START_YEAR && m < CONFIG.START_MONTH)) return;

  state.currentYear  = y;
  state.currentMonth = m;
  renderTable();
  renderStats();
}

// ── Render Table ─────────────────────────────────────────────
function renderTable() {
  document.getElementById("monthDisplay").textContent =
    `${MONTHS[state.currentMonth - 1]} ${state.currentYear}`;

  const monthData = Sheets.getMonth(state.currentYear, state.currentMonth);
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  // Show/hide admin columns
  document.getElementById("actionHeader").classList.toggle("hidden", !state.isAdmin);
  document.getElementById("emailHeader").classList.toggle("hidden", !state.isAdmin);
  document.getElementById("manageEmailsBtn").classList.toggle("hidden", !state.isAdmin);

  CONFIG.FLATS.forEach(flat => {
    const rec    = monthData[flat.id] || { paid: false, date: "" };
    const isPaid = rec.paid;
    const email  = EmailManager.getEmail(flat.id);
    const tr     = document.createElement("tr");

    // Email cell — show address with edit indicator, or "No email" prompt
    const emailCell = state.isAdmin
      ? (email
          ? `<span class="email-chip" title="${email}">✉ ${email}</span>`
          : `<span class="email-missing" onclick="openEmailsPanel()">+ Add email</span>`)
      : '';

    // Action buttons
    let actionCell = '';
    if (state.isAdmin) {
      const payBtn    = isPaid
        ? `<button class="btn-revoke" onclick="openRevokeModal('${flat.id}','${flat.owner}')">✕ Revoke</button>`
        : `<button class="btn-pay"    onclick="openPaymentModal('${flat.id}','${flat.owner}')">✓ Mark Paid</button>`;
      const billBtn   = email
        ? `<button class="btn-bill"   onclick="openSendBillModal('${flat.id}')">✉ Send Bill</button>`
        : '';
      actionCell = `<div class="action-group">${payBtn}${billBtn}</div>`;
    }

    tr.innerHTML = `
      <td><span class="flat-badge">Flat ${flat.id}</span></td>
      <td><span class="owner-name">${flat.owner}</span></td>
      <td><span class="amount-text">₹${flat.charge.toLocaleString('en-IN')}</span></td>
      <td>
        <span class="status-badge ${isPaid ? 'status-paid' : 'status-pending'}">
          ${isPaid ? 'PAID' : 'PENDING'}
        </span>
      </td>
      <td><span class="date-text">${isPaid && rec.date ? formatDate(rec.date) : '—'}</span></td>
      <td class="${state.isAdmin ? '' : 'hidden'}">${emailCell}</td>
      <td class="${state.isAdmin ? '' : 'hidden'}">${actionCell}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Render Stats ─────────────────────────────────────────────
function renderStats() {
  const monthData = Sheets.getMonth(state.currentYear, state.currentMonth);
  let paid = 0, collected = 0;

  CONFIG.FLATS.forEach(flat => {
    const rec = monthData[flat.id] || {};
    if (rec.paid) { paid++; collected += flat.charge; }
  });

  document.getElementById("statPaid").textContent     = paid;
  document.getElementById("statPending").textContent  = CONFIG.FLATS.length - paid;
  document.getElementById("statCollected").textContent = `₹${collected.toLocaleString('en-IN')}`;
}

// ── Render Yearly Summary ─────────────────────────────────────
function renderYearly() {
  const allData = Sheets.getAllData();
  const container = document.getElementById("yearlyContent");

  // Gather all unique year-months from start till current
  const months = [];
  let y = CONFIG.START_YEAR, m = CONFIG.START_MONTH;
  const nowY = state.currentYear, nowM = state.currentMonth;
  while (y < nowY || (y === nowY && m <= nowM)) {
    months.push({ y, m });
    m++; if (m > 12) { m = 1; y++; }
  }

  let html = `<table class="yearly-table">
    <thead><tr>
      <th>Flat / Owner</th>
      ${months.map(({y,m}) => `<th>${MONTHS[m-1].slice(0,3)} ${y}</th>`).join('')}
      <th>Total Paid</th>
    </tr></thead><tbody>`;

  CONFIG.FLATS.forEach(flat => {
    let totalPaid = 0;
    const cells = months.map(({y, m}) => {
      const mk  = Sheets.monthKey(y, m);
      const rec = (allData[mk] || {})[flat.id] || {};
      if (rec.paid) { totalPaid++; return `<td class="y-paid">✓</td>`; }
      return `<td class="y-pend">—</td>`;
    }).join('');

    html += `<tr>
      <td><strong>Flat ${flat.id}</strong> <span style="color:var(--text2);font-size:12px;">${flat.owner}</span></td>
      ${cells}
      <td><strong style="color:var(--teal)">${totalPaid}/${months.length}</strong></td>
    </tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function toggleYearly() {
  const panel = document.getElementById("yearlyPanel");
  const arrow = document.getElementById("yearlyArrow");
  const open  = panel.classList.toggle("hidden");
  arrow.textContent = open ? "▼" : "▲";
  if (!open) renderYearly();
}

// ── Admin Auth ───────────────────────────────────────────────
function openAdminModal() {
  document.getElementById("adminModal").classList.remove("hidden");
  document.getElementById("adminPasswordInput").value = "";
  document.getElementById("adminError").classList.add("hidden");
  setTimeout(() => document.getElementById("adminPasswordInput").focus(), 100);
}
function closeAdminModal() {
  document.getElementById("adminModal").classList.add("hidden");
}
function verifyAdmin() {
  const pw = document.getElementById("adminPasswordInput").value;
  if (pw === CONFIG.ADMIN_PASSWORD) {
    state.isAdmin = true;
    document.getElementById("adminModal").classList.add("hidden");
    document.getElementById("adminLoginBtn").classList.add("hidden");
    document.getElementById("adminLogoutBtn").classList.remove("hidden");
    document.getElementById("adminBadge").classList.remove("hidden");
    renderTable();
    showToast("✓ Admin access granted");
  } else {
    document.getElementById("adminError").classList.remove("hidden");
    document.getElementById("adminPasswordInput").value = "";
    document.getElementById("adminPasswordInput").focus();
  }
}
function adminLogout() {
  state.isAdmin = false;
  document.getElementById("adminLoginBtn").classList.remove("hidden");
  document.getElementById("adminLogoutBtn").classList.add("hidden");
  document.getElementById("adminBadge").classList.add("hidden");
  document.getElementById("manageEmailsBtn").classList.add("hidden");
  renderTable();
  showToast("Logged out");
}

// ── Payment Modal ────────────────────────────────────────────
function openPaymentModal(flatId, owner) {
  state.pendingFlat = flatId;
  document.getElementById("payModalTitle").textContent  = `Mark Flat ${flatId} as Paid`;
  document.getElementById("payModalSub").textContent    = `Owner: ${owner} · ₹${CONFIG.FLATS.find(f=>f.id===flatId).charge.toLocaleString('en-IN')}`;
  document.getElementById("paymentDateInput").value     = todayISO();
  document.getElementById("paymentModal").classList.remove("hidden");
}
function closePaymentModal() {
  document.getElementById("paymentModal").classList.add("hidden");
  state.pendingFlat = null;
}
async function confirmPayment() {
  if (!state.pendingFlat) return;
  const date    = document.getElementById("paymentDateInput").value || todayISO();
  const flatId  = state.pendingFlat;
  await Sheets.markPaid(state.currentYear, state.currentMonth, flatId, date, true);
  closePaymentModal();
  renderTable();
  renderStats();
  renderYearly();

  // Offer receipt email
  const email = EmailManager.getEmail(flatId);
  const flat  = CONFIG.FLATS.find(f => f.id === flatId);
  state.receiptFlat = { flatId, date };
  const sub = document.getElementById("receiptModalSub");
  sub.textContent = `${flat.owner} · Flat ${flatId} · ₹${flat.charge.toLocaleString('en-IN')}`;
  document.getElementById("receiptEmailInput").value = email || "";
  document.getElementById("receiptModal").classList.remove("hidden");
}

// ── Revoke Modal ─────────────────────────────────────────────
function openRevokeModal(flatId, owner) {
  state.revokeFlat = flatId;
  document.getElementById("revokeModalSub").textContent = `Flat ${flatId} · ${owner}`;
  document.getElementById("revokeModal").classList.remove("hidden");
}
function closeRevokeModal() {
  document.getElementById("revokeModal").classList.add("hidden");
  state.revokeFlat = null;
}
async function confirmRevoke() {
  if (!state.revokeFlat) return;
  await Sheets.markPaid(state.currentYear, state.currentMonth, state.revokeFlat, "", false);
  closeRevokeModal();
  renderTable();
  renderStats();
  renderYearly();
  showToast(`Payment revoked for Flat ${state.revokeFlat}`);
}

// ── Close modal on backdrop click ────────────────────────────
function closeModalOutside(e) {
  if (e.target === e.currentTarget) {
    closeAdminModal();
    closePaymentModal();
    closeRevokeModal();
    closeEmailsPanel();
    closeSendBillModal();
    closeReceiptModal();
  }
}

// ── Receipt Modal ─────────────────────────────────────────────
async function confirmSendReceipt() {
  const email = document.getElementById("receiptEmailInput").value.trim();
  if (!email) { closeReceiptModal(); showToast(`✓ Flat ${state.receiptFlat.flatId} marked as paid`); return; }
  const { flatId, date } = state.receiptFlat;
  const flat = CONFIG.FLATS.find(f => f.id === flatId);
  closeReceiptModal();
  showToast("Sending receipt…");
  const ok = await EmailManager.sendReceipt(flat, date, email,
    MONTHS[state.currentMonth - 1], state.currentYear);
  showToast(ok ? `✉ Receipt sent to ${email}` : `✓ Paid — receipt failed (check email config)`);
}
function closeReceiptModal() {
  document.getElementById("receiptModal").classList.add("hidden");
  state.receiptFlat = null;
  showToast(`✓ Payment recorded`);
}

// ── Send Bill Modal ───────────────────────────────────────────
function openSendBillModal(flatId) {
  const flat  = CONFIG.FLATS.find(f => f.id === flatId);
  const email = EmailManager.getEmail(flatId);
  state.billFlat = flatId;
  document.getElementById("billModalTitle").textContent = `Send Bill — Flat ${flatId}`;
  document.getElementById("billModalSub").textContent   = `${flat.owner} · ₹${flat.charge.toLocaleString('en-IN')} due`;
  document.getElementById("billEmailInput").value       = email || "";

  // Build preview
  const monthLabel = `${MONTHS[state.currentMonth - 1]} ${state.currentYear}`;
  document.getElementById("billPreview").innerHTML = buildBillPreviewHTML(flat, monthLabel);
  document.getElementById("sendBillModal").classList.remove("hidden");
}
function closeSendBillModal() {
  document.getElementById("sendBillModal").classList.add("hidden");
  state.billFlat = null;
}
async function confirmSendBill() {
  const email = document.getElementById("billEmailInput").value.trim();
  if (!email) { showToast("Please enter an email address"); return; }
  const flat       = CONFIG.FLATS.find(f => f.id === state.billFlat);
  const monthLabel = `${MONTHS[state.currentMonth - 1]} ${state.currentYear}`;
  closeSendBillModal();
  showToast("Sending bill…");
  const ok = await EmailManager.sendBill(flat, email, monthLabel);
  showToast(ok ? `✉ Bill sent to ${email}` : `❌ Failed to send — check email configuration`);
}
function buildBillPreviewHTML(flat, monthLabel) {
  return `<div class="bill-preview-inner">
    <div class="bp-header">Diamond Enclave</div>
    <div class="bp-sub">Maintenance Bill · ${monthLabel}</div>
    <div class="bp-row"><span>Flat</span><span>${flat.id}</span></div>
    <div class="bp-row"><span>Owner</span><span>${flat.owner}</span></div>
    <div class="bp-row bp-total"><span>Amount Due</span><span>₹${flat.charge.toLocaleString('en-IN')}</span></div>
  </div>`;
}

// ── Excel Export ─────────────────────────────────────────────
function exportExcel() {
  const allData = Sheets.getAllData();

  // Build months list from start to current
  const months = [];
  let y = CONFIG.START_YEAR, m = CONFIG.START_MONTH;
  const nowY = state.currentYear, nowM = state.currentMonth;
  while (y < nowY || (y === nowY && m <= nowM)) {
    months.push({ y, m });
    m++; if (m > 12) { m = 1; y++; }
  }

  // Build CSV rows
  const headers = ["Flat", "Owner", "Monthly Charge (₹)",
    ...months.map(({y,m}) => `${MONTHS[m-1]} ${y}`),
    "Total Months Paid", "Total Amount Collected (₹)"];

  const rows = CONFIG.FLATS.map(flat => {
    let totalPaid = 0, totalAmount = 0;
    const cells = months.map(({y, m}) => {
      const mk  = Sheets.monthKey(y, m);
      const rec = (allData[mk] || {})[flat.id] || {};
      if (rec.paid) {
        totalPaid++;
        totalAmount += flat.charge;
        return rec.date ? `Paid (${formatDate(rec.date)})` : "Paid";
      }
      return "Pending";
    });
    return [`Flat ${flat.id}`, flat.owner, flat.charge, ...cells, totalPaid, totalAmount];
  });

  // Summary row
  const summaryRow = ["TOTAL", "", CONFIG.FLATS.reduce((s,f)=>s+f.charge,0),
    ...months.map(({y,m}) => {
      const mk = Sheets.monthKey(y, m);
      const md = allData[mk] || {};
      return CONFIG.FLATS.filter(f => (md[f.id]||{}).paid).reduce((s,f)=>s+f.charge,0);
    }),
    "", ""
  ];

  const allRows = [headers, ...rows, [], summaryRow];
  const csv     = allRows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `DiamondEnclave_Maintenance_${MONTHS[state.currentMonth-1]}_${state.currentYear}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("📥 Excel report downloaded");
}

// ── Utilities ────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split("T")[0];
}
function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

let _toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.classList.add("hidden"), 300);
  }, 2800);
}
