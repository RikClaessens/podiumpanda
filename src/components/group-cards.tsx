import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { RecentGroup } from "../lib/local";
import { useLanguage } from "../lib/language";
import { GroupIcon } from "./group-icon";

export function GroupCards({ groups }: { groups: RecentGroup[] }) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {groups.map((item) => (
        <Link
          key={item.id}
          to="/g/$groupId"
          params={{ groupId: item.id }}
          hash={`key=${item.key}`}
          className="concert-card panel flex min-h-20 min-w-0 items-center gap-4"
        >
          <GroupIcon icon={item.icon} className="shrink-0 text-coral-foreground" />
          <h3 className="min-w-0 text-2xl font-semibold break-words">{item.title}</h3>
        </Link>
      ))}
      <Link
        to="/g/new"
        className="concert-card flex min-h-20 min-w-0 items-center gap-4 rounded-[1.25rem] border-2 border-dashed border-primary/40 bg-secondary/40 p-5 text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Plus size={24} className="shrink-0" aria-hidden="true" />
        <h3 className="text-2xl font-semibold">{t("Create group")}</h3>
      </Link>
    </div>
  );
}
