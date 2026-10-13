import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout, useLogoutEverywhere, useMe } from "../api/auth";
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
  const logoutEverywhere = useLogoutEverywhere();
  const [confirmingEverywhere, setConfirmingEverywhere] = useState(false);
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

  async function onLogoutEverywhere() {
    try {
      await logoutEverywhere.mutateAsync();
      navigate("/login", { replace: true });
    } catch {
      // Shown below via logoutEverywhere.error
    }
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
        {logoutEverywhere.isError && (
          <p role="alert" className="text-sm text-danger">
            {logoutEverywhere.error.message}
          </p>
        )}
        {confirmingEverywhere ? (
          <Card className="flex flex-col gap-3 p-4">
            <p className="font-medium">This logs out every device, including this one.</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmingEverywhere(false);
                  logoutEverywhere.reset();
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={onLogoutEverywhere} disabled={logoutEverywhere.isPending}>
                Confirm
              </Button>
            </div>
          </Card>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmingEverywhere(true)} className="w-full">
            Log out everywhere
          </Button>
        )}
      </div>
    </Screen>
  );
}
