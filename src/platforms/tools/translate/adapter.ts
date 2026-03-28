import { AutoCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

type TranslateInput = {
  text: string;
  from?: string;
  to?: string;
};

type GoogleTranslateSentence = [string?, string?, unknown?, unknown?, unknown?];

type GoogleTranslateResponse = [
  GoogleTranslateSentence[]?,
  unknown?,
  string?,
  unknown?,
  unknown?,
  unknown?,
  number?,
];

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
    const translation = await this.lookupGoogleTranslate({ text, from, to });

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
          "user-agent": "AutoCLI/1.0 (+https://github.com/)",
        },
      });
    } catch (error) {
      throw new AutoCliError("TRANSLATE_REQUEST_FAILED", "Unable to reach Google Translate's public endpoint.", {
        cause: error,
        details: {
          sourceUrl,
        },
      });
    }

    if (!response.ok) {
      throw new AutoCliError(
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
      throw new AutoCliError("TRANSLATE_RESPONSE_INVALID", "Google Translate returned invalid JSON.", {
        cause: error,
        details: {
          sourceUrl,
        },
      });
    }

    const parsed = parseGoogleTranslateResponse(payload);
    if (!parsed.translatedText) {
      throw new AutoCliError("TRANSLATE_RESPONSE_INVALID", "Google Translate response did not include translated text.", {
        details: {
          sourceUrl,
        },
      });
    }

    return {
      provider: "google-translate",
      sourceUrl,
      inputText: input.text,
      translatedText: parsed.translatedText,
      sourceLanguage: parsed.sourceLanguage ?? input.from,
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

export function parseGoogleTranslateResponse(payload: unknown): {
  translatedText: string;
  sourceLanguage?: string;
  confidence?: number;
} {
  if (!Array.isArray(payload)) {
    return { translatedText: "" };
  }

  const sentences = Array.isArray(payload[0]) ? payload[0] : [];
  const translatedText = sentences
    .flatMap((entry) => (Array.isArray(entry) && typeof entry[0] === "string" ? [entry[0]] : []))
    .join("")
    .trim();
  const sourceLanguage = typeof payload[2] === "string" && payload[2].trim().length > 0 ? payload[2].trim() : undefined;
  const confidence = typeof payload[6] === "number" && Number.isFinite(payload[6]) ? payload[6] : undefined;

  return {
    translatedText,
    sourceLanguage,
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
  const parsed = parseGoogleTranslateResponse(payload);
  return {
    translatedText: parsed.translatedText,
    detectedSourceLanguage: parsed.sourceLanguage,
  };
}

function buildGoogleTranslateUrl(input: { text: string; from: string; to: string }): string {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", input.from);
  url.searchParams.set("tl", input.to);
  url.searchParams.set("dt", "t");
  url.searchParams.set("ie", "UTF-8");
  url.searchParams.set("oe", "UTF-8");
  url.searchParams.set("q", input.text);
  return url.toString();
}

function normalizeText(value: string): string {
  const text = value.trim();
  if (!text) {
    throw new AutoCliError("INVALID_TEXT", "Expected text to translate.");
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
