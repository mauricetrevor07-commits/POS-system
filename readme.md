# Autopak POS System

## Project Overview

This is a Multi-Branch Point of Sale (POS) system for Autopak.  
It is deployed on Render (Backend + Frontend served from the same Express origin) and uses Neon PostgreSQL.

## Tech Stack

* **Frontend:** Vanilla JavaScript, HTML, CSS (No React, No Next.js, No Vite).
* **Backend:** Node.js, Express.js.
* **Database:** Neon PostgreSQL (via `pg` pool).
* **Auth & Terminal Security:**
  * User Auth: JWT tokens stored in `localStorage` (`X-Auth-Token` header).
  * Terminal Gate: `HttpOnly; SameSite=Strict` device cookie (`autopak_device`) validated against SHA-256 token hashes in Neon.

## Architecture & Folder Structure

```text
POS-system/
├── renderer/                     # FRONTEND
│   ├── index.html                # Main shell (loads all JS)
│   ├── enroll.html               # Standalone terminal authorization screen for un-enrolled browsers
│   ├── css/
│   ├── js/
│   │   ├── app.js                # App routing, sidebar badges & notification polling (MUST load last)
│   │   ├── database.js           # Contains DB._fetch() wrapper
│   │   └── modules/              # Individual page logic (pos.js, products.js, transfers.js, settings.js, etc.)
│   └── templates/                # HTML templates fetched dynamically (products.html, settings.html, etc.)
│
└── backend/                      # BACKEND
    ├── server.js                 # Express entry point, device gate & static serving
    ├── database.js               # Neon DB pool & init (branches, users, products, categories, transfers, devices)
    ├── middleware/
    │   ├── auth.js               # authMiddleware, adminOnly, deviceGate, getAuthorizedDevice, getClientIp
    │   └── errorHandler.js
    └── routes/                   # Modular API routes (authRoutes, deviceRoutes, branchRoutes, productRoutes, transferRoutes, notificationRoutes, settingsRoutes, salesRoutes, etc.)
```

## Key Features & Architecture

### 1. Terminal Enrollment & Access Control
To prevent unauthorized access from public browsers or personal phones on branch Wi-Fi at zero extra subscription cost:
* **Closed Gate (`deviceGate` + `enroll.html`):** Un-enrolled browsers visiting the Render URL are served `renderer/enroll.html` instead of `index.html`, and all `/api/*` routes (except `/api/devices/enroll`) require a valid `autopak_device` cookie checked against `authorized_devices` (`is_active = true`).
* **Admin Self-Service (Settings > Authorized Terminals):** Admins can generate 15-minute, single-use enrollment codes (`POS-XXXXXX`) scoped to a branch and terminal label (password-confirmed) and revoke terminals in one click.
* **First-Time Bootstrap:** To enroll the very first admin terminal on a fresh database, insert a one-time code directly in Neon's SQL Editor:
  ```sql
  INSERT INTO device_enrollment_codes (code, branch_id, device_label, expires_at)
  VALUES ('BOOT-1001', 1, 'Admin Master Laptop', NOW() + INTERVAL '2 hours')
  ON CONFLICT (code) DO UPDATE
  SET used_at = NULL, expires_at = NOW() + INTERVAL '2 hours';
  ```

### 2. Multi-Branch Stock Transfers & Admin Notifications
* **Receiving Branch Permissions:** Both the sending branch (`from_branch_id`) and receiving branch (`to_branch_id`)—as well as admins—can receive or cancel pending transfers.
* **Admin Arrival Alerts:** `GET /api/notifications/pending-count` returns both pending credit approvals (`count`) and unseen transfer arrivals/cancellations (`transfer_count`). `app.js` displays `#transferAlertBadge` on **Stock Transfers** and clears it via `PUT /api/transfers/mark-seen` when the admin opens the page.

### 3. Dynamic Product Categories & Flexible Parameters
* **Zero Hardcoding:** `product_categories` stores per-category `attributes_schema` (`JSONB`), and `products.attributes` (`JSONB`) stores each product's parameter values (e.g., Pipes with `Outer Diameter (mm)`, `Nominal Size (in)`, `PN Category`, `SDR Category`).
* **Admin Management:** From **Products > Categories**, admins can create, edit, and delete categories and their custom parameters; deleting a category leaves existing products and sales history intact.
* **Dynamic UI:** Category filters, the Add/Edit Product modal, Inventory search, and the Price Matrix tab all render dynamically from `product_categories`.

## Recent Fixes Applied

* **`backend/middleware/auth.js`:** Fixed `Authorization` header parsing (`split(' ')`), added `deviceGate` and `getAuthorizedDevice`, and fixed the `getAuthorizedDevice` typo.
* **`backend/server.js`:** Fixed `express-rate-limit` `windowMs` option, corrected the SPA fallback path to `../renderer/index.html`, removed duplicate `deviceRoutes` mounting, and placed `deviceGate` and the HTML gate ahead of `express.static`.
* **`backend/routes/branchRoutes.js`:** Exposed `GET /api/branches`, fixed `req.json` → `res.json`, fixed `waSetting.rows[0].values` → `value`, and removed the unused `puppeteer-core` import.
* **`backend/routes/transferRoutes.js`:** Fixed `POST /` `to_branch_id` column and `transfer_items` comma syntax, fixed `PUT /:id/cancel` `const transfer` bug, added `admin_seen` tracking, and added `PUT /mark-seen`.
* **`backend/routes/productRoutes.js`:** Added `/categories` CRUD endpoints and fixed `attributes` JSONB parameter binding in `POST /` and `PUT /:id`.
* **`renderer/js/app.js`:** Fixed boolean rendering on sidebar nav items (`badgeHTML`) and added `#transferAlertBadge` polling.
* **`renderer/js/modules/settings.js`:** Removed stray Node.js `require()` code, fixed `loadDevices()` (`branches`, `devData`), and fixed `Settings` capitalization.
* **`renderer/js/modules/products.js`:** Replaced hardcoded category filters/modals with dynamic `product_categories` & `attributes` support, added Edit/Delete category actions, and fixed `openCategoryModal()` quote/parenthesis typos and `saveCategoricalPricesMatrix()`.