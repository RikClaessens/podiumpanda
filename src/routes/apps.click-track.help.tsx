import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ClickTrackHelp } from "../components/click-track-help";
import { useLanguage } from "../lib/language";

function ClickTrackHelpPage() {
  const { t } = useLanguage();
  return (
    <main className="page-enter mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        to="/apps/click-track"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft size={14} />
        {t("Back to the app")}
      </Link>
      <h1 className="text-3xl font-bold text-primary">
        {t("Click Track")} – {t("Notation help")}
      </h1>
      <ClickTrackHelp />
    </main>
  );
}

export const Route = createFileRoute("/apps/click-track/help")({
  component: ClickTrackHelpPage,
  ssr: false,
});
