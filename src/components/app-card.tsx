import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useLanguage } from "../lib/language";
import type { apps } from "../lib/apps";

type AppDefinition = (typeof apps)[number];

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

const animatedIcons: Record<AppDefinition["to"], ReactNode> = {
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
};

export function AppCard({ app }: { app: AppDefinition }) {
  const { t } = useLanguage();
  return (
    <Link
      to={app.to}
      aria-label={t(app.name)}
      className="app-card concert-card group flex min-h-44 flex-col justify-between gap-6 rounded-2xl border border-l-4 border-l-coral bg-secondary/60 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className={`block h-16 w-16 overflow-hidden ${app.iconColor}`}>
        {animatedIcons[app.to]}
      </span>
      <span className="block text-xl font-semibold leading-tight">{t(app.name)}</span>
    </Link>
  );
}
