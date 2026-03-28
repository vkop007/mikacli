import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printShoppingAccountResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const user = result.user ?? {};
  const data = result.data ?? {};
  const displayName = [asString(user.displayName), asString(user.username)].find(Boolean);

  if (displayName) {
    console.log(`user: ${displayName}`);
  }
  if (typeof user.id === "string" && user.id.length > 0) {
    console.log(`id: ${user.id}`);
  }
  if (typeof data.mobile === "string" && data.mobile.length > 0) {
    console.log(`mobile: ${data.mobile}`);
  }
  if (typeof data.wishlistCount === "number") {
    console.log(`wishlist: ${data.wishlistCount} item${data.wishlistCount === 1 ? "" : "s"}`);
  }
  if (typeof data.cartCount === "number") {
    console.log(`cart: ${data.cartCount} item${data.cartCount === 1 ? "" : "s"}`);
  }
  if (typeof data.apiHost === "string" && data.apiHost.length > 0) {
    console.log(`api host: ${data.apiHost}`);
  }
}

export function printShoppingStatusResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  if (typeof data.status === "string") {
    console.log(`status: ${data.status}`);
  }
  if (typeof data.details === "string" && data.details.length > 0) {
    console.log(data.details);
  }
}

export function printShoppingSearchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const results = Array.isArray(result.data?.results) ? result.data.results : [];
  for (const [index, rawItem] of results.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const title = asString(item.title) ?? "Unknown product";
    const url = asString(item.url);
    const meta = [
      asString(item.priceText),
      typeof item.rating === "number" ? `${item.rating}/5` : undefined,
      typeof item.ratingCount === "number" ? `${item.ratingCount} ratings` : undefined,
      asString(item.availability),
      asString(item.seller),
      asString(item.soldText),
      item.sponsored ? "sponsored" : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);
    const description = asString(item.description) ?? asString(item.snippet);

    console.log(`${index + 1}. ${title}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (url) {
      console.log(`   ${url}`);
    }
    if (description) {
      console.log(`   ${description}`);
    }
  }
}

export function printShoppingProductResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data ?? {};
  const meta = [
    asString(data.priceText),
    typeof data.rating === "number" ? `${data.rating}/5` : undefined,
    typeof data.ratingCount === "number" ? `${data.ratingCount} ratings` : undefined,
    asString(data.availability),
    asString(data.brand),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.description === "string" && data.description.length > 0) {
    console.log(data.description);
  }

  const features = Array.isArray(data.features) ? data.features : [];
  for (const feature of features.slice(0, 6)) {
    if (typeof feature === "string" && feature.length > 0) {
      console.log(`- ${feature}`);
    }
  }
}

export function printShoppingStoreResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const user = result.user ?? {};
  const data = result.data ?? {};
  const name = asString(user.displayName) ?? asString(user.username) ?? asString(data.title);

  if (name) {
    console.log(`name: ${name}`);
  }
  if (typeof user.id === "string" && user.id.length > 0) {
    console.log(`id: ${user.id}`);
  }
  if (typeof data.location === "string" && data.location.length > 0) {
    console.log(`location: ${data.location}`);
  }
  if (typeof data.memberSince === "string" && data.memberSince.length > 0) {
    console.log(`member since: ${data.memberSince}`);
  }
  if (typeof data.positiveFeedbackText === "string" && data.positiveFeedbackText.length > 0) {
    console.log(`feedback: ${data.positiveFeedbackText}`);
  }
  if (typeof data.itemsSoldText === "string" && data.itemsSoldText.length > 0) {
    console.log(`items sold: ${data.itemsSoldText}`);
  }
  if (typeof data.followersText === "string" && data.followersText.length > 0) {
    console.log(`followers: ${data.followersText}`);
  }
  if (typeof data.reviewCountText === "string" && data.reviewCountText.length > 0) {
    console.log(`reviews: ${data.reviewCountText}`);
  }
  if (typeof data.description === "string" && data.description.length > 0) {
    console.log(data.description);
  }
}

export function printShoppingSuggestionsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const suggestions = Array.isArray(result.data?.suggestions) ? result.data.suggestions : [];
  for (const [index, suggestion] of suggestions.entries()) {
    if (typeof suggestion === "string" && suggestion.trim().length > 0) {
      console.log(`${index + 1}. ${suggestion.trim()}`);
    }
  }
}

export function printShoppingOrdersResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const orders = Array.isArray(result.data?.orders) ? result.data.orders : [];
  for (const [index, rawOrder] of orders.entries()) {
    if (!rawOrder || typeof rawOrder !== "object") {
      continue;
    }

    const order = rawOrder as Record<string, unknown>;
    const title = asString(order.orderId) ?? `Order ${index + 1}`;
    const meta = [
      asString(order.status),
      asString(order.placedAt),
      asString(order.totalText),
      asString(order.deliveryText),
      typeof order.itemCount === "number" ? `${order.itemCount} item${order.itemCount === 1 ? "" : "s"}` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${title}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }

    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items.slice(0, 3)) {
      if (typeof item === "string" && item.length > 0) {
        console.log(`   - ${item}`);
      }
    }

    const url = asString(order.url);
    if (url) {
      console.log(`   ${url}`);
    }
  }
}

export function printShoppingWishlistResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = Array.isArray(result.data?.items) ? result.data.items : [];
  for (const [index, rawItem] of items.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const title = asString(item.title) ?? `Wishlist item ${index + 1}`;
    const meta = [
      asString(item.priceText),
      asString(item.availability),
      asString(item.brand),
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${title}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    const url = asString(item.url);
    if (url) {
      console.log(`   ${url}`);
    }
  }
}

export function printShoppingCartResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data ?? {};
  const count = typeof data.count === "number" ? data.count : undefined;
  if (typeof count === "number") {
    console.log(`items: ${count}`);
  }

  const items = Array.isArray(data.items) ? data.items : [];
  for (const [index, rawItem] of items.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const title = asString(item.title) ?? asString(item.pid) ?? `Cart item ${index + 1}`;
    const meta = [
      asString(item.priceText),
      typeof item.quantity === "number" ? `qty ${item.quantity}` : undefined,
      asString(item.availability),
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${title}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    const url = asString(item.url);
    if (url) {
      console.log(`   ${url}`);
    }
  }
}

export function printShoppingOrderDetailResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data ?? {};
  const meta = [
    asString(data.placedAt),
    asString(data.totalText),
    Array.isArray(data.paymentMethods) ? data.paymentMethods.filter((value): value is string => typeof value === "string").join(", ") : undefined,
    asString(data.deliveryText),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  const itemDetails = Array.isArray(data.itemDetails) ? data.itemDetails : [];
  for (const [index, rawItem] of itemDetails.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const title = asString(item.title) ?? `Item ${index + 1}`;
    const itemMeta = [
      asString(item.priceText),
      asString(item.brand),
      asString(item.color),
      asString(item.deliveryText),
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${title}`);
    if (itemMeta.length > 0) {
      console.log(`   ${itemMeta.join(" • ")}`);
    }
    const url = asString(item.url);
    if (url) {
      console.log(`   ${url}`);
    }
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
