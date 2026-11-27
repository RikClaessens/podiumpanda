type AppDefinition = {
  to:
    | "/apps/metronome"
    | "/apps/tuner"
    | "/apps/tone-generator"
    | "/apps/transposition"
    | "/apps/click-track";
  name: string;
};

export const apps = [
  {
    to: "/apps/metronome",
    name: "Metronome",
  },
  {
    to: "/apps/tuner",
    name: "Tuner",
  },
  {
    to: "/apps/tone-generator",
    name: "Tone generator",
  },
  {
    to: "/apps/transposition",
    name: "Transposition",
  },
  {
    to: "/apps/click-track",
    name: "Click Track",
  },
] satisfies AppDefinition[];
