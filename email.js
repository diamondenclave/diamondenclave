// ============================================================
//  DIAMOND ENCLAVE — Email Manager
//  Handles: email storage, manage-emails UI, bill & receipt sending
//  Sending is done via the same Google Apps Script backend.
// ============================================================

const EmailManager = (() => {

  // In-memory email store: { flatId: "email@example.com" }
  let _emails = {};

  // ── Load / Save ──────────────────────────────────────────

  function load() {
    try {
      const raw = localStorage.getItem("de_emails");
      _emails = raw ? JSON.parse(raw) : {};
    } catch(e) { _emails = {}; }

    // If Sheet is configured, try to sync from sheet too
    if (CONFIG.SHEET_URL && CONFIG.SHEET_URL.trim()) {
      _loadFromSheet();
    }
  }

  async function _loadFromSheet() {
    try {
      const res  = await fetch(CONFIG.SHEET_URL + "?action=getEmails");
      const data = await res.json();
      if (data && data.emails) {
        // Merge: sheet wins over localStorage for existing entries
        Object.assign(_emails, data.emails);
        _saveLocal();
      }
    } catch(e) { /* silent fallback to localStorage */ }
  }

  function _saveLocal() {
    try { localStorage.setItem("de_emails", JSON.stringify(_emails)); } catch(e) {}
  }

  async function _saveToSheet(flatId, email) {
    if (!CONFIG.SHEET_URL || !CONFIG.SHEET_URL.trim()) return;
    try {
      await fetch(CONFIG.SHEET_URL, {
        method: "POST",
        body: JSON.stringify({ action: "setEmail", flatId, email }),
        headers: { "Content-Type": "application/json" }
      });
    } catch(e) { console.warn("Email sheet sync failed:", e); }
  }

  // ── Get / Set ────────────────────────────────────────────

  function getEmail(flatId) {
    return _emails[flatId] || "";
  }

  async function setEmail(flatId, email) {
    _emails[flatId] = email.trim();
    if (!email.trim()) delete _emails[flatId];
    _saveLocal();
    await _saveToSheet(flatId, email.trim());
  }

  // ── Manage Emails Panel ──────────────────────────────────

  function openPanel() {
    const list = document.getElementById("emailFormList");
    list.innerHTML = "";

    CONFIG.FLATS.forEach(flat => {
      const current = _emails[flat.id] || "";
      const row = document.createElement("div");
      row.className = "email-form-row";
      row.innerHTML = `
        <div class="email-form-info">
          <span class="email-flat-label">Flat ${flat.id}</span>
          <span class="email-owner-label">${flat.owner}</span>
        </div>
        <input
          type="email"
          class="modal-input email-field-input"
          data-flat="${flat.id}"
          value="${current}"
          placeholder="email@example.com"
        />
      `;
      list.appendChild(row);
    });

    document.getElementById("emailsModal").classList.remove("hidden");
  }

  async function saveAll() {
    const inputs = document.querySelectorAll(".email-field-input");
    const saves  = [];
    inputs.forEach(input => {
      const flatId = input.dataset.flat;
      const email  = input.value.trim();
      saves.push(setEmail(flatId, email));
    });
    await Promise.all(saves);
    document.getElementById("emailsModal").classList.add("hidden");
    // Re-render table to reflect new email chips
    if (typeof renderTable === "function") renderTable();
    showEmailToast("✓ Emails saved");
  }

  function closePanel() {
    document.getElementById("emailsModal").classList.add("hidden");
  }

  // ── Build HTML Email Body ────────────────────────────────

  function _buildBillHTML(flat, monthLabel) {
    return `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body { font-family: Georgia, serif; background: #f5f0e8; margin: 0; padding: 20px; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
  .header { background: #1a1a2e; padding: 28px 32px; text-align: center; }
  .diamond { color: #c9a84c; font-size: 28px; }
  .title { color: #e2c97e; font-size: 22px; font-weight: bold; margin: 8px 0 4px; }
  .subtitle { color: #888; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }
  .body { padding: 28px 32px; }
  .greeting { font-size: 16px; color: #333; margin-bottom: 20px; }
  .detail-row { display: flex; justify-content: space-between; padding: 10px 0;
                border-bottom: 1px solid #eee; font-size: 15px; }
  .detail-row:last-child { border-bottom: none; }
  .label { color: #666; }
  .value { font-weight: 600; color: #1a1a2e; }
  .amount-row { background: #faf6ed; border-radius: 8px; padding: 16px; margin: 20px 0;
                display: flex; justify-content: space-between; align-items: center; }
  .amount-label { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .amount-value { font-size: 28px; font-weight: bold; color: #c9a84c; }
  .footer { background: #f9f9f9; padding: 16px 32px; text-align: center;
            font-size: 12px; color: #999; border-top: 1px solid #eee; }
</style></head><body>
<div class="card">
  <div class="header">
    <div class="diamond">◆</div>
    <div class="title">Diamond Enclave</div>
    <div class="subtitle">Maintenance Bill</div>
  </div>
  <div class="body">
    <p class="greeting">Dear ${flat.owner},</p>
    <p style="color:#555;font-size:14px;margin-bottom:20px;">
      Please find your maintenance bill for <strong>${monthLabel}</strong> below.
    </p>
    <div class="detail-row"><span class="label">Flat</span><span class="value">${flat.id}</span></div>
    <div class="detail-row"><span class="label">Month</span><span class="value">${monthLabel}</span></div>
    <div class="amount-row">
      <span class="amount-label">Amount Due</span>
      <span class="amount-value">₹${flat.charge.toLocaleString('en-IN')}</span>
    </div>
    <p style="color:#888;font-size:13px;">
      Kindly make the payment at your earliest convenience. If you have already paid, please disregard this notice.
    </p>
  </div>
  <div class="footer">Diamond Enclave Residents' Association &nbsp;|&nbsp; This is an automated message.</div>
</div></body></html>`;
  }

  function _buildReceiptHTML(flat, date, monthLabel) {
    return `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body { font-family: Georgia, serif; background: #f5f0e8; margin: 0; padding: 20px; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
  .header { background: #0d2e1e; padding: 28px 32px; text-align: center; }
  .check { color: #4ade80; font-size: 36px; }
  .title { color: #4ade80; font-size: 22px; font-weight: bold; margin: 8px 0 4px; }
  .subtitle { color: #888; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }
  .body { padding: 28px 32px; }
  .greeting { font-size: 16px; color: #333; margin-bottom: 20px; }
  .detail-row { display: flex; justify-content: space-between; padding: 10px 0;
                border-bottom: 1px solid #eee; font-size: 15px; }
  .detail-row:last-child { border-bottom: none; }
  .label { color: #666; }
  .value { font-weight: 600; color: #1a1a2e; }
  .amount-row { background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 20px 0;
                display: flex; justify-content: space-between; align-items: center; }
  .amount-label { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .amount-value { font-size: 28px; font-weight: bold; color: #16a34a; }
  .footer { background: #f9f9f9; padding: 16px 32px; text-align: center;
            font-size: 12px; color: #999; border-top: 1px solid #eee; }
</style></head><body>
<div class="card">
  <div class="header">
    <div class="check">✓</div>
    <div class="title">Payment Received</div>
    <div class="subtitle">Receipt · Diamond Enclave</div>
  </div>
  <div class="body">
    <p class="greeting">Dear ${flat.owner},</p>
    <p style="color:#555;font-size:14px;margin-bottom:20px;">
      Your maintenance payment for <strong>${monthLabel}</strong> has been received. Thank you!
    </p>
    <div class="detail-row"><span class="label">Flat</span><span class="value">${flat.id}</span></div>
    <div class="detail-row"><span class="label">Month</span><span class="value">${monthLabel}</span></div>
    <div class="detail-row"><span class="label">Payment Date</span><span class="value">${_formatDate(date)}</span></div>
    <div class="amount-row">
      <span class="amount-label">Amount Paid</span>
      <span class="amount-value">₹${flat.charge.toLocaleString('en-IN')}</span>
    </div>
    <p style="color:#888;font-size:13px;">Please keep this receipt for your records.</p>
  </div>
  <div class="footer">Diamond Enclave Residents' Association &nbsp;|&nbsp; This is an automated message.</div>
</div></body></html>`;
  }

  // ── Send via Google Apps Script ───────────────────────────

  async function sendBill(flat, email, monthLabel) {
    if (!CONFIG.SHEET_URL || !CONFIG.SHEET_URL.trim()) {
      console.warn("SHEET_URL not configured — cannot send email");
      return false;
    }
    try {
      const res = await fetch(CONFIG.SHEET_URL, {
        method: "POST",
        body: JSON.stringify({
          action:  "sendEmail",
          to:      email,
          subject: `Diamond Enclave — Maintenance Bill for ${monthLabel} (Flat ${flat.id})`,
          html:    _buildBillHTML(flat, monthLabel)
        }),
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      return data.status === "sent";
    } catch(e) {
      console.warn("sendBill failed:", e);
      return false;
    }
  }

  async function sendReceipt(flat, date, email, monthName, year) {
    if (!CONFIG.SHEET_URL || !CONFIG.SHEET_URL.trim()) {
      console.warn("SHEET_URL not configured — cannot send email");
      return false;
    }
    const monthLabel = `${monthName} ${year}`;
    try {
      const res = await fetch(CONFIG.SHEET_URL, {
        method: "POST",
        body: JSON.stringify({
          action:  "sendEmail",
          to:      email,
          subject: `Diamond Enclave — Payment Receipt for ${monthLabel} (Flat ${flat.id})`,
          html:    _buildReceiptHTML(flat, date, monthLabel)
        }),
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      return data.status === "sent";
    } catch(e) {
      console.warn("sendReceipt failed:", e);
      return false;
    }
  }

  // ── Utility ───────────────────────────────────────────────
  function _formatDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function showEmailToast(msg) {
    if (typeof showToast === "function") showToast(msg);
  }

  // ── Init ──────────────────────────────────────────────────
  load();

  return { getEmail, setEmail, openPanel, saveAll, closePanel, sendBill, sendReceipt, load };

})();

// ── Global wrappers called from HTML ─────────────────────────
function openEmailsPanel()  { EmailManager.openPanel(); }
function closeEmailsPanel() { EmailManager.closePanel(); }
function saveEmails()       { EmailManager.saveAll(); }
