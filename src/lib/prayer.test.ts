import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPrayerTimings } from "./prayer";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchPrayerTimings", () => {
  it("requests Aladhan timings with method=20 and school=0 (RFC §6.1 / PRD Q10, Q18)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          timings: {
            Fajr: "04:45",
            Sunrise: "06:02",
            Dhuhr: "12:01",
            Asr: "15:20",
            Maghrib: "18:05",
            Isha: "19:18",
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const timings = await fetchPrayerTimings({
      latitude: -6.2088,
      longitude: 106.8456,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe(
      "https://api.aladhan.com/v1/timings",
    );
    expect(url.searchParams.get("latitude")).toBe("-6.2088");
    expect(url.searchParams.get("longitude")).toBe("106.8456");
    expect(url.searchParams.get("method")).toBe("20");
    expect(url.searchParams.get("school")).toBe("0");

    expect(timings).toEqual({
      Fajr: "04:45",
      Dhuhr: "12:01",
      Asr: "15:20",
      Maghrib: "18:05",
      Isha: "19:18",
    });
  });

  it("strips timezone suffixes from Aladhan HH:mm fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          data: {
            timings: {
              Fajr: "04:45 (WIB)",
              Dhuhr: "12:01 (WIB)",
              Asr: "15:20 (WIB)",
              Maghrib: "18:05 (WIB)",
              Isha: "19:18 (WIB)",
            },
          },
        }),
      }),
    );

    const timings = await fetchPrayerTimings({
      latitude: -6.2088,
      longitude: 106.8456,
    });

    expect(timings.Fajr).toBe("04:45");
    expect(timings.Isha).toBe("19:18");
  });

  it("throws when the HTTP response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }),
    );

    await expect(
      fetchPrayerTimings({ latitude: -6.2088, longitude: 106.8456 }),
    ).rejects.toThrow(/gagal|prayer|aladhan/i);
  });

  it("throws when a required prayer time is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 200,
          data: {
            timings: {
              Fajr: "04:45",
              Dhuhr: "12:01",
              Asr: "15:20",
              Maghrib: "18:05",
              // Isha missing
            },
          },
        }),
      }),
    );

    await expect(
      fetchPrayerTimings({ latitude: -6.2088, longitude: 106.8456 }),
    ).rejects.toThrow();
  });
});
