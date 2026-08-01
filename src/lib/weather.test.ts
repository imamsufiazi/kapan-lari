import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chartBarsFromHourly,
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

describe("chartBarsFromHourly", () => {
  it("keeps only hours 05:00–21:00 and scales bar height by precipitation (RFC §8.2)", () => {
    const hourly: HourlyWeather[] = [
      {
        time: "2026-08-01T04:00",
        temperatureC: 23,
        precipitationProbability: 5,
        weatherCode: 1,
      },
      {
        time: "2026-08-01T05:00",
        temperatureC: 24,
        precipitationProbability: 0,
        weatherCode: 1,
      },
      {
        time: "2026-08-01T12:00",
        temperatureC: 32,
        precipitationProbability: 50,
        weatherCode: 61,
      },
      {
        time: "2026-08-01T21:00",
        temperatureC: 27,
        precipitationProbability: 100,
        weatherCode: 63,
      },
      {
        time: "2026-08-01T22:00",
        temperatureC: 26,
        precipitationProbability: 80,
        weatherCode: 61,
      },
    ];

    const bars = chartBarsFromHourly(hourly);

    expect(bars.map((b) => b.hourLabel)).toEqual(["05", "12", "21"]);
    expect(bars[0]).toMatchObject({
      precipitationProbability: 0,
      temperatureC: 24,
      heightPercent: 0,
    });
    expect(bars[1]).toMatchObject({
      precipitationProbability: 50,
      heightPercent: 50,
    });
    expect(bars[2]).toMatchObject({
      precipitationProbability: 100,
      heightPercent: 100,
    });
  });

  it("returns empty array when no hourly rows fall in the chart window", () => {
    expect(
      chartBarsFromHourly([
        {
          time: "2026-08-01T03:00",
          temperatureC: 22,
          precipitationProbability: 10,
          weatherCode: 1,
        },
      ]),
    ).toEqual([]);
  });
});
