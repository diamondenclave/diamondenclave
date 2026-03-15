// ============================================================
//  DIAMOND ENCLAVE — Configuration
//  Fill in the fields below after completing setup.
//  See SETUP.md for step-by-step instructions.
// ============================================================

const CONFIG = {

  // ── ADMIN ──────────────────────────────────────────────────
  ADMIN_PASSWORD: "DEAdmin",

  // ── EMAILJS (free — 200 emails/month) ──────────────────────
  // Sign up at https://www.emailjs.com
  EMAILJS_SERVICE_ID:  "",   // e.g. "diamondenclave"
  EMAILJS_TEMPLATE_ID: "",   // e.g. "template_xxxxxxx"
  EMAILJS_PUBLIC_KEY:  "",   // e.g. "aBcDeFgHiJkLmNoPq"

  // ── AIRTABLE (free — cross-device data sync) ────────────────
  // Sign up at https://airtable.com, then fill these in.
  // See SETUP.md → Part 3 for step-by-step instructions.
  AIRTABLE_TOKEN:   "",   // e.g. "patXXXXXXXXXXXXXX.XXXXXXXX..."
  AIRTABLE_BASE_ID: "",   // e.g. "appXXXXXXXXXXXXXX"
  AIRTABLE_TABLE:   "Payments",   // keep this as-is unless you rename the table

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
