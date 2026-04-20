import { MikaCliError } from "../../../errors.js";
import { runFirstClassBrowserAction } from "../../../core/runtime/browser-action-runtime.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { parseAmazonProductTarget } from "../../../utils/targets.js";
import { getPlatformHomeUrl, getPlatformOrigin } from "../../config.js";
import { BaseShoppingAdapter, type ShoppingSessionProbe } from "../shared/base-shopping-adapter.js";
import { clamp, collapseWhitespace, parsePriceText, toAbsoluteUrl } from "../shared/helpers.js";

import type { AdapterActionResult, PlatformSession } from "../../../types.js";
import type { Page as PlaywrightPage } from "playwright-core";

const AMAZON_ORIGIN = getPlatformOrigin("amazon");
const AMAZON_HOME = getPlatformHomeUrl("amazon");
const AMAZON_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface AmazonSearchResult {
  asin: string;
  title: string;
  url?: string;
  imageUrl?: string;
  priceText?: string;
  price?: number;
  currency?: string;
  rating?: number;
  ratingCount?: number;
  sponsored?: boolean;
}

interface AmazonProductInfo {
  asin: string;
  title: string;
  url: string;
  priceText?: string;
  price?: number;
  currency?: string;
  rating?: number;
  ratingCount?: number;
  availability?: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  features: string[];
}

interface AmazonCartData {
  count: number;
  subtotalText?: string;
  empty: boolean;
  items: Array<Record<string, unknown>>;
}

interface AmazonOrdersPageSummary {
  visibleCount?: number;
  timeFilterLabel?: string;
  timeFilterValue?: string;
  availableTimeFilters: Array<{ value: string; label: string }>;
  empty: boolean;
}

type AmazonBrowserActionInput = {
  account?: string;
  browser?: boolean;
  browserTimeoutSeconds?: number;
};

export class AmazonAdapter extends BaseShoppingAdapter {
  readonly platform = "amazon" as const;
  readonly productTargetLabel = "ASIN";

  async accountSummary(input: { account?: string }): Promise<AdapterActionResult> {
    const { session } = await this.ensureActiveSession(input.account);
    const client = await this.createAmazonClient(session);
    const html = await this.fetchAmazonAccountLikeHtml(client, session);
    const summary = extractAmazonAccountSummary(html, this.getAmazonOrigin(session));

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "account",
      message: `Loaded Amazon account overview for ${session.account}.`,
      user: summary.user,
      data: summary.data,
    };
  }

  async wishlist(input: { limit?: number; account?: string }): Promise<AdapterActionResult> {
    const { session } = await this.ensureActiveSession(input.account);
    const client = await this.createAmazonClient(session);
    const wishlistUrl = this.getAmazonWishlistUrl(session);
    const html = await this.fetchAmazonSessionHtml(client, wishlistUrl, session);
    const items = extractAmazonWishlistEntries(html, this.getAmazonOrigin(session)).slice(0, clamp(input.limit ?? 5, 1, 25));

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "wishlist",
      message:
        items.length > 0
          ? `Loaded ${items.length} Amazon list${items.length === 1 ? "" : "s"} for ${session.account}.`
          : `No Amazon lists were visible for ${session.account}.`,
      data: {
        count: items.length,
        items,
      },
    };
  }

  async cart(input: { account?: string; browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    if (input.browser) {
      return this.browserCart(input);
    }

    const { session } = await this.ensureActiveSession(input.account);
    const client = await this.createAmazonClient(session);
    const cartUrl = this.getAmazonCartUrl(session);
    const html = await this.fetchAmazonSessionHtml(client, cartUrl, session);
    const cart = extractAmazonCart(html, this.getAmazonOrigin(session));

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "cart",
      message:
        cart.items.length > 0
          ? `Loaded ${cart.items.length} Amazon cart item${cart.items.length === 1 ? "" : "s"} for ${session.account}.`
          : `The Amazon cart is empty for ${session.account}.`,
      data: { ...cart },
    };
  }

  async addToCart(input: { target: string; quantity?: number; account?: string; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const parsed = parseAmazonProductTarget(input.target);
    const quantity = clamp(input.quantity ?? 1, 1, 10);
    const { session, path } = await this.ensureActiveSession(input.account);
    const origin = this.getAmazonOrigin(session);
    const productUrl = `${origin}/dp/${parsed.asin}`;

    const added = await this.runAmazonBrowserAction(session, productUrl, input.browserTimeoutSeconds, async (page, source) => {
      const beforeCart = await this.loadAmazonCartFromPage(page, session);
      const previousQuantity = getAmazonCartQuantity(beforeCart, parsed.asin);

      await this.tryAmazonDirectAddToCart(page, session, parsed.asin, quantity);
      let afterCart = await this.loadAmazonCartFromPage(page, session);
      let item = findAmazonCartItem(afterCart, parsed.asin);

      if (!this.didAmazonCartQuantityIncrease(previousQuantity, item, quantity)) {
        await this.addAmazonProductToCartViaPage(page, session, parsed.asin, quantity);
        afterCart = await this.loadAmazonCartFromPage(page, session);
        item = findAmazonCartItem(afterCart, parsed.asin);
      }

      if (!item) {
        throw new MikaCliError(
          "AMAZON_ADD_TO_CART_NOT_CONFIRMED",
          `Amazon loaded the cart, but MikaCLI could not confirm that ${parsed.asin} was added.`,
          {
            details: {
              asin: parsed.asin,
              quantity,
              previousQuantity,
            },
          },
        );
      }

      return {
        cart: afterCart,
        item,
        previousQuantity,
        finalUrl: page.url(),
        source,
      };
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "add-to-cart",
      id: parsed.asin,
      url: asString(added.item.url) ?? productUrl,
      message: `Added Amazon product ${parsed.asin} to the cart for ${session.account}.`,
      user: session.user,
      sessionPath: path,
      data: {
        asin: parsed.asin,
        quantityRequested: quantity,
        previousQuantity: added.previousQuantity,
        cartCount: added.cart.count,
        subtotalText: added.cart.subtotalText,
        item: added.item,
        cart: added.cart,
        browser: {
          finalUrl: added.finalUrl,
          source: added.source,
        },
      },
    };
  }

  async removeFromCart(input: { target: string; account?: string; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const parsed = parseAmazonProductTarget(input.target);
    const { session, path } = await this.ensureActiveSession(input.account);
    const origin = this.getAmazonOrigin(session);
    const productUrl = `${origin}/dp/${parsed.asin}`;

    const removed = await this.runAmazonBrowserAction(session, this.getAmazonCartUrl(session), input.browserTimeoutSeconds, async (page, source) => {
      const beforeCart = await this.loadAmazonCartFromPage(page, session);
      const item = findAmazonCartItem(beforeCart, parsed.asin);
      if (!item) {
        throw new MikaCliError("AMAZON_CART_ITEM_NOT_FOUND", `Amazon cart does not contain ${parsed.asin}.`, {
          details: {
            asin: parsed.asin,
          },
        });
      }

      const previousQuantity = getAmazonCartQuantity(beforeCart, parsed.asin);
      const title = asString(item.title);
      await this.removeAmazonCartItem(page, session, parsed.asin);
      const afterCart = await this.loadAmazonCartFromPage(page, session);

      if (findAmazonCartItem(afterCart, parsed.asin)) {
        throw new MikaCliError(
          "AMAZON_REMOVE_FROM_CART_NOT_CONFIRMED",
          `Amazon still shows ${parsed.asin} in the cart after the remove action.`,
          {
            details: {
              asin: parsed.asin,
            },
          },
        );
      }

      return {
        cart: afterCart,
        title,
        previousQuantity,
        finalUrl: page.url(),
        source,
      };
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "remove-from-cart",
      id: parsed.asin,
      url: productUrl,
      message: `Removed Amazon product ${parsed.asin} from the cart for ${session.account}.`,
      user: session.user,
      sessionPath: path,
      data: {
        asin: parsed.asin,
        title: removed.title,
        previousQuantity: removed.previousQuantity,
        cartCount: removed.cart.count,
        subtotalText: removed.cart.subtotalText,
        cart: removed.cart,
        browser: {
          finalUrl: removed.finalUrl,
          source: removed.source,
        },
      },
    };
  }

  async updateCart(input: { target: string; quantity: number; account?: string; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const parsed = parseAmazonProductTarget(input.target);
    const quantity = clamp(input.quantity, 1, 10);
    const { session, path } = await this.ensureActiveSession(input.account);
    const origin = this.getAmazonOrigin(session);
    const productUrl = `${origin}/dp/${parsed.asin}`;

    const updated = await this.runAmazonBrowserAction(session, this.getAmazonCartUrl(session), input.browserTimeoutSeconds, async (page, source) => {
      const result = await this.updateAmazonCartQuantity(page, session, parsed.asin, quantity);

      return {
        cart: result.cart,
        item: result.item,
        previousQuantity: result.previousQuantity,
        finalUrl: page.url(),
        source,
      };
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "update-cart",
      id: parsed.asin,
      url: asString(updated.item.url) ?? productUrl,
      message: `Updated Amazon product ${parsed.asin} to quantity ${quantity} for ${session.account}.`,
      user: session.user,
      sessionPath: path,
      data: {
        asin: parsed.asin,
        quantityRequested: quantity,
        previousQuantity: updated.previousQuantity,
        cartCount: updated.cart.count,
        subtotalText: updated.cart.subtotalText,
        item: updated.item,
        cart: updated.cart,
        browser: {
          finalUrl: updated.finalUrl,
          source: updated.source,
        },
      },
    };
  }

  async orderDetail(input: { target: string; account?: string; browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const orderId = input.target.trim();
    if (!orderId) {
      throw new MikaCliError("AMAZON_ORDER_REQUIRED", "Amazon order ID cannot be empty.");
    }

    if (input.browser) {
      return this.browserOrderDetail(input);
    }

    const { session } = await this.ensureActiveSession(input.account);
    const client = await this.createAmazonClient(session);
    const ordersUrl = this.getAmazonOrdersUrl(session);
    const html = await this.fetchAmazonSessionHtml(client, ordersUrl, session);
    let order = extractAmazonOrders(html).find((entry) => asString(entry.orderId) === orderId);

    if (!order) {
      const detailHtml = await this.fetchAmazonOrderDetailHtml(client, session, orderId).catch(() => undefined);
      if (detailHtml) {
        order = extractAmazonOrderDetail(detailHtml, orderId, this.getAmazonOrigin(session));
      }
    }

    if (!order) {
      throw new MikaCliError("AMAZON_ORDER_NOT_FOUND", `Amazon could not find order ${orderId}.`, {
        details: {
          orderId,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "order",
      message: `Loaded Amazon order ${orderId}.`,
      id: orderId,
      url: asString(order.url),
      data: {
        ...order,
        itemDetails: Array.isArray(order.items)
          ? (order.items as unknown[]).map((item) => (typeof item === "string" ? { title: item } : item))
          : [],
      },
    };
  }

  async search(input: { query: string; limit?: number; account?: string }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("AMAZON_QUERY_REQUIRED", "Amazon search query cannot be empty.");
    }

    const client = this.createGuestClient();
    const url = new URL("/s", AMAZON_ORIGIN);
    url.searchParams.set("k", query);
    const html = await this.fetchAmazonHtml(client, url.toString());
    const results = extractAmazonSearchResults(html).slice(0, clamp(input.limit ?? 5, 1, 25));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${results.length} Amazon products for "${query}".`,
      data: {
        query,
        results,
      },
    };
  }

  async productInfo(input: { target: string; account?: string }): Promise<AdapterActionResult> {
    const parsed = parseAmazonProductTarget(input.target);
    const client = this.createGuestClient();
    const targetUrl = parsed.url ?? `${AMAZON_ORIGIN}/dp/${parsed.asin}`;
    const html = await this.fetchAmazonHtml(client, targetUrl);
    const product = extractAmazonProduct(html, targetUrl, parsed.asin);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "product",
      message: `Loaded Amazon product ${product.asin}.`,
      id: product.asin,
      url: product.url,
      data: { ...product },
    };
  }

  async orders(input: { limit?: number; account?: string; browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    if (input.browser) {
      return this.browserOrders(input);
    }

    const { session } = await this.ensureActiveSession(input.account);
    const client = await this.createAmazonClient(session);
    const response = await this.fetchAmazonOrdersResponse(client, session);

    if (isAmazonLoggedOutUrl(response.response.url)) {
      if (await this.isAmazonStillSignedInOutsideOrders(client, session)) {
        throw new MikaCliError(
          "AMAZON_ORDERS_REAUTH_REQUIRED",
          "Amazon is still signed in for account/cart pages, but orders currently require a real browser-authenticated context beyond imported cookies.",
        );
      }

      throw new MikaCliError("SESSION_EXPIRED", "Amazon redirected the saved session to a sign-in or claim flow. Re-import cookies.txt.");
    }

    const pageSummary = extractAmazonOrdersPageSummary(response.data);
    const orders = extractAmazonOrders(response.data).slice(0, clamp(input.limit ?? 5, 1, 25));
    if (orders.length === 0 && !pageSummary.empty) {
      throw new MikaCliError(
        "AMAZON_ORDERS_LAYOUT_CHANGED",
        "Amazon loaded the orders page, but MikaCLI could not extract the order cards from the current layout.",
      );
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "orders",
      message:
        orders.length > 0
          ? `Loaded ${orders.length} Amazon orders for ${session.account}.`
          : `No Amazon orders were visible for ${session.account}${pageSummary.timeFilterLabel ? ` in ${pageSummary.timeFilterLabel}` : ""}.`,
      data: {
        orders,
        count: orders.length,
        visibleCount: pageSummary.visibleCount,
        timeFilter: pageSummary.timeFilterValue
          ? {
              value: pageSummary.timeFilterValue,
              label: pageSummary.timeFilterLabel,
            }
          : undefined,
        availableTimeFilters: pageSummary.availableTimeFilters,
      },
    };
  }

  protected async probeSession(session: PlatformSession): Promise<ShoppingSessionProbe> {
    const client = await this.createAmazonClient(session);

    try {
      const response = await this.fetchAmazonOrdersResponse(client, session);

      if (response.response.url.includes("/errors/validateCaptcha")) {
        return {
          status: {
            state: "unknown",
            message: "Amazon presented a validation or anti-bot page while checking the session.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "ANTI_BOT",
          },
        };
      }

      if (isAmazonLoggedOutUrl(response.response.url)) {
        const fallback = await this.probeAmazonFallbackPages(
          client,
          session,
          "Amazon session is still signed in for account/cart pages, but the orders surface currently requires a real browser-authenticated context beyond imported cookies.",
          "ORDERS_REAUTH_REQUIRED",
        );
        if (fallback) {
          return fallback;
        }

        return {
          status: {
            state: "expired",
            message: "Amazon redirected the session to sign-in or claim verification. Re-import cookies.txt.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "LOGGED_OUT",
          },
        };
      }

      const summary = extractAmazonAccountSummary(response.data, this.getAmazonOrigin(session));
      return {
        status: {
          state: "active",
          message: "Session validated via the Amazon orders page.",
          lastValidatedAt: new Date().toISOString(),
        },
        user: summary.user,
        metadata: {
          validation: "orders_page",
          finalUrl: response.response.url,
          marketplaceOrigin: this.getAmazonOrigin(session),
        },
      };
    } catch (error) {
      if (isAmazonAntiBotError(error)) {
        const fallback = await this.probeAmazonFallbackPages(
          client,
          session,
          "Amazon session is still signed in, but the orders surface is blocked by Amazon's automated-traffic protections right now.",
          "ANTI_BOT",
        );
        if (fallback) {
          return fallback;
        }
      }

      return {
        status: {
          state: "unknown",
          message: "Amazon validation was unavailable, but the imported session was saved.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: error instanceof MikaCliError ? error.code : "REQUEST_FAILED",
        },
      };
    }
  }

  private createGuestClient(): SessionHttpClient {
    return new SessionHttpClient(undefined, this.buildAmazonHeaders(AMAZON_HOME));
  }

  private async createAmazonClient(session: PlatformSession): Promise<SessionHttpClient> {
    return this.createClient(session, this.buildAmazonHeaders(this.getAmazonHomeUrl(session), session));
  }

  private buildAmazonHeaders(referer: string, session?: PlatformSession): Record<string, string> {
    const origin = this.getAmazonOrigin(session);
    return {
      origin,
      referer,
      "user-agent": AMAZON_USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "upgrade-insecure-requests": "1",
    };
  }

  private async fetchAmazonHtml(client: SessionHttpClient, url: string): Promise<string> {
    const response = await client
      .requestWithResponse<string>(url, {
        responseType: "text",
        expectedStatus: 200,
        headers: this.buildAmazonHeaders(url),
      })
      .catch((error) => {
        throw normalizeAmazonRequestError(error);
      });

    if (response.response.url.includes("/errors/validateCaptcha") || response.data.includes("Type the characters you see in this image")) {
      throw new MikaCliError(
        "AMAZON_ANTI_BOT_BLOCKED",
        "Amazon blocked the request with a validation or anti-bot page. A fresh browser session or slower request cadence may be required.",
      );
    }

    return response.data;
  }

  private async fetchAmazonSessionHtml(client: SessionHttpClient, url: string, session: PlatformSession): Promise<string> {
    const response = await client
      .requestWithResponse<string>(url, {
        responseType: "text",
        expectedStatus: 200,
        headers: this.buildAmazonHeaders(url, session),
      })
      .catch((error) => {
        throw normalizeAmazonRequestError(error);
      });

    if (response.response.url.includes("/errors/validateCaptcha") || response.data.includes("Type the characters you see in this image")) {
      throw new MikaCliError(
        "AMAZON_ANTI_BOT_BLOCKED",
        "Amazon blocked the request with a validation or anti-bot page. A fresh browser session or slower request cadence may be required.",
      );
    }

    return response.data;
  }

  private async fetchAmazonAccountLikeHtml(client: SessionHttpClient, session: PlatformSession): Promise<string> {
    const candidates = [
      this.getAmazonAccountUrl(session),
      this.getAmazonOrdersUrl(session),
      this.getAmazonCartUrl(session),
      this.getAmazonWishlistUrl(session),
    ];

    let lastError: unknown;
    for (const url of candidates) {
      try {
        return await this.fetchAmazonSessionHtml(client, url, session);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new MikaCliError("AMAZON_ACCOUNT_UNAVAILABLE", "Amazon account pages were unavailable for the current session.");
  }

  private getAmazonOrigin(session?: PlatformSession): string {
    const cookieDomain = session ? detectAmazonCookieDomain(session) : undefined;
    if (!cookieDomain) {
      return AMAZON_ORIGIN;
    }

    return `https://www.${cookieDomain}`;
  }

  private getAmazonHomeUrl(session?: PlatformSession): string {
    return `${this.getAmazonOrigin(session)}/`;
  }

  private getAmazonAccountUrl(session?: PlatformSession): string {
    return `${this.getAmazonOrigin(session)}/gp/css/homepage.html`;
  }

  private getAmazonCartUrl(session?: PlatformSession): string {
    return `${this.getAmazonOrigin(session)}/gp/cart/view.html`;
  }

  private getAmazonWishlistUrl(session?: PlatformSession): string {
    return `${this.getAmazonOrigin(session)}/hz/wishlist/intro`;
  }

  private getAmazonOrdersUrl(session?: PlatformSession): string {
    return `${this.getAmazonOrigin(session)}/gp/css/order-history`;
  }

  private getAmazonModernOrdersUrl(session?: PlatformSession): string {
    return `${this.getAmazonOrigin(session)}/your-orders/orders`;
  }

  private getAmazonProductUrl(session: PlatformSession, asin: string): string {
    return `${this.getAmazonOrigin(session)}/dp/${asin}`;
  }

  private getAmazonAddToCartUrl(session: PlatformSession, asin: string, quantity: number): string {
    const url = new URL("/gp/aws/cart/add.html", this.getAmazonOrigin(session));
    url.searchParams.set("ASIN.1", asin);
    url.searchParams.set("Quantity.1", String(quantity));
    return url.toString();
  }

  private async isAmazonStillSignedInOutsideOrders(client: SessionHttpClient, session: PlatformSession): Promise<boolean> {
    const candidates = [this.getAmazonAccountUrl(session), this.getAmazonCartUrl(session), this.getAmazonWishlistUrl(session)];

    for (const url of candidates) {
      const html = await this.fetchAmazonSessionHtml(client, url, session).catch(() => undefined);
      if (html && looksLikeAmazonSignedInPage(html)) {
        return true;
      }
    }

    return false;
  }

  private async probeAmazonFallbackPages(
    client: SessionHttpClient,
    session: PlatformSession,
    message: string,
    errorCode: string,
  ): Promise<ShoppingSessionProbe | undefined> {
    const cartUrl = this.getAmazonCartUrl(session);
    const cartHtml = await this.fetchAmazonSessionHtml(client, cartUrl, session).catch(() => undefined);
    if (cartHtml && looksLikeAmazonSignedInPage(cartHtml)) {
      const summary = extractAmazonAccountSummary(cartHtml, this.getAmazonOrigin(session));
      return {
        status: {
          state: "active",
          message,
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: errorCode,
        },
        user: summary.user,
        metadata: {
          validation: "cart_page",
          finalUrl: cartUrl,
          marketplaceOrigin: this.getAmazonOrigin(session),
        },
      };
    }

    const wishlistUrl = this.getAmazonWishlistUrl(session);
    const wishlistHtml = await this.fetchAmazonSessionHtml(client, wishlistUrl, session).catch(() => undefined);
    if (wishlistHtml && looksLikeAmazonSignedInPage(wishlistHtml)) {
      const summary = extractAmazonAccountSummary(wishlistHtml, this.getAmazonOrigin(session));
      return {
        status: {
          state: "active",
          message,
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: errorCode,
        },
        user: summary.user,
        metadata: {
          validation: "wishlist_page",
          finalUrl: wishlistUrl,
          marketplaceOrigin: this.getAmazonOrigin(session),
        },
      };
    }

    return undefined;
  }

  private async fetchAmazonOrdersResponse(
    client: SessionHttpClient,
    session: PlatformSession,
  ): Promise<{ data: string; response: Response }> {
    const headers = this.buildAmazonHeaders(this.getAmazonModernOrdersUrl(session), session);

    return client
      .requestWithResponse<string>(this.getAmazonModernOrdersUrl(session), {
        responseType: "text",
        expectedStatus: 200,
        headers,
      })
      .catch((error) => {
        throw normalizeAmazonRequestError(error);
      });
  }

  private async fetchAmazonOrderDetailHtml(
    client: SessionHttpClient,
    session: PlatformSession,
    orderId: string,
  ): Promise<string> {
    const candidates = [
      `${this.getAmazonOrigin(session)}/gp/your-account/order-details?orderID=${encodeURIComponent(orderId)}`,
      `${this.getAmazonOrigin(session)}/your-orders/order-details?orderID=${encodeURIComponent(orderId)}`,
    ];

    for (const url of candidates) {
      const html = await this.fetchAmazonSessionHtml(client, url, session).catch(() => undefined);
      if (!html) {
        continue;
      }

      if (looksLikeAmazonOrderDetailUnavailable(html)) {
        continue;
      }

      return html;
    }

    throw new MikaCliError("AMAZON_ORDER_NOT_FOUND", `Amazon could not load order details for ${orderId}.`, {
      details: {
        orderId,
      },
    });
  }

  private async browserOrders(input: { limit?: number; account?: string; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const { session, path } = await this.ensureActiveSession(input.account);
    const page = await this.fetchAmazonBrowserPage(session, this.getAmazonModernOrdersUrl(session), input.browserTimeoutSeconds);
    const pageSummary = extractAmazonOrdersPageSummary(page.html);
    const orders = extractAmazonOrders(page.html).slice(0, clamp(input.limit ?? 5, 1, 25));

    if (orders.length === 0 && !pageSummary.empty) {
      throw new MikaCliError(
        "AMAZON_ORDERS_LAYOUT_CHANGED",
        "Amazon loaded the orders page in the browser, but MikaCLI could not extract the order cards from the current layout.",
      );
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "orders",
      message:
        orders.length > 0
          ? `Loaded ${orders.length} Amazon orders for ${session.account} through a browser-backed session.`
          : `No Amazon orders were visible for ${session.account}${pageSummary.timeFilterLabel ? ` in ${pageSummary.timeFilterLabel}` : ""}.`,
      user: session.user,
      sessionPath: path,
      data: {
        orders,
        count: orders.length,
        visibleCount: pageSummary.visibleCount,
        timeFilter: pageSummary.timeFilterValue
          ? {
              value: pageSummary.timeFilterValue,
              label: pageSummary.timeFilterLabel,
            }
          : undefined,
        availableTimeFilters: pageSummary.availableTimeFilters,
        browser: {
          finalUrl: page.finalUrl,
          source: page.source,
        },
      },
    };
  }

  private async browserCart(input: { account?: string; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const { session, path } = await this.ensureActiveSession(input.account);
    const page = await this.fetchAmazonBrowserPage(session, this.getAmazonCartUrl(session), input.browserTimeoutSeconds);
    const cart = extractAmazonCart(page.html, this.getAmazonOrigin(session));

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "cart",
      message:
        cart.items.length > 0
          ? `Loaded ${cart.items.length} Amazon cart item${cart.items.length === 1 ? "" : "s"} for ${session.account} through a browser-backed session.`
          : `The Amazon cart is empty for ${session.account}.`,
      user: session.user,
      sessionPath: path,
      data: {
        ...cart,
        browser: {
          finalUrl: page.finalUrl,
          source: page.source,
        },
      },
    };
  }

  private async browserOrderDetail(input: { target: string; account?: string; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const orderId = input.target.trim();
    const { session, path } = await this.ensureActiveSession(input.account);
    const browserPage = await this.fetchAmazonBrowserPage(session, this.getAmazonModernOrdersUrl(session), input.browserTimeoutSeconds);
    let order = extractAmazonOrders(browserPage.html).find((entry) => asString(entry.orderId) === orderId);
    let finalUrl = browserPage.finalUrl;
    let browserSource = browserPage.source;

    if (!order) {
      const detailPage = await this.fetchAmazonBrowserOrderDetailPage(session, orderId, input.browserTimeoutSeconds).catch(() => undefined);
      if (detailPage) {
        order = extractAmazonOrderDetail(detailPage.html, orderId, this.getAmazonOrigin(session));
        finalUrl = detailPage.finalUrl;
        browserSource = detailPage.source;
      }
    }

    if (!order) {
      throw new MikaCliError("AMAZON_ORDER_NOT_FOUND", `Amazon could not find order ${orderId}.`, {
        details: {
          orderId,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "order",
      message: `Loaded Amazon order ${orderId} through a browser-backed session.`,
      id: orderId,
      url: asString(order.url) ?? finalUrl,
      user: session.user,
      sessionPath: path,
      data: {
        ...order,
        itemDetails: Array.isArray(order.items)
          ? (order.items as unknown[]).map((item) => (typeof item === "string" ? { title: item } : item))
          : [],
        browser: {
          finalUrl,
          source: browserSource,
        },
      },
    };
  }

  private async fetchAmazonBrowserPage(
    session: PlatformSession,
    url: string,
    timeoutSeconds?: number,
  ): Promise<{ html: string; finalUrl: string; source: "headless" | "profile" | "shared" }> {
    return this.runAmazonBrowserAction(session, url, timeoutSeconds, async (page, source) => {
      await page.waitForTimeout(2_000);
      const html = await page.content();
      const finalUrl = page.url();
      this.assertAmazonBrowserPageState(html, finalUrl);
      return {
        html,
        finalUrl,
        source,
      };
    });
  }

  private async fetchAmazonBrowserOrderDetailPage(
    session: PlatformSession,
    orderId: string,
    timeoutSeconds?: number,
  ): Promise<{ html: string; finalUrl: string; source: "headless" | "profile" | "shared" }> {
    const candidates = [
      `${this.getAmazonOrigin(session)}/gp/your-account/order-details?orderID=${encodeURIComponent(orderId)}`,
      `${this.getAmazonOrigin(session)}/your-orders/order-details?orderID=${encodeURIComponent(orderId)}`,
    ];

    let lastError: unknown;
    for (const url of candidates) {
      try {
        const result = await this.fetchAmazonBrowserPage(session, url, timeoutSeconds);
        if (looksLikeAmazonOrderDetailUnavailable(result.html)) {
          continue;
        }
        return result;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new MikaCliError("AMAZON_ORDER_NOT_FOUND", `Amazon could not load order details for ${orderId}.`, {
          details: {
            orderId,
          },
        });
  }

  private assertAmazonBrowserPageState(html: string, finalUrl: string): void {
    if (finalUrl.includes("/errors/validateCaptcha") || html.includes("Type the characters you see in this image")) {
      throw new MikaCliError(
        "AMAZON_ANTI_BOT_BLOCKED",
        "Amazon blocked the browser action with a validation or anti-bot page. A fresher browser session may be required.",
      );
    }

    if (isAmazonLoggedOutUrl(finalUrl)) {
      throw new MikaCliError(
        "SESSION_EXPIRED",
        "Amazon redirected the browser session to sign-in or claim verification. Re-import cookies.txt or log into Amazon once with `mikacli login --browser --url https://www.amazon.com/` so the shared browser profile can be reused.",
      );
    }
  }

  private shouldRetryAmazonBrowserWithProfile(error: unknown): boolean {
    if (!(error instanceof MikaCliError)) {
      return false;
    }

    return error.code === "SESSION_EXPIRED" || error.code === "AMAZON_ANTI_BOT_BLOCKED";
  }

  private async runAmazonBrowserAction<T>(
    session: PlatformSession,
    targetUrl: string,
    timeoutSeconds: number | undefined,
    action: (page: PlaywrightPage, source: "headless" | "profile" | "shared") => Promise<T>,
  ): Promise<T> {
    return (
      await runFirstClassBrowserAction({
      platform: this.platform,
      action: "browser-action",
      actionLabel: "browser action",
      targetUrl,
      timeoutSeconds: timeoutSeconds ?? 60,
      initialCookies: session.cookieJar.cookies,
      headless: true,
      userAgent: AMAZON_USER_AGENT,
      locale: "en-US",
      steps: [
        {
          source: "headless",
          shouldContinueOnError: (error) => this.shouldRetryAmazonBrowserWithProfile(error),
        },
        {
          source: "profile",
          shouldContinueOnError: (error) => error instanceof MikaCliError && error.code === "BROWSER_PROFILE_IN_USE",
        },
        {
          source: "shared",
          announceLabel: `Reusing the shared MikaCLI browser profile for Amazon: ${targetUrl}`,
        },
      ],
      actionFn: action,
    })
    ).value;
  }

  private async loadAmazonCartFromPage(page: PlaywrightPage, session: PlatformSession): Promise<AmazonCartData> {
    await page.goto(this.getAmazonCartUrl(session), {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    }).catch(() => {});
    await page.waitForTimeout(1_500);
    const html = await page.content();
    this.assertAmazonBrowserPageState(html, page.url());
    return extractAmazonCart(html, this.getAmazonOrigin(session));
  }

  private async tryAmazonDirectAddToCart(page: PlaywrightPage, session: PlatformSession, asin: string, quantity: number): Promise<void> {
    await page.goto(this.getAmazonAddToCartUrl(session, asin, quantity), {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    }).catch(() => {});
    await page.waitForTimeout(2_000);
    this.assertAmazonBrowserPageState(await page.content(), page.url());
  }

  private async addAmazonProductToCartViaPage(page: PlaywrightPage, session: PlatformSession, asin: string, quantity: number): Promise<void> {
    await page.goto(this.getAmazonProductUrl(session, asin), {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    }).catch(() => {});
    await page.waitForTimeout(1_500);
    this.assertAmazonBrowserPageState(await page.content(), page.url());

    if (quantity > 1) {
      await this.selectAmazonQuantity(page, quantity);
    }

    const selectors = [
      "#add-to-cart-button",
      "input[name='submit.add-to-cart']",
      "#submit\\.add-to-cart",
      "#add-to-cart-button-ubb",
      "[data-feature-id='add-to-cart-button'] input",
    ];

    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      const count = await locator.count().catch(() => 0);
      if (count < 1) {
        continue;
      }

      await locator.scrollIntoViewIfNeeded().catch(() => {});
      await locator.click({
        timeout: 10_000,
      }).catch(() => {});
      await page.waitForTimeout(2_500);
      this.assertAmazonBrowserPageState(await page.content(), page.url());
      return;
    }

    throw new MikaCliError(
      "AMAZON_ADD_TO_CART_UNAVAILABLE",
      `Amazon did not show a usable add-to-cart control for ${asin}.`,
      {
        details: {
          asin,
          url: page.url(),
        },
      },
    );
  }

  private async selectAmazonQuantity(page: PlaywrightPage, quantity: number): Promise<void> {
    const selectors = ["#quantity", "select[name='quantity']"];
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      const count = await locator.count().catch(() => 0);
      if (count < 1) {
        continue;
      }

      const desired = String(quantity);
      const byValue = await locator.selectOption(desired).catch(() => []);
      if (byValue.length > 0) {
        await page.waitForTimeout(500);
        return;
      }

      const byLabel = await locator.selectOption({ label: desired }).catch(() => []);
      if (byLabel.length > 0) {
        await page.waitForTimeout(500);
        return;
      }
    }
  }

  private async removeAmazonCartItem(page: PlaywrightPage, session: PlatformSession, asin: string): Promise<void> {
    await this.loadAmazonCartFromPage(page, session);
    const row = this.getAmazonCartRow(page, asin);
    const rowCount = await row.count().catch(() => 0);
    if (rowCount < 1) {
      throw new MikaCliError("AMAZON_CART_ITEM_NOT_FOUND", `Amazon cart does not contain ${asin}.`, {
        details: {
          asin,
        },
      });
    }

    const selectors = [
      "input[data-feature-id='item-delete-button']",
      "input[data-action='delete-active']",
      "input[name^='submit.delete-active.']",
      "[data-feature-id='item-delete-button'] input",
    ];

    for (const selector of selectors) {
      const locator = row.locator(selector).first();
      const count = await locator.count().catch(() => 0);
      if (count < 1) {
        continue;
      }

      await locator.scrollIntoViewIfNeeded().catch(() => {});
      await locator.click({
        timeout: 10_000,
      }).catch(() => {});
      await page.waitForTimeout(2_500);
      return;
    }

    throw new MikaCliError(
      "AMAZON_REMOVE_FROM_CART_UNAVAILABLE",
      `Amazon did not show a usable remove control for ${asin}.`,
      {
        details: {
          asin,
          url: page.url(),
        },
      },
    );
  }

  private async updateAmazonCartQuantity(
    page: PlaywrightPage,
    session: PlatformSession,
    asin: string,
    targetQuantity: number,
  ): Promise<{ cart: AmazonCartData; item: Record<string, unknown>; previousQuantity: number }> {
    let cart = await this.loadAmazonCartFromPage(page, session);
    let item = findAmazonCartItem(cart, asin);
    if (!item) {
      throw new MikaCliError("AMAZON_CART_ITEM_NOT_FOUND", `Amazon cart does not contain ${asin}.`, {
        details: {
          asin,
        },
      });
    }

    const previousQuantity = getAmazonCartQuantity(cart, asin);
    let currentQuantity = previousQuantity;
    if (currentQuantity < 1) {
      throw new MikaCliError("AMAZON_CART_QUANTITY_UNAVAILABLE", `Amazon did not expose a usable cart quantity for ${asin}.`, {
        details: {
          asin,
        },
      });
    }

    if (currentQuantity === targetQuantity) {
      return { cart, item, previousQuantity };
    }

    for (let step = 0; step < 12 && currentQuantity !== targetQuantity; step += 1) {
      const row = this.getAmazonCartRow(page, asin);
      const rowCount = await row.count().catch(() => 0);
      if (rowCount < 1) {
        throw new MikaCliError("AMAZON_CART_ITEM_NOT_FOUND", `Amazon cart no longer shows ${asin} while updating quantity.`, {
          details: {
            asin,
          },
        });
      }

      const direction = targetQuantity > currentQuantity ? "increment" : "decrement";
      const stepper = row.locator(`button[data-a-selector='${direction}']`).first();
      const stepperCount = await stepper.count().catch(() => 0);
      if (stepperCount < 1) {
        throw new MikaCliError(
          "AMAZON_UPDATE_CART_UNAVAILABLE",
          `Amazon did not show a usable ${direction} control for ${asin}.`,
          {
            details: {
              asin,
              targetQuantity,
              currentQuantity,
              url: page.url(),
            },
          },
        );
      }

      await stepper.scrollIntoViewIfNeeded().catch(() => {});
      await stepper.click({
        timeout: 10_000,
      }).catch(() => {});
      await page.waitForTimeout(2_250);

      cart = await this.loadAmazonCartFromPage(page, session);
      item = findAmazonCartItem(cart, asin);
      if (!item) {
        throw new MikaCliError("AMAZON_CART_ITEM_NOT_FOUND", `Amazon cart no longer shows ${asin} after updating quantity.`, {
          details: {
            asin,
            targetQuantity,
          },
        });
      }

      currentQuantity = getAmazonCartQuantity(cart, asin);
      if (currentQuantity < 1) {
        throw new MikaCliError(
          "AMAZON_CART_QUANTITY_UNAVAILABLE",
          `Amazon did not expose the updated quantity for ${asin}.`,
          {
            details: {
              asin,
              targetQuantity,
            },
          },
        );
      }
    }

    if (currentQuantity !== targetQuantity) {
      throw new MikaCliError(
        "AMAZON_UPDATE_CART_NOT_CONFIRMED",
        `Amazon still shows quantity ${currentQuantity} for ${asin} after trying to update it to ${targetQuantity}.`,
        {
          details: {
            asin,
            currentQuantity,
            targetQuantity,
          },
        },
      );
    }

    return {
      cart,
      item,
      previousQuantity,
    };
  }

  private getAmazonCartRow(page: PlaywrightPage, asin: string) {
    return page.locator(`[data-asin="${asin}"].sc-list-item`).first();
  }

  private didAmazonCartQuantityIncrease(previousQuantity: number, item: Record<string, unknown> | undefined, requestedQuantity: number): boolean {
    if (!item) {
      return false;
    }

    const rawQuantity = item.quantity;
    const nextQuantity = typeof rawQuantity === "number" && Number.isFinite(rawQuantity) ? rawQuantity : undefined;
    if (typeof nextQuantity !== "number") {
      return true;
    }

    if (previousQuantity <= 0) {
      return nextQuantity >= Math.max(1, requestedQuantity);
    }

    return nextQuantity >= previousQuantity + Math.max(1, requestedQuantity);
  }
}

function extractAmazonSearchResults(html: string): AmazonSearchResult[] {
  const openTag = /<div\b(?=[^>]*\bdata-component-type="s-search-result")(?=[^>]*\bdata-asin="([A-Z0-9]{10})")[^>]*>/g;
  const matches = Array.from(html.matchAll(openTag));
  const results: AmazonSearchResult[] = [];
  const seen = new Set<string>();

  for (const [index, match] of matches.entries()) {
    const asin = match[1];
    const start = match.index ?? -1;
    if (!asin || start === -1 || seen.has(asin)) {
      continue;
    }

    const end = matches[index + 1]?.index ?? html.length;
    const block = html.slice(start, end);
    const title = collapseWhitespace(extractMatch(block, /<h2[^>]*>[\s\S]*?<span[^>]*>(.*?)<\/span>/i));
    if (!title) {
      continue;
    }

    const url = toAbsoluteUrl(AMAZON_ORIGIN, extractMatch(block, new RegExp(`href="([^"]*?(?:dp|gp/product)\\/${asin}[^"]*)"`, "i")));
    const imageUrl = extractMatch(block, /class="s-image"[^>]+src="([^"]+)"/i) ?? extractMatch(block, /src="([^"]+)"[^>]+class="s-image"/i);
    const whole = extractMatch(block, /<span class="a-price-whole">([^<]+)<\/span>/i)?.replace(/\D+/g, "");
    const fraction = extractMatch(block, /<span class="a-price-fraction">([^<]+)<\/span>/i)?.replace(/\D+/g, "");
    const ratingText = collapseWhitespace(extractMatch(block, /<span class="a-icon-alt">([^<]+)<\/span>/i));
    const rating = ratingText ? Number.parseFloat(ratingText) : undefined;
    const ratingCountText =
      collapseWhitespace(extractMatch(block, /aria-label="([0-9,]+)\s+ratings?"/i)) ||
      collapseWhitespace(extractMatch(block, /<span class="a-size-base s-underline-text">([^<]+)<\/span>/i));
    const ratingCount = parseInteger(ratingCountText);
    const priceText = whole ? `₹${whole}${fraction ? `.${fraction}` : ""}` : undefined;
    const parsedPrice = parsePriceText(priceText);

    seen.add(asin);
    results.push({
      asin,
      title,
      url,
      imageUrl,
      priceText: parsedPrice.text,
      price: parsedPrice.value,
      currency: parsedPrice.currency,
      rating: Number.isFinite(rating) ? rating : undefined,
      ratingCount,
      sponsored: block.includes("Sponsored"),
    });
  }

  return results;
}

function extractAmazonProduct(html: string, sourceUrl: string, asin: string): AmazonProductInfo {
  const title = collapseWhitespace(extractMatch(html, /<span id="productTitle"[^>]*>(.*?)<\/span>/i));
  if (!title) {
    throw new MikaCliError("AMAZON_PRODUCT_NOT_FOUND", "Amazon did not return a recognizable product detail page.");
  }

  const priceText =
    collapseWhitespace(extractMatch(html, /<div id="priceToPay"[\s\S]*?<span class="aok-offscreen">([^<]+)<\/span>/i)) ||
    collapseWhitespace(extractMatch(html, /<span class="a-price aok-align-center[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/i));
  const parsedPrice = parsePriceText(priceText);
  const ratingText =
    collapseWhitespace(extractMatch(html, /id="acrPopover"[^>]+title="([^"]+)"/i)) ||
    collapseWhitespace(extractMatch(html, /<span class="a-icon-alt">([^<]+)<\/span>/i));
  const rating = ratingText ? Number.parseFloat(ratingText) : undefined;
  const reviewCount = parseInteger(collapseWhitespace(extractMatch(html, /id="acrCustomerReviewText"[^>]*>(.*?)<\/span>/i)));
  const availability = collapseWhitespace(extractMatch(html, /<div id="availability"[\s\S]*?<span[^>]*>(.*?)<\/span>/i));
  const brand = collapseWhitespace(extractMatch(html, /<(?:a|span) id="bylineInfo"[^>]*>(.*?)<\/(?:a|span)>/i));
  const description =
    collapseWhitespace(extractMatch(html, /<meta name="description" content="([^"]+)"/i)) ||
    collapseWhitespace(extractMatch(html, /<div id="feature-bullets"[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i));
  const imageUrl =
    extractMatch(html, /<meta property="og:image" content="([^"]+)"/i) ||
    extractMatch(html, /id="landingImage"[^>]+data-old-hires="([^"]+)"/i) ||
    extractMatch(html, /id="landingImage"[^>]+src="([^"]+)"/i);
  const features = Array.from(html.matchAll(/<li[^>]*><span class="a-list-item">([\s\S]*?)<\/span><\/li>/gi))
    .map((match) => collapseWhitespace(match[1] ?? ""))
    .filter(Boolean)
    .slice(0, 8);

  return {
    asin,
    title,
    url: sourceUrl,
    priceText: parsedPrice.text,
    price: parsedPrice.value,
    currency: parsedPrice.currency,
    rating: Number.isFinite(rating) ? rating : undefined,
    ratingCount: reviewCount,
    availability,
    brand,
    description,
    imageUrl,
    features,
  };
}

function extractAmazonOrders(html: string): Array<Record<string, unknown>> {
  const matches = Array.from(html.matchAll(/orderID=([0-9-]{10,})/g));
  const seen = new Set<string>();
  const orders: Array<Record<string, unknown>> = [];

  for (const match of matches) {
    const orderId = match[1];
    const index = match.index ?? -1;
    if (!orderId || index === -1 || seen.has(orderId)) {
      continue;
    }

    seen.add(orderId);
    const window = html.slice(Math.max(0, index - 2500), Math.min(html.length, index + 6500));
    const items = Array.from(window.matchAll(/<(?:span|a)[^>]+(?:class="a-size-medium|href="\/gp\/product\/)[^>]*>([^<]{8,200})<\/(?:span|a)>/gi))
      .map((itemMatch) => collapseWhitespace(itemMatch[1] ?? ""))
      .filter((value) => value && !/^(Buy it again|View item|Track package|Leave seller feedback|Write a product review)$/i.test(value))
      .slice(0, 3);
    const deliveredText = findAmazonDeliveryText(window);

    orders.push({
      orderId,
      placedAt: extractAmazonOrderField(window, "ORDER PLACED"),
      totalText: extractAmazonOrderField(window, "TOTAL"),
      status: deliveredText ?? extractAmazonOrderField(window, "ORDER #"),
      deliveryText: deliveredText,
      items,
      url: `${AMAZON_ORIGIN}/gp/your-account/order-details?orderID=${orderId}`,
    });
  }

  return orders;
}

function extractAmazonOrderDetail(html: string, orderId: string, origin: string): Record<string, unknown> | undefined {
  if (looksLikeAmazonOrderDetailUnavailable(html)) {
    return undefined;
  }

  const items = extractAmazonOrderDetailItems(html, origin);
  const deliveryText =
    collapseWhitespace(extractMatch(html, /<div[^>]*class="[^"]*a-alert-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)) ||
    findAmazonDeliveryText(html);

  return {
    orderId,
    placedAt: extractAmazonOrderDetailField(html, "Order placed"),
    totalText: extractAmazonOrderDetailField(html, "Grand Total") ?? extractAmazonOrderDetailField(html, "Order Total"),
    status: deliveryText || extractAmazonOrderDetailField(html, "Status"),
    deliveryText,
    recipient: extractAmazonOrderDetailField(html, "Recipient"),
    paymentMethod: extractAmazonOrderDetailField(html, "Payment Method"),
    shippingAddress: extractAmazonOrderDetailField(html, "Shipping Address"),
    items,
    url: `${origin}/gp/your-account/order-details?orderID=${encodeURIComponent(orderId)}`,
  };
}

function extractAmazonOrderDetailItems(html: string, origin: string): Array<Record<string, unknown>> {
  const matches = Array.from(
    html.matchAll(/<a[^>]+href="([^"]*\/(?:dp|gp\/product)\/([A-Z0-9]{10})[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi),
  );
  const results: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const asin = match[2];
    if (!asin || seen.has(asin)) {
      continue;
    }

    const title = collapseWhitespace(stripHtml(match[3] ?? ""));
    if (!title || /^(?:Back to top|Continue shopping|Your Orders)$/i.test(title)) {
      continue;
    }

    seen.add(asin);
    results.push({
      asin,
      title,
      url: toAbsoluteUrl(origin, match[1]),
    });
  }

  return results;
}

function extractAmazonOrderField(window: string, label: string): string | undefined {
  const direct = collapseWhitespace(
    extractMatch(window, new RegExp(`${escapeRegex(label)}[\\s\\S]{0,200}?<span[^>]*>(.*?)<\\/span>`, "i")),
  );
  if (direct) {
    return direct;
  }

  return collapseWhitespace(
    extractMatch(window, new RegExp(`${escapeRegex(label)}[\\s\\S]{0,200}?<div[^>]*>(.*?)<\\/div>`, "i")),
  );
}

function findAmazonDeliveryText(window: string): string | undefined {
  const text = collapseWhitespace(window);
  const match = text.match(
    /\b(?:Delivered|Arriving|Shipped|Out for delivery|Return completed|Cancelled|Refunded)[^.]{0,80}/i,
  );
  return match?.[0]?.trim();
}

function looksLikeAmazonNoOrders(html: string): boolean {
  return extractAmazonOrdersPageSummary(html).empty;
}

function extractAmazonOrdersPageSummary(html: string): AmazonOrdersPageSummary {
  const timeFilterSelect = html.match(/<select[^>]+id="time-filter"[\s\S]*?<\/select>/i)?.[0] ?? "";
  const visibleCount = parseInteger(collapseWhitespace(extractMatch(html, /<span class="num-orders">([^<]+)<\/span>/i)));
  const timeFilterValue = extractMatch(timeFilterSelect, /<option[^>]+selected[^>]+value="([^"]+)"/i);
  const timeFilterLabel = collapseWhitespace(
    extractMatch(timeFilterSelect, /<option[^>]+selected[^>]*>([\s\S]*?)<\/option>/i),
  );
  const availableTimeFilters = Array.from(timeFilterSelect.matchAll(/<option[^>]+value="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/option>/gi))
    .map((match) => {
      const value = match[1]?.trim();
      const label = collapseWhitespace(match[2] ?? "");
      return value && label ? { value, label } : undefined;
    })
    .filter((entry): entry is { value: string; label: string } => Boolean(entry));

  return {
    visibleCount,
    timeFilterValue: timeFilterValue || undefined,
    timeFilterLabel: timeFilterLabel || undefined,
    availableTimeFilters,
    empty:
      visibleCount === 0 ||
      /(?:You have not placed any orders|looks like you haven'?t placed an order|<span class="num-orders">\s*0 orders?\s*<\/span>)/i.test(
        html,
      ),
  };
}

function extractAmazonOrderDetailField(html: string, label: string): string | undefined {
  const patterns = [
    new RegExp(`${escapeRegex(label)}[\\s\\S]{0,240}?<span[^>]*>([\\s\\S]*?)<\\/span>`, "i"),
    new RegExp(`${escapeRegex(label)}[\\s\\S]{0,240}?<div[^>]*>([\\s\\S]*?)<\\/div>`, "i"),
    new RegExp(`${escapeRegex(label)}[\\s\\S]{0,240}?<dd[^>]*>([\\s\\S]*?)<\\/dd>`, "i"),
  ];

  for (const pattern of patterns) {
    const value = collapseWhitespace(stripHtml(extractMatch(html, pattern) ?? ""));
    if (value) {
      return value;
    }
  }

  return undefined;
}

function looksLikeAmazonOrderDetailUnavailable(html: string): boolean {
  return /We'?re unable to load your order details/i.test(html);
}

function isAmazonLoggedOutUrl(url: string): boolean {
  return /\/(?:ap\/signin|ax\/claim|gp\/signin)/i.test(url);
}

function looksLikeAmazonSignedInPage(html: string): boolean {
  const greeting = extractAmazonNavGreeting(html);
  if (!greeting) {
    return false;
  }

  return !/^Hello,\s*sign in$/i.test(greeting);
}

function extractAmazonAccountSummary(html: string, origin: string): {
  user?: { username?: string; displayName?: string };
  data: Record<string, unknown>;
} {
  const greeting = extractAmazonNavGreeting(html);
  const displayName = greeting?.replace(/^Hello,\s*/i, "").trim();
  return {
    user: displayName
      ? {
          username: displayName,
          displayName,
        }
      : undefined,
    data: {
      displayName,
      greeting,
      signedIn: looksLikeAmazonSignedInPage(html),
      marketplaceOrigin: origin,
      ordersAccessible:
        !html.includes("/ap/signin") &&
        (/<title>\s*Your Orders\s*<\/title>/i.test(html) || html.includes("your-orders") || html.includes("order-history")),
    },
  };
}

function extractAmazonCart(html: string, origin: string): AmazonCartData {
  const items = extractAmazonCartItems(html, origin);
  const subtotalText =
    collapseWhitespace(extractMatch(html, /id="sc-subtotal-amount-activecart"[^>]*>\s*<span[^>]*>(.*?)<\/span>/i)) ||
    collapseWhitespace(extractMatch(html, /Subtotal \((?:[^)]+)\)\s*<span[^>]*>(.*?)<\/span>/i));

  return {
    count: items.length,
    subtotalText: subtotalText || undefined,
    empty: /Your Amazon Cart is empty/i.test(html),
    items,
  };
}

function extractAmazonCartItems(html: string, origin: string): Array<Record<string, unknown>> {
  const matches = Array.from(html.matchAll(/<div\b(?=[^>]*\bdata-asin="([A-Z0-9]{10})")[^>]*class="[^"]*sc-list-item[^"]*"[^>]*>/gi));
  const results: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const [index, match] of matches.entries()) {
    const asin = match[1];
    const start = match.index ?? -1;
    if (!asin || start === -1 || seen.has(asin)) {
      continue;
    }

    const end = matches[index + 1]?.index ?? html.length;
    const block = html.slice(start, end);
    const title =
      collapseWhitespace(extractMatch(block, /class="[^"]*sc-product-title[^"]*"[^>]*>([\s\S]*?)<\/span>/i)) ||
      collapseWhitespace(extractMatch(block, /href="\/dp\/[A-Z0-9]{10}[^"]*"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/i));

    if (!title) {
      continue;
    }

    seen.add(asin);
    results.push({
      asin,
      title,
      url: toAbsoluteUrl(origin, extractMatch(block, new RegExp(`href=\"([^\"]*\\/dp\\/${asin}[^\"]*)\"`, "i"))),
      imageUrl: extractMatch(block, /<img[^>]+src="([^"]+)"/i),
      priceText: collapseWhitespace(extractMatch(block, /class="[^"]*sc-price[^"]*"[^>]*>(.*?)<\/span>/i)),
      availability: collapseWhitespace(extractMatch(block, /class="[^"]*sc-availability[^"]*"[^>]*>(.*?)<\/span>/i)),
      quantity: extractAmazonCartItemQuantity(block),
    });
  }

  return results;
}

function extractAmazonWishlistEntries(html: string, origin: string): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/<a[^>]+href="([^"]*\/hz\/wishlist\/ls[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = toAbsoluteUrl(origin, match[1]);
    const title = collapseWhitespace(match[2] ?? "");
    if (!url || !title || /^(Your Lists|Create a List|Find a List or Registry|Sign In)$/i.test(title) || seen.has(url)) {
      continue;
    }

    seen.add(url);
    results.push({
      title,
      url,
    });
  }

  return results;
}

function findAmazonCartItem(cart: AmazonCartData, asin: string): Record<string, unknown> | undefined {
  return cart.items.find((item) => item && typeof item === "object" && asString((item as Record<string, unknown>).asin) === asin);
}

function getAmazonCartQuantity(cart: AmazonCartData, asin: string): number {
  const item = findAmazonCartItem(cart, asin);
  if (!item) {
    return 0;
  }

  const quantity = item.quantity;
  return typeof quantity === "number" && Number.isFinite(quantity) ? quantity : 0;
}

function extractAmazonCartItemQuantity(block: string): number | undefined {
  const candidates = [
    collapseWhitespace(extractMatch(block, /\bdata-quantity="([0-9]+)"/i)),
    collapseWhitespace(extractMatch(block, /\bdata-saved-item-quantity="([0-9]+)"/i)),
    collapseWhitespace(extractMatch(block, /\bdata-a-selector="inner-value"[^>]*>\s*([0-9]+)\s*</i)),
    collapseWhitespace(extractMatch(block, /\bname="quantityBox"[^>]*value="([0-9]+)"/i)),
    collapseWhitespace(extractMatch(block, /\bvalue="([0-9]+)"[^>]*data-a-selector="value"/i)),
    collapseWhitespace(extractMatch(block, /\baria-label="(?:Delete|Reduce quantity to|Increase quantity to|Quantity:? )\s*([0-9]+)"/i)),
  ];

  for (const candidate of candidates) {
    const parsed = parseInteger(candidate);
    if (typeof parsed === "number" && Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function extractAmazonNavGreeting(html: string): string | undefined {
  return collapseWhitespace(extractMatch(html, /id="nav-link-accountList-nav-line-1"[^>]*>([\s\S]*?)<\/span>/i));
}

function detectAmazonCookieDomain(session: PlatformSession): string | undefined {
  const cookies = Array.isArray(session.cookieJar.cookies) ? session.cookieJar.cookies : [];
  const match = cookies
    .map((cookie) => (cookie && typeof cookie.domain === "string" ? cookie.domain.replace(/^\./, "") : undefined))
    .find((domain): domain is string => typeof domain === "string" && /^amazon\.[a-z.]+$/i.test(domain));

  return match;
}

function extractMatch(input: string, pattern: RegExp): string | undefined {
  return input.match(pattern)?.[1];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function isAmazonAntiBotError(error: unknown): boolean {
  return error instanceof MikaCliError && error.code === "AMAZON_ANTI_BOT_BLOCKED";
}

function normalizeAmazonRequestError(error: unknown): never {
  if (error instanceof MikaCliError && error.code === "HTTP_REQUEST_FAILED") {
    const body = typeof error.details?.body === "string" ? error.details.body : undefined;
    const status = typeof error.details?.status === "number" ? error.details.status : undefined;

    if (status === 503 && isAmazonAutomationBlockBody(body)) {
      throw new MikaCliError(
        "AMAZON_ANTI_BOT_BLOCKED",
        "Amazon blocked the orders request as automated traffic. The browser session is valid, but this surface currently requires a real browser context.",
        {
          details: {
            status,
            upstreamMessage: body?.slice(0, 200),
          },
        },
      );
    }
  }

  throw error;
}

function isAmazonAutomationBlockBody(body: string | undefined): boolean {
  return Boolean(body && /automated access to Amazon data|api-services-support@amazon\.com/i.test(body));
}

function parseInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/[^0-9]/g, "");
  if (!normalized) {
    return undefined;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
