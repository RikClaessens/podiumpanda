import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GroupCards } from "../components/group-cards";
import { useLanguage } from "../lib/language";
import { recentGroups } from "../lib/local";

export const Route = createFileRoute("/groups")({ component: GroupsPage, ssr: false });

function GroupsPage() {
  const { t, dynamic } = useLanguage();
  const [initial] = useState(() => {
    try {
      return { groups: recentGroups(), error: "" };
    } catch (error) {
      return {
        groups: [],
        error: error instanceof Error ? error.message : "Browser storage is unavailable.",
      };
    }
  });
  return (
    <main className="page-enter mx-auto max-w-5xl space-y-4 px-5 py-10">
      <h1 className="section-title">{t("Your groups")}</h1>
      <p className="text-sm text-muted-foreground">{t("Groups opened on this device.")}</p>
      {initial.error ? (
        <p role="alert" className="text-destructive">
          {dynamic(initial.error)}
        </p>
      ) : (
        <>
          {initial.groups.length === 0 && (
            <p className="text-muted-foreground">
              {t("Create a group, or open a group link you received.")}
            </p>
          )}
          <GroupCards groups={initial.groups} />
        </>
      )}
    </main>
  );
}
