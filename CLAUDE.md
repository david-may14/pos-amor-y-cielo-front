# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

POS (punto de venta) frontend for **Amor y Cielo** cafetería, Mérida, Yucatán. React + TypeScript SPA that talks to a Spring Boot backend at `http://localhost:8080`.

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:5173
npm run build      # production build
npm run preview    # preview production build
```

## Architecture

**Stack:** React 18, TypeScript, React Router v6, Tailwind CSS v3, Vite.

**`src/types/api.ts`** — Single source of truth for all API types, derived from `assets/backend-swagger.json`. Every request/response shape is typed here; import from here, never inline types.

**`src/api/`** — One file per resource (`ventas.ts`, `productos.ts`, etc.). Each function is a thin wrapper over `client.ts`. The base client handles JWT injection and 401 redirect automatically.

**Auth flow:** `POST /api/auth/login` returns `{ token, nombre, rol }`. Token stored in `localStorage` as `pos_token`, user as `pos_user`. `AuthContext` exposes `user`, `isAdmin`, `login`, `logout`. On 401, the client clears storage and redirects to `/login`.

**Routing:** Two roles — `ADMIN` and `BARISTA`. The `RequireAdmin` guard in `App.tsx` blocks `/productos`, `/ingredientes`, `/inventario`, `/usuarios` for baristers, redirecting to `/pos`.

**`publicDir: 'assets'`** in `vite.config.js` — the `assets/` folder is served at the root. Logo references: `/logo-cream.svg`, `/logo-dark.svg`, `/favicon.svg`.

## Brand

- Forest green: `#4d6335` (primary action, active nav)
- Cream: `#f6e2c1` (sidebar text, button text on green)
- Background: `#faf7f2` (warm off-white)
- Sidebar: `#2d3d1f` (deep forest)

Tailwind custom tokens: `forest`, `forest-dark`, `forest-deep`, `cream`, `surface`, `surface-muted`.

## Backend

Base URL: `http://localhost:8080`. Full spec in `assets/backend-swagger.json`. Key domains:

| Resource | Endpoints |
|---|---|
| Auth | `POST /api/auth/login` |
| Ventas | `GET/POST /api/ventas`, `GET /api/ventas/resumen` |
| Productos | CRUD `/api/productos`, recipe at `/api/productos/{id}/receta` |
| Ingredientes | CRUD `/api/ingredientes`, `GET /api/ingredientes/stock-bajo` |
| Inventario | `POST /api/inventario/compras`, `POST /api/inventario/ajustes`, `GET /api/inventario/movimientos` |
| Categorías | CRUD `/api/categorias` |
| Usuarios | CRUD `/api/usuarios`, `PATCH /api/usuarios/{id}/password` |
