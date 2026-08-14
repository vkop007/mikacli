import { hashAdapter } from "./adapter.js";
import { hashCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const hashPlatformDefinition: PlatformDefinition = {
  id: "hash" as PlatformDefinition["id"],
  category: "tools",
  displayName: "Hash & Encoding",
  description: "Hash, sign, encode, and generate secrets offline",
  authStrategies: ["none"],
  adapter: hashAdapter,
  capabilities: hashCapabilities,
  examples: [
    'mikacli tools hash digest "hello world"',
    "mikacli tools hash digest --file ./dist/app.js --alg sha512",
    'mikacli tools hash hmac "payload" --secret my-key --encoding base64',
    "mikacli tools hash verify e5e9fa1ba31ecd1ae84f75caaa474f3a663f05f4 --file ./release.tar.gz",
    'mikacli tools hash encode "eyJhbGciOiJIUzI1NiJ9" --from base64url --to utf8',
    "mikacli tools hash uuid --uuid-version 7 --count 5",
    "mikacli tools hash random --bytes 32 --encoding base64url --json",
    "mikacli tools hash algorithms --json",
  ],
};
