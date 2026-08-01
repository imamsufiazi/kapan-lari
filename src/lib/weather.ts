/**
 * Fetch/parse Open-Meteo forecast — RFC §6.2 / PRD Q2
 * hourly temperature, precipitation probability, weather code; today only
 */

import type { HourlyWeather } from "./location";

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export type WeatherFetchCoords = {
  latitude: number;
  longitude: number;
};

export type WeatherFetchResult = {
  hourly: HourlyWeather[];
  timezone: string;
};

export type WeatherSummary = {
  minTempC: number;
  maxTempC: number;
  maxPrecipitationProbability: number;
  /** Weather code pada jam dengan peluang hujan tertinggi (RFC §8.1 kondisi ringkas). */
  conditionCode: number;
};

export async function fetchHourlyWeather(
  coords: WeatherFetchCoords,
): Promise<WeatherFetchResult> {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set("latitude", String(coords.latitude));
  url.searchParams.set("longitude", String(coords.longitude));
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation_probability,weather_code",
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Gagal memuat cuaca (Open-Meteo ${response.status})`);
  }

  const body = (await response.json()) as {
    timezone?: string;
    hourly?: {
      time?: string[];
      temperature_2m?: Array<number | null>;
      precipitation_probability?: Array<number | null>;
      weather_code?: Array<number | null>;
    };
  };

  const timezone = body.timezone;
  const hourly = body.hourly;
  if (!timezone || !hourly?.time) {
    throw new Error("Gagal memuat cuaca: respons Open-Meteo tidak lengkap");
  }

  const { time, temperature_2m: temps, precipitation_probability: precip, weather_code: codes } =
    hourly;

  if (
    !temps ||
    !precip ||
    !codes ||
    temps.length !== time.length ||
    precip.length !== time.length ||
    codes.length !== time.length
  ) {
    throw new Error("Gagal memuat cuaca: data hourly tidak selaras");
  }

  const rows: HourlyWeather[] = [];
  for (let i = 0; i < time.length; i++) {
    const temperatureC = temps[i];
    const precipitationProbability = precip[i];
    const weatherCode = codes[i];
    if (
      temperatureC == null ||
      precipitationProbability == null ||
      weatherCode == null
    ) {
      continue;
    }
    rows.push({
      time: time[i]!,
      temperatureC,
      precipitationProbability,
      weatherCode,
    });
  }

  if (rows.length === 0) {
    throw new Error("Gagal memuat cuaca: tidak ada data hourly");
  }

  return { hourly: rows, timezone };
}

export function summarizeWeather(hourly: HourlyWeather[]): WeatherSummary {
  let minTempC = hourly[0]!.temperatureC;
  let maxTempC = hourly[0]!.temperatureC;
  let maxPrecipitationProbability = hourly[0]!.precipitationProbability;
  let conditionCode = hourly[0]!.weatherCode;

  for (let i = 1; i < hourly.length; i++) {
    const row = hourly[i]!;
    if (row.temperatureC < minTempC) minTempC = row.temperatureC;
    if (row.temperatureC > maxTempC) maxTempC = row.temperatureC;
    if (row.precipitationProbability > maxPrecipitationProbability) {
      maxPrecipitationProbability = row.precipitationProbability;
      conditionCode = row.weatherCode;
    }
  }

  return {
    minTempC,
    maxTempC,
    maxPrecipitationProbability,
    conditionCode,
  };
}
