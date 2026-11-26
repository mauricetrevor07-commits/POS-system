# Autopak POS System

## Project Overview
This is a Multi-Branch Point of Sale (POS) system for Autopak. 
It is currently deployed on Render (Backend + Frontend) and uses Neon PostgreSQL.

## Tech Stack
*   **Frontend:** Vanilla JavaScript, HTML, CSS. (No React, No Next.js, No Vite).
*   **Backend:** Node.js, Express.js.
*   **Database:** Neon PostgreSQL (via `pg` pool).
*   **Auth:** JWT tokens stored in `localStorage`.

## Architecture & Folder Structure
```text
POS-system/
├── renderer/                 # FRONTEND
│   ├── index.html            # Main shell (loads all JS)
│   ├── css/
│   ├── js/
│   │   ├── app.js            # App routing and sidebar (MUST load last)
│   │   ├── database.js       # Contains DB._fetch() wrapper
│   │   └── modules/          # Individual page logic (pos.js, products.js, etc.)
│   └── templates/            # HTML templates fetched dynamically
│
└── backend/                  # BACKEND
    ├── server.js             # Express entry point
    ├── database.js           # Neon DB pool & init
    ├── middleware/           # auth.js, errorHandler.js
    └── routes/               # Modular API routes (authRoutes, salesRoutes, etc.)