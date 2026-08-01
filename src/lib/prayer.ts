/**
 * Fetch/parse Aladhan prayer timings — RFC §6.1 / PRD Q10, Q18
 * method=20 (Kemenag), school=0 (Shafi Asr)
 */

import type { PrayerName, PrayerTimings } from "./location";

const ALADHAN_TIMINGS_URL = "https://api.aladhan.com/v1/timings";
const PRAYER_NAMES: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

export type PrayerFetchCoords = {
  latitude: number;
  longitude: number;
};

export async function fetchPrayerTimings(
  coords: PrayerFetchCoords,
): Promise<PrayerTimings> {
  const url = new URL(ALADHAN_TIMINGS_URL);
  url.searchParams.set("latitude", String(coords.latitude));
  url.searchParams.set("longitude", String(coords.longitude));
  url.searchParams.set("method", "20");
  url.searchParams.set("school", "0");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Gagal memuat jadwal sholat (Aladhan ${response.status})`);
  }

  const body = (await response.json()) as {
    data?: { timings?: Record<string, string> };
  };
  const raw = body.data?.timings;
  if (!raw) {
    throw new Error("Gagal memuat jadwal sholat: respons Aladhan tidak lengkap");
  }

  const timings = {} as PrayerTimings;
  for (const name of PRAYER_NAMES) {
    const value = raw[name];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Gagal memuat jadwal sholat: waktu ${name} hilang`);
    }
    timings[name] = normalizeHhmm(value);
  }
  return timings;
}

/** Aladhan may append timezone labels, e.g. "04:45 (WIB)". */
function normalizeHhmm(value: string): string {
  const match = value.trim().match(/^(\d{1,2}:\d{2})/);
  if (!match) {
    throw new Error(`Gagal memuat jadwal sholat: format waktu tidak valid (${value})`);
  }
  return match[1]!;
}
