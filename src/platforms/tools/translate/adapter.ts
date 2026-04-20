import { MikaCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

type TranslateInput = {
  text: string;
  from?: string;
  to?: string;
};

type MyMemoryResponse = {
  responseStatus: number;
  responseDetails?: string;
  responseData: {
    translatedText: string;
    match?: number;
  };
};

type TranslationResult = {
  provider: string;
  sourceUrl: string;
  inputText: string;
  translatedText: string;
  sourceLanguage: string;
  requestedSourceLanguage: string;
  targetLanguage: string;
  confidence?: number;
};

export class TranslateAdapter {
  readonly platform = "translate" as Platform;
  readonly displayName = "Translate";

  async translate(input: TranslateInput): Promise<AdapterActionResult> {
    const text = normalizeText(input.text);
    const from = normalizeLanguageCode(input.from ?? "auto");
    const to = normalizeLanguageCode(input.to ?? "en");
    
    let translation: TranslationResult;
    try {
      translation = await this.lookupGoogleTranslate({ text, from, to });
    } catch (googleError) {
      try {
        translation = await this.lookupMyMemory({ text, from, to });
      } catch (myMemoryError) {
        throw googleError; // Prefer the Google error if both fail
      }
    }

    const sourceLabel = from === "auto" ? `${translation.sourceLanguage} (detected)` : from;

    return this.buildResult({
      action: "translate",
      message: `Translated text from ${sourceLabel} to ${to}.`,
      data: {
        provider: translation.provider,
        sourceUrl: translation.sourceUrl,
        inputText: translation.inputText,
        translatedText: translation.translatedText,
        sourceLanguage: translation.sourceLanguage,
        requestedSourceLanguage: translation.requestedSourceLanguage,
        targetLanguage: translation.targetLanguage,
        confidence: translation.confidence ?? null,
      },
    });
  }

  private async lookupGoogleTranslate(input: { text: string; from: string; to: string }): Promise<TranslationResult> {
    const sourceUrl = buildGoogleTranslateUrl(input);

    let response: Response;
    try {
      response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(10000),
        headers: {
          accept: "application/json",
          "user-agent": "MikaCLI/1.0 (+https://github.com/)",
        },
      });
    } catch (error) {
      throw new MikaCliError("TRANSLATE_REQUEST_FAILED", "Unable to reach Google Translate service.", {
        cause: error,
        details: {
          sourceUrl,
        },
      });
    }

    if (!response.ok) {
      throw new MikaCliError(
        "TRANSLATE_REQUEST_FAILED",
        `Google Translate returned HTTP ${response.status} ${response.statusText}.`,
        {
          details: {
            sourceUrl,
            status: response.status,
            statusText: response.statusText,
          },
        },
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new MikaCliError("TRANSLATE_RESPONSE_INVALID", "Google Translate returned invalid JSON.", {
        cause: error,
        details: {
          sourceUrl,
        },
      });
    }

    const parsed = parseGoogleTranslateResponse(payload);
    if (!parsed.translatedText) {
      throw new MikaCliError("TRANSLATE_RESPONSE_INVALID", "Google Translate response did not include translated text.", {
        details: {
          sourceUrl,
        },
      });
    }

    return {
      provider: "google",
      sourceUrl,
      inputText: input.text,
      translatedText: parsed.translatedText,
      sourceLanguage: parsed.detectedSourceLanguage ?? input.from,
      requestedSourceLanguage: input.from,
      targetLanguage: input.to,
    };
  }

  private async lookupMyMemory(input: { text: string; from: string; to: string }): Promise<TranslationResult> {
    // MyMemory doesn't support auto-detection in the same way as Google Translate
    // Use "en" as default when auto is requested
    const sourceLanguage = input.from === "auto" ? "en" : input.from;
    const sourceUrl = buildMyMemoryUrl({ ...input, from: sourceLanguage });

    let response: Response;
    try {
      response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(10000),
        headers: {
          accept: "application/json",
          "user-agent": "MikaCLI/1.0 (+https://github.com/)",
        },
      });
    } catch (error) {
      throw new MikaCliError("TRANSLATE_REQUEST_FAILED", "Unable to reach MyMemory translation service.", {
        cause: error,
        details: {
          sourceUrl,
        },
      });
    }

    if (!response.ok) {
      throw new MikaCliError(
        "TRANSLATE_REQUEST_FAILED",
        `MyMemory returned HTTP ${response.status} ${response.statusText}.`,
        {
          details: {
            sourceUrl,
            status: response.status,
            statusText: response.statusText,
          },
        },
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new MikaCliError("TRANSLATE_RESPONSE_INVALID", "MyMemory returned invalid JSON.", {
        cause: error,
        details: {
          sourceUrl,
        },
      });
    }

    const parsed = parseMyMemoryResponse(payload);
    if (!parsed.translatedText) {
      throw new MikaCliError("TRANSLATE_RESPONSE_INVALID", "MyMemory response did not include translated text.", {
        details: {
          sourceUrl,
        },
      });
    }

    return {
      provider: "mymemory",
      sourceUrl,
      inputText: input.text,
      translatedText: parsed.translatedText,
      sourceLanguage: sourceLanguage,
      requestedSourceLanguage: input.from,
      targetLanguage: input.to,
      confidence: parsed.confidence,
    };
  }

  private buildResult(input: {
    action: string;
    message: string;
    data: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: input.action,
      message: input.message,
      data: input.data,
    };
  }
}

export const translateAdapter = new TranslateAdapter();

export function parseMyMemoryResponse(payload: unknown): {
  translatedText: string;
  sourceLanguage?: string;
  confidence?: number;
} {
  if (typeof payload !== "object" || payload === null) {
    return { translatedText: "" };
  }

  const data = payload as Record<string, unknown>;
  
  if (data.responseStatus !== 200 || typeof data.responseData !== "object" || data.responseData === null) {
    return { translatedText: "" };
  }

  const responseData = data.responseData as Record<string, unknown>;
  const translatedText = typeof responseData.translatedText === "string" ? responseData.translatedText.trim() : "";
  const confidence = typeof responseData.match === "number" && Number.isFinite(responseData.match) ? responseData.match : undefined;

  return {
    translatedText,
    confidence,
  };
}

export function buildTranslateUrl(input: { text: string; from: string; to: string }): string {
  return buildGoogleTranslateUrl(input);
}

export function parseTranslateResponse(payload: unknown): {
  translatedText: string;
  detectedSourceLanguage?: string;
} {
  return parseGoogleTranslateResponse(payload);
}

export function buildGoogleTranslateUrl(input: { text: string; from: string; to: string }): string {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", input.from);
  url.searchParams.set("tl", input.to);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", input.text);
  return url.toString();
}

export function parseGoogleTranslateResponse(payload: unknown): {
  translatedText: string;
  detectedSourceLanguage?: string;
} {
  if (!Array.isArray(payload)) {
    return { translatedText: "" };
  }

  const segments = payload[0];
  if (!Array.isArray(segments) || segments.length === 0) {
    return { translatedText: "" };
  }

  const translatedText = segments
    .map((s) => (Array.isArray(s) && typeof s[0] === "string" ? s[0] : ""))
    .join("")
    .trim();

  const detectedSourceLanguage = typeof payload[2] === "string" ? payload[2] : undefined;

  return {
    translatedText,
    detectedSourceLanguage,
  };
}

function buildMyMemoryUrl(input: { text: string; from: string; to: string }): string {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", input.text);
  url.searchParams.set("langpair", `${input.from}|${input.to}`);
  return url.toString();
}

function normalizeText(value: string): string {
  const text = value.trim();
  if (!text) {
    throw new MikaCliError("INVALID_TEXT", "Expected text to translate.");
  }

  return text;
}

function normalizeLanguageCode(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "auto";
  }

  if (normalized === "detect") {
    return "auto";
  }

  return normalized;
}
