import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";

export class GrokAdapter extends CookieLlmAdapter {
  constructor() {
    super({
      platform: "grok",
      defaultModel: "grok-auto",
      textUnsupportedMessage:
        "Grok text prompting is scaffolded, but the private Grok conversation flow still needs a live cookie session capture before this command can run reliably.",
      imageUnsupportedMessage:
        "Grok multimodal image prompting is scaffolded, but the private attachment flow still needs a live session capture.",
      videoUnsupportedMessage:
        "Grok video prompting is scaffolded, but the private generation endpoint still needs live validation before this command can run reliably.",
    });
  }
}

export const grokAdapter = new GrokAdapter();
