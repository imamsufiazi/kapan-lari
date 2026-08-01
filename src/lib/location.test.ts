import { describe, expect, it } from "vitest";
import { DEFAULT_LOCATION } from "./location";

describe("DEFAULT_LOCATION", () => {
  it("defaults to Jakarta per PRD Q12 / RFC §5.1", () => {
    expect(DEFAULT_LOCATION.label).toBe("Jakarta");
    expect(DEFAULT_LOCATION.latitude).toBe(-6.2088);
    expect(DEFAULT_LOCATION.longitude).toBe(106.8456);
    expect(DEFAULT_LOCATION.timezone).toBe("Asia/Jakarta");
  });
});
