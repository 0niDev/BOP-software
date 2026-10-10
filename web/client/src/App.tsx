import { useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";
import Layout from "./components/Layout";
import AccountsPage from "./pages/AccountsPage";
import AssetsPage from "./pages/AssetsPage";
import BankingPage from "./pages/BankingPage";
import DashboardPage from "./pages/DashboardPage";
import ExpensesPage from "./pages/ExpensesPage";
import ItemsPage from "./pages/ItemsPage";
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
  | "reports"
  | "users"
  | "settings";

export default function App() {
  const [user, setUser] = useState<User | null>(loadUser);
  const [page, setPage] = useState<Page>("dashboard");

  // Apply the stored appearance theme for the signed-in session.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .settings()
      .then((all) => {
        if (!cancelled) applyTheme(all.APPEARANCE?.theme_name);
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
        setUser(null);
      }}
    >
      {page === "dashboard" && <DashboardPage />}
      {page === "sales" && <SalesInvoicesPage />}
      {page === "purchases" && <PurchaseInvoicesPage />}
      {page === "parties" && <PartiesPage />}
      {page === "items" && <ItemsPage />}
      {page === "payments" && <PaymentsPage />}
      {page === "manufacturing" && <ManufacturingPage />}
      {page === "expenses" && <ExpensesPage />}
      {page === "banking" && <BankingPage />}
      {page === "returns" && <ReturnsPage />}
      {page === "assets" && <AssetsPage />}
      {page === "accounts" && <AccountsPage />}
      {page === "reports" && <TrialBalancePage />}
      {page === "users" && <UsersPage />}
      {page === "settings" && <SettingsPage />}
    </Layout>
  );
}
