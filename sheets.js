// ============================================================
//  DIAMOND ENCLAVE — Airtable Data Layer
//  Replaces Google Sheets. No Apps Script needed.
//  Falls back to localStorage if Airtable is not configured.
// ============================================================

const Sheets = (() => {

  // In-memory cache: { "YYYY-MM": { "flatId": { paid, date, recordId } } }
  let _cache     = {};
  let _recordMap = {}; // flatKey -> Airtable record ID for updates

  // ── Helpers ───────────────────────────────────────────────

  function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function flatKey(year, month, flatId) {
    return `${year}-${String(month).padStart(2,'0')}-${flatId}`;
  }

  function isConfigured() {
    return CONFIG.AIRTABLE_TOKEN     && CONFIG.AIRTABLE_TOKEN.trim()    !== "" &&
           CONFIG.AIRTABLE_BASE_ID   && CONFIG.AIRTABLE_BASE_ID.trim()  !== "" &&
           CONFIG.AIRTABLE_TABLE     && CONFIG.AIRTABLE_TABLE.trim()    !== "";
  }

  function _headers() {
    return {
      "Authorization": `Bearer ${CONFIG.AIRTABLE_TOKEN}`,
      "Content-Type":  "application/json"
    };
  }

  function _baseURL() {
    const table = encodeURIComponent(CONFIG.AIRTABLE_TABLE);
    return `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${table}`;
  }

  // ── Load ALL records from Airtable ────────────────────────

  async function loadAll() {
    _loadFromLocal(); // always load local first for instant render

    if (!isConfigured()) return;

    try {
      let allRecords = [];
      let offset     = null;

      // Airtable paginates at 100 records — loop through all pages
      do {
        const url = _baseURL() + (offset ? `?offset=${offset}` : "");
        const res  = await fetch(url, { headers: _headers() });
        const data = await res.json();

        if (data.error) {
          console.warn("Airtable load error:", data.error);
          return;
        }

        allRecords = allRecords.concat(data.records || []);
        offset     = data.offset || null;
      } while (offset);

      // Parse records into cache
      _cache     = {};
      _recordMap = {};

      allRecords.forEach(rec => {
        const f  = rec.fields;
        const mk = monthKey(f.Year, f.Month);
        const fk = flatKey(f.Year, f.Month, f.FlatID);

        if (!_cache[mk]) _cache[mk] = {};
        _cache[mk][f.FlatID] = {
          paid:     f.Status === "Paid",
          date:     f.PaymentDate || "",
          recordId: rec.id
        };
        _recordMap[fk] = rec.id;
      });

      _saveToLocal();

    } catch(e) {
      console.warn("Airtable loadAll failed, using localStorage:", e);
    }
  }

  // ── Get month data ────────────────────────────────────────

  function getMonth(year, month) {
    return _cache[monthKey(year, month)] || {};
  }

  // ── Mark payment ──────────────────────────────────────────

  async function markPaid(year, month, flatId, date, paid) {
    const mk = monthKey(year, month);
    const fk = flatKey(year, month, flatId);

    if (!_cache[mk]) _cache[mk] = {};
    _cache[mk][flatId] = { paid, date: paid ? date : "" };
    _saveToLocal();

    if (!isConfigured()) return;

    try {
      const existingId = _recordMap[fk];
      const fields = {
        FlatID:      flatId,
        Year:        year,
        Month:       month,
        Status:      paid ? "Paid" : "Pending",
        PaymentDate: paid ? date : ""
      };

      if (existingId) {
        // Update existing record
        await fetch(`${_baseURL()}/${existingId}`, {
          method:  "PATCH",
          headers: _headers(),
          body:    JSON.stringify({ fields })
        });
      } else {
        // Create new record
        const res  = await fetch(_baseURL(), {
          method:  "POST",
          headers: _headers(),
          body:    JSON.stringify({ fields })
        });
        const data = await res.json();
        if (data.id) {
          _recordMap[fk]             = data.id;
          _cache[mk][flatId].recordId = data.id;
          _saveToLocal();
        }
      }
    } catch(e) {
      console.warn("Airtable write failed:", e);
    }
  }

  // ── localStorage fallback ─────────────────────────────────

  function _saveToLocal() {
    try {
      localStorage.setItem("de_payments",  JSON.stringify(_cache));
      localStorage.setItem("de_recordmap", JSON.stringify(_recordMap));
    } catch(e) {}
  }

  function _loadFromLocal() {
    try {
      const raw = localStorage.getItem("de_payments");
      _cache     = raw ? JSON.parse(raw) : {};
      const rm   = localStorage.getItem("de_recordmap");
      _recordMap = rm  ? JSON.parse(rm)  : {};
    } catch(e) { _cache = {}; _recordMap = {}; }
  }

  // ── Export full data ──────────────────────────────────────

  function getAllData() { return _cache; }

  return { loadAll, getMonth, markPaid, getAllData, isConfigured, monthKey };

})();
