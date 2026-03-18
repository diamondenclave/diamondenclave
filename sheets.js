// ============================================================
//  DIAMOND ENCLAVE — Airtable Data Layer
//  Tables: Payments, Owners, Ledger
// ============================================================
const Sheets = (() => {

  let _payments  = {};   // { "YYYY-MM": { flatId: { paid, date, amount, recordId } } }
  let _payRecs   = {};   // flatKey -> airtable record id
  let _owners    = [];   // array of owner records
  let _ledger    = [];   // array of ledger entries

  // ── Helpers ───────────────────────────────────────────────
  function monthKey(y, m)       { return `${y}-${String(m).padStart(2,'0')}`; }
  function flatKey(y, m, fid)   { return `${monthKey(y,m)}-${fid}`; }
  function isConfigured()       {
    return !!(CONFIG.AIRTABLE_TOKEN   && CONFIG.AIRTABLE_TOKEN.trim() &&
              CONFIG.AIRTABLE_BASE_ID && CONFIG.AIRTABLE_BASE_ID.trim());
  }
  function _hdr()  { return { "Authorization":`Bearer ${CONFIG.AIRTABLE_TOKEN}`, "Content-Type":"application/json" }; }
  function _url(t) { return `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(t)}`; }

  async function _fetchAll(table) {
    let records = [], offset = null;
    do {
      const res  = await fetch(_url(table) + (offset ? `?offset=${offset}` : ""), { headers: _hdr() });
      const data = await res.json();
      if (data.error) throw new Error(JSON.stringify(data.error));
      records = records.concat(data.records || []);
      offset  = data.offset || null;
    } while (offset);
    return records;
  }

  // ── LOAD ALL ──────────────────────────────────────────────
  async function loadAll() {
    _loadLocal();
    if (!isConfigured()) return;
    try {
      await Promise.all([_loadPayments(), _loadOwners(), _loadLedger()]);
      _saveLocal();
    } catch(e) { console.warn("Airtable load failed:", e); }
  }

  async function _loadPayments() {
    const recs = await _fetchAll("Payments");
    _payments = {}; _payRecs = {};
    recs.forEach(rec => {
      const f  = rec.fields;
      const mk = monthKey(f.Year, f.Month);
      const fk = flatKey(f.Year, f.Month, f.FlatID);
      if (!_payments[mk]) _payments[mk] = {};
      _payments[mk][f.FlatID] = {
        paid:      f.Status === "Paid",
        date:      f.PaymentDate || "",
        amount:    Number(f.AmountPaid) || 0,
        recordId:  rec.id,
        ledgerRef: f.LedgerRef || "",
      };
      _payRecs[fk] = rec.id;
    });
  }

  async function _loadOwners() {
    const recs = await _fetchAll("Owners");
    _owners = recs.map(rec => ({
      id:        rec.id,
      flatId:    rec.fields.FlatID      || "",
      name:      rec.fields.OwnerName   || "",
      email:     rec.fields.Email       || "",
      phone:     rec.fields.Phone       || "",
      moveIn:    rec.fields.MoveIn      || "",   // "YYYY-MM"
      moveOut:   rec.fields.MoveOut     || "",   // "YYYY-MM" or ""
      notes:     rec.fields.Notes       || "",
    }));
  }

  async function _loadLedger() {
    const recs = await _fetchAll("Ledger");
    _ledger = recs.map(rec => ({
      id:          rec.id,
      date:        rec.fields.Date        || "",
      type:        rec.fields.Type        || "",
      amount:      Number(rec.fields.Amount) || 0,
      description: rec.fields.Description || "",
      addedBy:     rec.fields.AddedBy     || "",
    })).sort((a,b) => a.date.localeCompare(b.date));
  }

  // ── PAYMENTS ─────────────────────────────────────────────
  function getMonth(y, m)  { return _payments[monthKey(y,m)] || {}; }
  function getAllData()     { return _payments; }

  async function markPaid(year, month, flatId, date, paid, amount) {
    const mk      = monthKey(year, month);
    const fk      = flatKey(year, month, flatId);
    const MONTHS  = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];
    const flatCfg = CONFIG.FLATS.find(f => f.id === flatId) || {};

    // ── If REVOKING: delete the associated auto-ledger entry ──
    if (!paid) {
      const existing = (_payments[mk]||{})[flatId];
      if (existing && existing.ledgerRef) {
        await deleteLedgerEntry(existing.ledgerRef);
      }
    }

    if (!_payments[mk]) _payments[mk] = {};
    _payments[mk][flatId] = { paid, date: paid ? date : "", amount: paid ? Number(amount)||0 : 0 };
    _saveLocal();

    // ── If MARKING PAID: auto-create a ledger credit entry ───
    let ledgerRef = null;
    if (paid) {
      const owner      = getCurrentOwner(flatId, year, month);
      const monthLabel = `${MONTHS[month-1]} ${year}`;
      const desc       = `Maintenance collected — ${flatCfg.label||flatId}${owner?" ("+owner.name+")":""} · ${monthLabel}`;
      const entry      = await addLedgerEntry({
        date:        date,
        type:        "Credit",
        amount:      Number(amount)||0,
        description: desc,
        addedBy:     "Auto (Payment)",
      });
      ledgerRef = entry.id;
      _payments[mk][flatId].ledgerRef = ledgerRef;
      _saveLocal();
    }

    // ── Sync payment record to Airtable ──────────────────────
    if (!isConfigured()) return;
    try {
      const fields = {
        FlatID:      flatId,
        Year:        year,
        Month:       month,
        Status:      paid ? "Paid" : "Pending",
        PaymentDate: paid ? date : "",
        AmountPaid:  paid ? Number(amount)||0 : 0,
        LedgerRef:   ledgerRef || "",
      };
      const existId = _payRecs[fk];
      if (existId) {
        await fetch(`${_url("Payments")}/${existId}`,
          { method:"PATCH", headers:_hdr(), body:JSON.stringify({fields}) });
      } else {
        const res  = await fetch(_url("Payments"),
          { method:"POST", headers:_hdr(), body:JSON.stringify({fields}) });
        const data = await res.json();
        if (data.id) { _payRecs[fk] = data.id; _payments[mk][flatId].recordId = data.id; }
      }
      _saveLocal();
    } catch(e) { console.warn("Airtable payment write failed:", e); }
  }

  // ── BALANCE CALCULATION ───────────────────────────────────

  // Count how many months have passed from START up to and including (upToYear, upToMonth)
  function _monthsElapsed(upToYear, upToMonth) {
    const start = CONFIG.START_YEAR * 12 + CONFIG.START_MONTH - 1;
    const end   = upToYear * 12 + upToMonth - 1;
    return Math.max(0, end - start + 1);
  }

  // Total amount paid by a flat across all months
  function _totalPaid(flatId) {
    let total = 0;
    Object.values(_payments).forEach(monthData => {
      const rec = monthData[flatId];
      if (rec && rec.paid) total += (rec.amount || 0);
    });
    return total;
  }

  // Running balance UP TO AND INCLUDING current viewed month
  // Positive = credit (overpaid), Negative = due (underpaid/missed)
  function calcBalance(flatId, upToYear, upToMonth) {
    const flat = CONFIG.FLATS.find(f => f.id === flatId);
    if (!flat || flat.parking) return 0;
    // Use current state month if not specified
    const y = upToYear  || (typeof state !== "undefined" ? state.currentYear  : CONFIG.START_YEAR);
    const m = upToMonth || (typeof state !== "undefined" ? state.currentMonth : CONFIG.START_MONTH);
    const totalOwed = flat.charge * _monthsElapsed(y, m);
    const totalPaid = _totalPaid(flatId);
    return totalPaid - totalOwed;
  }

  // Balance BEFORE the given month — used to calculate "Due This Month"
  // Excludes the current month from both owed and paid
  function calcBalanceBefore(flatId, year, month) {
    const flat = CONFIG.FLATS.find(f => f.id === flatId);
    if (!flat || flat.parking) return 0;
    // Months elapsed before this month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    if (prevYear < CONFIG.START_YEAR ||
       (prevYear === CONFIG.START_YEAR && prevMonth < CONFIG.START_MONTH)) return 0;
    const totalOwed = flat.charge * _monthsElapsed(prevYear, prevMonth);
    // Only count payments from months before current
    const currentMk = monthKey(year, month);
    let totalPaid = 0;
    Object.entries(_payments).forEach(([mk, monthData]) => {
      if (mk >= currentMk) return;
      const rec = monthData[flatId];
      if (rec && rec.paid) totalPaid += (rec.amount || 0);
    });
    return totalPaid - totalOwed;
  }

  // ── OWNERS ────────────────────────────────────────────────
  function getOwners()     { return [..._owners]; }

  // Get current owner for a flat at a given year-month
  function getCurrentOwner(flatId, year, month) {
    const mk = monthKey(year, month);
    return _owners.find(o =>
      o.flatId === flatId &&
      o.moveIn <= mk &&
      (o.moveOut === "" || o.moveOut >= mk)
    ) || null;
  }

  // Get full history for a flat
  function getFlatHistory(flatId) {
    return _owners
      .filter(o => o.flatId === flatId)
      .sort((a,b) => a.moveIn.localeCompare(b.moveIn));
  }

  async function addOwner(ownerData) {
    const optimistic = { ...ownerData, id: "pending_" + Date.now() };
    _owners.push(optimistic);
    _saveLocal();
    if (!isConfigured()) return optimistic;
    try {
      const fields = {
        FlatID:    ownerData.flatId,
        OwnerName: ownerData.name,
        Email:     ownerData.email,
        Phone:     ownerData.phone,
        MoveIn:    ownerData.moveIn,
        MoveOut:   ownerData.moveOut || "",
        Notes:     ownerData.notes  || "",
      };
      const res  = await fetch(_url("Owners"),
        { method:"POST", headers:_hdr(), body:JSON.stringify({fields}) });
      const data = await res.json();
      if (data.id) {
        const idx = _owners.findIndex(o => o.id === optimistic.id);
        if (idx !== -1) _owners[idx] = { ...ownerData, id: data.id };
        _saveLocal();
        return _owners.find(o => o.id === data.id);
      }
    } catch(e) { console.warn("Airtable owner add failed:", e); }
    return optimistic;
  }

  async function updateOwner(recordId, updates) {
    const idx = _owners.findIndex(o => o.id === recordId);
    if (idx !== -1) { _owners[idx] = { ..._owners[idx], ...updates }; _saveLocal(); }
    if (!isConfigured() || !recordId || recordId.startsWith("pending_")) return;
    try {
      const fields = {};
      if (updates.name    !== undefined) fields.OwnerName  = updates.name;
      if (updates.email   !== undefined) fields.Email      = updates.email;
      if (updates.phone   !== undefined) fields.Phone      = updates.phone;
      if (updates.moveIn  !== undefined) fields.MoveIn     = updates.moveIn;
      if (updates.moveOut !== undefined) fields.MoveOut    = updates.moveOut;
      if (updates.notes   !== undefined) fields.Notes      = updates.notes;
      await fetch(`${_url("Owners")}/${recordId}`,
        { method:"PATCH", headers:_hdr(), body:JSON.stringify({fields}) });
      _saveLocal();
    } catch(e) { console.warn("Airtable owner update failed:", e); }
  }

  // Transfer: set moveOut on current, add new owner record
  async function transferOwnership(flatId, moveOutMk, newOwnerData) {
    const current = getCurrentOwner(flatId, ...moveOutMk.split("-").map(Number));
    if (current) await updateOwner(current.id, { moveOut: moveOutMk });
    return addOwner({ ...newOwnerData, flatId, moveOut: "" });
  }

  // Get email for a flat (from current owner)
  function getEmail(flatId) {
    const now  = new Date();
    const owner = getCurrentOwner(flatId, now.getFullYear(), now.getMonth()+1);
    return owner ? owner.email || "" : "";
  }

  // ── LEDGER ────────────────────────────────────────────────
  function getLedger() { return [..._ledger]; }

  async function addLedgerEntry(entry) {
    const opt = { ...entry, id: "pending_" + Date.now() };
    _ledger.push(opt);
    _ledger.sort((a,b) => a.date.localeCompare(b.date));
    _saveLocal();
    if (!isConfigured()) return opt;
    try {
      const fields = { Date: entry.date, Type: entry.type,
                       Amount: Number(entry.amount),
                       Description: entry.description, AddedBy: entry.addedBy };
      const res  = await fetch(_url("Ledger"),
        { method:"POST", headers:_hdr(), body:JSON.stringify({fields}) });
      const data = await res.json();
      if (data.id) {
        const idx = _ledger.findIndex(e => e.id === opt.id);
        if (idx !== -1) _ledger[idx] = { ...entry, id: data.id };
        _saveLocal();
      }
    } catch(e) { console.warn("Airtable ledger write failed:", e); }
    return opt;
  }

  async function deleteLedgerEntry(recordId) {
    _ledger = _ledger.filter(e => e.id !== recordId);
    _saveLocal();
    if (!isConfigured() || recordId.startsWith("pending_")) return;
    try {
      await fetch(`${_url("Ledger")}/${recordId}`, { method:"DELETE", headers:_hdr() });
    } catch(e) { console.warn("Airtable ledger delete failed:", e); }
  }

  // ── localStorage ─────────────────────────────────────────
  function _saveLocal() {
    try {
      localStorage.setItem("de_payments", JSON.stringify(_payments));
      localStorage.setItem("de_payrecs",  JSON.stringify(_payRecs));
      localStorage.setItem("de_owners",   JSON.stringify(_owners));
      localStorage.setItem("de_ledger",   JSON.stringify(_ledger));
    } catch(e) {}
  }
  function _loadLocal() {
    try {
      _payments = JSON.parse(localStorage.getItem("de_payments") || "{}");
      _payRecs  = JSON.parse(localStorage.getItem("de_payrecs")  || "{}");
      _owners   = JSON.parse(localStorage.getItem("de_owners")   || "[]");
      _ledger   = JSON.parse(localStorage.getItem("de_ledger")   || "[]");
    } catch(e) { _payments={}; _payRecs={}; _owners=[]; _ledger=[]; }
  }

  return {
    loadAll, isConfigured, monthKey,
    getMonth, getAllData, markPaid, calcBalance, calcBalanceBefore,
    getOwners, getCurrentOwner, getFlatHistory,
    addOwner, updateOwner, transferOwnership, getEmail,
    getLedger, addLedgerEntry, deleteLedgerEntry,
  };
})();
