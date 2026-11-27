import { createFileRoute } from "@tanstack/react-router";
import { Tuner } from "../components/tuner";

export const Route = createFileRoute("/apps/tuner")({
  component: Tuner,
  ssr: false,
});
