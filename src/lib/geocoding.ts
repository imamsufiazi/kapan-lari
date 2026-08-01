/**
 * Open-Meteo Geocoding search — RFC §5.3 / PRD Q7–Q8
 * Filter Indonesia: countryCode=ID, language=id, count=5
 */

import type { Coordinates } from "./location";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

type GeocodingApiResult = {
  name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  admin1?: string;
};

export async function searchCities(query: string): Promise<Coordinates[]> {
  const name = query.trim();
  if (name.length < 2) {
    return [];
  }

  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", name);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "id");
  url.searchParams.set("countryCode", "ID");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Gagal mencari kota (geocoding ${response.status})`);
  }

  const body = (await response.json()) as { results?: GeocodingApiResult[] };
  const results = body.results;
  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  const cities: Coordinates[] = [];
  for (const item of results) {
    if (
      typeof item.name !== "string" ||
      item.name.trim() === "" ||
      typeof item.latitude !== "number" ||
      typeof item.longitude !== "number" ||
      typeof item.timezone !== "string" ||
      item.timezone.trim() === ""
    ) {
      continue;
    }

    const admin =
      typeof item.admin1 === "string" && item.admin1.trim() !== ""
        ? item.admin1.trim()
        : null;

    cities.push({
      latitude: item.latitude,
      longitude: item.longitude,
      label: admin ? `${item.name.trim()}, ${admin}` : item.name.trim(),
      timezone: item.timezone,
    });
  }

  return cities;
}
