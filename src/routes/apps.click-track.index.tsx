import { createFileRoute } from "@tanstack/react-router";
import { ClickTrackApp } from "../components/click-track";

export const Route = createFileRoute("/apps/click-track/")({
  component: ClickTrackApp,
  ssr: false,
});
