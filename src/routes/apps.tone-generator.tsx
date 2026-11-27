import { createFileRoute } from "@tanstack/react-router";
import { ToneGenerator } from "../components/tone-generator";

export const Route = createFileRoute("/apps/tone-generator")({
  component: ToneGenerator,
  ssr: false,
});
