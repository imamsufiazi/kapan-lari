import { describe, expect, it } from "vitest";
import type { HourlyWeather, PrayerTimings } from "./location";
import {
  emptyStateMessage,
  recommendRunSlots,
} from "./recommendRunSlots";

const TZ = "Asia/Jakarta";

/** Wall-clock time in Asia/Jakarta (UTC+7, no DST). */
function jakarta(
  y: number,
  m: number,
  d: number,
  h: number,
  min = 0,
  sec = 0,
  ms = 0,
): Date {
  return new Date(Date.UTC(y, m - 1, d, h - 7, min, sec, ms));
}

const PRAYERS: PrayerTimings = {
  Fajr: "04:45",
  Dhuhr: "12:00",
  Asr: "15:15",
  Maghrib: "18:00",
  Isha: "19:15",
};

/** Safe weather for every hour 05–20 on the fixture day. */
function safeHourly(day = 1): HourlyWeather[] {
  return Array.from({ length: 16 }, (_, i) => {
    const hour = 5 + i;
    return {
      time: `2026-08-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00`,
      temperatureC: 27,
      precipitationProbability: 10,
      weatherCode: 1,
    };
  });
}

function withHour(
  base: HourlyWeather[],
  hour: number,
  patch: Partial<HourlyWeather>,
): HourlyWeather[] {
  return base.map((row) => {
    const h = Number(row.time.slice(11, 13));
    return h === hour ? { ...row, ...patch } : row;
  });
}

describe("recommendRunSlots", () => {
  it("generates 1-hour slots from 05:00–21:00 (window bounds + 1h duration)", () => {
    const now = jakarta(2026, 8, 1, 4, 0);
    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: {
        // Fajr 04:30 → buffer [04:00, 05:00); slot 05–06 starts at forbiddenEnd → lolos
        Fajr: "04:30",
        Dhuhr: "12:00",
        Asr: "15:15",
        Maghrib: "18:00",
        Isha: "19:15",
      },
      hourlyWeather: safeHourly(),
    });

    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.slots).toHaveLength(5);
    expect(result.slots[0]!.start).toEqual(jakarta(2026, 8, 1, 5, 0));
    const lastCandidateEnd = jakarta(2026, 8, 1, 21, 0);
    for (const slot of result.slots) {
      expect(slot.start.getTime()).toBeGreaterThanOrEqual(
        jakarta(2026, 8, 1, 5, 0).getTime(),
      );
      expect(slot.end.getTime()).toBeLessThanOrEqual(lastCandidateEnd.getTime());
      expect(slot.end.getTime() - slot.start.getTime()).toBe(60 * 60 * 1000);
    }
  });

  it("discards slots that overlap prayer buffer ±30 minutes (partial overlap too)", () => {
    const now = jakarta(2026, 8, 1, 5, 0);
    // Dhuhr 12:00 → forbidden [11:30, 12:30) overlaps 11–12 and 12–13
    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: PRAYERS,
      hourlyWeather: safeHourly(),
    });

    const starts = result.slots.map((s) => s.start.getTime());
    expect(starts).not.toContain(jakarta(2026, 8, 1, 11, 0).getTime());
    expect(starts).not.toContain(jakarta(2026, 8, 1, 12, 0).getTime());
    expect(result.discardedSummary?.prayerConflict).toBeGreaterThan(0);
  });

  it("discards precipitationProbability >= 50; keeps 49", () => {
    const now = jakarta(2026, 8, 1, 5, 0);
    // Isolasi jam 8 & 9: jam lain dibuat unsafe agar tidak menyingkirkan 9 dari top 5
    const weather = safeHourly().map((row) => {
      const h = Number(row.time.slice(11, 13));
      if (h === 8) return { ...row, precipitationProbability: 50 };
      if (h === 9) return { ...row, precipitationProbability: 49 };
      return { ...row, precipitationProbability: 80 };
    });

    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: PRAYERS,
      hourlyWeather: weather,
    });

    const starts = result.slots.map((s) => s.start.getTime());
    expect(starts).not.toContain(jakarta(2026, 8, 1, 8, 0).getTime());
    expect(starts).toContain(jakarta(2026, 8, 1, 9, 0).getTime());
    expect(result.discardedSummary?.unsafeWeather).toBeGreaterThan(0);
  });

  it("discards temperatureC > 33; keeps exactly 33", () => {
    const now = jakarta(2026, 8, 1, 5, 0);
    const weather = safeHourly().map((row) => {
      const h = Number(row.time.slice(11, 13));
      if (h === 8) return { ...row, temperatureC: 34 };
      if (h === 9) return { ...row, temperatureC: 33 };
      return { ...row, temperatureC: 40 };
    });

    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: PRAYERS,
      hourlyWeather: weather,
    });

    const starts = result.slots.map((s) => s.start.getTime());
    expect(starts).not.toContain(jakarta(2026, 8, 1, 8, 0).getTime());
    expect(starts).toContain(jakarta(2026, 8, 1, 9, 0).getTime());
  });

  it("discards dangerous weather code 95; keeps light rain code 61", () => {
    const now = jakarta(2026, 8, 1, 5, 0);
    const weather = withHour(
      withHour(safeHourly(), 8, { weatherCode: 95 }),
      9,
      { weatherCode: 61 },
    );

    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: PRAYERS,
      hourlyWeather: weather,
    });

    const starts = result.slots.map((s) => s.start.getTime());
    expect(starts).not.toContain(jakarta(2026, 8, 1, 8, 0).getTime());
    expect(starts).toContain(jakarta(2026, 8, 1, 9, 0).getTime());
  });

  it("discards past slots when now >= slot.end (boundary: exact end)", () => {
    // Slot 05–06 ends at 06:00; now === end → discarded
    const now = jakarta(2026, 8, 1, 6, 0);
    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: PRAYERS,
      hourlyWeather: safeHourly(),
    });

    const starts = result.slots.map((s) => s.start.getTime());
    expect(starts).not.toContain(jakarta(2026, 8, 1, 5, 0).getTime());
    expect(result.discardedSummary?.past).toBeGreaterThan(0);
  });

  it("keeps a slot when now is 1ms before slot.end (unless other filters)", () => {
    // 09–10 is clear of prayer buffers (Fajr~04:45, Dhuhr 12:00)
    const slotEnd = jakarta(2026, 8, 1, 10, 0);
    const now = new Date(slotEnd.getTime() - 1);
    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: PRAYERS,
      hourlyWeather: safeHourly(),
    });

    expect(result.slots.some((s) => s.start.getTime() === jakarta(2026, 8, 1, 9, 0).getTime())).toBe(
      true,
    );
  });

  it("samples weather at slot start hour (06–07 uses 06:00), not average", () => {
    const now = jakarta(2026, 8, 1, 5, 0);
    const weather = withHour(
      withHour(safeHourly(), 6, {
        temperatureC: 28,
        precipitationProbability: 5,
        weatherCode: 0,
      }),
      7,
      { temperatureC: 40, precipitationProbability: 90, weatherCode: 95 },
    );

    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: PRAYERS,
      hourlyWeather: weather,
    });

    const slot6 = result.slots.find(
      (s) => s.start.getTime() === jakarta(2026, 8, 1, 6, 0).getTime(),
    );
    expect(slot6).toBeDefined();
    expect(slot6!.temperatureC).toBe(28);
    expect(slot6!.precipitationProbability).toBe(5);
  });

  it("returns max 5 slots sorted by score descending with isBest only on slots[0]", () => {
    const now = jakarta(2026, 8, 1, 4, 0);
    const weather = safeHourly().map((row, i) => ({
      ...row,
      // Vary comfort so ranking is deterministic; keep all safe
      temperatureC: 26 + (i % 3),
      precipitationProbability: 5 + i,
    }));

    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: {
        // Push Fajr earlier so 05–06 is not prayer-blocked
        Fajr: "04:00",
        Dhuhr: "12:00",
        Asr: "15:15",
        Maghrib: "18:00",
        Isha: "19:15",
      },
      hourlyWeather: weather,
    });

    expect(result.slots).toHaveLength(5);
    expect(result.slots[0]!.isBest).toBe(true);
    for (let i = 1; i < result.slots.length; i++) {
      expect(result.slots[i]!.isBest).toBeFalsy();
      expect(result.slots[i - 1]!.score).toBeGreaterThanOrEqual(result.slots[i]!.score);
    }
  });

  it("ranks comfortable temp first, then lower rain, then earlier slot", () => {
    const now = jakarta(2026, 8, 1, 5, 0);
    // Hanya biarkan jam 7/9/10 aman agar urutan ranking terisolasi
    const weather = safeHourly().map((row) => {
      const h = Number(row.time.slice(11, 13));
      if (h === 7) {
        return { ...row, temperatureC: 20, precipitationProbability: 0 }; // non-nyaman
      }
      if (h === 9) {
        return { ...row, temperatureC: 27, precipitationProbability: 20 }; // nyaman, hujan lebih tinggi
      }
      if (h === 10) {
        return { ...row, temperatureC: 27, precipitationProbability: 5 }; // nyaman, hujan lebih rendah
      }
      return { ...row, precipitationProbability: 90 };
    });

    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: PRAYERS,
      hourlyWeather: weather,
    });

    expect(result.slots).toHaveLength(3);
    expect(result.slots[0]!.start).toEqual(jakarta(2026, 8, 1, 10, 0));
    expect(result.slots[1]!.start).toEqual(jakarta(2026, 8, 1, 9, 0));
    expect(result.slots[2]!.start).toEqual(jakarta(2026, 8, 1, 7, 0));
  });

  it("fills nearestPrayer and Indonesian reasons for each surviving slot", () => {
    const now = jakarta(2026, 8, 1, 5, 0);
    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: PRAYERS,
      hourlyWeather: safeHourly(),
    });

    expect(result.slots.length).toBeGreaterThan(0);
    for (const slot of result.slots) {
      expect(slot.nearestPrayer.name).toMatch(/^(Fajr|Dhuhr|Asr|Maghrib|Isha)$/);
      expect(slot.nearestPrayer.deltaMinutes).toBeGreaterThanOrEqual(0);
      expect(slot.reasons.length).toBeGreaterThan(0);
      expect(slot.reasons.every((r) => typeof r === "string" && r.length > 0)).toBe(true);
      expect(slot.reasons).toContain("Tidak berdekatan dengan waktu sholat");
    }
  });

  it("returns empty slots with discardedSummary when nothing is safe", () => {
    const now = jakarta(2026, 8, 1, 5, 0);
    const weather = safeHourly().map((row) => ({
      ...row,
      precipitationProbability: 80,
    }));

    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: PRAYERS,
      hourlyWeather: weather,
    });

    expect(result.slots).toEqual([]);
    expect(result.discardedSummary).toBeDefined();
    expect(result.discardedSummary!.unsafeWeather).toBeGreaterThan(0);
    expect(
      result.discardedSummary!.past +
        result.discardedSummary!.prayerConflict +
        result.discardedSummary!.unsafeWeather,
    ).toBeGreaterThan(0);
  });

  it("marks past as dominant when almost all candidates are already over", () => {
    const now = jakarta(2026, 8, 1, 21, 30);
    const result = recommendRunSlots({
      now,
      timezone: TZ,
      prayerTimings: PRAYERS,
      hourlyWeather: safeHourly(),
    });

    expect(result.slots).toEqual([]);
    expect(result.discardedSummary!.past).toBe(16);
    expect(emptyStateMessage(result.discardedSummary!)).toBe(
      "Hari hampir habis — tidak ada slot lari tersisa untuk hari ini.",
    );
  });
});

describe("emptyStateMessage", () => {
  it("picks weather-dominant copy", () => {
    expect(
      emptyStateMessage({ past: 1, prayerConflict: 2, unsafeWeather: 10 }),
    ).toBe(
      "Cuaca hari ini kurang aman untuk lari. Coba cek lagi nanti atau pilih kota lain.",
    );
  });

  it("picks prayer-dominant copy", () => {
    expect(
      emptyStateMessage({ past: 1, prayerConflict: 8, unsafeWeather: 2 }),
    ).toBe("Sisa hari terlalu dekat dengan waktu sholat. Coba cek lagi besok.");
  });

  it("picks mixed copy on tie", () => {
    expect(
      emptyStateMessage({ past: 5, prayerConflict: 5, unsafeWeather: 2 }),
    ).toBe(
      "Tidak ada slot aman tersisa hari ini. Coba cek lagi besok, atau pilih kota lain.",
    );
  });
});
