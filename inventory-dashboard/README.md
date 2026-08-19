# Inventory BOS — Admin Dashboard

A React + TypeScript dashboard for the [`inventory-bos`](https://github.com/jalis55/inventory-bos) FastAPI backend.
Built with **Vite, Tailwind CSS, shadcn/ui (Radix primitives)**, **React Router**, and **Axios**.

## Highlights

- **Cookie-based auth**, matched to the backend: the API sets httpOnly `access_token` /
  `refresh_token` cookies. The frontend never touches tokens directly — it can't, and shouldn't.
- **Axios interceptor with automatic refresh + request queueing** (`src/lib/axios.ts`): on any
  401 (except from `/auth/login|refresh|logout` themselves), it calls `POST /auth/refresh` once,
  queues any other requests that 401'd while the refresh was in flight, then retries them all.
  If refresh itself fails, it fires a `session-expired` event that logs the user out client-side.
- **Route protection** (`src/components/auth/ProtectedRoute.tsx`): blocks rendering until the
  initial `/auth/me` session check resolves, redirects unauthenticated users to `/login`
  (preserving where they were headed), and redirects users without the right role to
  `/unauthorized`.
- **RBAC config** (`src/config/rbac.ts`): a single source of truth for permissions mirroring the
  backend's roles (`super_admin`, `admin`, `store_keeper`, `seller`), used to filter sidebar nav,
  guard whole routes, and hide/show inline actions (`<RequirePermission>`) — e.g. only
  admin/super_admin see Create/Edit/Delete buttons on inventory pages, and only they can reach
  `/users` at all.

## Project structure

```
src/
├── api/            # one file per REST resource, thin wrappers over axios
├── components/
│   ├── auth/        ProtectedRoute, RequirePermission
│   ├── layout/       Sidebar (role-filtered nav), Topbar, DashboardLayout
│   ├── common/        SimpleResourceManager (generic CRUD table+dialog for
│   │                   categories/companies/variants), PageHeader, ConfirmDialog...
│   └── ui/           shadcn/ui primitives (button, dialog, select, table, ...)
├── config/          rbac.ts, nav.ts
├── contexts/        AuthContext — session state, login/logout, silent /auth/me check
├── lib/             axios.ts (the interceptor), utils.ts (cn helper)
├── pages/           LoginPage, DashboardHome, ProductsPage, CategoriesPage,
│                    CompaniesPage, ProductVariantsPage, UsersPage, AccountPage,
│                    UnauthorizedPage, NotFoundPage
└── types/           shared TS interfaces matching the API schemas
```

## Getting started

### 1. Backend prerequisites

Run `inventory-bos` first (see its own README). Two things to double-check on the backend for
cookie auth to work cross-origin in dev:

- CORS must allow your frontend origin **with credentials**, e.g. in `app/main.py`:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
  `allow_origins=["*"]` will NOT work together with credentialed cookies — browsers reject it.
- Keep `COOKIE_SECURE=False` for local HTTP dev; set it to `True` behind HTTPS in production.

### 2. Install & configure the dashboard

```bash
npm install
cp .env.example .env   # set VITE_API_URL if your API isn't on 127.0.0.1:8000
npm run dev
```

Open http://localhost:5173. Log in with the super admin created via
`python -m app.scripts.create_super_admin` on the backend.

### 3. Build

```bash
npm run build
npm run preview
```

## How the auth flow works end-to-end

1. **App load** — `AuthContext` calls `GET /auth/me` once. If the browser is holding a valid
   `access_token` cookie, this succeeds silently and the user is considered logged in — no
   flash of the login page.
2. **Login** — `POST /auth/login` sets both cookies, then `GET /auth/me` populates the user in
   context.
3. **Every subsequent API call** goes through the shared `api` axios instance
   (`withCredentials: true`), so cookies ride along automatically.
4. **Access token expires (15 min default)** — the next request 401s. The interceptor catches it,
   calls `POST /auth/refresh` (sends the refresh cookie, gets fresh cookies back), then retries
   the original request. The caller never sees the 401.
5. **Refresh token expires or is invalid (7 days default, or after logout elsewhere)** — the
   refresh call itself 401s. The interceptor gives up, dispatches a `session-expired` event,
   `AuthContext` clears the user, and `ProtectedRoute` redirects to `/login`.
6. **Logout** — `POST /auth/logout` clears both cookies server-side; context clears client-side.

## Roles reference

| Role | Sidebar / routes | Inventory CRUD | Users |
|---|---|---|---|
| `seller` / `store_keeper` | Dashboard, Products, Categories, Companies, Variants | read-only | no access |
| `admin` | + Users | full CRUD | create/edit store_keeper & seller |
| `super_admin` | + Users | full CRUD | create/edit any role except super_admin |

Adjust `src/config/rbac.ts` if the backend's role rules ever change — it's the only place UI
permissions are defined.
