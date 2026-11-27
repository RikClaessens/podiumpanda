import { createFileRoute } from "@tanstack/react-router";
import { Transposition } from "../components/transposition";

export const Route = createFileRoute("/apps/transposition")({
  component: Transposition,
  ssr: false,
});
