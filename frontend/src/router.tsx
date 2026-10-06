import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./auth/AppLayout";
import { RequireAuth } from "./auth/RequireAuth";
import { CategoriesPage } from "./pages/CategoriesPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SummaryPage } from "./pages/SummaryPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <ExpensesPage /> },
          { path: "/categories", element: <CategoriesPage /> },
          { path: "/summary", element: <SummaryPage /> },
        ],
      },
    ],
  },
]);
