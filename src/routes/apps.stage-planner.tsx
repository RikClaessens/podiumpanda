import { createFileRoute } from "@tanstack/react-router";
import { StagePlanner } from "../components/stage-planner";

export const Route = createFileRoute("/apps/stage-planner")({
  component: StagePlanner,
  ssr: false,
});
