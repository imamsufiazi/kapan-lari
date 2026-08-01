import { describe, expect, it } from "vitest";
import {
  formatNearestPrayer,
  prayerLabel,
  weatherConditionLabel,
} from "./display";

describe("prayerLabel", () => {
  it("maps prayer names to Indonesian UI labels (PRD Q13)", () => {
    expect(prayerLabel("Fajr")).toBe("Subuh");
    expect(prayerLabel("Dhuhr")).toBe("Zuhur");
    expect(prayerLabel("Asr")).toBe("Ashar");
    expect(prayerLabel("Maghrib")).toBe("Maghrib");
    expect(prayerLabel("Isha")).toBe("Isya");
  });
});

describe("formatNearestPrayer", () => {
  it("shows Indonesian name and absolute delta minutes (US-2 / RFC §7.8)", () => {
    expect(
      formatNearestPrayer({ name: "Asr", deltaMinutes: 45 }),
    ).toBe("Ashar (45 mnt)");
  });
});

describe("weatherConditionLabel", () => {
  it("returns short Indonesian labels for common WMO codes (RFC §8.1)", () => {
    expect(weatherConditionLabel(0)).toBe("Cerah");
    expect(weatherConditionLabel(1)).toBe("Cerah berawan");
    expect(weatherConditionLabel(2)).toBe("Berawan sebagian");
    expect(weatherConditionLabel(3)).toBe("Berawan");
    expect(weatherConditionLabel(45)).toBe("Berkabut");
    expect(weatherConditionLabel(61)).toBe("Hujan ringan");
    expect(weatherConditionLabel(63)).toBe("Hujan sedang");
    expect(weatherConditionLabel(65)).toBe("Hujan lebat");
    expect(weatherConditionLabel(80)).toBe("Hujan lokal");
    expect(weatherConditionLabel(95)).toBe("Badai petir");
  });

  it("falls back for unknown codes", () => {
    expect(weatherConditionLabel(999)).toBe("Kondisi tidak diketahui");
  });
});
