/**
 * Pure recommendation engine — RFC §7 (implemented in M1)
 *
 * Placeholder agar scaffold M0 tetap bisa di-import dari UI.
 * Diganti implementasi penuh + Vitest di commit M1.
 */

import type {
  HourlyWeather,
  PrayerTimings,
  RecommendationResult,
} from "./location";

export type RecommendInput = {
  now: Date;
  timezone: string;
  prayerTimings: PrayerTimings;
  hourlyWeather: HourlyWeather[];
};

export type DiscardedSummary = NonNullable<
  RecommendationResult["discardedSummary"]
>;

export function emptyStateMessage(_summary: DiscardedSummary): string {
  return "Tidak ada slot aman tersisa hari ini. Coba cek lagi besok, atau pilih kota lain.";
}

export function recommendRunSlots(_input: RecommendInput): RecommendationResult {
  return {
    slots: [],
    discardedSummary: { past: 0, prayerConflict: 0, unsafeWeather: 0 },
  };
}
