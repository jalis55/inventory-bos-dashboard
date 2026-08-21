# Inventory BOS — Admin Dashboard

A React + TypeScript dashboard for the [`inventory-bos`](https://github.com/jalis55/inventory-bos) FastAPI backend — a computer-accessories inventory & accounts system. Built with **Vite, Tailwind CSS, shadcn/ui (Radix primitives)**, **React Router**, and **Axios**.

## Highlights

- **Cookie-based auth** — the backend owns `access_token` / `refresh_token` **httpOnly** cookies; the frontend never touches tokens directly.
- **Automatic refresh + request queueing** (`src/lib/axios.ts`) — on a 401 the interceptor calls `POST /auth/refresh` once, queues concurrent 401s, retries them, and logs the user out client-side only if the refresh itself fails.
- **Route protection & RBAC** (`src/components/auth/ProtectedRoute.tsx`, `src/config/rbac.ts`) — sidebar nav, routes, and inline actions are filtered by role (`super_admin`, `admin`, `store_keeper`, `seller`).
- **Grouped sidebar** — Dashboard · **Product Setup** (Products, Categories, Brands, Product Variants) · Parties, Party Ledger, Payments · **Trade** (Purchases, Purchase Returns, Sales, Sales Returns) · **Reports** (Invoice Ledger, Purchase Returns, Sales Returns report) · Stock Movements, Users.
- **Invoice-wise payments** — pick a supplier/customer, switch between **Pay** and **Receive Refund / Refund Customers** modes, check invoices, set the amount (pre-filled at due, capped), and confirm — one payment per invoice, then an in-page Money Receipt / Payment Voucher / Refund Voucher prints.
- **In-page printing** — purchase invoices, credit notes, payment receipts and the invoice-ledger statement all render into a hidden container and print via `window.print()` (`src/utils/print.ts`) — no pop-up tabs.
- **Sales dialog shows only in-stock variants** — the variant picker lists items with `qty_in_stock > 0`, labeled with live stock.
- **Return editors** — Purchase Returns and Sales Returns share the same inline multi-invoice (block) flow: pick a party, add invoices/sales to the picker (manual id search), add items with **per-line reasons**, then **Record Return** auto-prints the credit note.
- **Lazy-loaded routes / code-splitting** — every page is a `React.lazy` chunk (`src/App.tsx`).

## Project structure

```
src/
├── api/            # one file per REST resource, thin wrappers over axios
├── components/
│   ├── auth/        ProtectedRoute, RequirePermission
│   ├── layout/       Sidebar (grouped, role-filtered, collapsible), Topbar, DashboardLayout
│   ├── common/        PageHeader, PageLoader, StatusBadge, ConfirmDialog, ...
│   ├── reports/       ReturnReport (shared searchable returns page)
│   └── ui/           shadcn/ui primitives (button, dialog, select, table, ...)
├── config/          rbac.ts (permission map), nav.ts (sidebar groups)
├── contexts/        AuthContext — session state, login/logout, silent /auth/me check
├── lib/             axios.ts (interceptor), utils.ts (cn)
├── pages/           one file per route/page (Dashboard, Products, Categories,
│                    Brands, ProductVariants, Parties, PartyLedger, Payments,
│                    Purchases, PurchaseReturns, Sales, SalesReturns,
│                    StockMovements, InvoiceLedger, PurchaseReturnsReport,
│                    SalesReturnsReport, Users, Account, Login, ...)
├── types/           shared TS interfaces matching the API schemas
└── utils/           invoice.ts, receipt.ts, ledgerDocument.ts (printers),
                     print.ts (in-page print helper)
```

## Getting started

### 1. Backend

Run `inventory-bos` first (see its README). For cookie auth in dev, the backend must allow your origin **with credentials** in `app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

`COOKIE_SECURE=False` for local HTTP; `True` behind HTTPS.

### 2. Install & run

```bash
npm install
npm run dev
```

Open http://localhost:5173 and log in with the super admin created via
`python -m app.scripts.create_super_admin` on the backend.

### 3. Build

```bash
npm run build
npm run preview
```

## How auth works end-to-end

1. **App load** — `AuthContext` calls `GET /auth/me` once; a valid access cookie means no login flash.
2. **Login** — `POST /auth/login` sets both cookies; `/auth/me` populates the user.
3. **Every call** goes through the shared `api` axios instance (`withCredentials: true`).
4. **Access token expires** — the next request 401s; the interceptor refreshes once and retries transparently.
5. **Refresh fails / expired** — a `session-expired` event clears the user and `ProtectedRoute` redirects to `/login`.
6. **Logout** — `POST /auth/logout` clears cookies; context clears client-side.

## Roles & permissions

Defined once in `src/config/rbac.ts` and mirrored from the backend (`app/api/deps.py`):

| Role           | Highlights                                                 |
| -------------- | ---------------------------------------------------------- |
| `seller` / `store_keeper` | View inventory/dashboard/stock; create sales; no master-data or user mgmt |
| `admin` / `super_admin`  | Full CRUD on master data, payments, returns; manage users   |

Dashboards pages for admin use; `payments:view` is read-only for sellers, `payments:manage` is manager-only.

## Common flows

- **Purchase → sell → return cycle.** Receive a purchase to create stock, sell via FIFO, take a customer return (restocks the same batch), and return goods to the supplier (only lines still in stock) — the Invoice Ledger report shows the full debit/credit story per invoice end to end.
- **Reports.** `Reports → Invoice Ledger` accepts one invoice number (reference or id) for a statement, or a supplier/customer id for their whole invoice-wise ledger. `Reports → Purchase Returns` / `Sales Returns` search by party id / name / email / phone and load data **only when you search**, with per-row print.