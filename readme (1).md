# Autopak POS System

## Project Overview
This is a Multi-Branch Point of Sale (POS) system for Autopak.  
It is deployed on Render (Backend + Frontend served from the same Express origin) and uses Neon PostgreSQL.

## Tech Stack
- **Frontend:** Vanilla JavaScript, HTML, CSS (No React, No Next.js, No Vite).
- **Backend:** Node.js, Express.js.
- **Database:** Neon PostgreSQL (via `pg` pool).
- **Auth & Terminal Security:**
  - User Auth: JWT tokens stored in `localStorage` (`X-Auth-Token` header).
  - Terminal Gate: `HttpOnly; SameSite=Strict` device cookie (`autopak_device`) validated against SHA-256 token hashes in Neon.

## Architecture & Folder Structure
```text
POS-system/
├── renderer/                     # FRONTEND
│   ├── index.html                # Main shell (loads all JS)
│   ├── enroll.html               # Standalone terminal authorization screen for un-enrolled browsers
│   ├── css/
│   ├── js/
│   │   ├── app.js                # App routing and sidebar (MUST load last)
│   │   ├── database.js           # Contains DB._fetch() wrapper
│   │   └── modules/              # Individual page logic (pos.js, products.js, settings.js, etc.)
│   └── templates/                # HTML templates fetched dynamically (settings.html, etc.)
│
└── backend/                      # BACKEND
    ├── server.js                 # Express entry point, device gate & static serving
    ├── database.js               # Neon DB pool & init (includes authorized_devices & enrollment tables)
    ├── middleware/
    │   ├── auth.js               # authMiddleware, adminOnly, deviceGate, getAuthorizedDevice, getClientIp
    │   └── errorHandler.js
    └── routes/                   # Modular API routes (authRoutes, deviceRoutes, settingsRoutes, salesRoutes, etc.)
```

## Terminal Enrollment & Access Control
To prevent unauthorized access from public browsers or personal phones on branch Wi-Fi at zero extra subscription cost:

1. **Closed Gate (`deviceGate` + `enroll.html`):**
   - Un-enrolled browsers visiting the Render URL are served `renderer/enroll.html` instead of `index.html`, so POS scripts and login forms are never exposed.
   - All `/api/*` routes (except `/api/devices/enroll`) require a valid `autopak_device` cookie checked against `authorized_devices` (`is_active = true`).
2. **Admin Self-Service (Settings > Authorized Terminals):**
   - Admins can generate 15-minute, single-use enrollment codes (`POS-XXXXXX`) scoped to a branch and terminal label (password-confirmed).
   - Admins can view active/revoked terminals (`last_seen_at`, branch, `This PC` indicator) and revoke any other terminal in one click (password-confirmed).
3. **First-Time Bootstrap:**
   - To enroll the very first admin terminal on a fresh database, insert a one-time code directly in Neon's SQL Editor:
     ```sql
     INSERT INTO device_enrollment_codes (code, branch_id, device_label, expires_at)
     VALUES ('BOOT-1001', 1, 'Admin Master Laptop', NOW() + INTERVAL '2 hours')
     ON CONFLICT (code) DO UPDATE
     SET used_at = NULL, expires_at = NOW() + INTERVAL '2 hours';
     ```

## Recent Fixes Applied
- **`backend/middleware/auth.js`:** Fixed `Authorization` header parsing (`split(' ')`), added `deviceGate` and `getAuthorizedDevice`, and fixed the `getAuthorizedDevice` typo.
- **`backend/server.js`:** Fixed `express-rate-limit` `windowMs` option, corrected the SPA fallback path to `../renderer/index.html`, and mounted `/api/devices` and the HTML gate ahead of `express.static`.
- **`renderer/js/modules/settings.js`:** Removed stray Node.js `require()` code, fixed `loadDevices()` variable references (`branches`, `devData`), and ensured `Settings` global capitalization in `onclick` handlers.
