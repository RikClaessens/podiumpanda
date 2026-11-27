import { describe, expect, it } from "vitest";
import { formatUiDate, formatUiTimestamp, toIsoDate } from "./dates";

describe("Dutch-format dates", () => {
  it("renders exact dd-MM-yyyy independently of locale and UTC parsing", () => {
    expect(formatUiDate("2026-01-05")).toBe("05-01-2026");
    expect(formatUiDate("2028-02-29")).toBe("29-02-2028");
    expect(formatUiDate("")).toBe("");
    expect(() => formatUiDate("2026-02-30")).toThrow();
  });
  it("preserves the calendar-selected local day rather than converting it to UTC", () => {
    const date = new Date(2026, 0, 5, 0, 15);
    expect(toIsoDate(date)).toBe("2026-01-05");
    expect(formatUiTimestamp(date.toISOString())).toBe("05-01-2026 00:15");
  });
});
