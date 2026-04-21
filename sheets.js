// ============================================================
//  DIAMOND ENCLAVE — Airtable Data Layer v4
//  Tables: Payments, Owners, Ledger, ChargeHistory
// ============================================================
const Sheets = (() => {

  let _payments     = {};
  let _payRecs      = {};
  let _owners       = [];
  let _ledger       = [];
  let _chargeHistory= [];  // [{ id, flatId, charge, effectiveFrom }]

  // ── Helpers ───────────────────────────────────────────────
  function monthKey(y, m)     { return `${y}-${String(m).padStart(2,'0')}`; }
  function flatKey(y, m, fid) { return `${monthKey(y,m)}-${fid}`; }
  function isConfigured()     {
    return !!(CONFIG.AIRTABLE_TOKEN?.trim() && CONFIG.AIRTABLE_BASE_ID?.trim());
  }
  function _hdr()  { return {"Authorization":`Bearer ${CONFIG.AIRTABLE_TOKEN}`,"Content-Type":"application/json"}; }
  function _url(t) { return `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(t)}`; }
  async function _fetchAll(table) {
    let records=[], offset=null;
    do {
      const res  = await fetch(_url(table)+(offset?`?offset=${offset}`:""), {headers:_hdr()});
      const data = await res.json();
      if (data.error) throw new Error(JSON.stringify(data.error));
      records = records.concat(data.records||[]);
      offset  = data.offset||null;
    } while(offset);
    return records;
  }

  // ── LOAD ALL ──────────────────────────────────────────────
  async function loadAll() {
    _loadLocal();
    if (!isConfigured()) return;
    try {
      await Promise.all([_loadPayments(), _loadOwners(), _loadLedger(), _loadChargeHistory()]);
      _saveLocal();
    } catch(e) { console.warn("Airtable load failed:", e); }
  }

  async function _loadPayments() {
    const recs = await _fetchAll("Payments");
    _payments={}; _payRecs={};
    recs.forEach(rec => {
      const f  = rec.fields;
      const mk = monthKey(f.Year, f.Month);
      const fk = flatKey(f.Year, f.Month, f.FlatID);
      if (!_payments[mk]) _payments[mk]={};
      _payments[mk][f.FlatID] = {
        paid:      f.Status==="Paid",
        refused:   f.Status==="Refused",
        date:      f.PaymentDate||"",
        amount:    Number(f.AmountPaid)||0,
        reason:    f.Reason||"",
        recordId:  rec.id,
        ledgerRef: f.LedgerRef||"",
      };
      _payRecs[fk] = rec.id;
    });
  }

  async function _loadOwners() {
    const recs = await _fetchAll("Owners");
    _owners = recs.map(rec => ({
      id:      rec.id,
      flatId:  rec.fields.FlatID    ||"",
      name:    rec.fields.OwnerName ||"",
      email:   rec.fields.Email     ||"",
      phone:   rec.fields.Phone     ||"",
      moveIn:  rec.fields.MoveIn    ||"",
      moveOut: rec.fields.MoveOut   ||"",
      notes:   rec.fields.Notes     ||"",
    }));
  }

  async function _loadLedger() {
    const recs = await _fetchAll("Ledger");
    _ledger = recs.map(rec => ({
      id:          rec.id,
      date:        rec.fields.Date        ||"",
      type:        rec.fields.Type        ||"",
      amount:      Number(rec.fields.Amount)||0,
      description: rec.fields.Description ||"",
      addedBy:     rec.fields.AddedBy     ||"",
      createdAt:   rec.fields.CreatedAt   ||rec.fields.Date||"",
    }));
    // Sort: by date ASC, then createdAt ASC (insertion order for same day)
    _ledger.sort((a,b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  async function _loadChargeHistory() {
    try {
      const recs = await _fetchAll("ChargeHistory");
      _chargeHistory = recs.map(rec => ({
        id:            rec.id,
        flatId:        rec.fields.FlatID       ||"",
        charge:        Number(rec.fields.Charge)||500,
        effectiveFrom: rec.fields.EffectiveFrom||"",
      }));
    } catch(e) {
      console.warn("ChargeHistory table not found, using config defaults:", e);
      _chargeHistory = [];
    }
  }

  // ── CHARGE HISTORY ────────────────────────────────────────
  // Get the correct charge for a flat in a given month
  function getChargeForMonth(flatId, year, month) {
    const mk      = monthKey(year, month);
    const flat    = CONFIG.FLATS.find(f=>f.id===flatId);
    const baseChg = flat ? flat.charge : 500;
    if (!_chargeHistory.length) return baseChg;
    // Find most recent entry for this flat where effectiveFrom <= mk
    const relevant = _chargeHistory
      .filter(h => (h.flatId===flatId||h.flatId==="ALL") && h.effectiveFrom<=mk)
      .sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    return relevant.length ? relevant[0].charge : baseChg;
  }

  function getChargeHistory() { return [..._chargeHistory]; }

  async function addChargeEntry(flatId, charge, effectiveFrom) {
    const entry = { id:"pending_"+Date.now(), flatId, charge, effectiveFrom };
    _chargeHistory.push(entry);
    _saveLocal();
    if (!isConfigured()) return entry;
    try {
      const res  = await fetch(_url("ChargeHistory"), {
        method:"POST", headers:_hdr(),
        body:JSON.stringify({fields:{FlatID:flatId, Charge:Number(charge), EffectiveFrom:effectiveFrom}})
      });
      const data = await res.json();
      if (data.id) {
        const idx = _chargeHistory.findIndex(h=>h.id===entry.id);
        if (idx!==-1) _chargeHistory[idx] = {...entry, id:data.id};
        _saveLocal();
      }
    } catch(e) { console.warn("ChargeHistory write failed:", e); }
    return entry;
  }

  // ── PAYMENTS ─────────────────────────────────────────────
  function getMonth(y,m)  { return _payments[monthKey(y,m)]||{}; }
  function getAllData()    { return _payments; }

  // Check if a payment already exists for this flat+month
  function paymentExists(year, month, flatId) {
    const rec = (_payments[monthKey(year,month)]||{})[flatId];
    return rec && rec.paid;
  }

  async function markPaid(year, month, flatId, date, paid, amount) {
    const mk         = monthKey(year, month);
    const fk         = flatKey(year, month, flatId);
    const MONTHS_ARR = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];
    const flatCfg    = CONFIG.FLATS.find(f=>f.id===flatId)||{};
    const monthLabel = `${MONTHS_ARR[month-1]} ${year}`;

    // Always delete any existing auto-ledger entry for this flat+month first
    const existing = (_payments[mk]||{})[flatId];
    if (existing && existing.ledgerRef) {
      await deleteLedgerEntry(existing.ledgerRef);
    } else {
      const flatLabel = flatCfg.label||flatId;
      const match = _ledger.find(e =>
        e.addedBy&&e.addedBy.startsWith("Auto") &&
        e.description&&e.description.includes(flatLabel) &&
        e.description&&e.description.includes(monthLabel)
      );
      if (match) await deleteLedgerEntry(match.id);
    }

    if (!_payments[mk]) _payments[mk]={};
    _payments[mk][flatId] = { paid, refused:false, date:paid?date:"", amount:paid?Number(amount)||0:0, reason:"" };
    _saveLocal();

    let ledgerRef = null;
    if (paid) {
      const owner = getCurrentOwner(flatId, year, month);
      const desc  = `Maintenance collected — ${flatCfg.label||flatId}${owner?" ("+owner.name+")":""} · ${monthLabel}`;
      const entry = await addLedgerEntry({
        date:date, type:"Credit", amount:Number(amount)||0,
        description:desc, addedBy:"Auto (Payment)",
      });
      ledgerRef = entry.id;
      _payments[mk][flatId].ledgerRef = ledgerRef;
      _saveLocal();
    }

    if (!isConfigured()) return;
    try {
      const fields = {
        FlatID:flatId, Year:year, Month:month,
        Status:paid?"Paid":"Pending",
        PaymentDate:paid?date:"",
        AmountPaid:paid?Number(amount)||0:0,
        LedgerRef:ledgerRef||"",
        Reason:"",
      };
      const existId = _payRecs[fk];
      if (existId) {
        await fetch(`${_url("Payments")}/${existId}`,
          {method:"PATCH",headers:_hdr(),body:JSON.stringify({fields})});
      } else {
        const res  = await fetch(_url("Payments"),
          {method:"POST",headers:_hdr(),body:JSON.stringify({fields})});
        const data = await res.json();
        if (data.id) { _payRecs[fk]=data.id; _payments[mk][flatId].recordId=data.id; }
      }
      _saveLocal();
    } catch(e) { console.warn("Airtable payment write failed:", e); }
  }

  async function markRefused(year, month, flatId, reason) {
    const mk = monthKey(year, month);
    const fk = flatKey(year, month, flatId);
    // Delete any existing ledger entry
    const existing = (_payments[mk]||{})[flatId];
    if (existing&&existing.ledgerRef) await deleteLedgerEntry(existing.ledgerRef);
    if (!_payments[mk]) _payments[mk]={};
    _payments[mk][flatId] = { paid:false, refused:!!reason||true, date:"", amount:0, reason:reason||"Refused" };
    _saveLocal();
    if (!isConfigured()) return;
    try {
      const fields = {FlatID:flatId, Year:year, Month:month, Status:"Refused",
                      PaymentDate:"", AmountPaid:0, LedgerRef:"", Reason:reason||"Refused"};
      const existId = _payRecs[fk];
      if (existId) {
        await fetch(`${_url("Payments")}/${existId}`,
          {method:"PATCH",headers:_hdr(),body:JSON.stringify({fields})});
      } else {
        const res  = await fetch(_url("Payments"),
          {method:"POST",headers:_hdr(),body:JSON.stringify({fields})});
        const data = await res.json();
        if (data.id) { _payRecs[fk]=data.id; }
      }
      _saveLocal();
    } catch(e) { console.warn("Airtable refused write failed:", e); }
  }

  // ── BALANCE CALCULATION ───────────────────────────────────
  function calcBalance(flatId, upToYear, upToMonth) {
    let balance=0;
    const flat = CONFIG.FLATS.find(f=>f.id===flatId);
    if (!flat||flat.parking) return 0;
    const upToMk = monthKey(upToYear, upToMonth);
    // Count months from START to upToMonth (inclusive)
    let y=CONFIG.START_YEAR, m=CONFIG.START_MONTH;
    while (monthKey(y,m)<=upToMk) {
      const mk      = monthKey(y,m);
      const charge  = getChargeForMonth(flatId, y, m);
      const rec     = (_payments[mk]||{})[flatId];
      if (rec&&rec.paid) balance += (rec.amount||charge) - charge;
      else               balance -= charge;  // unpaid month = due
      m++; if(m>12){m=1;y++;}
    }
    return balance;
  }

  function calcBalanceBefore(flatId, year, month) {
    if (year===CONFIG.START_YEAR && month===CONFIG.START_MONTH) return 0;
    let m=month-1, y=year;
    if(m<1){m=12;y--;}
    return calcBalance(flatId, y, m);
  }

  // ── OWNERS ────────────────────────────────────────────────
  function getOwners()                  { return [..._owners]; }
  function getCurrentOwner(fid,y,m)     {
    const mk=monthKey(y,m);
    return _owners.find(o=>o.flatId===fid&&o.moveIn<=mk&&(!o.moveOut||o.moveOut>=mk))||null;
  }
  function getFlatHistory(fid) {
    return _owners.filter(o=>o.flatId===fid).sort((a,b)=>a.moveIn.localeCompare(b.moveIn));
  }
  function getEmail(flatId) {
    const now=new Date();
    const o=getCurrentOwner(flatId,now.getFullYear(),now.getMonth()+1);
    return o?o.email||"":"";
  }
  async function addOwner(data) {
    const opt={...data, id:"pending_"+Date.now()};
    _owners.push(opt); _saveLocal();
    if (!isConfigured()) return opt;
    try {
      const fields={FlatID:data.flatId,OwnerName:data.name,Email:data.email,
                    Phone:data.phone,MoveIn:data.moveIn,MoveOut:data.moveOut||"",Notes:data.notes||""};
      const res=await fetch(_url("Owners"),{method:"POST",headers:_hdr(),body:JSON.stringify({fields})});
      const d=await res.json();
      if(d.id){const i=_owners.findIndex(o=>o.id===opt.id);if(i!==-1)_owners[i]={...data,id:d.id};_saveLocal();}
    } catch(e){console.warn("Owner add failed:",e);}
    return opt;
  }
  async function updateOwner(recordId, updates) {
    const idx=_owners.findIndex(o=>o.id===recordId);
    if(idx!==-1){_owners[idx]={..._owners[idx],...updates};_saveLocal();}
    if(!isConfigured()||!recordId||recordId.startsWith("pending_")) return;
    try {
      const fields={};
      if(updates.name    !==undefined) fields.OwnerName  =updates.name;
      if(updates.email   !==undefined) fields.Email      =updates.email;
      if(updates.phone   !==undefined) fields.Phone      =updates.phone;
      if(updates.moveIn  !==undefined) fields.MoveIn     =updates.moveIn;
      if(updates.moveOut !==undefined) fields.MoveOut    =updates.moveOut;
      if(updates.notes   !==undefined) fields.Notes      =updates.notes;
      await fetch(`${_url("Owners")}/${recordId}`,{method:"PATCH",headers:_hdr(),body:JSON.stringify({fields})});
      _saveLocal();
    } catch(e){console.warn("Owner update failed:",e);}
  }
  async function transferOwnership(flatId, moveOutMk, newOwnerData) {
    const cur=getCurrentOwner(flatId,...moveOutMk.split("-").map(Number));
    if(cur) await updateOwner(cur.id,{moveOut:moveOutMk});
    return addOwner({...newOwnerData, flatId, moveOut:""});
  }

  // ── LEDGER ────────────────────────────────────────────────
  function getLedger()  { return [..._ledger]; }

  async function addLedgerEntry(entry) {
    const now = new Date().toISOString();
    const opt = {...entry, id:"pending_"+Date.now(), createdAt:now};
    _ledger.push(opt);
    // Re-sort after adding
    _ledger.sort((a,b)=>{
      const dc=a.date.localeCompare(b.date);
      return dc!==0?dc:a.createdAt.localeCompare(b.createdAt);
    });
    _saveLocal();
    if (!isConfigured()) return opt;
    try {
      const fields={Date:entry.date, Type:entry.type, Amount:Number(entry.amount),
                    Description:entry.description, AddedBy:entry.addedBy, CreatedAt:now};
      const res=await fetch(_url("Ledger"),{method:"POST",headers:_hdr(),body:JSON.stringify({fields})});
      const d=await res.json();
      if(d.id){
        const i=_ledger.findIndex(e=>e.id===opt.id);
        if(i!==-1) _ledger[i]={...opt,id:d.id};
        _saveLocal();
      }
      return _ledger.find(e=>e.id===d.id)||opt;
    } catch(e){console.warn("Ledger write failed:",e); return opt;}
  }

  async function deleteLedgerEntry(recordId) {
    _ledger=_ledger.filter(e=>e.id!==recordId); _saveLocal();
    if(!isConfigured()||!recordId||recordId.startsWith("pending_")) return;
    try { await fetch(`${_url("Ledger")}/${recordId}`,{method:"DELETE",headers:_hdr()}); }
    catch(e){console.warn("Ledger delete failed:",e);}
  }

  async function linkLedgerRef(flatId, year, month, ledgerRefId) {
    const mk=monthKey(year,month), fk=flatKey(year,month,flatId);
    if(_payments[mk]&&_payments[mk][flatId]){
      _payments[mk][flatId].ledgerRef=ledgerRefId; _saveLocal();
    }
    if(!isConfigured()) return;
    try {
      const existId=_payRecs[fk];
      if(existId) await fetch(`${_url("Payments")}/${existId}`,
        {method:"PATCH",headers:_hdr(),body:JSON.stringify({fields:{LedgerRef:ledgerRefId}})});
    } catch(e){console.warn("linkLedgerRef failed:",e);}
  }

  // ── FINANCIAL YEAR HELPERS ────────────────────────────────
  // FY starts 1 Apr, ends 31 Mar next year
  // FY 2026-27: Apr 2026 – Mar 2027
  function getCurrentFY() {
    const now=new Date(), y=now.getFullYear(), m=now.getMonth()+1;
    return m>=4 ? {start:`${y}-04`,end:`${y+1}-03`,label:`${y}-${String(y+1).slice(-2)}`}
                : {start:`${y-1}-04`,end:`${y}-03`,label:`${y-1}-${String(y).slice(-2)}`};
  }
  function getFYForDate(mk) {
    const [y,m]=mk.split("-").map(Number);
    return m>=4 ? {start:`${y}-04`,end:`${y+1}-03`,label:`${y}-${String(y+1).slice(-2)}`}
                : {start:`${y-1}-04`,end:`${y}-03`,label:`${y-1}-${String(y).slice(-2)}`};
  }
  function getLedgerForFY(fy) {
    return _ledger.filter(e=>e.date>=fy.start&&e.date<=fy.end+"-31");
  }

  // ── OPENING BALANCE ───────────────────────────────────────
  async function recordOpeningBalance() {
    const fy     = getCurrentFY();
    const prevFY = getFYForDate(`${fy.start.split("-")[0]-1}-04`);
    // Calculate closing balance of previous FY
    const prevEntries = getLedgerForFY(prevFY);
    let closing=0;
    prevEntries.forEach(e=>{ closing += e.type==="Credit"?e.amount:-e.amount; });
    // Check if opening balance already recorded for this FY
    const already = _ledger.find(e=>
      e.description&&e.description.includes(`Opening Balance FY ${fy.label}`)
    );
    if (already) { showToast&&showToast("Opening balance already recorded for this FY"); return; }
    await addLedgerEntry({
      date:  fy.start+"-01",
      type:  closing>=0?"Credit":"Debit",
      amount:Math.abs(closing),
      description:`Opening Balance FY ${fy.label} (carried from FY ${prevFY.label})`,
      addedBy:"Auto (FY)",
    });
  }

  // ── PURGE OLD DATA ────────────────────────────────────────
  async function purgeOldData() {
    const now=new Date(), y=now.getFullYear(), m=now.getMonth()+1;
    // Delete payments and ledger entries older than 2 years
    const cutoff=monthKey(y-2, m);
    let deleted=0;
    // Purge payments
    for(const [mk, monthData] of Object.entries(_payments)) {
      if(mk>=cutoff) continue;
      for(const [flatId, rec] of Object.entries(monthData)) {
        if(rec.recordId&&!rec.recordId.startsWith("pending_")) {
          try { await fetch(`${_url("Payments")}/${rec.recordId}`,{method:"DELETE",headers:_hdr()}); deleted++; }
          catch(e){}
        }
      }
      delete _payments[mk];
    }
    // Purge ledger entries older than 2 years
    const cutoffDate=`${y-2}-${String(m).padStart(2,"0")}`;
    const toDelete=_ledger.filter(e=>e.date<cutoffDate);
    for(const e of toDelete) {
      if(!e.id.startsWith("pending_")) {
        try { await fetch(`${_url("Ledger")}/${e.id}`,{method:"DELETE",headers:_hdr()}); deleted++; }
        catch(err){}
      }
    }
    _ledger=_ledger.filter(e=>e.date>=cutoffDate);
    _saveLocal();
    return deleted;
  }

  // ── localStorage ─────────────────────────────────────────
  function _saveLocal() {
    try {
      localStorage.setItem("de_payments",      JSON.stringify(_payments));
      localStorage.setItem("de_payrecs",       JSON.stringify(_payRecs));
      localStorage.setItem("de_owners",        JSON.stringify(_owners));
      localStorage.setItem("de_ledger",        JSON.stringify(_ledger));
      localStorage.setItem("de_chargehistory", JSON.stringify(_chargeHistory));
    } catch(e){}
  }
  function _loadLocal() {
    try {
      _payments      = JSON.parse(localStorage.getItem("de_payments")      ||"{}");
      _payRecs       = JSON.parse(localStorage.getItem("de_payrecs")       ||"{}");
      _owners        = JSON.parse(localStorage.getItem("de_owners")        ||"[]");
      _ledger        = JSON.parse(localStorage.getItem("de_ledger")        ||"[]");
      _chargeHistory = JSON.parse(localStorage.getItem("de_chargehistory") ||"[]");
    } catch(e){ _payments={}; _payRecs={}; _owners=[]; _ledger=[]; _chargeHistory=[]; }
  }

  return {
    loadAll, isConfigured, monthKey,
    getMonth, getAllData, markPaid, markRefused, paymentExists,
    calcBalance, calcBalanceBefore,
    getChargeForMonth, getChargeHistory, addChargeEntry,
    getOwners, getCurrentOwner, getFlatHistory,
    addOwner, updateOwner, transferOwnership, getEmail,
    getLedger, addLedgerEntry, deleteLedgerEntry, linkLedgerRef,
    getCurrentFY, getFYForDate, getLedgerForFY,
    recordOpeningBalance, purgeOldData,
  };
})();
