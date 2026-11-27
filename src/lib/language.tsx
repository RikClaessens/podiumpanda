import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { resolveLanguage, translate, translateDynamic, type Locale } from "../../shared/i18n";
import { Picker } from "../components/picker";
import { PandaLoading } from "../components/panda-loading";

let override: Locale | null = null;
const storageKey = "podiumpanda.language";
let storageReadWarningLogged = false;
function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      override = null;
      listener();
    }
  };
  window.addEventListener("languagechange", listener);
  window.addEventListener("podiumpanda-language", listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("languagechange", listener);
    window.removeEventListener("podiumpanda-language", listener);
    window.removeEventListener("storage", onStorage);
  };
}
const getLocale = (): Locale => {
  if (override) return override;
  const languages = navigator.languages.length ? navigator.languages : [navigator.language];
  try {
    return resolveLanguage(window.localStorage.getItem(storageKey), languages);
  } catch (error) {
    if (!storageReadWarningLogged) {
      console.warn("Could not read the saved language preference.", error);
      storageReadWarningLogged = true;
    }
  }
  return resolveLanguage(null, languages);
};
const serverLocale = (): Locale => "nl";
const LanguageContext = createContext<{
  locale: Locale;
  t: (key: string, values?: Record<string, string | number>) => string;
  dynamic: (message: string) => string;
  setLanguage: (locale: Locale) => void;
  languageSaveFailed: boolean;
}>({
  locale: "nl",
  t: (key, values) => translate("nl", key, values),
  dynamic: (message) => translateDynamic("nl", message),
  languageSaveFailed: false,
  setLanguage: () => {
    throw new Error("LanguageProvider is required.");
  },
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getLocale, serverLocale);
  const [languageSaveFailed, setLanguageSaveFailed] = useState(false);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `PodiumPanda · ${translate(locale, "Make room for music")}`;
  }, [locale]);
  return (
    <LanguageContext.Provider
      value={{
        locale,
        t: (key, values) => translate(locale, key, values),
        dynamic: (message) => translateDynamic(locale, message),
        languageSaveFailed,
        setLanguage: (next) => {
          try {
            window.localStorage.setItem(storageKey, next);
            override = null;
            setLanguageSaveFailed(false);
          } catch (error) {
            console.warn("Could not save the language preference.", error);
            override = next;
            setLanguageSaveFailed(true);
          }
          window.dispatchEvent(new Event("podiumpanda-language"));
        },
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function Opening() {
  const { t } = useLanguage();
  return (
    <main className="p-8">
      <PandaLoading label={t("Opening PodiumPanda…")} />
    </main>
  );
}

export function LanguageSelect() {
  const { locale, t, setLanguage, languageSaveFailed } = useLanguage();
  return (
    <div className="min-w-0">
      <Picker
        ariaLabel={t("Language")}
        value={locale}
        onValueChange={(value) => {
          if (value === "nl" || value === "en") setLanguage(value);
        }}
        options={[
          { value: "nl", label: "Nederlands" },
          { value: "en", label: "English" },
        ]}
      />
      {languageSaveFailed && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {t("Your language choice could not be saved on this device.")}
        </p>
      )}
    </div>
  );
}
