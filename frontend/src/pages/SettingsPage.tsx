import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../api/auth";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { getThemePref, setThemePref, type ThemePref } from "../lib/theme";

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function SettingsPage() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemePref>(getThemePref);

  function chooseTheme(pref: ThemePref) {
    setTheme(pref);
    setThemePref(pref);
  }

  async function onLogout() {
    await logout.mutateAsync();
    navigate("/login", { replace: true });
  }

  return (
    <Screen title="Settings" backTo="/">
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted">Signed in as</p>
          <p className="font-semibold break-all">{me.data?.email}</p>
        </Card>

        <Card className="p-4">
          <fieldset>
            <legend className="mb-3 font-semibold">Theme</legend>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-app p-1">
              {THEME_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                    theme === value ? "bg-surface text-fg shadow-sm" : "text-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={theme === value}
                    onChange={() => chooseTheme(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </Card>

        <Button variant="secondary" onClick={onLogout} disabled={logout.isPending} className="w-full">
          Log out
        </Button>
      </div>
    </Screen>
  );
}
