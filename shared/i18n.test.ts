import { describe, expect, it } from "vitest";
import { detectLanguage, resolveLanguage, translate, translateDynamic } from "./i18n";

describe("language selection and translation", () => {
  it("matches regional system languages in preference order", () => {
    expect(detectLanguage(["nl-NL", "en-US"])).toBe("nl");
    expect(detectLanguage(["en-GB", "nl"])).toBe("en");
    expect(detectLanguage(["fr-FR", "nl-BE", "en"])).toBe("nl");
    expect(detectLanguage(["de", "EN_us"])).toBe("en");
  });
  it("defaults to Dutch when no supported language is found", () => {
    expect(detectLanguage([])).toBe("nl");
    expect(detectLanguage(["fr-FR", "de-DE"])).toBe("nl");
  });
  it("prefers a saved language and falls back to system settings for missing or invalid values", () => {
    expect(resolveLanguage("en", ["nl-NL"])).toBe("en");
    expect(resolveLanguage("nl", ["en-GB"])).toBe("nl");
    expect(resolveLanguage(null, ["en-GB"])).toBe("en");
    expect(resolveLanguage("invalid", ["fr-FR"])).toBe("nl");
  });
  it("translates names and dynamic history without translating user content", () => {
    expect(translate("nl", "Edit {name}", { name: "Alex" })).toBe("Alex bewerken");
    expect(translate("en", "Edit {name}", { name: "Alex" })).toBe("Edit Alex");
    expect(translateDynamic("nl", "Undid revision 12")).toBe("Versie 12 ongedaan gemaakt");
    expect(translateDynamic("nl", "This concert changed. Refresh and try your edit again.")).toBe(
      "Dit concert is gewijzigd. Vernieuw en probeer je wijziging opnieuw.",
    );
  });
});
