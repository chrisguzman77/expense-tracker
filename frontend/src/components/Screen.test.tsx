import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Screen } from "./Screen";

function Home() {
  return <p>home {JSON.stringify(useLocation().state)}</p>;
}

describe("Screen", () => {
  it("shows the title and goes back to its backTo route, carrying backState", async () => {
    const router = createMemoryRouter(
      [
        { path: "/", element: <Home /> },
        {
          path: "/pushed",
          element: (
            <Screen title="New expense" backTo="/" backState={{ keep: 1 }}>
              <p>body</p>
            </Screen>
          ),
        },
      ],
      { initialEntries: ["/pushed"] },
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("heading", { name: "New expense" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("link", { name: /back/i }));

    expect(await screen.findByText('home {"keep":1}')).toBeInTheDocument();
  });

  it("shows a header action link when given one", () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <Screen title="Account" backTo="/accounts" action={{ to: "/accounts/1/edit", label: "Edit" }}>
            <p>body</p>
          </Screen>
        ),
      },
    ]);
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/accounts/1/edit");
  });

  it("has no link besides Back without an action", () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <Screen title="Account" backTo="/accounts">
            <p>body</p>
          </Screen>
        ),
      },
    ]);
    render(<RouterProvider router={router} />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
