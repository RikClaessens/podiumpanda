import { Grid2X2 } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useLanguage } from "../lib/language";
import { AppIcon } from "./app-icon";
import { apps } from "../lib/apps";
import { recentGroups, type RecentGroup } from "../lib/local";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { GroupIcon } from "./group-icon";

const switcherLinkClass =
  "flex min-h-10 items-center gap-3 rounded-lg px-2 py-2 font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring";

export function AppSwitcher() {
  const { t, dynamic } = useLanguage();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<RecentGroup[]>([]);
  const [error, setError] = useState("");
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          try {
            setGroups(recentGroups().slice(0, 3));
            setError("");
          } catch (storageError) {
            setGroups([]);
            setError(
              storageError instanceof Error
                ? storageError.message
                : "Browser storage is unavailable.",
            );
          }
        }
      }}
    >
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
      <PopoverContent
        align="end"
        sideOffset={8}
        className="max-h-[var(--radix-popover-content-available-height)] w-72 max-w-[calc(100vw-2rem)] space-y-3 overflow-y-auto"
      >
        <h2 className="text-lg font-semibold">{t("Your groups")}</h2>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {dynamic(error)}
          </p>
        )}
        {groups.map((group) => (
          <Link
            key={group.id}
            to="/g/$groupId"
            params={{ groupId: group.id }}
            hash={`key=${group.key}`}
            onClick={() => setOpen(false)}
            className={switcherLinkClass}
          >
            <GroupIcon icon={group.icon} size={20} className="shrink-0 text-coral-foreground" />
            <span className="min-w-0 break-words">{group.title}</span>
          </Link>
        ))}
        <Button asChild variant="outline" className="w-full">
          <Link to="/groups" onClick={() => setOpen(false)}>
            {t("All groups")}
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">{t("Apps")}</h2>
        <div className="space-y-2">
          {apps.map((app) => {
            return (
              <Link
                key={app.to}
                to={app.to}
                onClick={() => setOpen(false)}
                className={switcherLinkClass}
              >
                <span className="block size-6 shrink-0 text-primary" aria-hidden="true">
                  <AppIcon app={app.to} />
                </span>
                <span className="min-w-0 break-words">{t(app.name)}</span>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
