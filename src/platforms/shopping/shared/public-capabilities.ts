import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import {
  printShoppingProductResult,
  printShoppingSearchResult,
  printShoppingStoreResult,
  printShoppingSuggestionsResult,
} from "./output.js";
import { parseShoppingLimitOption } from "./options.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";

interface PublicShoppingAdapter {
  readonly displayName: string;
  search(input: { query: string; limit?: number }): Promise<AdapterActionResult>;
  productInfo(input: { target: string }): Promise<AdapterActionResult>;
  storeInfo?(input: { target: string }): Promise<AdapterActionResult>;
  suggestions?(input: { query: string; limit?: number }): Promise<AdapterActionResult>;
}

interface PublicShoppingCapabilityOptions {
  searchDescription: string;
  productDescription: string;
  productCommand?: string;
  productAliases?: readonly string[];
  storeCommand?: string;
  storeAliases?: readonly string[];
  storeDescription?: string;
  suggestionsCommand?: string;
  suggestionsAliases?: readonly string[];
  suggestionsDescription?: string;
}

export function createPublicShoppingCapabilities(
  adapter: PublicShoppingAdapter,
  options: PublicShoppingCapabilityOptions,
): readonly PlatformCapability[] {
  const capabilities: PlatformCapability[] = [
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: options.searchDescription,
      spinnerText: `Searching ${adapter.displayName}...`,
      successMessage: `${adapter.displayName} search completed.`,
      options: [
        {
          flags: "--limit <number>",
          description: "Maximum number of results to return (1-25, default: 5)",
          parser: parseShoppingLimitOption,
        },
      ],
      action: ({ args, options: commandOptions }) =>
        adapter.search({
          query: String(args[0] ?? ""),
          limit: commandOptions.limit as number | undefined,
        }),
      onSuccess: printShoppingSearchResult,
    }),
    createAdapterActionCapability({
      id: "product",
      command: options.productCommand ?? "product <target>",
      aliases: options.productAliases ?? ["info"],
      description: options.productDescription,
      spinnerText: `Loading ${adapter.displayName} product details...`,
      successMessage: `${adapter.displayName} product details loaded.`,
      action: ({ args }) =>
        adapter.productInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printShoppingProductResult,
    }),
  ];

  if (typeof adapter.storeInfo === "function" && options.storeCommand && options.storeDescription) {
    capabilities.push(
      createAdapterActionCapability({
        id: "store",
        command: options.storeCommand,
        aliases: options.storeAliases ?? [],
        description: options.storeDescription,
        spinnerText: `Loading ${adapter.displayName} store details...`,
        successMessage: `${adapter.displayName} store details loaded.`,
        action: ({ args }) =>
          adapter.storeInfo!({
            target: String(args[0] ?? ""),
          }),
        onSuccess: printShoppingStoreResult,
      }),
    );
  }

  if (typeof adapter.suggestions === "function" && options.suggestionsCommand && options.suggestionsDescription) {
    capabilities.push(
      createAdapterActionCapability({
        id: "suggestions",
        command: options.suggestionsCommand,
        aliases: options.suggestionsAliases ?? [],
        description: options.suggestionsDescription,
        spinnerText: `Loading ${adapter.displayName} suggestions...`,
        successMessage: `${adapter.displayName} suggestions loaded.`,
        options: [
          {
            flags: "--limit <number>",
            description: "Maximum number of suggestions to return (1-25, default: 5)",
            parser: parseShoppingLimitOption,
          },
        ],
        action: ({ args, options: commandOptions }) =>
          adapter.suggestions!({
            query: String(args[0] ?? ""),
            limit: commandOptions.limit as number | undefined,
          }),
        onSuccess: printShoppingSuggestionsResult,
      }),
    );
  }

  return capabilities;
}
