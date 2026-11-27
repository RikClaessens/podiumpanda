import { createFileRoute } from "@tanstack/react-router";
import { WheelOfFortune } from "../components/wheel-of-fortune";

export const Route = createFileRoute("/apps/wheel-of-fortune")({
  component: WheelOfFortune,
  ssr: false,
});
