# Diamond Enclave — Setup Guide

Complete setup in 3 parts. Parts 1 and 2 are required. Part 3 adds cross-device sync.

---

## PART 1 — Upload & Host on GitHub Pages (~5 minutes)

### Step 1: Go to your repository
Open https://github.com/diamondenclave/diamondenclave and log in.

### Step 2: Upload all files
1. Click **"Add file"** → **"Upload files"**
2. Drag and drop ALL of these files:
   - `index.html`
   - `style.css`
   - `config.js`
   - `app.js`
   - `sheets.js`
   - `email.js`
3. Write commit message: `Initial upload`
4. Click **"Commit changes"**

### Step 3: Enable GitHub Pages
1. Click the **Settings** tab in your repository
2. In the left sidebar click **"Pages"**
3. Under **Source** → select **"Deploy from a branch"**
4. Under **Branch** → select **`main`** → folder **`/ (root)`** → click **Save**
5. Wait ~2 minutes → your site will be live at:

   **https://diamondenclave.github.io/diamondenclave/**

---

## PART 2 — Set Up EmailJS for Bill & Receipt Emails (~10 minutes)

### Step 1: Sign up
Go to https://www.emailjs.com → click **Sign Up** (free, no credit card).

### Step 2: Add Gmail service
1. Click **"Email Services"** → **"Add New Service"**
2. Choose **Gmail**
3. Click **"Connect Account"** → sign in with `enclavediamond@gmail.com`
4. Name: `Diamond Enclave` — note the **Service ID** shown (e.g. `diamondenclave`)
5. Tick **"Send test email to verify"** → click **"Create Service"**

### Step 3: Create email template
1. Click **"Email Templates"** → **"Create New Template"**
2. Fill in:
   - **Subject:** `{{subject}}`
   - **To Email:** `{{to_email}}`
   - **From Name:** `Diamond Enclave`
   - **Content:** click **"Edit Content"** → switch to HTML → delete everything → paste: `{{{message_html}}}`
3. Click **"Save"** → note the **Template ID** (e.g. `template_xxxxxxx`)

### Step 4: Get Public Key
1. Click your avatar (top right) → **"Account"**
2. Copy the **Public Key** shown

### Step 5: Add to config.js on GitHub
1. Go to https://github.com/diamondenclave/diamondenclave
2. Click **`config.js`** → click pencil ✏️ icon
3. Fill in:
```js
EMAILJS_SERVICE_ID:  "diamondenclave",
EMAILJS_TEMPLATE_ID: "template_xxxxxxx",
EMAILJS_PUBLIC_KEY:  "your_public_key_here",
```
4. Click **"Commit changes"** → **"Commit directly to main"** → Commit

---

## PART 3 — Set Up Airtable for Cross-Device Sync (~10 minutes)

Airtable stores payment data in the cloud so any device can see it.
Free plan = 1,000 records = ~9 years for a 9-flat building.

### Step 1: Sign up
Go to https://airtable.com → click **"Sign up for free"** (no credit card needed).

### Step 2: Create a new Base
1. On your Airtable home, click **"+ Create a base"**
2. Choose **"Start from scratch"**
3. Name it: `Diamond Enclave`
4. Click **"Create base"**

### Step 3: Set up the Payments table
You will see a default table called "Table 1". Rename it:
1. Click the tab that says **"Table 1"** → click the **dropdown arrow** next to it
2. Click **"Rename"** → type `Payments` → press Enter

Now set up the columns exactly as follows. Delete any existing columns first (right-click → delete field), then create these:

| Field Name | Field Type |
|---|---|
| `FlatID` | Single line text |
| `Year` | Number |
| `Month` | Number |
| `Status` | Single line text |
| `PaymentDate` | Single line text |

To add each field: click the **"+"** button at the end of the column headers.

### Step 4: Get your Base ID
1. With your base open, look at the browser URL — it looks like:
   `https://airtable.com/appXXXXXXXXXXXXXX/...`
2. Copy the part that starts with **`app`** — that is your **Base ID**
   e.g. `appAb12Cd34Ef56Gh`

### Step 5: Create a Personal Access Token
1. Go to https://airtable.com/create/tokens
2. Click **"+ Create new token"**
3. Fill in:
   - **Name:** `Diamond Enclave Token`
   - **Scopes:** click **"+ Add a scope"** → add these two:
     - `data.records:read`
     - `data.records:write`
   - **Access:** click **"+ Add a base"** → select `Diamond Enclave`
4. Click **"Create token"**
5. **Copy the token immediately** — it starts with `pat` and is very long.
   ⚠️ You cannot see it again after closing this page!

### Step 6: Add to config.js on GitHub
1. Go to https://github.com/diamondenclave/diamondenclave
2. Click **`config.js`** → click pencil ✏️ icon
3. Fill in:
```js
AIRTABLE_TOKEN:   "patXXXXXXXXXXXXXX.XXXXXXXX...",
AIRTABLE_BASE_ID: "appXXXXXXXXXXXXXX",
AIRTABLE_TABLE:   "Payments",
```
4. Click **"Commit changes"** → **"Commit directly to main"** → Commit
5. Wait 1 minute → hard refresh portal with **Ctrl+Shift+R**

Data now syncs across all devices in real time! ✅

---

## Using the Portal

### Any visitor (public view)
- Browse months with ← → arrows
- See payment status per flat
- Download Excel report

### Admin (password: DEAdmin)
1. Click **"Admin Login"** → enter `DEAdmin`
2. **Mark Paid** → select date → receipt email offered automatically
3. **✉ Send Bill** → preview → confirm email → send
4. **✉ Manage Emails** → add/update email for each flat owner
5. **Revoke** → undo a payment entered by mistake

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Emails not sending | Check all 3 EmailJS fields in config.js |
| EmailJS error 422 | Make sure To Email field in template is `{{to_email}}` |
| Data not syncing across devices | Check Airtable token and Base ID in config.js |
| Airtable error in console | Make sure all 5 column names match exactly (case-sensitive) |
| Site not updating after commit | Wait 2 min, then Ctrl+Shift+R |
| Data lost after clearing browser | Complete Airtable setup — it will restore from cloud |

---

## File Overview

```
diamondenclave/
├── index.html   ← Main page
├── style.css    ← Styles
├── config.js    ← ⭐ Edit this — all credentials go here
├── app.js       ← UI logic
├── sheets.js    ← Airtable sync layer
└── email.js     ← EmailJS integration
```

---
*Diamond Enclave Maintenance Portal — Hosted free on GitHub Pages.*
