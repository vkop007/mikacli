import { describe, expect, test } from "bun:test";
import crypto from "crypto";
import { jwtAdapter } from "../adapter.js";

describe("jwt offline tool", () => {
  const secret = "my-secure-test-secret-123456";
  const header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
  const payload = "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ";
  const signature = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  const token = `${header}.${payload}.${signature}`;

  test("decodes a standard JWT structure", async () => {
    const result = await jwtAdapter.decode({ token });
    expect(result.ok).toBe(true);

    const data = result.data as any;
    expect(data.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(data.payload).toEqual({ sub: "1234567890", name: "John Doe", iat: 1516239022 });
    expect(data.timing.expired).toBe(false);
  });

  test("throws error on invalid token format", async () => {
    expect(jwtAdapter.decode({ token: "invalidtoken" })).rejects.toThrow();
  });

  test("verifies signature with correct HMAC secret", async () => {
    // Generate a fresh signed token
    const signResult = await jwtAdapter.sign({
      payload: { sub: "user-123", role: "admin" },
      secretOrKey: secret,
      algorithm: "HS256",
    });
    const freshToken = signResult.data?.token as string;
    expect(freshToken).toBeDefined();

    // Verify it
    const verifyResult = await jwtAdapter.verify({
      token: freshToken,
      secret,
    });
    expect(verifyResult.ok).toBe(true);
    expect(verifyResult.data?.isValid).toBe(true);
  });

  test("fails verification with incorrect HMAC secret", async () => {
    const signResult = await jwtAdapter.sign({
      payload: { sub: "user-123" },
      secretOrKey: secret,
    });
    const freshToken = signResult.data?.token as string;

    const verifyResult = await jwtAdapter.verify({
      token: freshToken,
      secret: "wrong-secret",
    });
    expect(verifyResult.ok).toBe(true);
    expect(verifyResult.data?.isValid).toBe(false);
  });

  test("signs and verifies using RSA keypair", async () => {
    // Generate RSA key pair
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const signResult = await jwtAdapter.sign({
      payload: { sub: "rsa-user" },
      secretOrKey: privateKey,
      algorithm: "RS256",
    });
    const rsaToken = signResult.data?.token as string;
    expect(rsaToken).toBeDefined();

    const verifyResult = await jwtAdapter.verify({
      token: rsaToken,
      secret: publicKey,
    });
    expect(verifyResult.ok).toBe(true);
    expect(verifyResult.data?.isValid).toBe(true);
  });

  test("audits token for security issues", async () => {
    // 1. Audit token with weak secret
    const weakSignResult = await jwtAdapter.sign({
      payload: { sub: "admin", exp: Math.floor(Date.now() / 1000) + 3600 },
      secretOrKey: "secret", // weak secret
    });
    const weakToken = weakSignResult.data?.token as string;
    const weakAudit = await jwtAdapter.audit({ token: weakToken });
    const weakIssues = weakAudit.data?.issues as any[];
    expect(weakIssues.some((i) => i.severity === "HIGH" && i.message.includes("Weak HMAC secret"))).toBe(true);

    // 2. Audit token with missing expiration and sensitive data
    const insecureSignResult = await jwtAdapter.sign({
      payload: { sub: "admin", db_password: "cleartextpassword" }, // missing exp, sensitive key
      secretOrKey: secret,
    });
    const insecureToken = insecureSignResult.data?.token as string;
    const insecureAudit = await jwtAdapter.audit({ token: insecureToken });
    const insecureIssues = insecureAudit.data?.issues as any[];
    expect(insecureIssues.some((i) => i.severity === "MEDIUM" && i.message.includes("Missing expiration"))).toBe(true);
    expect(insecureIssues.some((i) => i.severity === "MEDIUM" && i.message.includes("Potential sensitive field"))).toBe(true);

    // 3. Audit token with none algorithm
    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const nonePayload = Buffer.from(JSON.stringify({ sub: "user" })).toString("base64url");
    const noneToken = `${noneHeader}.${nonePayload}.`;
    const noneAudit = await jwtAdapter.audit({ token: noneToken });
    const noneIssues = noneAudit.data?.issues as any[];
    expect(noneIssues.some((i) => i.severity === "HIGH" && i.message.includes("none"))).toBe(true);
  });
});
