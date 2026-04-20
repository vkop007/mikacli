import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, parseBrowserTimeoutSeconds, resolveCookieLoginInput } from "../../shared/cookie-login.js";
import {
  printShoppingAccountResult,
  printShoppingAddToCartResult,
  printShoppingCartResult,
  printShoppingOrderDetailResult,
  printShoppingOrdersResult,
  printShoppingProductResult,
  printShoppingRemoveFromCartResult,
  printShoppingSearchResult,
  printShoppingStatusResult,
  printShoppingUpdateCartResult,
  printShoppingWishlistResult,
} from "./output.js";
import { parseShoppingLimitOption, parseShoppingQuantityOption } from "./options.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";
import type { BaseShoppingAdapter } from "./base-shopping-adapter.js";

export function createShoppingCapabilities(adapter: BaseShoppingAdapter): readonly PlatformCapability[] {
  const browserActionOptions = [
    { flags: "--browser", description: "Run this action in an invisible browser session instead of browserless requests" },
    { flags: "--browser-timeout <seconds>", description: "Maximum seconds to allow the browser action to complete", parser: parseBrowserTimeoutSeconds },
  ] as const;

  const capabilities: PlatformCapability[] = [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: `Save the ${adapter.displayName} session for future CLI use. With no auth flags, MikaCLI opens browser login by default`,
      spinnerText: `Saving ${adapter.displayName} session...`,
      successMessage: `${adapter.displayName} session saved.`,
      options: createCookieLoginOptions(),
      action: ({ options }) => adapter.login(resolveCookieLoginInput(options)),
    }),
    createAdapterActionCapability({
      id: "status",
      command: "status",
      description: `Show the saved ${adapter.displayName} session status`,
      spinnerText: `Checking ${adapter.displayName} session status...`,
      successMessage: `${adapter.displayName} status loaded.`,
      options: [{ flags: "--account <name>", description: "Optional saved session name to inspect" }],
      action: ({ options }) => adapter.statusAction(options.account as string | undefined),
      onSuccess: printShoppingStatusResult,
    }),
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: `Search ${adapter.displayName} products`,
      spinnerText: `Searching ${adapter.displayName}...`,
      successMessage: `${adapter.displayName} search completed.`,
      options: [
        {
          flags: "--limit <number>",
          description: "Maximum number of results to return (1-25, default: 5)",
          parser: parseShoppingLimitOption,
        },
      ],
      action: ({ args, options }) =>
        adapter.search({
          query: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printShoppingSearchResult,
    }),
    createAdapterActionCapability({
      id: "product",
      command: "product <target>",
      aliases: ["item", "info"],
      description: `Load exact ${adapter.displayName} product details by URL or ${adapter.productTargetLabel}`,
      spinnerText: `Loading ${adapter.displayName} product details...`,
      successMessage: `${adapter.displayName} product details loaded.`,
      action: ({ args }) =>
        adapter.productInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printShoppingProductResult,
    }),
    createAdapterActionCapability({
      id: "orders",
      command: "orders",
      description: `List recent ${adapter.displayName} orders using the latest saved session by default`,
      spinnerText: `Loading ${adapter.displayName} orders...`,
      successMessage: `${adapter.displayName} orders loaded.`,
      options: [
        { flags: "--account <name>", description: "Optional saved session name to use" },
        {
          flags: "--limit <number>",
          description: "Maximum number of orders to return (1-25, default: 5)",
          parser: parseShoppingLimitOption,
        },
        ...browserActionOptions,
      ],
      action: ({ options }) =>
        adapter.orders({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
          browser: Boolean(options.browser),
          browserTimeoutSeconds: options.browserTimeout as number | undefined,
        }),
      onSuccess: printShoppingOrdersResult,
    }),
  ];

  const extendedAdapter = adapter as BaseShoppingAdapter & Partial<ShoppingRichAdapter>;

  if (typeof extendedAdapter.accountSummary === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "account",
        command: "account",
        aliases: ["me", "profile"],
        description: `Load the saved ${adapter.displayName} account overview`,
        spinnerText: `Loading ${adapter.displayName} account details...`,
        successMessage: `${adapter.displayName} account details loaded.`,
        options: [{ flags: "--account <name>", description: "Optional saved session name to use" }],
        action: ({ options }) =>
          extendedAdapter.accountSummary!({
            account: options.account as string | undefined,
          }),
        onSuccess: printShoppingAccountResult,
      }),
    );
  }

  if (typeof extendedAdapter.wishlist === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "wishlist",
        command: "wishlist",
        aliases: ["saved"],
        description: `Load the saved ${adapter.displayName} wishlist`,
        spinnerText: `Loading ${adapter.displayName} wishlist...`,
        successMessage: `${adapter.displayName} wishlist loaded.`,
        options: [
          { flags: "--account <name>", description: "Optional saved session name to use" },
          {
            flags: "--limit <number>",
            description: "Maximum number of wishlist items to return (1-25, default: 5)",
            parser: parseShoppingLimitOption,
          },
        ],
        action: ({ options }) =>
          extendedAdapter.wishlist!({
            account: options.account as string | undefined,
            limit: options.limit as number | undefined,
          }),
        onSuccess: printShoppingWishlistResult,
      }),
    );
  }

  if (typeof extendedAdapter.cart === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "cart",
        command: "cart",
        description: `Load the saved ${adapter.displayName} cart`,
        spinnerText: `Loading ${adapter.displayName} cart...`,
        successMessage: `${adapter.displayName} cart loaded.`,
        options: [{ flags: "--account <name>", description: "Optional saved session name to use" }, ...browserActionOptions],
        action: ({ options }) =>
          extendedAdapter.cart!({
            account: options.account as string | undefined,
            browser: Boolean(options.browser),
            browserTimeoutSeconds: options.browserTimeout as number | undefined,
          }),
        onSuccess: printShoppingCartResult,
      }),
    );
  }

  if (typeof extendedAdapter.addToCart === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "add-to-cart",
        command: "add-to-cart <target>",
        aliases: ["add", "cart-add"],
        description: `Add an exact ${adapter.displayName} product to the saved cart`,
        spinnerText: `Adding ${adapter.displayName} product to cart...`,
        successMessage: `${adapter.displayName} cart updated.`,
        options: [
          { flags: "--account <name>", description: "Optional saved session name to use" },
          { flags: "--qty <number>", description: "Quantity to add (1-10, default: 1)", parser: parseShoppingQuantityOption },
          {
            flags: "--browser-timeout <seconds>",
            description: "Maximum seconds to allow the action to complete when the adapter uses browser-backed flows",
            parser: parseBrowserTimeoutSeconds,
          },
        ],
        action: ({ args, options }) =>
          extendedAdapter.addToCart!({
            account: options.account as string | undefined,
            target: String(args[0] ?? ""),
            quantity: options.qty as number | undefined,
            browserTimeoutSeconds: options.browserTimeout as number | undefined,
          }),
        onSuccess: printShoppingAddToCartResult,
      }),
    );
  }

  if (typeof extendedAdapter.removeFromCart === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "remove-from-cart",
        command: "remove-from-cart <target>",
        aliases: ["remove", "cart-remove"],
        description: `Remove an exact ${adapter.displayName} product from the saved cart`,
        spinnerText: `Removing ${adapter.displayName} product from cart...`,
        successMessage: `${adapter.displayName} cart updated.`,
        options: [
          { flags: "--account <name>", description: "Optional saved session name to use" },
          {
            flags: "--browser-timeout <seconds>",
            description: "Maximum seconds to allow the action to complete when the adapter uses browser-backed flows",
            parser: parseBrowserTimeoutSeconds,
          },
        ],
        action: ({ args, options }) =>
          extendedAdapter.removeFromCart!({
            account: options.account as string | undefined,
            target: String(args[0] ?? ""),
            browserTimeoutSeconds: options.browserTimeout as number | undefined,
          }),
        onSuccess: printShoppingRemoveFromCartResult,
      }),
    );
  }

  if (typeof extendedAdapter.updateCart === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "update-cart",
        command: "update-cart <target>",
        aliases: ["cart-update", "set-qty"],
        description: `Update the saved ${adapter.displayName} cart quantity for an exact product`,
        spinnerText: `Updating ${adapter.displayName} cart quantity...`,
        successMessage: `${adapter.displayName} cart updated.`,
        options: [
          { flags: "--account <name>", description: "Optional saved session name to use" },
          { flags: "--qty <number>", description: "Target quantity to keep in cart (1-10)", parser: parseShoppingQuantityOption, required: true },
          {
            flags: "--browser-timeout <seconds>",
            description: "Maximum seconds to allow the action to complete when the adapter uses browser-backed flows",
            parser: parseBrowserTimeoutSeconds,
          },
        ],
        action: ({ args, options }) =>
          extendedAdapter.updateCart!({
            account: options.account as string | undefined,
            target: String(args[0] ?? ""),
            quantity: options.qty as number,
            browserTimeoutSeconds: options.browserTimeout as number | undefined,
          }),
        onSuccess: printShoppingUpdateCartResult,
      }),
    );
  }

  if (typeof extendedAdapter.orderDetail === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "order",
        command: "order <target>",
        aliases: ["order-detail"],
        description: `Load exact ${adapter.displayName} order details by order ID`,
        spinnerText: `Loading ${adapter.displayName} order details...`,
        successMessage: `${adapter.displayName} order details loaded.`,
        options: [{ flags: "--account <name>", description: "Optional saved session name to use" }, ...browserActionOptions],
        action: ({ args, options }) =>
          extendedAdapter.orderDetail!({
            account: options.account as string | undefined,
            target: String(args[0] ?? ""),
            browser: Boolean(options.browser),
            browserTimeoutSeconds: options.browserTimeout as number | undefined,
          }),
        onSuccess: printShoppingOrderDetailResult,
      }),
    );
  }

  return capabilities;
}

interface ShoppingRichAdapter {
  accountSummary(input: { account?: string }): Promise<AdapterActionResult>;
  wishlist(input: { account?: string; limit?: number }): Promise<AdapterActionResult>;
  cart(input: { account?: string; browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult>;
  addToCart(input: { account?: string; target: string; quantity?: number; browserTimeoutSeconds?: number }): Promise<AdapterActionResult>;
  removeFromCart(input: { account?: string; target: string; browserTimeoutSeconds?: number }): Promise<AdapterActionResult>;
  updateCart(input: { account?: string; target: string; quantity: number; browserTimeoutSeconds?: number }): Promise<AdapterActionResult>;
  orderDetail(input: { account?: string; target: string; browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult>;
}
