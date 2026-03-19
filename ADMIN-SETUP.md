# Admin Form Setup (Free)

This enables non-coders to update events from a mobile form.

## 1) Deploy backend (Google Apps Script)

1. Go to [script.google.com](https://script.google.com) and create a new project.
2. Replace default code with:
   - `backend/google-apps-script/Code.gs`
3. In Apps Script: `Project Settings -> Script Properties`, add:
   - `ADMIN_PIN` (optional at first; you can also set first PIN from `admin.html`)
   - `SHEET_ID`
   - `SHEET_NAME` (example: `events`)
   - `DRIVE_ROOT_FOLDER_ID`
   - Or easier: run `setupScriptPropertiesOnce()` from `Code.gs` once (it fills all 4 values).
4. Deploy:
   - `Deploy -> New deployment -> Web app`
   - Execute as: `Me`
   - Access: `Anyone`
5. Copy Web App URL (`.../exec`).

## 2) Configure admin page

1. Open `assets/js/events-config.js`
2. Set `apiEndpoint` to your Apps Script Web App URL (`.../exec`)
3. Publish site (GitHub Pages)
4. Admin page and website both read from this one config

Admin URL:
- `https://<username>.github.io/<repo>/admin.html`

## 3) Non-coder flow

1. Open admin URL on phone
2. Enter PIN
3. Fill event fields
4. Upload poster
5. Submit
6. Homepage + Events page update automatically from backend feed

## 3A) First-time PIN and PIN change

- In `admin.html`, use **Set / Change PIN**.
- If no PIN exists, set first PIN directly (no old PIN needed).
- If PIN exists, old PIN is required to change.
- PIN must be at least 4 digits.

## 3B) Local laptop vs GitHub

- You can test on laptop first; GitHub is not mandatory for testing.
- Recommended local test command from repo root:
  - `powershell -NoProfile -Command "Set-Location 'C:\Users\apkuf\Downloads\Tact\Tact'; python -m http.server 8080"`
- Open:
  - `http://localhost:8080/admin.html`
  - `http://localhost:8080/index.html`
- For real public use on phone, publish to GitHub Pages (or any static hosting).

## 4) Sheet columns expected

The backend auto-creates columns if empty:
- `slug`, `title`, `date`, `time`, `location`, `status`, `teaser`, `homepageMatter`, `posterUrl`, `updatedAt`

## Important

- PIN is checked on backend (Apps Script), not trusted from frontend.
- Keep Apps Script URL private (do not post publicly).
- Change PIN periodically.
- The admin page verifies PIN first, then unlocks the form.
- Google Drive is used automatically through the Google account that owns the Apps Script deployment.
- You only need to set `DRIVE_ROOT_FOLDER_ID` once; posters are stored inside that Drive folder.
