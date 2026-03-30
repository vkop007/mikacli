import { AutoCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { parseFlipkartProductTarget } from "../../../utils/targets.js";
import { getPlatformHomeUrl, getPlatformOrigin } from "../../config.js";
import { BaseShoppingAdapter, type ShoppingSessionProbe } from "../shared/base-shopping-adapter.js";
import { clamp, collapseWhitespace, extractBalancedJsonSegments, toAbsoluteUrl } from "../shared/helpers.js";

import type { AdapterActionResult, PlatformSession } from "../../../types.js";

const FLIPKART_ORIGIN = getPlatformOrigin("flipkart");
const FLIPKART_HOME = getPlatformHomeUrl("flipkart");
const FLIPKART_ORDERS_URL = `${FLIPKART_ORIGIN}/account/orders`;
const FLIPKART_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface FlipkartSearchResult {
  pid: string;
  title: string;
  subtitle?: string;
  url?: string;
  imageUrl?: string;
  priceText?: string;
  price?: number;
  originalPriceText?: string;
  rating?: number;
  ratingCount?: number;
  availability?: string;
}

interface FlipkartProductInfo {
  pid: string;
  title: string;
  description?: string;
  priceText?: string;
  price?: number;
  currency?: string;
  availability?: string;
  rating?: number;
  ratingCount?: number;
  reviewCount?: number;
  brand?: string;
  category?: string;
  imageUrl?: string;
  images?: string[];
  url: string;
  features?: string[];
}

interface FlipkartSessionContext {
  client: SessionHttpClient;
  state: Record<string, unknown>;
  bootstrap: Record<string, unknown>;
  apiOrigin: string;
}

export class FlipkartAdapter extends BaseShoppingAdapter {
  readonly platform = "flipkart" as const;
  readonly productTargetLabel = "PID";

  async accountSummary(input: { account?: string }): Promise<AdapterActionResult> {
    const { session } = await this.ensureActiveSession(input.account);
    const context = await this.loadFlipkartSessionContext(session);
    const summary = summarizeFlipkartAccount(context.state);
    const user = buildFlipkartSessionUser(summary);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "account",
      message: `Loaded Flipkart account overview for ${session.account}.`,
      user,
      data: summary,
    };
  }

  async wishlist(input: { limit?: number; account?: string }): Promise<AdapterActionResult> {
    const { session } = await this.ensureActiveSession(input.account);
    const context = await this.loadFlipkartSessionContext(session);
    const productIds = extractFlipkartWishlistProductIds(context.state);
    const limit = clamp(input.limit ?? 5, 1, 25);
    const guestClient = this.createGuestClient();
    const items = await Promise.all(
      productIds.slice(0, limit).map((pid) => this.loadFlipkartWishlistItem(guestClient, pid)),
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "wishlist",
      message:
        items.length > 0
          ? `Loaded ${items.length} Flipkart wishlist item${items.length === 1 ? "" : "s"} for ${session.account}.`
          : `No Flipkart wishlist items were visible for ${session.account}.`,
      data: {
        count: extractFlipkartWishlistCount(context.state),
        items,
      },
    };
  }

  async cart(input: { account?: string; browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const { session } = await this.ensureActiveSession(input.account);
    const context = await this.loadFlipkartSessionContext(session);
    const items = extractFlipkartCartItems(context.state);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "cart",
      message:
        items.length > 0
          ? `Loaded ${items.length} Flipkart cart item${items.length === 1 ? "" : "s"} for ${session.account}.`
          : `The Flipkart cart is empty for ${session.account}.`,
      data: {
        count: items.length,
        fkItemCount: extractFlipkartCartArray(context.state, "fkItems").length,
        groceryItemCount: extractFlipkartCartArray(context.state, "groceryItems").length,
        items,
      },
    };
  }

  async orderDetail(input: { target: string; account?: string; browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const orderId = input.target.trim();
    if (!orderId) {
      throw new AutoCliError("FLIPKART_ORDER_REQUIRED", "Flipkart order ID cannot be empty.");
    }

    const { session } = await this.ensureActiveSession(input.account);
    const context = await this.loadFlipkartSessionContext(session);
    const order = await this.findFlipkartOrder(context, orderId);
    if (!order) {
      throw new AutoCliError("FLIPKART_ORDER_NOT_FOUND", `Flipkart could not find order ${orderId}.`, {
        details: {
          orderId,
        },
      });
    }

    const mapped = mapFlipkartOrder(order);
    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "order",
      message: `Loaded Flipkart order ${orderId}.`,
      id: orderId,
      url: asString(mapped.url),
      data: mapped,
    };
  }

  async search(input: { query: string; limit?: number; account?: string }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new AutoCliError("FLIPKART_QUERY_REQUIRED", "Flipkart search query cannot be empty.");
    }

    const client = this.createGuestClient();
    const url = new URL("/search", FLIPKART_ORIGIN);
    url.searchParams.set("q", query);
    const html = await this.fetchFlipkartHtml(client, url.toString());
    const results = extractFlipkartSearchResults(html).slice(0, clamp(input.limit ?? 5, 1, 25));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${results.length} Flipkart products for "${query}".`,
      data: {
        query,
        results,
      },
    };
  }

  async productInfo(input: { target: string; account?: string }): Promise<AdapterActionResult> {
    const resolved = await this.resolveProductTarget(input.target);
    const client = this.createGuestClient();
    const html = await this.fetchFlipkartHtml(client, resolved.url);
    const product = extractFlipkartProduct(html, resolved.url, resolved.pid);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "product",
      message: `Loaded Flipkart product ${product.pid}.`,
      id: product.pid,
      url: product.url,
      data: { ...product },
    };
  }

  async orders(input: { limit?: number; account?: string; browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const { session } = await this.ensureActiveSession(input.account);
    const context = await this.loadFlipkartSessionContext(session);
    const limit = clamp(input.limit ?? 5, 1, 25);
    const orders = (await this.fetchFlipkartOrders(context, limit)).map(mapFlipkartOrder);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "orders",
      message:
        orders.length > 0
          ? `Loaded ${orders.length} Flipkart orders for ${session.account}.`
          : `No Flipkart orders were visible for ${session.account}.`,
      data: {
        orders,
        count: orders.length,
      },
    };
  }

  protected async probeSession(session: PlatformSession): Promise<ShoppingSessionProbe> {
    try {
      const context = await this.loadFlipkartSessionContext(session);
      const summary = summarizeFlipkartAccount(context.state);
      const user = buildFlipkartSessionUser(summary);

      return {
        status: {
          state: "active",
          message: "Session validated via the Flipkart account pages.",
          lastValidatedAt: new Date().toISOString(),
        },
        user,
        metadata: {
          validation: "account_page",
          apiHost: summary.apiHost,
          accountId: summary.accountId,
          wishlistCount: summary.wishlistCount,
          cartCount: summary.cartCount,
        },
      };
    } catch (error) {
      return {
        status: {
          state: "unknown",
          message: "Flipkart validation was unavailable, but the imported session was saved.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: error instanceof AutoCliError ? error.code : "REQUEST_FAILED",
        },
      };
    }
  }

  private createGuestClient(): SessionHttpClient {
    return new SessionHttpClient(undefined, this.buildFlipkartHeaders(FLIPKART_HOME));
  }

  private async createFlipkartClient(session: PlatformSession): Promise<SessionHttpClient> {
    return this.createClient(session, this.buildFlipkartHeaders(FLIPKART_HOME));
  }

  private async loadFlipkartSessionContext(session: PlatformSession): Promise<FlipkartSessionContext> {
    const client = await this.createFlipkartClient(session);
    const statePage = await this.fetchFlipkartStatePage(client, `${FLIPKART_ORIGIN}/account`);
    const bootstrapPage = await this.fetchFlipkartHtml(client, `${FLIPKART_ORIGIN}/viewcart`);
    const state = extractFirstJsonObject(statePage, "window.__INITIAL_STATE__ = ");
    const bootstrap = extractFirstJsonObject(bootstrapPage, "var wVar = ");
    const apiHost = asString(asRecord(state.dcContextReducer).hostName) ?? "2.rome.api.flipkart.com";

    return {
      client,
      state,
      bootstrap,
      apiOrigin: `https://${apiHost}`,
    };
  }

  private buildFlipkartHeaders(referer: string): Record<string, string> {
    return {
      origin: FLIPKART_ORIGIN,
      referer,
      "user-agent": FLIPKART_USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
    };
  }

  private buildFlipkartApiHeaders(context: FlipkartSessionContext, referer: string): Record<string, string> {
    const fkSession = asRecord(context.bootstrap.FKSession);
    const appEnvironment = asRecord(context.bootstrap.appEnvironment);
    const fkUa = asString(appEnvironment.fkUA) ?? FLIPKART_USER_AGENT;
    const terminalId = asString(fkSession.terminalId);
    const sessionNonce = asString(fkSession.SN);
    const secureToken = asString(fkSession.secureToken);

    return {
      ...this.buildFlipkartHeaders(referer),
      accept: "application/json, text/plain, */*",
      "x-user-agent": fkUa,
      ...(terminalId ? { "device-id": terminalId } : {}),
      ...(sessionNonce ? { SN: sessionNonce } : {}),
      ...(secureToken ? { SC: secureToken, secureCookie: secureToken } : {}),
    };
  }

  private async fetchFlipkartHtml(client: SessionHttpClient, url: string): Promise<string> {
    const response = await client.requestWithResponse<string>(url, {
      responseType: "text",
      expectedStatus: 200,
      headers: this.buildFlipkartHeaders(url),
    });

    return response.data;
  }

  private async fetchFlipkartStatePage(client: SessionHttpClient, url: string): Promise<string> {
    const html = await this.fetchFlipkartHtml(client, url);
    if (isFlipkartLoggedOutHtml(html)) {
      throw new AutoCliError("SESSION_EXPIRED", "Flipkart redirected the saved session to the login flow. Re-import cookies.txt.");
    }
    return html;
  }

  private async fetchFlipkartOrdersPage(context: FlipkartSessionContext, page: number): Promise<{
    orders: Record<string, unknown>[];
    more: boolean;
  }> {
    const url = new URL("/api/5/self-serve/orders/", context.apiOrigin);
    url.searchParams.set("page", String(page));
    const response = await context.client.request<Record<string, unknown>>(url.toString(), {
      responseType: "json",
      expectedStatus: 200,
      headers: this.buildFlipkartApiHeaders(context, FLIPKART_ORDERS_URL),
    });

    const view = asRecord(asRecord(response.RESPONSE).multipleOrderDetailsView);
    const orders = Array.isArray(view.orders) ? view.orders.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object") : [];
    return {
      orders,
      more: view.moreOrder === true,
    };
  }

  private async fetchFlipkartOrders(context: FlipkartSessionContext, limit: number): Promise<Record<string, unknown>[]> {
    const collected: Record<string, unknown>[] = [];

    for (let page = 1; page <= 10 && collected.length < limit; page += 1) {
      const batch = await this.fetchFlipkartOrdersPage(context, page);
      collected.push(...batch.orders);

      if (!batch.more || batch.orders.length === 0) {
        break;
      }
    }

    return collected.slice(0, limit);
  }

  private async findFlipkartOrder(context: FlipkartSessionContext, orderId: string): Promise<Record<string, unknown> | undefined> {
    for (let page = 1; page <= 10; page += 1) {
      const batch = await this.fetchFlipkartOrdersPage(context, page);
      const match = batch.orders.find((order) => asString(asRecord(order.orderMetaData).orderId) === orderId);
      if (match) {
        return match;
      }
      if (!batch.more || batch.orders.length === 0) {
        return undefined;
      }
    }

    return undefined;
  }

  private async loadFlipkartWishlistItem(client: SessionHttpClient, pid: string): Promise<Record<string, unknown>> {
    try {
      const resolved = await this.resolveProductTarget(pid);
      const html = await this.fetchFlipkartHtml(client, resolved.url);
      const product = extractFlipkartProduct(html, resolved.url, resolved.pid);
      return {
        pid: product.pid,
        title: product.title,
        brand: product.brand,
        priceText: product.priceText,
        availability: product.availability,
        url: product.url,
        imageUrl: product.imageUrl,
      };
    } catch {
      return { pid };
    }
  }

  private async resolveProductTarget(target: string): Promise<{ pid: string; url: string }> {
    const parsed = parseFlipkartProductTarget(target);
    if (parsed.url) {
      return {
        pid: parsed.pid,
        url: parsed.url,
      };
    }

    return {
      pid: parsed.pid,
      url: `${FLIPKART_ORIGIN}/product/p/item?pid=${parsed.pid}`,
    };
  }
}

function extractFlipkartSearchResults(html: string): FlipkartSearchResult[] {
  const results: FlipkartSearchResult[] = [];
  const seen = new Set<string>();

  for (const segment of extractBalancedJsonSegments(html, 'productInfo":')) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(segment.json) as Record<string, unknown>;
    } catch {
      continue;
    }

    const action = asRecord(parsed.action);
    const value = asRecord(parsed.value);
    const titles = asRecord(value.titles);
    const pricing = asRecord(value.pricing);
    const rating = asRecord(value.rating);
    const availability = asRecord(value.availability);
    const media = asRecord(value.media);
    const images = Array.isArray(media.images) ? media.images : [];

    const pid = asString(value.id);
    const title = asString(titles.title);
    if (!pid || !title || seen.has(pid)) {
      continue;
    }

    const priceValues = Array.isArray(pricing.prices) ? pricing.prices.filter((entry) => entry && typeof entry === "object") : [];
    const currentPrice = asNumber((priceValues.find((entry) => !asBoolean((entry as { strikeOff?: unknown }).strikeOff)) as { value?: unknown } | undefined)?.value);
    const originalPrice = asNumber((priceValues.find((entry) => asBoolean((entry as { strikeOff?: unknown }).strikeOff)) as { value?: unknown } | undefined)?.value);
    const imageUrl = firstImageUrl(images);

    seen.add(pid);
    results.push({
      pid,
      title,
      subtitle: asString(titles.subtitle),
      url: toAbsoluteUrl(FLIPKART_ORIGIN, asString(action.url)),
      imageUrl,
      priceText: typeof currentPrice === "number" ? `₹${currentPrice}` : undefined,
      price: currentPrice,
      originalPriceText: typeof originalPrice === "number" ? `₹${originalPrice}` : undefined,
      rating: asNumber(rating.average),
      ratingCount: asNumber(rating.count),
      availability: normalizeFlipkartAvailability(availability),
    });
  }

  return results;
}

function extractFlipkartProduct(html: string, url: string, pid: string): FlipkartProductInfo {
  const productJson = tryExtractFlipkartProductJsonLd(html, pid);
  if (productJson) {
    const title = asString(productJson.name);
    if (title) {
      const offers = asRecord(productJson.offers);
      const aggregateRating = asRecord(productJson.aggregateRating);
      const brand = asRecord(productJson.brand);
      const images = Array.isArray(productJson.image) ? productJson.image.filter((value): value is string => typeof value === "string") : [];
      const price = asNumber(offers.price);

      return {
        pid,
        title,
        description: asString(productJson.description),
        priceText: typeof price === "number" ? `₹${price}` : undefined,
        price,
        currency: asString(offers.priceCurrency) ?? "INR",
        availability: normalizeSchemaAvailability(asString(offers.availability)),
        rating: asNumber(aggregateRating.ratingValue),
        ratingCount: asNumber(aggregateRating.ratingCount),
        reviewCount: asNumber(aggregateRating.reviewCount),
        brand: asString(brand.name),
        category: asString(productJson.category),
        imageUrl: images[0],
        images,
        url,
        features: buildFlipkartFeatureList(productJson),
      };
    }
  }

  const title =
    normalizeFlipkartTitle(collapseWhitespace(extractMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i))) ??
    normalizeFlipkartTitle(collapseWhitespace(extractMatch(html, /<meta property="og:title" content="([^"]+)"/i))) ??
    normalizeFlipkartTitle(collapseWhitespace(extractMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)));
  if (!title) {
    throw new AutoCliError("FLIPKART_PRODUCT_NOT_FOUND", "Flipkart did not return a recognizable product detail page.");
  }

  const metaPrice = asNumber(extractMatch(html, /<meta property="product:price:amount" content="([^"]+)"/i));
  const inlinePriceText = collapseWhitespace(extractMatch(html, /(₹\s*[0-9,]+(?:\.[0-9]+)?)/i));
  const parsedInlinePrice = inlinePriceText ? Number.parseFloat(inlinePriceText.replace(/[^0-9.]/g, "")) : undefined;
  const price = metaPrice ?? (Number.isFinite(parsedInlinePrice) ? parsedInlinePrice : undefined);
  const imageUrl =
    extractMatch(html, /<meta property="og:image" content="([^"]+)"/i) ??
    extractMatch(html, /<meta name="twitter:image" content="([^"]+)"/i);

  return {
    pid,
    title,
    description: collapseWhitespace(extractMatch(html, /<meta name="description" content="([^"]+)"/i)),
    priceText: typeof price === "number" ? `₹${price}` : inlinePriceText || undefined,
    price,
    currency: collapseWhitespace(extractMatch(html, /<meta property="product:price:currency" content="([^"]+)"/i)) || "INR",
    availability:
      normalizeSchemaAvailability(extractMatch(html, /<meta property="product:availability" content="([^"]+)"/i)) ??
      (html.includes("Out of stock") ? "Out of stock" : undefined),
    brand: collapseWhitespace(extractMatch(html, /<meta property="og:brand" content="([^"]+)"/i)),
    imageUrl,
    images: imageUrl ? [imageUrl] : [],
    url,
    features: [],
  };
}

function tryExtractFlipkartProductJsonLd(html: string, pid: string): Record<string, unknown> | undefined {
  const matches = Array.from(html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi));
  for (const match of matches) {
    const raw = match[1];
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const found = candidates.find((candidate) => asRecord(candidate).sku === pid || asRecord(candidate).name);
      if (found && typeof found === "object" && found) {
        return found as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function isFlipkartLoggedOutUrl(url: string): boolean {
  return /\/account\/login/i.test(url);
}

function isFlipkartLoggedOutHtml(html: string): boolean {
  return /(?:Login &amp; Signup|Enter Email\/Mobile number|account\/login)/i.test(html);
}

function extractFirstJsonObject(input: string, marker: string): Record<string, unknown> {
  const segment = extractBalancedJsonSegments(input, marker)[0];
  if (!segment) {
    throw new AutoCliError("FLIPKART_STATE_MISSING", `Flipkart did not expose the expected ${marker.trim()} state block.`);
  }

  try {
    return asRecord(JSON.parse(segment.json));
  } catch (error) {
    throw new AutoCliError("FLIPKART_STATE_INVALID", `Flipkart exposed an invalid ${marker.trim()} state block.`, {
      cause: error,
    });
  }
}

function summarizeFlipkartAccount(state: Record<string, unknown>): Record<string, unknown> {
  const userState = asRecord(state.userState);
  const wishlist = asRecord(userState.wishlist);
  const cartItems = extractFlipkartCartItems(state);
  const firstName = asString(userState.firstName);
  const lastName = asString(userState.lastName);
  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    accountId: asString(userState.accountId),
    displayName: displayName || undefined,
    mobile: asString(asRecord(userState.userService).mobileNo),
    email: asString(userState.userEmail),
    wishlistCount: asNumber(wishlist.totalElements) ?? extractFlipkartWishlistProductIds(state).length,
    cartCount: cartItems.length,
    apiHost: asString(asRecord(state.dcContextReducer).hostName),
    isLoggedIn: userState.isLoggedIn === true,
  };
}

function buildFlipkartSessionUser(summary: Record<string, unknown>) {
  const displayName = asString(summary.displayName);
  return {
    id: asString(summary.accountId),
    username: asString(summary.mobile),
    displayName,
  };
}

function extractFlipkartWishlistProductIds(state: Record<string, unknown>): string[] {
  const wishlist = asRecord(asRecord(state.userState).wishlist);
  return Array.isArray(wishlist.productIds)
    ? wishlist.productIds.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];
}

function extractFlipkartWishlistCount(state: Record<string, unknown>): number {
  const wishlist = asRecord(asRecord(state.userState).wishlist);
  return asNumber(wishlist.totalElements) ?? extractFlipkartWishlistProductIds(state).length;
}

function extractFlipkartCartArray(state: Record<string, unknown>, key: "fkItems" | "groceryItems" | "items"): unknown[] {
  const cart = asRecord(asRecord(state.userState).cart);
  return Array.isArray(cart[key]) ? cart[key] : [];
}

function extractFlipkartCartItems(state: Record<string, unknown>): Array<Record<string, unknown>> {
  const cart = asRecord(asRecord(state.userState).cart);
  const combined = [
    ...(Array.isArray(cart.fkItems) ? cart.fkItems : []),
    ...(Array.isArray(cart.groceryItems) ? cart.groceryItems : []),
    ...(Array.isArray(cart.items) ? cart.items : []),
  ];

  return combined
    .map((entry, index) => mapFlipkartCartItem(asRecord(entry), index))
    .filter((entry): entry is Record<string, unknown> => Object.keys(entry).length > 0);
}

function mapFlipkartCartItem(raw: Record<string, unknown>, index: number): Record<string, unknown> {
  const product = asRecord(raw.productInfo);
  const basic = asRecord(product.productBasicData);
  const title = asString(raw.title) ?? asString(product.title) ?? asString(basic.title);
  const url = toAbsoluteUrl(FLIPKART_ORIGIN, asString(raw.url) ?? asString(basic.url));
  const imageUrl = renderFlipkartImageUrl(asRecord(raw.imageLocation)) ?? renderFlipkartImageUrl(asRecord(basic.imageLocation));
  const quantity = asNumber(raw.quantity) ?? asNumber(raw.qty);
  const price = asNumber(raw.price) ?? asNumber(raw.sellingPrice);

  if (!title && !url) {
    return {
      index: index + 1,
      raw,
    };
  }

  return {
    title: title ?? `Item ${index + 1}`,
    url,
    imageUrl,
    quantity,
    priceText: typeof price === "number" ? `₹${price}` : undefined,
    pid: extractPidFromFlipkartUrl(url),
  };
}

function mapFlipkartOrder(order: Record<string, unknown>): Record<string, unknown> {
  const meta = asRecord(order.orderMetaData);
  const money = asRecord(order.orderMoneyDataBag);
  const units = asRecord(order.units);
  const itemDetails = extractFlipkartOrderItems(order);
  const paymentMethods = Array.isArray(money.paymentMethods)
    ? money.paymentMethods.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];
  const deliveryText = Array.from(Object.values(units))
    .map((value) => asString(asRecord(asRecord(asRecord(value).deliveryDataBag).promiseDataBag).deliveryMessage))
    .find(Boolean);
  const orderId = asString(meta.orderId) ?? "unknown";
  const amount = asNumber(money.amount);
  const totalSavings = asNumber(money.totalSavings);

  return {
    orderId,
    placedAt: formatEpochDate(asNumber(meta.orderDate)),
    total: amount,
    totalText: typeof amount === "number" ? `₹${amount}` : undefined,
    totalSavingsText: typeof totalSavings === "number" ? `₹${totalSavings}` : undefined,
    paymentMethods,
    deliveryText,
    status: deliveryText,
    itemCount: asNumber(meta.numberOfItems) ?? itemDetails.length,
    items: itemDetails.map((item) => asString(item.title)).filter((value): value is string => Boolean(value)).slice(0, 3),
    itemDetails,
    url: `${FLIPKART_ORIGIN}/account/orders`,
  };
}

function extractFlipkartOrderItems(order: Record<string, unknown>): Record<string, unknown>[] {
  const productData = asRecord(order.productDataBag);
  const seen = new Set<string>();
  const items: Record<string, unknown>[] = [];

  for (const [key, rawValue] of Object.entries(productData)) {
    const value = asRecord(rawValue);
    const basic = asRecord(value.productBasicData);
    const attribute = asRecord(value.productAttribute);
    const title = asString(basic.title);
    if (!title || seen.has(title)) {
      continue;
    }

    seen.add(title);
    const url = toAbsoluteUrl(FLIPKART_ORIGIN, asString(basic.url));
    items.push({
      pid: extractPidFromFlipkartUrl(url) ?? key,
      title,
      subtitle: asString(basic.subTitle),
      brand: asString(attribute.brand),
      color: asString(attribute.color),
      url,
      imageUrl: renderFlipkartImageUrl(asRecord(basic.imageLocation)),
    });
  }

  return items;
}

function formatEpochDate(value: number | undefined): string | undefined {
  if (!value || !Number.isFinite(value)) {
    return undefined;
  }

  return new Date(value).toISOString();
}

function renderFlipkartImageUrl(imageLocation: Record<string, unknown>): string | undefined {
  const template =
    asString(imageLocation["700x700"]) ??
    asString(imageLocation["400x400"]) ??
    asString(imageLocation["275x275"]) ??
    asString(imageLocation["180x240"]) ??
    asString(imageLocation["75x75"]);

  if (!template) {
    return undefined;
  }

  return template.replaceAll("{@width}", "1200").replaceAll("{@height}", "1200").replaceAll("{@quality}", "80");
}

function extractPidFromFlipkartUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  return url.match(/[?&]pid=([A-Z0-9]{12,18})/i)?.[1]?.toUpperCase();
}

function normalizeSchemaAvailability(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value.endsWith("/InStock")) {
    return "In stock";
  }

  if (value.endsWith("/OutOfStock")) {
    return "Out of stock";
  }

  return value;
}

function normalizeFlipkartAvailability(value: Record<string, unknown>): string | undefined {
  const displayState = asString(value.displayState);
  if (displayState === "IN_STOCK") {
    return "In stock";
  }

  if (displayState === "OUT_OF_STOCK") {
    return "Out of stock";
  }

  return displayState ?? asString(value.intent);
}

function normalizeFlipkartTitle(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/\s*\|\s*Flipkart.*$/i, "")
    .replace(/\bmore$/i, "")
    .trim();
}

function buildFlipkartFeatureList(productJson: Record<string, unknown>): string[] {
  const description = asString(productJson.description) ?? "";
  return description
    .split(/(?<=\.)\s+|;\s+/)
    .map((part) => collapseWhitespace(part))
    .filter((part) => part.length > 0)
    .slice(0, 6);
}

function normalizeAmount(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? `₹${parsed}` : undefined;
}

function firstImageUrl(images: unknown[]): string | undefined {
  for (const entry of images) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const url = asString((entry as { url?: unknown }).url);
    if (url) {
      return url
        .replace("{@width}", "1200")
        .replace("{@height}", "1200")
        .replace("{@quality}", "80");
    }
  }

  return undefined;
}

function extractMatch(input: string, pattern: RegExp): string | undefined {
  return input.match(pattern)?.[1];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}
