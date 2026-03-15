// ============================================================
//  DIAMOND ENCLAVE — Google Sheets Integration Layer
// ============================================================

const Sheets = (() => {

  // In-memory cache: { "YYYY-MM": { "flatId": { paid: bool, date: "YYYY-MM-DD" } } }
  let _cache = {};
  let _loaded = false;

  // ── Helpers ─────────────────────────────────────────────

  function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function isConfigured() {
    return CONFIG.SHEET_URL && CONFIG.SHEET_URL.trim() !== "";
  }

  // ── Load ALL data from sheet ─────────────────────────────

  async function loadAll() {
    if (!isConfigured()) {
      _loadFromLocal();
      _loaded = true;
      return;
    }
    try {
      const url = CONFIG.SHEET_URL + "?action=getAll";
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.records) {
        _cache = {};
        data.records.forEach(r => {
          const mk = monthKey(r.year, r.month);
          if (!_cache[mk]) _cache[mk] = {};
          _cache[mk][r.flatId] = { paid: r.paid === true || r.paid === "TRUE", date: r.date || "" };
        });
      }
      _loaded = true;
    } catch (e) {
      console.warn("Sheets load failed, using localStorage fallback:", e);
      _loadFromLocal();
      _loaded = true;
    }
  }

  // ── Get month data ───────────────────────────────────────

  function getMonth(year, month) {
    const mk = monthKey(year, month);
    return _cache[mk] || {};
  }

  // ── Mark payment ─────────────────────────────────────────

  async function markPaid(year, month, flatId, date, paid) {
    const mk = monthKey(year, month);
    if (!_cache[mk]) _cache[mk] = {};
    _cache[mk][flatId] = { paid, date: paid ? date : "" };

    // Persist locally always (fallback / offline)
    _saveToLocal();

    // If sheets configured, sync
    if (isConfigured()) {
      try {
        await fetch(CONFIG.SHEET_URL, {
          method: "POST",
          body: JSON.stringify({ action: "setRecord", year, month, flatId, paid, date: paid ? date : "" }),
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        console.warn("Sheets write failed:", e);
      }
    }
  }

  // ── localStorage fallback ────────────────────────────────

  function _saveToLocal() {
    try { localStorage.setItem("de_payments", JSON.stringify(_cache)); } catch(e) {}
  }

  function _loadFromLocal() {
    try {
      const raw = localStorage.getItem("de_payments");
      _cache = raw ? JSON.parse(raw) : {};
    } catch(e) { _cache = {}; }
  }

  // ── Export full data for Excel ───────────────────────────

  function getAllData() { return _cache; }

  return { loadAll, getMonth, markPaid, getAllData, isConfigured, monthKey };

})();
