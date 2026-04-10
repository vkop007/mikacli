import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { getPlatformDefinitions } from "../platforms/index.js";

const CONTRACT_EXEMPTIONS = new Set(["download", "http"]);

describe("authenticated provider contract", () => {
  test("authenticated providers expose login and status commands", () => {
    const missing = getPlatformDefinitions().flatMap((definition) => {
      if (CONTRACT_EXEMPTIONS.has(definition.id)) {
        return [];
      }

      const authStrategies = definition.authStrategies.filter((strategy) => strategy !== "none");
      if (authStrategies.length === 0) {
        return [];
      }

      const command = buildPlatformCommand(definition);
      const commandNames = new Set(command.commands.map((subcommand) => subcommand.name()));
      const missingCommands = ["login", "status"].filter((name) => !commandNames.has(name));

      return missingCommands.length === 0 ? [] : [`${definition.id}: ${missingCommands.join(", ")}`];
    });

    expect(missing).toEqual([]);
  });
});
