# Diamond Enclave — Setup Guide

Complete setup in 3 parts. Parts 1 and 2 are required. Part 3 is optional (adds cross-device sync later).

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

EmailJS lets the site send emails directly without any backend. Free plan = 200 emails/month.

### Step 1: Sign up at EmailJS
Go to https://www.emailjs.com and click **Sign Up** (free, no credit card).

### Step 2: Add an Email Service
1. In your EmailJS dashboard, click **"Email Services"** → **"Add New Service"**
2. Choose **Gmail**
3. Click **"Connect Account"** → sign in with your Gmail account
4. Name it anything (e.g. `Diamond Enclave`) → click **"Create Service"**
5. Copy the **Service ID** (looks like `service_xxxxxxx`) — save it

### Step 3: Create an Email Template
1. Click **"Email Templates"** → **"Create New Template"**
2. Set the template up as follows:

   - **To:** `{{to_email}}`
   - **Subject:** `{{subject}}`
   - **Content (HTML):** paste this exactly:
     ```html
     {{{message_html}}}
     ```
   - **From Name:** `Diamond Enclave`

3. Click **"Save"**
4. Copy the **Template ID** (looks like `template_xxxxxxx`) — save it

### Step 4: Get your Public Key
1. Click your account name (top right) → **"Account"**
2. Under **"Public Key"**, copy the key (looks like `aBcDeFgHiJkLmNoPq`)

### Step 5: Add credentials to config.js
1. Go to https://github.com/diamondenclave/diamondenclave
2. Click on **`config.js`** → click the **pencil (✏️) icon** to edit
3. Fill in the three EmailJS lines:
   ```js
   EMAILJS_SERVICE_ID:  "service_xxxxxxx",
   EMAILJS_TEMPLATE_ID: "template_xxxxxxx",
   EMAILJS_PUBLIC_KEY:  "aBcDeFgHiJkLmNoPq",
   ```
4. Scroll down → click **"Commit changes"** → **"Commit directly to main"** → **Commit changes**

The site auto-redeploys in ~1 minute. Email is now active!

---

## PART 3 — Google Sheets Backend (Optional — adds cross-device sync)

Skip this for now. Come back when Google Apps Script becomes accessible.

When ready:
1. Create a Google Sheet named `Diamond Enclave Payments`
2. Open **Extensions → Apps Script**
3. Paste the contents of `google-apps-script.js` → Save → Deploy as Web App (Execute as: Me, Access: Anyone)
4. Copy the Web App URL into `config.js`:
   ```js
   SHEET_URL: "https://script.google.com/macros/s/YOUR_ID/exec",
   ```
5. Commit the change — data will now sync across all devices automatically.

---

## Using the Portal

### Any visitor (public view)
- Browse months with ← → arrows
- See payment status per flat
- Download Excel report

### Admin
1. Click **"Admin Login"** → enter `DEAdmin`
2. **Mark Paid** → select date → receipt email is offered automatically
3. **✉ Send Bill** → preview bill → enter/confirm email → send
4. **✉ Manage Emails** → add or update email addresses for any flat
5. **Revoke** → undo a payment if entered incorrectly

---

## File Overview

```
diamondenclave/
├── index.html          ← Main page
├── style.css           ← Styles
├── config.js           ← ⭐ Edit this — EmailJS keys, password, Sheet URL
├── app.js              ← UI logic
├── sheets.js           ← Google Sheets sync (works even without Sheets)
├── email.js            ← EmailJS integration
└── google-apps-script.js ← For optional Sheets backend (not needed now)
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Emails not sending | Check EmailJS credentials in config.js |
| "EmailJS not configured" banner | Fill in all 3 EMAILJS_* fields in config.js |
| Data lost after clearing browser | Add Google Sheets later (Part 3) |
| Site not updating | Wait 2 min after committing; try Ctrl+Shift+R |
| EmailJS "template not found" | Make sure Template ID is copied correctly |

---

*Diamond Enclave Maintenance Portal — Hosted free on GitHub Pages.*
