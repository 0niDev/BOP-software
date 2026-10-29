import { useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";
import Layout from "./components/Layout";
import { setDateFormat } from "./lib/format";
import { PageVisibleProvider } from "./lib/pageVisibility";
import AccountsPage from "./pages/AccountsPage";
import AssetsPage from "./pages/AssetsPage";
import BankingPage from "./pages/BankingPage";
import DashboardPage from "./pages/DashboardPage";
import DeletedRecordsPage from "./pages/DeletedRecordsPage";
import ExpensesPage from "./pages/ExpensesPage";
import ItemsPage from "./pages/ItemsPage";
import JournalVouchersPage from "./pages/JournalVouchersPage";
import LoginPage from "./pages/LoginPage";
import ManufacturingPage from "./pages/ManufacturingPage";
import PartiesPage from "./pages/PartiesPage";
import PaymentsPage from "./pages/PaymentsPage";
import PurchaseInvoicesPage from "./pages/PurchaseInvoicesPage";
import ReturnsPage from "./pages/ReturnsPage";
import SalesInvoicesPage from "./pages/SalesInvoicesPage";
import SettingsPage from "./pages/SettingsPage";
import TrialBalancePage from "./pages/TrialBalancePage";
import UsersPage from "./pages/UsersPage";
import { applyTheme } from "./theme";
import type { User } from "./types";

const USER_KEY = "bop-erp.user";

function loadUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw || !getToken()) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export type ReportPage =
  | "reports"
  | "report-trial-balance"
  | "report-party-ledger"
  | "report-cash-book"
  | "report-profit-loss"
  | "report-balance-sheet"
  | "report-export";

export type Page =
  | "dashboard"
  | "sales"
  | "purchases"
  | "parties"
  | "items"
  | "payments"
  | "manufacturing"
  | "expenses"
  | "banking"
  | "returns"
  | "assets"
  | "accounts"
  | "journal"
  | ReportPage
  | "users"
  | "settings"
  | "deleted";

function isReportPage(page: Page): page is ReportPage {
  return page === "reports" || page.startsWith("report-");
}

export default function App() {
  const [user, setUser] = useState<User | null>(loadUser);
  const [page, setPage] = useState<Page>("dashboard");
  // Visited pages stay mounted (hidden) so in-progress forms survive tab switches.
  const [visited, setVisited] = useState<Page[]>(["dashboard"]);
  const mountedPages = visited.includes(page) ? visited : [...visited, page];
  // Bumped once the saved date format arrives so mounted tables re-render.
  const [, setFormatVersion] = useState(0);

  // Remember every page that has been opened so it can keep its state while hidden.
  useEffect(() => {
    setVisited((current) => (current.includes(page) ? current : [...current, page]));
  }, [page]);

  // Apply the stored appearance theme and date format for the signed-in session.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .settings()
      .then((all) => {
        if (cancelled) return;
        applyTheme(all.APPEARANCE?.theme_name);
        setDateFormat(all.GENERAL?.date_format);
        setFormatVersion((version) => version + 1);
      })
      .catch(() => applyTheme("dark"));
    return () => {
      cancelled = true;
    };
  }, [user]);

  // "system" theme follows the OS preference while the app is open.
  useEffect(() => {
    if (!user || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const listener = () => {
      if (document.documentElement.dataset.themeSource === "system") applyTheme("system");
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [user]);

  // Signed out: the login screen always uses the dark palette.
  useEffect(() => {
    if (!user) applyTheme("dark");
  }, [user]);

  if (!user) {
    return (
      <LoginPage
        onLogin={(loggedIn, token) => {
          setToken(token);
          localStorage.setItem(USER_KEY, JSON.stringify(loggedIn));
          setUser(loggedIn);
        }}
      />
    );
  }

  return (
    <Layout
      user={user}
      page={page}
      onNavigate={setPage}
      onLogout={() => {
        setToken(null);
        localStorage.removeItem(USER_KEY);
        setVisited([]);
        setPage("dashboard");
        setUser(null);
      }}
    >
      {mountedPages
        .filter((mounted) => !isReportPage(mounted))
        .map((mounted) => (
          <div
            key={mounted}
            data-page-active={mounted === page ? "" : undefined}
            hidden={mounted !== page}
          >
            <PageVisibleProvider visible={mounted === page}>
              {renderPage(mounted, setPage)}
            </PageVisibleProvider>
          </div>
        ))}
      {isReportPage(page) && <TrialBalancePage section={page} />}
    </Layout>
  );
}

function renderPage(target: Page, onNavigate: (page: Page) => void) {
  switch (target) {
    case "dashboard": return <DashboardPage onNavigate={onNavigate} />;
    case "sales": return <SalesInvoicesPage />;
    case "purchases": return <PurchaseInvoicesPage />;
    case "parties": return <PartiesPage />;
    case "items": return <ItemsPage />;
    case "payments": return <PaymentsPage />;
    case "manufacturing": return <ManufacturingPage />;
    case "expenses": return <ExpensesPage />;
    case "banking": return <BankingPage />;
    case "returns": return <ReturnsPage />;
    case "assets": return <AssetsPage />;
    case "accounts": return <AccountsPage />;
    case "journal": return <JournalVouchersPage />;
    case "users": return <UsersPage />;
    case "settings": return <SettingsPage />;
    case "deleted": return <DeletedRecordsPage />;
    default: return null;
  }
}
