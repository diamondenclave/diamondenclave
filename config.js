// ============================================================
//  DIAMOND ENCLAVE — Configuration
//  Step 1: Fill in EMAILJS_* fields after signing up at emailjs.com
//  Step 2 (optional later): Fill in SHEET_URL for cross-device data sync
// ============================================================

const CONFIG = {

  // ── ADMIN ──────────────────────────────────────────────────
  ADMIN_PASSWORD: "DEAdmin",

  // ── EMAILJS (free — 200 emails/month) ──────────────────────
  // Sign up at https://www.emailjs.com, then fill these in.
  // See SETUP.md → Part 3 for step-by-step instructions.
  EMAILJS_SERVICE_ID:  "diamondenclave",   // e.g. "service_xxxxxxx"
  EMAILJS_TEMPLATE_ID: "template_7rpi1ts",   // e.g. "template_xxxxxxx"
  EMAILJS_PUBLIC_KEY:  "vSdCkNFabN9aUlHwG",   // e.g. "aBcDeFgHiJkLmNoPq"

  // ── GOOGLE SHEETS (optional — enables cross-device sync) ───
  // Leave blank to use localStorage (data stays on this device).
  // Fill in later when Google Apps Script becomes available.
  SHEET_URL: "",   // e.g. "https://script.google.com/macros/s/XXXX/exec"

  // ── FLATS DATA ─────────────────────────────────────────────
  FLATS: [
    { id: "0A", owner: "Joyshree Sil",         charge: 600  },
    { id: "0B", owner: "Mitra Guha",            charge: 400  },
    { id: "1A", owner: "Dilip Kundu",           charge: 450  },
    { id: "1B", owner: "Aloke Kundu",           charge: 400  },
    { id: "1C", owner: "Jharna Gupta",          charge: 700  },
    { id: "2A", owner: "Mandira Kundu",         charge: 900  },
    { id: "2B", owner: "Sarabajit Mukherjee",   charge: 700  },
    { id: "3A", owner: "Apurba Kundu",          charge: 900  },
    { id: "3B", owner: "Sanjeeb Goldar",        charge: 700  },
  ],

  // ── TRACKER START ───────────────────────────────────────────
  START_YEAR:  2026,
  START_MONTH: 3,   // March = 3

};
