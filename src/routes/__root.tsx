import { LanguageProvider, LanguageSelect, useLanguage } from "../lib/language";
import { useState } from "react";
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "../components/theme-toggle";
import { FloatingPlayerProvider } from "../components/media-player";
import { AppSwitcher } from "../components/app-switcher";
import { Button } from "../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import stylesheet from "../styles.css?url";
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "referrer", content: "no-referrer" },
      { name: "robots", content: "noindex,nofollow" },
      { title: "PodiumPanda" },
    ],
    links: [
      { rel: "stylesheet", href: stylesheet },
      { rel: "icon", type: "image/svg+xml", href: "/podiumpanda.svg" },
      { rel: "icon", type: "image/png", href: "/podiumpanda.png" },
      { rel: "apple-touch-icon", href: "/podiumpanda.png" },
    ],
  }),
  component: Root,
  notFoundComponent: NotFound,
  errorComponent: RootError,
});

function NotFound() {
  const { t } = useLanguage();
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1>{t("Page not found")}</h1>
      <Link to="/">{t("Go home")}</Link>
    </main>
  );
}

function RootError({ error, reset }: { error: unknown; reset: () => void }) {
  const { t, dynamic } = useLanguage();
  return (
    <main className="mx-auto max-w-5xl p-8" role="alert">
      <h1 className="section-title">{t("Something went wrong")}</h1>
      <p>{error instanceof Error ? dynamic(error.message) : t("An unexpected error occurred.")}</p>
      <Button type="button" onClick={reset}>
        {t("Try again")}
      </Button>
    </main>
  );
}

function Root() {
  return (
    <LanguageProvider>
      <RootContent />
    </LanguageProvider>
  );
}

function RootContent() {
  const { t, locale } = useLanguage();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="podiumpanda.theme"
        >
          <QueryClientProvider client={queryClient}>
            <header className="border-b bg-card/80 backdrop-blur">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
                <Link
                  to="/"
                  className="brand-title flex items-center gap-2 text-2xl font-bold tracking-tight"
                >
                  <img src="/podiumpanda.svg" alt="" width={44} height={44} />
                  PodiumPanda
                </Link>
                <div className="flex items-center gap-3">
                  <AppSwitcher />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="settings-trigger"
                        aria-label={t("Settings menu")}
                      >
                        <span className="menu-icon" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      sideOffset={8}
                      className="w-64 space-y-4"
                      aria-label={t("Settings")}
                    >
                      <h2 className="text-lg font-semibold">{t("Settings")}</h2>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{t("Language")}</span>
                        <LanguageSelect />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{t("Theme")}</span>
                        <ThemeToggle />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </header>
            <FloatingPlayerProvider>
              <Outlet />
            </FloatingPlayerProvider>
          </QueryClientProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
