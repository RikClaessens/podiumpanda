import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { ExternalLink, PictureInPicture2, Play, X, Youtube } from "lucide-react";
import { mediaEmbed, mediaProvider, type MediaEmbed } from "../../shared/media";
import { useLanguage } from "../lib/language";
import { Button } from "./ui/button";

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options: { width: number; height: number }) => Promise<Window>;
    };
  }
}

type FloatingSession = { id: string; url: string; embed: MediaEmbed; target: Window | null };
type FloatingError = { id: string; url: string; message: string };
type FloatingPlayerContextValue = {
  session: FloatingSession | null;
  opening: boolean;
  error: FloatingError | null;
  registerSource: (id: string, url: string) => () => void;
  open: (id: string, url: string, embed: MediaEmbed) => Promise<void>;
  stop: (id: string, url: string) => void;
  returnPlayer: () => void;
  clearError: () => void;
};

const FloatingPlayerContext = createContext<FloatingPlayerContextValue | null>(null);

function sourceKey(id: string, url: string) {
  return JSON.stringify([id, url]);
}

export function FloatingPlayerProvider({ children }: { children: ReactNode }) {
  const { t, locale } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [session, setSession] = useState<FloatingSession | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<FloatingError | null>(null);
  const [sources, setSources] = useState<Set<string>>(() => new Set());
  const sourcesRef = useRef(sources);
  const activeWindow = useRef<Window | null>(null);
  const mounted = useRef(false);
  const registerSource = useCallback((id: string, url: string) => {
    const key = sourceKey(id, url);
    sourcesRef.current = new Set(sourcesRef.current).add(key);
    setSources(sourcesRef.current);
    return () => {
      const next = new Set(sourcesRef.current);
      next.delete(key);
      sourcesRef.current = next;
      setSources(next);
    };
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeWindow.current?.close();
    };
  }, []);
  useEffect(() => {
    const target = activeWindow.current;
    if (!target) return;
    target.document.documentElement.className = resolvedTheme === "dark" ? "dark" : "";
    target.document.documentElement.lang = locale;
  }, [session?.target, resolvedTheme, locale]);
  async function open(id: string, url: string, embed: MediaEmbed) {
    const api = window.documentPictureInPicture;
    if (!api) {
      setError({ id, url, message: t("Picture-in-Picture is not supported in this browser.") });
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const target = await api.requestWindow({ width: 520, height: 390 });
      if (!mounted.current) {
        target.close();
        return;
      }
      activeWindow.current = target;
      target.document.title = "PodiumPanda";
      target.document.documentElement.className = document.documentElement.className;
      target.document.documentElement.lang = document.documentElement.lang;
      for (const stylesheet of document.querySelectorAll<HTMLLinkElement>(
        'link[rel="stylesheet"]',
      )) {
        const link = target.document.createElement("link");
        link.rel = "stylesheet";
        link.href = stylesheet.href;
        target.document.head.append(link);
      }
      target.addEventListener(
        "pagehide",
        () => {
          if (activeWindow.current === target) activeWindow.current = null;
          if (mounted.current)
            setSession((current) =>
              current?.target === target
                ? sourcesRef.current.has(sourceKey(current.id, current.url))
                  ? { ...current, target: null }
                  : null
                : current,
            );
        },
        { once: true },
      );
      setSession({ id, url, embed, target });
    } catch (error) {
      console.error("Could not open Picture-in-Picture", {
        error: error instanceof Error ? error.name : "UnknownError",
      });
      if (mounted.current)
        setError({
          id,
          url,
          message: t(
            "Could not open Picture-in-Picture. Try the embedded player or open the link.",
          ),
        });
    } finally {
      if (mounted.current) setOpening(false);
    }
  }
  function returnPlayer() {
    const target = session?.target;
    if (!target) return;
    setSession(
      sourcesRef.current.has(sourceKey(session.id, session.url))
        ? { ...session, target: null }
        : null,
    );
    if (activeWindow.current === target) activeWindow.current = null;
    target.close();
  }
  function stop(id: string, url: string) {
    if (session?.id !== id || session.url !== url) return;
    const target = session.target;
    setSession(null);
    if (activeWindow.current === target) activeWindow.current = null;
    target?.close();
  }
  const sourceVisible = session && sources.has(sourceKey(session.id, session.url));
  return (
    <FloatingPlayerContext.Provider
      value={{
        session,
        opening,
        error,
        registerSource,
        open,
        stop,
        returnPlayer,
        clearError: () => setError(null),
      }}
    >
      {children}
      {error && !sources.has(sourceKey(error.id, error.url)) && (
        <p role="alert" className="p-3 text-sm text-destructive">
          {error.message}
        </p>
      )}
      {session?.target &&
        createPortal(
          <main className="space-y-3 p-3">
            <Button size="sm" variant="outline" onClick={returnPlayer}>
              {sourceVisible ? t("Return player here") : t("Close player")}
            </Button>
            <EmbeddedPlayer embed={session.embed} floating />
          </main>,
          session.target.document.body,
        )}
    </FloatingPlayerContext.Provider>
  );
}

function EmbeddedPlayer({ embed, floating = false }: { embed: MediaEmbed; floating?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-2">
      <iframe
        title={`${embed.provider} ${t("Music player")}`}
        src={
          floating && embed.provider === "YouTube"
            ? `/player/youtube.html#${embed.videoId}`
            : embed.src
        }
        className={`block w-full rounded-lg ${embed.provider === "Spotify" ? "border-0" : "border"}`}
        style={{
          height: embed.provider === "Spotify" ? (embed.isCollection ? 352 : 80) : "auto",
          minHeight: embed.provider === "YouTube" ? 200 : undefined,
          aspectRatio: embed.provider === "YouTube" ? "16 / 9" : undefined,
        }}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy={embed.provider === "YouTube" ? "origin" : "no-referrer"}
      />
      <p className="text-xs text-muted-foreground">
        {embed.provider === "Spotify"
          ? t("Spotify may play previews. Sign in to Spotify for full playback where available.")
          : t("Playback availability is controlled by the provider.")}
      </p>
    </div>
  );
}

export function MediaPlayer({ id, url }: { id: string; url: string }) {
  const { t } = useLanguage();
  const floating = useContext(FloatingPlayerContext);
  if (!floating) throw new Error("MediaPlayer requires FloatingPlayerProvider.");
  const { session, registerSource } = floating;
  const [loaded, setLoaded] = useState(false);
  useEffect(() => registerSource(id, url), [id, url, registerSource]);
  if (!url) return null;
  const embed = mediaEmbed(url);
  const provider = mediaProvider(url);
  const ownSession = session?.id === id && session.url === url ? session : null;
  const active = loaded || !!ownSession;
  const pip = ownSession?.target;
  const supported = typeof window !== "undefined" && !!window.documentPictureInPicture;
  return (
    <div
      className={`max-w-full space-y-2 rounded-lg border bg-muted/30 p-2 dark:border-[#624876] dark:bg-[#20132e] ${
        active && !pip ? "w-full" : "w-fit"
      }`}
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            {provider === "YouTube" ? (
              <Youtube size={14} aria-hidden="true" />
            ) : provider === "Spotify" ? (
              <img src="/spotify.svg" width={14} height={14} alt="" className="dark:invert" />
            ) : (
              <ExternalLink size={14} aria-hidden="true" />
            )}
            {provider === "YouTube"
              ? t("Open on YouTube")
              : provider === "Spotify"
                ? t("Open on Spotify")
                : t("Open music link")}
          </a>
        </Button>
        {embed && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={floating.opening}
            onClick={() => {
              floating.clearError();
              if (active) floating.stop(id, url);
              setLoaded(!active);
            }}
          >
            {active ? <X size={14} /> : <Play size={14} />}
            {active ? t("Close player") : t("Play in app")}
          </Button>
        )}
        {active && embed && supported && !pip && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={floating.opening}
            onClick={() => void floating.open(id, url, embed)}
          >
            <PictureInPicture2 size={14} />
            {t("Floating player")}
          </Button>
        )}
        {pip && (
          <Button type="button" size="sm" variant="outline" onClick={floating.returnPlayer}>
            {t("Return player here")}
          </Button>
        )}
      </div>
      {!embed && (
        <p className="text-xs text-muted-foreground">
          {t("This link opens externally. In-app players support YouTube and Spotify.")}
        </p>
      )}
      {active && !pip && embed && <EmbeddedPlayer embed={embed} />}
      {active && (
        <p className="text-xs text-muted-foreground">
          {supported
            ? t("Opening or returning the floating player may restart playback.")
            : t("Picture-in-Picture is not supported in this browser.")}
        </p>
      )}
      {floating.error?.id === id && floating.error.url === url && (
        <p role="alert" className="text-sm text-destructive">
          {floating.error.message}
        </p>
      )}
    </div>
  );
}
