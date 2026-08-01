import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchHourlyWeather,
  summarizeWeather,
} from "./weather";
import type { HourlyWeather } from "./location";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchHourlyWeather", () => {
  it("requests Open-Meteo hourly with forecast_days=1 and timezone=auto (RFC §6.2)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        timezone: "Asia/Jakarta",
        hourly: {
          time: ["2026-08-01T05:00", "2026-08-01T06:00"],
          temperature_2m: [26.5, 27.1],
          precipitation_probability: [10, 20],
          weather_code: [1, 2],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchHourlyWeather({
      latitude: -6.2088,
      longitude: 106.8456,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe(
      "https://api.open-meteo.com/v1/forecast",
    );
    expect(url.searchParams.get("latitude")).toBe("-6.2088");
    expect(url.searchParams.get("longitude")).toBe("106.8456");
    expect(url.searchParams.get("hourly")).toBe(
      "temperature_2m,precipitation_probability,weather_code",
    );
    expect(url.searchParams.get("timezone")).toBe("auto");
    expect(url.searchParams.get("forecast_days")).toBe("1");

    expect(result.timezone).toBe("Asia/Jakarta");
    expect(result.hourly).toEqual([
      {
        time: "2026-08-01T05:00",
        temperatureC: 26.5,
        precipitationProbability: 10,
        weatherCode: 1,
      },
      {
        time: "2026-08-01T06:00",
        temperatureC: 27.1,
        precipitationProbability: 20,
        weatherCode: 2,
      },
    ]);
  });

  it("throws when the HTTP response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }),
    );

    await expect(
      fetchHourlyWeather({ latitude: -6.2088, longitude: 106.8456 }),
    ).rejects.toThrow(/gagal|weather|meteo/i);
  });

  it("throws when hourly arrays are missing or mismatched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          timezone: "Asia/Jakarta",
          hourly: {
            time: ["2026-08-01T05:00"],
            temperature_2m: [26],
            precipitation_probability: [],
            weather_code: [1],
          },
        }),
      }),
    );

    await expect(
      fetchHourlyWeather({ latitude: -6.2088, longitude: 106.8456 }),
    ).rejects.toThrow();
  });
});

describe("summarizeWeather", () => {
  it("returns min/max temperature and peak precipitation probability", () => {
    const hourly: HourlyWeather[] = [
      {
        time: "2026-08-01T05:00",
        temperatureC: 24,
        precipitationProbability: 10,
        weatherCode: 1,
      },
      {
        time: "2026-08-01T12:00",
        temperatureC: 32,
        precipitationProbability: 40,
        weatherCode: 61,
      },
      {
        time: "2026-08-01T18:00",
        temperatureC: 28,
        precipitationProbability: 15,
        weatherCode: 2,
      },
    ];

    expect(summarizeWeather(hourly)).toEqual({
      minTempC: 24,
      maxTempC: 32,
      maxPrecipitationProbability: 40,
      conditionCode: 61,
    });
  });
});
