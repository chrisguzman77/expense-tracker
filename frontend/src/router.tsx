import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./auth/AppLayout";
import { RequireAuth } from "./auth/RequireAuth";
import { AccountDetailPage } from "./pages/AccountDetailPage";
import { AccountsPage } from "./pages/AccountsPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { TransactionDetailPage } from "./pages/TransactionDetailPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { LoginPage } from "./pages/LoginPage";
import { NewAccountPage } from "./pages/NewAccountPage";
import { NewCategoryPage } from "./pages/NewCategoryPage";
import { NewTransactionPage } from "./pages/NewTransactionPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SummaryPage } from "./pages/SummaryPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        // Tabs: share the bottom tab bar.
        element: <AppLayout />,
        children: [
          { path: "/", element: <TransactionsPage /> },
          { path: "/categories", element: <CategoriesPage /> },
          { path: "/summary", element: <SummaryPage /> },
          { path: "/accounts", element: <AccountsPage /> },
        ],
      },
      // Pushed screens: full screen with their own back button.
      { path: "/transactions/new", element: <NewTransactionPage /> },
      { path: "/transactions/:id", element: <TransactionDetailPage /> },
      { path: "/categories/new", element: <NewCategoryPage /> },
      { path: "/accounts/new", element: <NewAccountPage /> },
      { path: "/accounts/:id", element: <AccountDetailPage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);
