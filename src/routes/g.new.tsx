import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import type { GroupIcon } from "../../shared/model";
import { GroupIconPicker } from "../components/group-icon";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { createGroup } from "../lib/api";
import { useLanguage } from "../lib/language";
import { rememberGroup } from "../lib/local";

export const Route = createFileRoute("/g/new")({ component: NewGroup, ssr: false });

function NewGroup() {
  const { t, dynamic } = useLanguage();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<GroupIcon>("users");
  const create = useMutation({
    mutationFn: () => createGroup(title, icon),
    onSuccess: async ({ id, key }) => {
      try {
        rememberGroup({ id, key, title, icon, visitedAt: new Date().toISOString() });
      } catch (error) {
        console.error("Could not save group shortcut.", error);
      }
      await navigate({ to: "/g/$groupId", params: { groupId: id }, hash: `key=${key}` });
    },
  });

  return (
    <main className="page-enter mx-auto max-w-xl space-y-4 px-5 py-10">
      <Button asChild variant="ghost">
        <Link to="/">{t("← Back to home")}</Link>
      </Button>
      <form
        className="panel space-y-5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <h1 className="section-title">{t("Let’s create your group")}</h1>
        <div className="field">
          <label htmlFor="group-name">{t("Group name")}</label>
          <Input
            id="group-name"
            placeholder={t("Your orchestra or ensemble")}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={160}
          />
        </div>
        <GroupIconPicker value={icon} onChange={setIcon} />
        <Button type="submit" className="w-full" disabled={create.isPending}>
          {create.isPending ? t("Creating…") : t("Create group")}
          <ArrowRight size={16} className="button-arrow" />
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("Everyone with the link can view and edit. Share it only with people you trust.")}
        </p>
        {create.error && (
          <p role="alert" className="text-sm text-destructive">
            {dynamic(create.error.message)}
          </p>
        )}
      </form>
    </main>
  );
}
