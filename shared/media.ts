import { z } from "zod";

export const pieceLinkSchema = z
  .union([
    z.literal(""),
    z
      .url({ protocol: /^https?$/ })
      .max(2048)
      .refine((value) => {
        const url = new URL(value);
        return !url.username && !url.password;
      }, "Links must not contain credentials."),
  ])
  .default("");

export type MediaEmbed =
  | { provider: "YouTube"; src: string; videoId: string }
  | { provider: "Spotify"; src: string; isCollection: boolean };

const youtubeHosts = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
];

export function mediaProvider(value: string): "YouTube" | "Spotify" | null {
  const link = pieceLinkSchema.parse(value);
  if (!link) return null;
  const host = new URL(link).hostname;
  if (host === "youtu.be" || youtubeHosts.includes(host)) return "YouTube";
  if (host === "spotify.com" || host === "www.spotify.com" || host === "open.spotify.com")
    return "Spotify";
  return null;
}

export function mediaEmbed(value: string): MediaEmbed | null {
  const link = pieceLinkSchema.parse(value);
  if (!link) return null;
  const url = new URL(link);
  const youtubeId =
    url.hostname === "youtu.be"
      ? url.pathname.split("/")[1]
      : youtubeHosts.includes(url.hostname)
        ? url.pathname === "/watch"
          ? url.searchParams.get("v")
          : /^\/(?:embed|shorts|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1]
        : null;
  if (youtubeId && /^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
    return {
      provider: "YouTube",
      src: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
      videoId: youtubeId,
    };
  }
  if (url.hostname === "open.spotify.com") {
    const match =
      /^\/(?:intl-[a-z]{2}\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]{22})\/?$/.exec(
        url.pathname,
      );
    if (match)
      return {
        provider: "Spotify",
        src: `https://open.spotify.com/embed/${match[1]}/${match[2]}`,
        isCollection: match[1] === "album" || match[1] === "playlist",
      };
  }
  return null;
}
