/** Domain types & default location — RFC §4, §5.1 / PRD Q12 */

export type Coordinates = {
  latitude: number;
  longitude: number;
  label: string;
  timezone: string;
};

export type PrayerName = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export type PrayerTimings = Record<PrayerName, string>;

export type HourlyWeather = {
  time: string;
  temperatureC: number;
  precipitationProbability: number;
  weatherCode: number;
};

export type RunSlot = {
  start: Date;
  end: Date;
  temperatureC: number;
  precipitationProbability: number;
  weatherCode: number;
  nearestPrayer: { name: PrayerName; at: Date; deltaMinutes: number };
  reasons: string[];
  score: number;
  isBest?: boolean;
};

export type RecommendationResult = {
  slots: RunSlot[];
  discardedSummary?: {
    past: number;
    prayerConflict: number;
    unsafeWeather: number;
  };
};

export const DEFAULT_LOCATION: Coordinates = {
  latitude: -6.2088,
  longitude: 106.8456,
  label: "Jakarta",
  timezone: "Asia/Jakarta",
};
