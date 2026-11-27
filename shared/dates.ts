import { z } from "zod";

export function formatUiDate(value: string): string {
  if (value === "") return "";
  z.iso.date().parse(value);
  return `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}`;
}

export function toIsoDate(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid calendar date.");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatUiTimestamp(value: string): string {
  const date = new Date(value);
  return `${formatUiDate(toIsoDate(date))} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
