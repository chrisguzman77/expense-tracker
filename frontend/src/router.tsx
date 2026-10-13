import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./auth/AppLayout";
import { RequireAuth } from "./auth/RequireAuth";
import { CategoriesPage } from "./pages/CategoriesPage";
import { ExpenseDetailPage } from "./pages/ExpenseDetailPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { LoginPage } from "./pages/LoginPage";
import { NewCategoryPage } from "./pages/NewCategoryPage";
import { NewExpensePage } from "./pages/NewExpensePage";
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
          { path: "/", element: <ExpensesPage /> },
          { path: "/categories", element: <CategoriesPage /> },
          { path: "/summary", element: <SummaryPage /> },
        ],
      },
      // Pushed screens: full screen with their own back button.
      { path: "/expenses/new", element: <NewExpensePage /> },
      { path: "/expenses/:id", element: <ExpenseDetailPage /> },
      { path: "/categories/new", element: <NewCategoryPage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);
