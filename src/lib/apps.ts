import { Timer, type LucideIcon } from "lucide-react";

type AppDefinition = {
  to: "/apps/metronome";
  name: string;
  iconColor: string;
  icon: LucideIcon;
};

export const apps = [
  {
    to: "/apps/metronome",
    name: "Metronome",
    iconColor: "text-coral-foreground",
    icon: Timer,
  },
] satisfies AppDefinition[];
