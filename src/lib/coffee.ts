import type { Locale } from "../../shared/i18n";

export type CoffeePresetId = "espresso" | "coffeeAndCroissant" | "coffeeAndCake";
export type CoffeeChoice = CoffeePresetId | "custom";

// Amounts are only displayed; keep them equal to the fixed amounts of the Mollie links.
export const coffeePresets: { id: CoffeePresetId; cents: number }[] = [
  { id: "espresso", cents: 250 },
  { id: "coffeeAndCroissant", cents: 400 },
  { id: "coffeeAndCake", cents: 600 },
];

// Reusable Mollie payment links: fixed amounts for presets, "customer sets the price" for custom.
// Choices without a link are hidden in production.
export const coffeeLinks: Record<CoffeeChoice, string> = {
  espresso: "",
  coffeeAndCroissant: "",
  coffeeAndCake: "",
  custom: "",
};

export const coffeeAvailable = (choice: CoffeeChoice) =>
  coffeeLinks[choice].length > 0 || import.meta.env.DEV;

export function formatCents(cents: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
