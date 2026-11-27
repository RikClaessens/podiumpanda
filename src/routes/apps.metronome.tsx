import { createFileRoute } from "@tanstack/react-router";
import { Metronome } from "../components/metronome";

export const Route = createFileRoute("/apps/metronome")({
  component: Metronome,
  ssr: false,
});
