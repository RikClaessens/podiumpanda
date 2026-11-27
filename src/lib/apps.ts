type AppDefinition = {
  to:
    | "/apps/metronome"
    | "/apps/tuner"
    | "/apps/tone-generator"
    | "/apps/transposition"
    | "/apps/click-track"
    | "/apps/stage-planner";
  name: string;
};

export const apps = [
  {
    to: "/apps/tuner",
    name: "Tuner",
  },
  {
    to: "/apps/metronome",
    name: "Metronome",
  },
  {
    to: "/apps/click-track",
    name: "Click Track",
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
    to: "/apps/stage-planner",
    name: "Stage planner",
  },
] satisfies AppDefinition[];
