import { MikaCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

import { buildCheatUrl, normalizeCheatLanguage, normalizeCheatShell, normalizeCheatTopic, truncateCheatSnippet } from "./helpers.js";

export class CheatAdapter {
  readonly platform = "cheat" as unknown as Platform;
  readonly displayName = "Cheat";

  async cheat(input: { topic: string; shell?: string; lang?: string }): Promise<AdapterActionResult> {
    const topic = normalizeCheatTopic(input.topic);
    const shell = normalizeCheatShell(input.shell);
    const lang = normalizeCheatLanguage(input.lang);
    const sourceUrl = buildCheatUrl({ topic, shell, lang });

    const snippet = await this.fetchSnippet(sourceUrl);
    const trimmed = truncateCheatSnippet(snippet);

    return this.buildResult({
      action: "cheat",
      message: `Loaded cheat sheet for "${topic}".`,
      url: sourceUrl,
      data: {
        topic,
        shell,
        lang,
        sourceUrl,
        snippet: trimmed,
      },
    });
  }

  private async fetchSnippet(url: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "user-agent": "curl/8.5.0",
          accept: "text/plain,text/*;q=0.9,*/*;q=0.8",
        },
      });
    } catch (error) {
      throw new MikaCliError("CHEAT_FETCH_FAILED", "Unable to reach cht.sh.", {
        cause: error,
        details: {
          url,
        },
      });
    }

    if (!response.ok) {
      throw new MikaCliError("CHEAT_HTTP_ERROR", `cht.sh returned HTTP ${response.status}.`, {
        details: {
          url,
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    return response.text();
  }

  private buildResult(input: {
    action: string;
    message: string;
    url: string;
    data: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: input.action,
      message: input.message,
      url: input.url,
      data: input.data,
    };
  }
}

export const cheatAdapter = new CheatAdapter();
