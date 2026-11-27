import { useLanguage } from "../lib/language";
import { useHydrated } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
export function ThemeToggle() {
  const { t } = useLanguage();
  const hydrated = useHydrated();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = hydrated && resolvedTheme === "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      disabled={!hydrated}
      aria-label={dark ? t("Switch to light mode") : t("Switch to dark mode")}
      title={dark ? t("Switch to light mode") : t("Switch to dark mode")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}
