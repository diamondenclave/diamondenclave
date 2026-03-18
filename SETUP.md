# Diamond Enclave — Setup Guide

---

## PART 1 — GitHub Pages (5 min)

1. Go to https://github.com/diamondenclave/diamondenclave
2. **Add file → Upload files** — upload all 8 files:
   `index.html`, `style.css`, `config.js`, `app.js`,
   `sheets.js`, `email.js`, `treasurer.js`, `owners.js`
3. Commit message: `Full system update` → **Commit changes**
4. **Settings → Pages → Branch: main / (root) → Save**
5. Wait 2 min → live at **https://diamondenclave.github.io/diamondenclave/**

---

## PART 2 — Airtable Setup (10 min)

Sign up free at https://airtable.com → Create a base named **Diamond Enclave**.

### Table 1: Payments
| Field Name | Type |
|---|---|
| FlatID | Single line text |
| Year | Number (0 decimals) |
| Month | Number (0 decimals) |
| Status | Single line text |
| PaymentDate | Single line text |
| AmountPaid | Number (0 decimals) |
| LedgerRef | Single line text |

### Table 2: Owners
| Field Name | Type |
|---|---|
| FlatID | Single line text |
| OwnerName | Single line text |
| Email | Single line text |
| Phone | Single line text |
| MoveIn | Single line text |
| MoveOut | Single line text |
| Notes | Single line text |

### Table 3: Ledger
| Field Name | Type |
|---|---|
| Date | Single line text |
| Type | Single line text |
| Amount | Number (0 decimals) |
| Description | Single line text |
| AddedBy | Single line text |

### Get credentials
- **Base ID**: from browser URL → `appXXXXXXXXXXXXXX`
- **Token**: https://airtable.com/create/tokens
  - Scopes: `data.records:read` + `data.records:write`
  - Access: Diamond Enclave base
  - Copy token (shown only once, starts with `pat`)

### Add to config.js on GitHub
```js
AIRTABLE_TOKEN:   "patXXXXXXXXXXX...",
AIRTABLE_BASE_ID: "appXXXXXXXXXXXX",
```

---

## PART 3 — EmailJS (10 min)

1. Sign up at https://www.emailjs.com
2. **Email Services → Add New Service → Gmail** → connect `enclavediamond@gmail.com`
   → note the **Service ID**
3. **Email Templates → Create New Template**
   - Subject: `{{subject}}`
   - To Email: `{{to_email}}`
   - From Name: `Diamond Enclave`
   - Content (HTML editor): `{{{message_html}}}`
   → Save → note **Template ID**
4. **Account → Public Key** → copy it
5. Add to config.js on GitHub:
```js
EMAILJS_SERVICE_ID:  "diamondenclave",
EMAILJS_TEMPLATE_ID: "template_xxxxxxx",
EMAILJS_PUBLIC_KEY:  "your_key_here",
```

---

## First-time data entry

After going live, login as **Admin** → go to **Owners tab** → add all current owners:
- For each flat, click **+ Add Owner**
- Enter name, email, phone
- Set **Move-in month** (e.g. 2026-03 for March 2026)

Then go to **Payments tab** → enter any payments already made for March 2026,
entering the **actual amount paid** (e.g. ₹600, ₹900 etc.) — the system will
auto-calculate running balances for each flat.

---

## Passwords
| Role | Password |
|---|---|
| Admin | `DEAdmin` |
| Treasurer | `DET2026` |

---

## Tabs overview
| Tab | Who can access | What it does |
|---|---|---|
| 💳 Payments | Everyone (view) / Admin (edit) | Monthly payment tracking |
| 📒 Treasurer | Admin + Treasurer | Debit/credit ledger, per-flat balances |
| 👤 Owners | Admin only | Owner registry, history, transfers |

---

## Airtable — what gets stored where
| Data | Table |
|---|---|
| Monthly payment status + amount paid | Payments |
| Owner name, email, phone, move-in/out | Owners |
| Expense and income entries | Ledger |

---

## Troubleshooting
| Problem | Fix |
|---|---|
| Banner shows "Airtable not connected" | Check AIRTABLE_TOKEN and BASE_ID in config.js |
| Table columns not found | Make sure column names match exactly (case-sensitive) |
| Emails not sending | Check all 3 EMAILJS_* fields |
| Balance seems wrong | Check AmountPaid is filled for past payments |
| Site not updating | Wait 2 min after commit, then Ctrl+Shift+R |
