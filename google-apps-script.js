// ============================================================
//  DIAMOND ENCLAVE — Google Apps Script Backend (v2)
//  Now handles: payment records, email storage, sending emails
//  Paste this entire file into your Google Apps Script editor.
//  See SETUP.md for instructions.
// ============================================================

const SHEET_NAME  = "Payments";
const EMAILS_NAME = "Emails";

// ── Router ────────────────────────────────────────────────────

function doGet(e) {
  const action = e.parameter.action;
  if (action === "getAll")    return getAll();
  if (action === "getEmails") return getEmails();
  return jsonResponse({ status: "ok" });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === "setRecord")  return setRecord(body);
    if (body.action === "setEmail")   return setEmail(body);
    if (body.action === "sendEmail")  return sendEmailMsg(body);
  } catch(err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
  return jsonResponse({ status: "unknown action" });
}

// ── Payment Records ───────────────────────────────────────────

function getAll() {
  const sheet   = getOrCreateSheet(SHEET_NAME, ["Year","Month","FlatID","Status","PaymentDate"]);
  const data    = sheet.getDataRange().getValues();
  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    records.push({
      year:   row[0],
      month:  row[1],
      flatId: row[2],
      paid:   row[3] === "Paid",
      date:   row[4] || ""
    });
  }
  return jsonResponse({ status: "ok", records });
}

function setRecord(body) {
  const sheet = getOrCreateSheet(SHEET_NAME, ["Year","Month","FlatID","Status","PaymentDate"]);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == body.year && data[i][1] == body.month && data[i][2] == body.flatId) {
      sheet.getRange(i+1, 4).setValue(body.paid ? "Paid" : "Pending");
      sheet.getRange(i+1, 5).setValue(body.date || "");
      return jsonResponse({ status: "updated" });
    }
  }
  sheet.appendRow([body.year, body.month, body.flatId, body.paid ? "Paid" : "Pending", body.date || ""]);
  return jsonResponse({ status: "inserted" });
}

// ── Email Storage ─────────────────────────────────────────────

function getEmails() {
  const sheet  = getOrCreateSheet(EMAILS_NAME, ["FlatID","Email"]);
  const data   = sheet.getDataRange().getValues();
  const emails = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][1]) emails[data[i][0]] = data[i][1];
  }
  return jsonResponse({ status: "ok", emails });
}

function setEmail(body) {
  const sheet = getOrCreateSheet(EMAILS_NAME, ["FlatID","Email"]);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == body.flatId) {
      sheet.getRange(i+1, 2).setValue(body.email || "");
      return jsonResponse({ status: "updated" });
    }
  }
  sheet.appendRow([body.flatId, body.email || ""]);
  return jsonResponse({ status: "inserted" });
}

// ── Email Sending ─────────────────────────────────────────────

function sendEmailMsg(body) {
  try {
    GmailApp.sendEmail(
      body.to,
      body.subject,
      "This email requires an HTML-compatible mail client.",
      { htmlBody: body.html, name: "Diamond Enclave" }
    );
    return jsonResponse({ status: "sent" });
  } catch(err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// ── Helpers ───────────────────────────────────────────────────

function getOrCreateSheet(name, headers) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
