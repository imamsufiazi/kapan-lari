import { afterEach, describe, expect, it, vi } from "vitest";
import { searchCities } from "./geocoding";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("searchCities", () => {
  it("requests Open-Meteo geocoding with countryCode=ID, language=id, count=5 (RFC §5.3 / PRD Q8)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 1,
            name: "Bandung",
            latitude: -6.9222,
            longitude: 107.6069,
            timezone: "Asia/Jakarta",
            admin1: "Jawa Barat",
            country_code: "ID",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchCities("Bandung");

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe(
      "https://geocoding-api.open-meteo.com/v1/search",
    );
    expect(url.searchParams.get("name")).toBe("Bandung");
    expect(url.searchParams.get("count")).toBe("5");
    expect(url.searchParams.get("language")).toBe("id");
    expect(url.searchParams.get("countryCode")).toBe("ID");

    expect(results).toEqual([
      {
        latitude: -6.9222,
        longitude: 107.6069,
        label: "Bandung, Jawa Barat",
        timezone: "Asia/Jakarta",
      },
    ]);
  });

  it("does not fetch when query is shorter than 2 characters (PLANNING E3.2)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchCities("B")).resolves.toEqual([]);
    await expect(searchCities("")).resolves.toEqual([]);
    await expect(searchCities("  ")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns empty array when API has no results (UI: Kota tidak ditemukan)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );

    await expect(searchCities("xyzzy")).resolves.toEqual([]);
  });

  it("uses name alone when admin1 is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              name: "Surabaya",
              latitude: -7.2575,
              longitude: 112.7521,
              timezone: "Asia/Jakarta",
            },
          ],
        }),
      }),
    );

    const results = await searchCities("Surabaya");
    expect(results[0]?.label).toBe("Surabaya");
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

    await expect(searchCities("Jakarta")).rejects.toThrow(/gagal|geocod/i);
  });

  it("skips results missing coordinates or timezone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { name: "Incomplete", latitude: -6.2 },
            {
              name: "Valid",
              latitude: -6.9,
              longitude: 107.6,
              timezone: "Asia/Jakarta",
              admin1: "Jawa Barat",
            },
          ],
        }),
      }),
    );

    const results = await searchCities("Valid");
    expect(results).toHaveLength(1);
    expect(results[0]?.label).toBe("Valid, Jawa Barat");
  });
});
