import { describe, expect, test } from "bun:test";

import { geoAdapter } from "../adapter.js";

describe("geo adapter", () => {
  test("calculates haversine distance", async () => {
    const result = await geoAdapter.distance({
      from: "19.0760,72.8777",
      to: "28.6139,77.2090",
      unit: "km",
    });

    expect(result.ok).toBe(true);
    expect(result.action).toBe("distance");
    expect(Number(result.data?.distance)).toBeGreaterThan(1100);
  });

  test("encodes and decodes plus codes", async () => {
    const encoded = await geoAdapter.plusCodeEncode({
      lat: "19.0760",
      lon: "72.8777",
      length: 10,
    });

    const code = String(encoded.data?.plusCode ?? "");
    const decoded = await geoAdapter.plusCodeDecode({ code });

    expect(code).toContain("+");
    expect(decoded.ok).toBe(true);
    expect(typeof decoded.data?.latitudeCenter).toBe("number");
    expect(typeof decoded.data?.longitudeCenter).toBe("number");
  });
});
