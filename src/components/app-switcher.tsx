import { Grid2X2 } from "lucide-react";
import { useLanguage } from "../lib/language";
import { apps } from "../lib/apps";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { AppCard } from "./app-card";

export function AppSwitcher() {
  const { t } = useLanguage();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("App switcher")}
          title={t("App switcher")}
        >
          <Grid2X2 size={18} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 space-y-3">
        <h2 className="text-lg font-semibold">{t("Apps")}</h2>
        <div className="space-y-2">
          {apps.map((app) => (
            <AppCard key={app.to} app={app} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
