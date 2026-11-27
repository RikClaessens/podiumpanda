import { Timer, type LucideIcon } from "lucide-react";

type AppDefinition = {
  to: "/apps/metronome";
  name: string;
  description: string;
  iconColor: string;
  icon: LucideIcon;
};

export const apps = [
  {
    to: "/apps/metronome",
    name: "Metronome",
    description: "Practice with a steady, adjustable click.",
    iconColor: "text-coral-foreground",
    icon: Timer,
  },
] satisfies AppDefinition[];
