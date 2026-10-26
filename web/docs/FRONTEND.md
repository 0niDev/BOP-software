# Frontend

The client is a React 19 single-page application built with Vite 8 and Tailwind
CSS v4. It holds no business rules: every figure on screen comes from the API,
and every action is one API call.

## Bootstrap and routing

- `index.html` mounts `#root`; `main.tsx` renders `<App/>` in `StrictMode` and
  imports the single stylesheet.
- **There is no client-side router.** `App.tsx` keeps the current `Page` in
  state and switches on it, so a browser reload always returns to the Dashboard.
  The URL is only meaningful for the SPA fallback in production.
- **Authentication gate**: `App` reads `bop-erp.token` and `bop-erp.user` from
  `localStorage`. Without both it renders `LoginPage` (always in the dark
  palette); with them it renders `Layout` and the current page. Logout clears
  both keys.
- `Page` is a union of 15 ids: `dashboard`, `sales`, `purchases`, `parties`,
  `items`, `payments`, `manufacturing`, `expenses`, `banking`, `returns`,
  `assets`, `accounts`, `reports`, `users`, `settings`.
- Sidebar order is defined by `NAV_SECTIONS` in
  `components/layout/Sidebar.tsx`, grouped as Overview, Sales & Purchasing,
  Inventory & Production, Accounting, Master data, Insights, Administration.
  **The flat order matters**: module-jump shortcuts index it, and the browser
  audit asserts `Ctrl+2` = Sales Invoices and `Ctrl+6` = Manufacturing.

## API layer

`src/api.ts` is the only module that calls `fetch`.

- `request<T>` sends JSON (`Content-Type: application/json` when there is a
  body), attaches `Authorization: Bearer <token>`, parses JSON and throws
  `ApiError(message, status, code)` on failure. `requestText` and `requestBlob`
  do the same for CSV/text and binary downloads.
- **Expired sessions**: on a `401` from a normal endpoint, the token is cleared
  and `window.location.replace(...)` re-mounts the app on the login page.
  `/api/auth/login` and `/api/auth/change-password` are exempt, so a wrong
  password shows inline instead of reloading.
- Each endpoint has a typed method (`api.salesInvoices(search)`,
  `api.createSalesInvoice(body)`, `api.trialBalanceXlsx(from, to)` …), grouped
  by module. Response types live in `src/types.ts` and mirror the JSON actually
  returned (snake_case fields for database rows).
- Pages catch `ApiError` and show `err.message` (the server's human-readable
  message) in an inline `.error` block; successful writes show a `.badge`
  notice. There is no toast system.

## State and data flow

There is **no global store** (no Redux/Zustand/React Query). The pattern is
deliberate and uniform:

1. A page holds its own data in `useState` and loads what it needs in
   `useEffect` on mount (some pages load several collections in parallel).
2. Master-data pickers (`SearchableSelect`) are fed from these collections;
   pages that only need a list fetch it directly.
3. A successful create/update re-fetches the affected list (or merges the
   response) and clears the form; failures leave the form intact.
4. Search/filter state is local. `FilterBox` filters rows in memory
   (case-insensitive substring over the visible columns) — it never re-queries
   the server. The invoice lists also support server-side `search`/`limit`.
5. Cross-page state is limited to the theme (via `data-theme`), the current
   page, and the session in `localStorage`.

Dashboard data is one payload fetched on mount; a manual refresh button
re-fetches it.

## Design system

`src/styles.css` is both the Tailwind entry and the ERP component layer.

- **Tailwind v4 utilities only; preflight is deliberately not imported.**
  Fifteen module screens rely on the unlayered element rules in that file
  (`button`, `input`, `table`, `h1`/`h2`, …). Importing a global reset would
  restyle all of them. New shell/dashboard UI uses utilities; anything driven by
  an element rule keeps a class (`.icon-btn`, `.sort-btn`, `.num`, `.pill`,
  `.meter`, `.menu`, `.thumb`, `.search-field`). Unlayered CSS outranks the
  utility layer, which is why `!important` is not needed.
- **Tokens**: `:root` is the dark palette; `:root[data-theme="light"]` is the
  light one (slate surface, royal blue, teal, amber). They are re-exported to
  Tailwind via `@theme inline`, so `bg-surface`, `text-muted`, `border-line`,
  `rounded-card`, `shadow-float` follow the appearance setting. Status colours
  have `-ink` variants so 12 px labels meet WCAG AA in both themes.
- **Type**: Plus Jakarta Sans, self-hosted in `client/public/fonts` (no runtime
  font fetch, no console errors offline). Numeric cells use `.num` (tabular
  figures, right aligned).
- **Motion**: Framer Motion drives entrance animations (`Card`, `StaggerGroup`,
  `StaggerItem`); everything is skipped under `prefers-reduced-motion` (both the
  JS path via `useReducedMotion` and the CSS fallback).
- **Charts**: Recharts inside `ChartFrame`, which owns the fixed height a
  `ResponsiveContainer` needs.

### Component inventory

| Component | Purpose |
| --- | --- |
| `ui/Card` | Dashboard surface: title/subtitle/action, optional accent outline |
| `ui/StatCard` | KPI tile with label, value, delta and icon |
| `ui/StatusPill`, `ui/DeltaPill` | Status tags and up/down deltas |
| `ui/ProgressMeter` | 0–100 share bar |
| `ui/Avatar` | Initials tile |
| `ui/DataTable` | Shared table shell (sorting hooks, headers) |
| `ui/ChartFrame` | Fixed-height chart container |
| `ui/motion` | `StaggerGroup` / `StaggerItem` wrappers |
| `layout/Layout` | Shell, shortcut binding, module finder, scroll reset |
| `layout/Sidebar` | Sectioned navigation, mobile drawer, footer hint |
| `layout/TopBar` | Module search, “new sales invoice” shortcut, notification feed, user menu, logout |
| `SearchableSelect` | The app's replacement for every `<select>` |
| `FilterBox` | Live in-page table filter (`data-search`) |
| `dashboard/*` | Activity list, alerts, best sellers, customer donut, expiring/low stock tables, revenue chart, profile drawer |

### SearchableSelect

A native `<select>` cannot filter, and this ERP has lists with hundreds of
items, so every picker is a combobox: one input shows the choice and doubles as
the search box, with a filtered option panel.

- Opens on focus/typing; `ArrowUp`/`ArrowDown` move the highlight, `Enter`
  chooses, `Escape` closes, clicking outside closes and clears the query.
- Options are chosen on `mousedown` (prevented default) so the input's blur does
  not beat the click.
- The panel is `position: fixed` with `z-index: 9999`, so a card's
  `overflow: hidden`/`auto` cannot clip it. It is **always positioned by
  `lib/useAnchoredPosition`**, never by CSS percentages: with fixed positioning
  those resolve against the viewport (a `min-width: 100%` panel once stretched
  to the full window width). The hook measures the trigger each time it opens
  and on resize/any scroll (capture phase), matches the trigger width, clamps to
  the viewport, and flips above the trigger when there is more room there.
- The same hook anchors the row-action menu and the notification feed with
  `align: "right"` and a 210 px minimum width.

## Theme

`src/theme.ts` maps the stored `APPEARANCE.theme_name` to the `data-theme`
attribute on `<html>`:

| Setting | Result |
| --- | --- |
| `dark` (default) | Dark palette |
| `light` | Light palette |
| `system` | Follows `prefers-color-scheme`, and switches live while the app is open |
| `custom` | Falls back to the dark palette (the desktop app's custom colours are not ported) |

The signed-out login screen always uses dark. `applyTheme` also writes
`data-theme-source`, which lets the OS-preference listener know whether it
should react.

## Keyboard shortcuts

`src/shortcuts.ts` binds the desktop app's action ids to sequences loaded from
the server (`GET /api/settings/shortcuts`), with defaults as fallback. A
module-level cache avoids a request per keypress; `shortcutsChanged()` clears it
and dispatches `bop-erp:shortcuts-changed`.

Live in the browser (`Layout`):

| Action | Default | Behaviour |
| --- | --- | --- |
| `search` | `Ctrl+F` | Focuses the first `[data-search]` filter on the page, else the module finder |
| `command_palette` | `Ctrl+K` | Same module finder |
| `module_jump_1…9,0` | `Ctrl+1…0` | Jumps to modules 1–10 of the flat sidebar order |
| `module_next` / `module_prev` | `Ctrl+Tab` / `Ctrl+Shift+Tab` | Steps through modules, wrapping |

The rest of the 26-action catalogue is editable (so both apps share one
catalogue) but is either browser-native or has no web equivalent yet. Sequences
are Qt-style strings (`Ctrl+Shift+F`) parsed by `matchesSequence`, which
requires the exact modifier set.

## Formatting and downloads

- `lib/format.ts`: `money` (en-PK, 2 dp), `compact` (K/M/B for KPI tiles),
  `percent`, `percentChange` (null without a baseline), `share`, `initials`,
  `monthLabel`, `dayLabel`.
- Pages that predate the helper use a local `money()` with the same `en-PK`
  formatting, so amounts look identical everywhere.
- `lib/download.ts` `saveBlob` appends the anchor (Firefox needs it), clicks,
  removes it, and revokes the object URL immediately.

## Responsive layout and accessibility

- **≥ 1024 px**: fixed sidebar column plus main content.
- **< 1024 px**: the sidebar becomes an off-canvas drawer with a scrim; the top
  bar exposes the toggle. The audit runs at 1440, 1280 and 1024 px and fails on
  horizontal page overflow, clipped text, overlapping controls, or hit targets
  smaller than 18 px.
- Navigation is a list of `<button>`s with `aria-current="page"`; the module
  finder filters sections and shows “No module matches.”
- Comboboxes expose `role="combobox"`, `aria-expanded`, `aria-autocomplete`,
  `role="listbox"`/`role="option"` with `aria-selected`; menus use
  `role="menu"`/`menuitem` and `aria-expanded` on the trigger.
- Icons are `aria-hidden`; icon-only buttons carry an `aria-label`.
- Charts keep their focus handling but hide Recharts' focus outline for
  mouse users; animations and transitions stop under reduced motion.
- Every page has one visible `h1`/`h2` used as the audit's “page rendered”
  signal.

## Development and build

```bash
npm run dev:client        # Vite on :5173, /api proxied to localhost:4000
npm -w @bop-erp/client run build
```

- `vite.config.ts` proxies `/api` to `process.env.API_URL ?? http://localhost:4000`
  so the browser sees a single origin in development.
- The production build is `client/dist` (`index.html` + content-hashed
  `assets/`). It is served by the Node process when `ERP_SERVE_CLIENT=1`; the
  server sends `no-cache` for `index.html` and immutable caching for assets.
- The bundle is currently one chunk of ~894 kB (258 kB gzip), dominated by
  Recharts and Framer Motion. Vite warns about the 500 kB threshold. It loads
  fine on a LAN; if first paint over a slow link matters, lazy-load the Reports
  and Dashboard chart components.

## Adding a page or widget

1. Add the page id to `Page` in `App.tsx` and render it in the switch.
2. Add its sidebar entry to `NAV_SECTIONS` (append to the right section; do not
   reorder existing entries or shortcuts shift).
3. Build it from `ui/Card` + existing primitives; use `SearchableSelect` for
   pickers, `FilterBox` for in-page filtering, and `money()` for amounts.
4. Add it to `PAGES` in `e2e/ui-audit.spec.ts` (with `expectData: true` when the
   demo dataset guarantees rows) and, if it has a filter, the audit's empty-state
   sweep will cover it automatically.
5. Run `npm run typecheck` and `npm run test:e2e`.
