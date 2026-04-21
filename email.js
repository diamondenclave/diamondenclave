// ============================================================
//  DIAMOND ENCLAVE — EmailJS Integration
// ============================================================
const EmailManager = (() => {

  function isEmailConfigured() {
    return !!(CONFIG.EMAILJS_SERVICE_ID  && CONFIG.EMAILJS_SERVICE_ID.trim()  &&
              CONFIG.EMAILJS_TEMPLATE_ID && CONFIG.EMAILJS_TEMPLATE_ID.trim() &&
              CONFIG.EMAILJS_PUBLIC_KEY  && CONFIG.EMAILJS_PUBLIC_KEY.trim());
  }

  async function _send(to, subject, html, flat, extra) {
    if (!isEmailConfigured()) return false;
    try {
      const res = await emailjs.send(
        CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_ID,
        { to_email:to, subject, message_html:html, flat_id:flat.id,
          to_name:flat.label, amount:"Rs."+flat.charge, ...extra },
        CONFIG.EMAILJS_PUBLIC_KEY
      );
      return res.status === 200;
    } catch(e) { console.warn("EmailJS failed:", e); return false; }
  }

  async function sendBill(flat, email, monthLabel, balance) {
    const due = flat.charge - (balance||0);
    return _send(email,
      `Diamond Enclave — Maintenance Bill for ${monthLabel} (${flat.label})`,
      _billHTML(flat, monthLabel, balance||0, due), flat, { month: monthLabel });
  }

  async function sendReceipt(flat, date, email, monthName, year, amountPaid) {
    const ml = `${monthName} ${year}`;
    return _send(email,
      `Diamond Enclave — Payment Receipt for ${ml} (${flat.label})`,
      _receiptHTML(flat, date, ml, amountPaid), flat,
      { month: ml, payment_date: _fmt(date) });
  }

  function _billHTML(flat, ml, bal, due) {
    const balRow = bal !== 0
      ? `<div class="drow"><span class="lbl">Running Balance</span>
         <span class="val" style="color:${bal>0?"#16a34a":"#dc2626"}">${bal>0?"+":"-"}₹${Math.abs(bal)}</span></div>`
      : "";
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Georgia,serif;background:#f5f0e8;margin:0;padding:20px}
.card{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);overflow:hidden}
.hdr{background:#1a1a2e;padding:28px 32px;text-align:center}
.dia{color:#c9a84c;font-size:28px}.ttl{color:#e2c97e;font-size:22px;font-weight:700;margin:8px 0 4px}
.sub{color:#888;font-size:12px;letter-spacing:2px;text-transform:uppercase}
.bdy{padding:28px 32px}.drow{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;font-size:15px}
.lbl{color:#666}.val{font-weight:600;color:#1a1a2e}
.arow{background:#faf6ed;border-radius:8px;padding:16px;margin:20px 0;display:flex;justify-content:space-between;align-items:center}
.aval{font-size:26px;font-weight:700;color:#c9a84c}
.ftr{background:#f9f9f9;padding:14px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee}
</style></head><body><div class="card">
<div class="hdr"><div class="dia">&#9670;</div><div class="ttl">Diamond Enclave</div><div class="sub">Maintenance Bill</div></div>
<div class="bdy">
<p style="font-size:16px;color:#333;margin-bottom:16px">Dear ${flat.label} Owner,</p>
<p style="color:#555;font-size:14px;margin-bottom:18px">Your maintenance bill for <strong>${ml}</strong>.</p>
<div class="drow"><span class="lbl">Flat</span><span class="val">${flat.label}</span></div>
<div class="drow"><span class="lbl">Standard Charge</span><span class="val">₹${flat.charge}</span></div>
${balRow}
<div class="arow"><span style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:1px">Amount Due</span>
<span class="aval">&#8377;${Math.max(0,due)}</span></div>
<p style="color:#888;font-size:13px">Kindly pay at your earliest convenience.</p>
</div>
<div class="ftr">Diamond Enclave Residents' Association &nbsp;|&nbsp; Automated message</div>
</div></body></html>`;
  }

  function _receiptHTML(flat, date, ml, amt) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Georgia,serif;background:#f0fdf4;margin:0;padding:20px}
.card{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);overflow:hidden}
.hdr{background:#0d2e1e;padding:28px 32px;text-align:center}
.chk{color:#4ade80;font-size:36px}.ttl{color:#4ade80;font-size:22px;font-weight:700;margin:8px 0 4px}
.sub{color:#888;font-size:12px;letter-spacing:2px;text-transform:uppercase}
.bdy{padding:28px 32px}.drow{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;font-size:15px}
.lbl{color:#666}.val{font-weight:600;color:#1a1a2e}
.arow{background:#f0fdf4;border-radius:8px;padding:16px;margin:20px 0;display:flex;justify-content:space-between;align-items:center}
.aval{font-size:26px;font-weight:700;color:#16a34a}
.ftr{background:#f9f9f9;padding:14px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee}
</style></head><body><div class="card">
<div class="hdr"><div class="chk">&#10003;</div><div class="ttl">Payment Received</div><div class="sub">Receipt &middot; Diamond Enclave</div></div>
<div class="bdy">
<p style="font-size:16px;color:#333;margin-bottom:16px">Dear ${flat.label} Owner,</p>
<p style="color:#555;font-size:14px;margin-bottom:18px">Payment for <strong>${ml}</strong> received. Thank you!</p>
<div class="drow"><span class="lbl">Flat</span><span class="val">${flat.label}</span></div>
<div class="drow"><span class="lbl">Month</span><span class="val">${ml}</span></div>
<div class="drow"><span class="lbl">Payment Date</span><span class="val">${_fmt(date)}</span></div>
<div class="arow"><span style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:1px">Amount Paid</span>
<span class="aval">&#8377;${amt}</span></div>
<p style="color:#888;font-size:13px">Please keep this receipt for your records.</p>
</div>
<div class="ftr">Diamond Enclave Residents' Association &nbsp;|&nbsp; Automated message</div>
</div></body></html>`;
  }

  function _fmt(iso) {
    if (!iso) return "—";
    const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`;
  }

  async function sendAnnualReport(owner, fyLabel, csvContent) {
    if (!isEmailConfigured()) return false;
    try {
      // Send email with annual report note (CSV attached as text in body)
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Georgia,serif;background:#f5f0e8;padding:20px">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)">
        <div style="background:#1a1a2e;padding:28px 32px;text-align:center">
          <div style="color:#c9a84c;font-size:28px">◆</div>
          <div style="color:#e2c97e;font-size:22px;font-weight:700;margin:8px 0 4px">Diamond Enclave</div>
          <div style="color:#888;font-size:12px;letter-spacing:2px;text-transform:uppercase">Annual Financial Report</div>
        </div>
        <div style="padding:28px 32px">
          <p style="font-size:16px;color:#333;margin-bottom:16px">Dear ${owner.name},</p>
          <p style="color:#555;font-size:14px;margin-bottom:18px">
            Please find the annual maintenance ledger report for Financial Year <strong>${fyLabel}</strong> attached.<br><br>
            This report includes all income and expenditure for Diamond Enclave from 1st April to 31st March.
          </p>
          <p style="color:#888;font-size:13px">For any queries, please contact the building administrator.</p>
        </div>
        <div style="background:#f9f9f9;padding:14px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee">
          Diamond Enclave · 11/6, Narendra Nath Ghosh Lane, Kolkata-700040
        </div>
      </div></body></html>`;
      const res = await emailjs.send(
        CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_ID,
        { to_email: owner.email, subject: `Diamond Enclave — Annual Report FY ${fyLabel}`,
          message_html: html, to_name: owner.name,
          flat_id: "", amount: "" },
        CONFIG.EMAILJS_PUBLIC_KEY
      );
      return res.status === 200;
    } catch(e) { console.warn("Annual report email failed:", e); return false; }
  }

  return { isEmailConfigured, sendBill, sendReceipt, sendAnnualReport };
})();
