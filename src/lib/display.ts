/**
 * UI copy helpers (Bahasa Indonesia) — PRD Q13 / RFC §7.7–7.8, §8.1
 * Pure & testable; no DOM.
 */

import type { PrayerName } from "./location";

const PRAYER_LABELS: Record<PrayerName, string> = {
  Fajr: "Subuh",
  Dhuhr: "Zuhur",
  Asr: "Ashar",
  Maghrib: "Maghrib",
  Isha: "Isya",
};

export function prayerLabel(name: PrayerName): string {
  return PRAYER_LABELS[name];
}

export function formatNearestPrayer(nearest: {
  name: PrayerName;
  deltaMinutes: number;
}): string {
  return `${prayerLabel(nearest.name)} (${nearest.deltaMinutes} mnt)`;
}

/** Short Indonesian condition from WMO / Open-Meteo weather code. */
export function weatherConditionLabel(code: number): string {
  if (code === 0) return "Cerah";
  if (code === 1) return "Cerah berawan";
  if (code === 2) return "Berawan sebagian";
  if (code === 3) return "Berawan";
  if (code === 45 || code === 48) return "Berkabut";
  if (code === 51 || code === 53 || code === 55) return "Gerimis";
  if (code === 61 || code === 66) return "Hujan ringan";
  if (code === 63) return "Hujan sedang";
  if (code === 65 || code === 67) return "Hujan lebat";
  if (code === 71 || code === 73 || code === 75 || code === 77) return "Salju";
  if (code === 80 || code === 81) return "Hujan lokal";
  if (code === 82) return "Hujan lokal lebat";
  if (code === 95 || code === 96 || code === 99) return "Badai petir";
  return "Kondisi tidak diketahui";
}
