import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";

export class GeminiAdapter extends CookieLlmAdapter {
  constructor() {
    super({
      platform: "gemini",
      defaultModel: "gemini",
      textUnsupportedMessage:
        "Gemini text prompting is scaffolded, but the private Gemini web RPC still needs a live cookie session capture before this command can run reliably.",
      imageUnsupportedMessage:
        "Gemini image prompting is scaffolded, but the private multimodal upload flow still needs live validation.",
      videoUnsupportedMessage:
        "Gemini video prompting is scaffolded, but the private media-generation flow is not mapped yet in this CLI.",
    });
  }
}

export const geminiAdapter = new GeminiAdapter();
