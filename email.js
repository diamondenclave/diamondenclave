// ============================================================
//  DIAMOND ENCLAVE — Email Manager (EmailJS version)
//  Handles: email storage (localStorage), manage-emails UI,
//           bill & receipt sending via EmailJS (free, no backend)
// ============================================================

const EmailManager = (() => {

  // In-memory email store: { flatId: "email@example.com" }
  let _emails = {};

  // ── Load / Save (localStorage) ───────────────────────────

  function load() {
    try {
      const raw = localStorage.getItem("de_emails");
      _emails = raw ? JSON.parse(raw) : {};
    } catch(e) { _emails = {}; }
  }

  function _saveLocal() {
    try { localStorage.setItem("de_emails", JSON.stringify(_emails)); } catch(e) {}
  }

  // ── Get / Set ─────────────────────────────────────────────

  function getEmail(flatId) {
    return _emails[flatId] || "";
  }

  function setEmail(flatId, email) {
    if (email.trim()) {
      _emails[flatId] = email.trim();
    } else {
      delete _emails[flatId];
    }
    _saveLocal();
  }

  // ── EmailJS configured? ───────────────────────────────────

  function isEmailConfigured() {
    return CONFIG.EMAILJS_SERVICE_ID &&
           CONFIG.EMAILJS_TEMPLATE_ID &&
           CONFIG.EMAILJS_PUBLIC_KEY &&
           CONFIG.EMAILJS_SERVICE_ID.trim()  !== "" &&
           CONFIG.EMAILJS_TEMPLATE_ID.trim() !== "" &&
           CONFIG.EMAILJS_PUBLIC_KEY.trim()  !== "";
  }

  // ── Send via EmailJS ──────────────────────────────────────
  // EmailJS sends a template email. We pass all variables as
  // template params so the template can render them.

  async function _sendViaEmailJS(to, subject, bodyHTML, flatObj, extraParams) {
    if (!isEmailConfigured()) {
      console.warn("EmailJS not configured in config.js");
      return false;
    }
    try {
      // emailjs.send is loaded from the EmailJS CDN in index.html
      const params = {
        to_email:   to,
        to_name:    flatObj.owner,
        subject:    subject,
        message_html: bodyHTML,
        flat_id:    flatObj.id,
        flat_owner: flatObj.owner,
        amount:     "Rs." + flatObj.charge.toLocaleString('en-IN'),
        ...extraParams
      };
      const res = await emailjs.send(
        CONFIG.EMAILJS_SERVICE_ID,
        CONFIG.EMAILJS_TEMPLATE_ID,
        params,
        CONFIG.EMAILJS_PUBLIC_KEY
      );
      return res.status === 200;
    } catch(e) {
      console.warn("EmailJS send failed:", e);
      return false;
    }
  }

  // ── Send Bill ─────────────────────────────────────────────

  async function sendBill(flat, email, monthLabel) {
    const subject = `Diamond Enclave — Maintenance Bill for ${monthLabel} (Flat ${flat.id})`;
    const html    = _buildBillHTML(flat, monthLabel);
    return _sendViaEmailJS(email, subject, html, flat, { month: monthLabel, type: "bill" });
  }

  // ── Send Receipt ──────────────────────────────────────────

  async function sendReceipt(flat, date, email, monthName, year) {
    const monthLabel = `${monthName} ${year}`;
    const subject    = `Diamond Enclave — Payment Receipt for ${monthLabel} (Flat ${flat.id})`;
    const html       = _buildReceiptHTML(flat, date, monthLabel);
    return _sendViaEmailJS(email, subject, html, flat, {
      month:        monthLabel,
      payment_date: _formatDate(date),
      type:         "receipt"
    });
  }

  // ── Build Bill HTML ───────────────────────────────────────

  function _buildBillHTML(flat, monthLabel) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Georgia,serif;background:#f5f0e8;margin:0;padding:20px}
  .card{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);overflow:hidden}
  .hdr{background:#1a1a2e;padding:28px 32px;text-align:center}
  .dia{color:#c9a84c;font-size:28px}
  .ttl{color:#e2c97e;font-size:22px;font-weight:700;margin:8px 0 4px}
  .sub{color:#888;font-size:12px;letter-spacing:2px;text-transform:uppercase}
  .bdy{padding:28px 32px}
  .greet{font-size:16px;color:#333;margin-bottom:16px}
  .drow{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;font-size:15px}
  .drow:last-child{border-bottom:none}
  .lbl{color:#666}.val{font-weight:600;color:#1a1a2e}
  .arow{background:#faf6ed;border-radius:8px;padding:16px;margin:20px 0;display:flex;justify-content:space-between;align-items:center}
  .albl{font-size:13px;color:#666;text-transform:uppercase;letter-spacing:1px}
  .aval{font-size:26px;font-weight:700;color:#c9a84c}
  .ftr{background:#f9f9f9;padding:14px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee}
</style></head><body>
<div class="card">
  <div class="hdr"><div class="dia">&#9670;</div><div class="ttl">Diamond Enclave</div><div class="sub">Maintenance Bill</div></div>
  <div class="bdy">
    <p class="greet">Dear ${flat.owner},</p>
    <p style="color:#555;font-size:14px;margin-bottom:18px">Please find your maintenance bill for <strong>${monthLabel}</strong>.</p>
    <div class="drow"><span class="lbl">Flat</span><span class="val">${flat.id}</span></div>
    <div class="drow"><span class="lbl">Month</span><span class="val">${monthLabel}</span></div>
    <div class="arow"><span class="albl">Amount Due</span><span class="aval">&#8377;${flat.charge.toLocaleString('en-IN')}</span></div>
    <p style="color:#888;font-size:13px">Kindly make the payment at your earliest convenience. If you have already paid, please disregard this notice.</p>
  </div>
  <div class="ftr">Diamond Enclave Residents' Association &nbsp;|&nbsp; Automated message</div>
</div></body></html>`;
  }

  // ── Build Receipt HTML ────────────────────────────────────

  function _buildReceiptHTML(flat, date, monthLabel) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Georgia,serif;background:#f0fdf4;margin:0;padding:20px}
  .card{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);overflow:hidden}
  .hdr{background:#0d2e1e;padding:28px 32px;text-align:center}
  .chk{color:#4ade80;font-size:36px}
  .ttl{color:#4ade80;font-size:22px;font-weight:700;margin:8px 0 4px}
  .sub{color:#888;font-size:12px;letter-spacing:2px;text-transform:uppercase}
  .bdy{padding:28px 32px}
  .greet{font-size:16px;color:#333;margin-bottom:16px}
  .drow{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;font-size:15px}
  .drow:last-child{border-bottom:none}
  .lbl{color:#666}.val{font-weight:600;color:#1a1a2e}
  .arow{background:#f0fdf4;border-radius:8px;padding:16px;margin:20px 0;display:flex;justify-content:space-between;align-items:center}
  .albl{font-size:13px;color:#666;text-transform:uppercase;letter-spacing:1px}
  .aval{font-size:26px;font-weight:700;color:#16a34a}
  .ftr{background:#f9f9f9;padding:14px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee}
</style></head><body>
<div class="card">
  <div class="hdr"><div class="chk">&#10003;</div><div class="ttl">Payment Received</div><div class="sub">Receipt &middot; Diamond Enclave</div></div>
  <div class="bdy">
    <p class="greet">Dear ${flat.owner},</p>
    <p style="color:#555;font-size:14px;margin-bottom:18px">Your maintenance payment for <strong>${monthLabel}</strong> has been received. Thank you!</p>
    <div class="drow"><span class="lbl">Flat</span><span class="val">${flat.id}</span></div>
    <div class="drow"><span class="lbl">Month</span><span class="val">${monthLabel}</span></div>
    <div class="drow"><span class="lbl">Payment Date</span><span class="val">${_formatDate(date)}</span></div>
    <div class="arow"><span class="albl">Amount Paid</span><span class="aval">&#8377;${flat.charge.toLocaleString('en-IN')}</span></div>
    <p style="color:#888;font-size:13px">Please keep this receipt for your records.</p>
  </div>
  <div class="ftr">Diamond Enclave Residents' Association &nbsp;|&nbsp; Automated message</div>
</div></body></html>`;
  }

  // ── Manage Emails Panel ───────────────────────────────────

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
        <input type="email" class="modal-input email-field-input"
          data-flat="${flat.id}" value="${current}" placeholder="email@example.com" />
      `;
      list.appendChild(row);
    });
    document.getElementById("emailsModal").classList.remove("hidden");
  }

  function saveAll() {
    document.querySelectorAll(".email-field-input").forEach(input => {
      setEmail(input.dataset.flat, input.value);
    });
    document.getElementById("emailsModal").classList.add("hidden");
    if (typeof renderTable === "function") renderTable();
    if (typeof showToast   === "function") showToast("✓ Emails saved");
  }

  function closePanel() {
    document.getElementById("emailsModal").classList.add("hidden");
  }

  // ── Utility ───────────────────────────────────────────────

  function _formatDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  // ── Init ──────────────────────────────────────────────────
  load();

  return { getEmail, setEmail, openPanel, saveAll, closePanel,
           sendBill, sendReceipt, isEmailConfigured, load };

})();

// ── Global wrappers called from HTML ─────────────────────────
function openEmailsPanel()  { EmailManager.openPanel(); }
function closeEmailsPanel() { EmailManager.closePanel(); }
function saveEmails()       { EmailManager.saveAll(); }
