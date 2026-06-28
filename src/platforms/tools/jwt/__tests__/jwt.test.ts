import { describe, expect, test } from "bun:test";
import { jwtAdapter } from "../adapter.js";

describe("jwt offline tool", () => {
  test("decodes a standard JWT structure", async () => {
    const token =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

    const result = await jwtAdapter.decode({ token });
    expect(result.ok).toBe(true);
    expect(result.data.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(result.data.payload).toEqual({ sub: "1234567890", name: "John Doe", iat: 1516239022 });
    expect(result.data.timing.expired).toBe(false);
  });

  test("throws error on invalid token format", async () => {
    expect(jwtAdapter.decode({ token: "invalidtoken" })).rejects.toThrow();
  });
});
