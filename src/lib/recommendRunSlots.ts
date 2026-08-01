/**
 * Pure recommendation engine — RFC §7 / PRD §9
 * Deterministic & testable: `now` diinject; tidak ada I/O.
 */

import type {
  HourlyWeather,
  PrayerName,
  PrayerTimings,
  RecommendationResult,
  RunSlot,
} from "./location";

const PRAYER_NAMES: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

/** WMO / Open-Meteo codes ditolak untuk filter cuaca seimbang (RFC §7.5). */
const DANGEROUS_WEATHER_CODES = new Set([65, 66, 67, 75, 82, 95, 96, 99]);

const BUFFER_MS = 30 * 60 * 1000;
const MAX_SLOTS = 5;

export type RecommendInput = {
  now: Date;
  timezone: string;
  prayerTimings: PrayerTimings;
  hourlyWeather: HourlyWeather[];
};

export type DiscardedSummary = NonNullable<
  RecommendationResult["discardedSummary"]
>;

const EMPTY_PAST =
  "Hari hampir habis — tidak ada slot lari tersisa untuk hari ini.";
const EMPTY_WEATHER =
  "Cuaca hari ini kurang aman untuk lari. Coba cek lagi nanti atau pilih kota lain.";
const EMPTY_PRAYER =
  "Sisa hari terlalu dekat dengan waktu sholat. Coba cek lagi besok.";
const EMPTY_MIXED =
  "Tidak ada slot aman tersisa hari ini. Coba cek lagi besok, atau pilih kota lain.";

export function emptyStateMessage(summary: DiscardedSummary): string {
  const { past, prayerConflict, unsafeWeather } = summary;
  const max = Math.max(past, prayerConflict, unsafeWeather);
  const winners = (
    [
      past === max ? "past" : null,
      prayerConflict === max ? "prayerConflict" : null,
      unsafeWeather === max ? "unsafeWeather" : null,
    ] as const
  ).filter((v): v is NonNullable<typeof v> => v !== null);

  if (winners.length !== 1) return EMPTY_MIXED;
  if (winners[0] === "past") return EMPTY_PAST;
  if (winners[0] === "unsafeWeather") return EMPTY_WEATHER;
  return EMPTY_PRAYER;
}

export function recommendRunSlots(input: RecommendInput): RecommendationResult {
  const { now, timezone, prayerTimings, hourlyWeather } = input;
  const discarded: DiscardedSummary = {
    past: 0,
    prayerConflict: 0,
    unsafeWeather: 0,
  };

  const { year, month, day } = zonedYmd(now, timezone);
  const prayers = PRAYER_NAMES.map((name) => ({
    name,
    at: parsePrayerTime(prayerTimings[name], year, month, day, timezone),
  }));

  const forbidden = prayers.map((p) => ({
    start: new Date(p.at.getTime() - BUFFER_MS),
    end: new Date(p.at.getTime() + BUFFER_MS),
  }));

  const weatherByHour = indexWeatherByLocalHour(hourlyWeather, year, month, day);

  type Candidate = Omit<RunSlot, "score" | "isBest" | "reasons"> & {
    localHour: number;
  };

  const survivors: Candidate[] = [];

  for (let hour = 5; hour <= 20; hour++) {
    const start = zonedLocalDate(timezone, year, month, day, hour, 0);
    const end = zonedLocalDate(timezone, year, month, day, hour + 1, 0);

    if (now.getTime() >= end.getTime()) {
      discarded.past += 1;
      continue;
    }

    if (forbidden.some((f) => overlaps(start, end, f.start, f.end))) {
      discarded.prayerConflict += 1;
      continue;
    }

    const weather = weatherByHour.get(hour);
    if (!weather || isUnsafeWeather(weather)) {
      discarded.unsafeWeather += 1;
      continue;
    }

    survivors.push({
      start,
      end,
      temperatureC: weather.temperatureC,
      precipitationProbability: weather.precipitationProbability,
      weatherCode: weather.weatherCode,
      nearestPrayer: findNearestPrayer(start, prayers),
      localHour: hour,
    });
  }

  const ranked = survivors
    .map((slot) => {
      const score = scoreSlot(slot);
      return {
        ...slot,
        score,
        reasons: buildReasons(slot),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SLOTS)
    .map(({ localHour: _localHour, ...slot }, index) => ({
      ...slot,
      isBest: index === 0 ? true : undefined,
    }));

  return {
    slots: ranked,
    discardedSummary: discarded,
  };
}

function isUnsafeWeather(w: HourlyWeather): boolean {
  return (
    w.precipitationProbability >= 50 ||
    w.temperatureC > 33 ||
    DANGEROUS_WEATHER_CODES.has(w.weatherCode)
  );
}

function overlaps(
  slotStart: Date,
  slotEnd: Date,
  forbiddenStart: Date,
  forbiddenEnd: Date,
): boolean {
  return (
    slotStart.getTime() < forbiddenEnd.getTime() &&
    forbiddenStart.getTime() < slotEnd.getTime()
  );
}

function scoreSlot(slot: {
  temperatureC: number;
  precipitationProbability: number;
  localHour: number;
}): number {
  const tempFit =
    slot.temperatureC >= 22 && slot.temperatureC <= 30
      ? 100
      : Math.max(0, 100 - Math.abs(slot.temperatureC - 26) * 5);
  const rain = 100 - slot.precipitationProbability;
  const morning = 24 - slot.localHour;
  return tempFit * 1e4 + rain * 1e2 + morning;
}

function buildReasons(slot: {
  temperatureC: number;
  precipitationProbability: number;
  weatherCode: number;
}): string[] {
  const reasons: string[] = ["Tidak berdekatan dengan waktu sholat"];
  if (slot.precipitationProbability < 50) {
    reasons.push("Peluang hujan rendah");
  }
  if (slot.temperatureC >= 22 && slot.temperatureC <= 30) {
    reasons.push("Suhu nyaman untuk lari");
  }
  if (!DANGEROUS_WEATHER_CODES.has(slot.weatherCode)) {
    reasons.push("Cuaca tidak ekstrem");
  }
  return reasons;
}

function findNearestPrayer(
  slotStart: Date,
  prayers: { name: PrayerName; at: Date }[],
): RunSlot["nearestPrayer"] {
  let best = prayers[0]!;
  let bestDelta = Math.abs(best.at.getTime() - slotStart.getTime());
  for (let i = 1; i < prayers.length; i++) {
    const p = prayers[i]!;
    const delta = Math.abs(p.at.getTime() - slotStart.getTime());
    if (delta < bestDelta) {
      best = p;
      bestDelta = delta;
    }
  }
  return {
    name: best.name,
    at: best.at,
    deltaMinutes: Math.round(bestDelta / 60_000),
  };
}

function parsePrayerTime(
  hhmm: string,
  year: number,
  month: number,
  day: number,
  timezone: string,
): Date {
  const [hStr, mStr] = hhmm.split(":");
  const hour = Number(hStr);
  const minute = Number(mStr);
  return zonedLocalDate(timezone, year, month, day, hour, minute);
}

function indexWeatherByLocalHour(
  hourly: HourlyWeather[],
  year: number,
  month: number,
  day: number,
): Map<number, HourlyWeather> {
  const map = new Map<number, HourlyWeather>();
  const dayPrefix = `${year}-${pad2(month)}-${pad2(day)}T`;

  for (const row of hourly) {
    // Open-Meteo local: "YYYY-MM-DDTHH:mm" or with offset/Z
    if (!row.time.startsWith(dayPrefix)) continue;
    const hour = Number(row.time.slice(11, 13));
    if (!Number.isFinite(hour)) continue;
    map.set(hour, row);
  }
  return map;
}

function zonedYmd(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = zonedParts(date, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

/** Instant yang merepresentasikan wall-clock lokal di `timeZone`. */
function zonedLocalDate(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = desiredAsUtc;

  for (let i = 0; i < 3; i++) {
    const parts = zonedParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    utc += desiredAsUtc - asUtc;
  }

  return new Date(utc);
}

function zonedParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const map = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
