import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./auth/AppLayout";
import { RequireAuth } from "./auth/RequireAuth";
import { CategoriesPage } from "./pages/CategoriesPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/categories", element: <CategoriesPage /> },
        ],
      },
    ],
  },
]);
