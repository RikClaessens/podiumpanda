import type { ReactNode } from "react";
import { Theater } from "lucide-react";
import type { apps } from "../lib/apps";

type AppPath = (typeof apps)[number]["to"];

const svgProps = {
  viewBox: "0 0 64 64",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "h-full w-full",
  "aria-hidden": true,
} as const;

const animatedIcons: Record<AppPath, ReactNode> = {
  "/apps/metronome": (
    <svg {...svgProps}>
      <path d="M22 54h20l-5-42h-10z" />
      <g className="app-icon-pendulum">
        <path d="M32 46 32 16" />
        <circle cx="32" cy="22" r="3" fill="currentColor" />
      </g>
    </svg>
  ),
  "/apps/tuner": (
    <svg {...svgProps}>
      <path d="M8 44a24 24 0 0 1 48 0" />
      <path d="M14 44h4M46 44h4M32 22v4" />
      <g className="app-icon-needle">
        <path d="M32 46 32 26" />
        <circle cx="32" cy="46" r="3" fill="currentColor" />
      </g>
    </svg>
  ),
  "/apps/tone-generator": (
    <svg {...svgProps}>
      <g className="app-icon-wave">
        <path d="M-48 32c8-20 16-20 24 0s16 20 24 0 16-20 24 0 16 20 24 0 16-20 24 0 16 20 24 0" />
      </g>
    </svg>
  ),
  "/apps/click-track": (
    <svg {...svgProps}>
      <path d="M10 48h44" />
      <path d="M14 48V20" className="app-icon-tick" />
      <path d="M26 48V32" className="app-icon-tick app-icon-tick-2" />
      <path d="M38 48V32" className="app-icon-tick app-icon-tick-3" />
      <path d="M50 48V32" className="app-icon-tick app-icon-tick-4" />
    </svg>
  ),
  "/apps/transposition": (
    <svg {...svgProps}>
      <g className="app-icon-up">
        <circle cx="22" cy="46" r="6" fill="currentColor" />
        <path d="M28 46V14l14 6" />
      </g>
      <g className="app-icon-down">
        <path d="M50 28v18M44 40l6 6 6-6" />
      </g>
    </svg>
  ),
  "/apps/stage-planner": (
    <Theater className="app-icon-theater h-full w-full" strokeWidth={1.125} aria-hidden="true" />
  ),
  "/apps/wheel-of-fortune": (
    <svg {...svgProps}>
      <circle cx="32" cy="33" r="22" />
      <g className="app-icon-wheel">
        <path d="M32 11v44M10 33h44M16.5 17.5l31 31M47.5 17.5l-31 31" />
      </g>
      <circle cx="32" cy="33" r="4" fill="var(--background)" />
      <path d="M28 5h8l-4 8z" fill="var(--background)" />
    </svg>
  ),
};

export function AppIcon({ app }: { app: AppPath }) {
  return animatedIcons[app];
}
