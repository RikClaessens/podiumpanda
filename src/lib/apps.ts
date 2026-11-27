import { AudioLines, Radio, Repeat2, Timer, type LucideIcon } from "lucide-react";

type AppDefinition = {
  to: "/apps/metronome" | "/apps/tuner" | "/apps/tone-generator" | "/apps/transposition";
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
  {
    to: "/apps/tuner",
    name: "Tuner",
    iconColor: "text-coral-foreground",
    icon: AudioLines,
  },
  {
    to: "/apps/tone-generator",
    name: "Tone generator",
    iconColor: "text-coral-foreground",
    icon: Radio,
  },
  {
    to: "/apps/transposition",
    name: "Transposition",
    iconColor: "text-coral-foreground",
    icon: Repeat2,
  },
] satisfies AppDefinition[];
