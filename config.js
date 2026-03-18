// ============================================================
//  DIAMOND ENCLAVE — Configuration
// ============================================================
const CONFIG = {

  ADMIN_PASSWORD:     "DEAdmin",
  TREASURER_PASSWORD: "DET2026",

  EMAILJS_SERVICE_ID:  "",
  EMAILJS_TEMPLATE_ID: "",
  EMAILJS_PUBLIC_KEY:  "",

  // Airtable — 3 tables: Payments, Owners, Ledger
  AIRTABLE_TOKEN:   "patEKk5dOQ5Bz2FoJ",
  AIRTABLE_BASE_ID: "appiCieQ3AijrHoUe",

  // All flats + parking placeholders
  FLATS: [
    { id: "0A", label: "Flat 0A",  charge: 500, parking: false },
    { id: "0B", label: "Flat 0B",  charge: 500, parking: false },
    { id: "1A", label: "Flat 1A",  charge: 500, parking: false },
    { id: "1B", label: "Flat 1B",  charge: 500, parking: false },
    { id: "1C", label: "Flat 1C",  charge: 500, parking: false },
    { id: "2A", label: "Flat 2A",  charge: 500, parking: false },
    { id: "2B", label: "Flat 2B",  charge: 500, parking: false },
    { id: "3A", label: "Flat 3A",  charge: 500, parking: false },
    { id: "3B", label: "Flat 3B",  charge: 500, parking: false },
    { id: "G1", label: "Parking G1", charge: 0, parking: true },
    { id: "G2", label: "Parking G2", charge: 0, parking: true },
  ],

  START_YEAR:  2026,
  START_MONTH: 3,
};
