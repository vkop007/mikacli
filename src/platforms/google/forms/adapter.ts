import { MikaCliError } from "../../../errors.js";
import { BaseGooglePlatformAdapter } from "../shared/base.js";
import { FormsApiClient } from "./client.js";

import type { AdapterActionResult } from "../../../types.js";

export class FormsAdapter extends BaseGooglePlatformAdapter {
  readonly platform = "forms" as const;
  protected readonly defaultScopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/forms.body",
    "https://www.googleapis.com/auth/forms.responses.readonly",
    "https://www.googleapis.com/auth/drive",
  ] as const;

  async forms(input: { account?: string; query?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const forms = await this.createClient(active.accessToken).listForms(input);

    return this.buildActionResult({
      account: active.account,
      action: "forms",
      message: `Loaded ${forms.length} Google Form${forms.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        forms,
      },
    });
  }

  async form(input: { account?: string; formId: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const form = await this.createClient(active.accessToken).getForm(input.formId);

    return this.buildActionResult({
      account: active.account,
      action: "form",
      message: `Loaded Google Form ${input.formId}.`,
      sessionPath: active.path,
      user: active.user,
      id: form.id,
      url: form.webViewLink,
      data: {
        form,
        questions: form.questions ?? [],
      },
    });
  }

  async responses(input: { account?: string; formId: string; filter?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const result = await this.createClient(active.accessToken).listResponses({
      formId: input.formId,
      filter: input.filter,
      limit: input.limit,
    });

    return this.buildActionResult({
      account: active.account,
      action: "responses",
      message: `Loaded ${result.responses.length} Google Form response${result.responses.length === 1 ? "" : "s"} from ${input.formId}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        formId: input.formId,
        ...(input.filter?.trim() ? { filter: input.filter.trim() } : {}),
        ...(result.nextPageToken ? { nextPageToken: result.nextPageToken } : {}),
        responses: result.responses,
      },
    });
  }

  async response(input: { account?: string; formId: string; responseId: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const response = await this.createClient(active.accessToken).getResponse({
      formId: input.formId,
      responseId: input.responseId,
    });

    return this.buildActionResult({
      account: active.account,
      action: "response",
      message: `Loaded Google Form response ${input.responseId}.`,
      sessionPath: active.path,
      user: active.user,
      id: response.responseId,
      data: {
        formId: input.formId,
        response,
      },
    });
  }

  async create(input: {
    account?: string;
    title: string;
    description?: string;
    documentTitle?: string;
    unpublished?: boolean;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const title = input.title.trim();
    if (!title) {
      throw new MikaCliError("GOOGLE_FORMS_TITLE_REQUIRED", "Google Forms create requires a title.");
    }

    const form = await this.createClient(active.accessToken).createForm({
      title,
      description: input.description,
      documentTitle: input.documentTitle,
      unpublished: input.unpublished,
    });

    return this.buildActionResult({
      account: active.account,
      action: "create",
      message: `Created Google Form ${title}.`,
      sessionPath: active.path,
      user: active.user,
      id: form.id,
      url: form.webViewLink,
      data: {
        form,
        questions: form.questions ?? [],
      },
    });
  }

  async updateInfo(input: {
    account?: string;
    formId: string;
    title?: string;
    description?: string;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const form = await this.createClient(active.accessToken).updateFormInfo({
      formId: input.formId,
      title: input.title,
      description: input.description,
    });

    return this.buildActionResult({
      account: active.account,
      action: "update-info",
      message: `Updated Google Form ${input.formId}.`,
      sessionPath: active.path,
      user: active.user,
      id: form.id,
      url: form.webViewLink,
      data: {
        form,
        questions: form.questions ?? [],
      },
    });
  }

  async addTextQuestion(input: {
    account?: string;
    formId: string;
    title: string;
    description?: string;
    required?: boolean;
    index?: number;
    paragraph?: boolean;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const title = input.title.trim();
    if (!title) {
      throw new MikaCliError("GOOGLE_FORMS_QUESTION_TITLE_REQUIRED", "Google Forms add-text-question requires --title.");
    }

    const result = await this.createClient(active.accessToken).addTextQuestion({
      formId: input.formId,
      title,
      description: input.description,
      required: input.required,
      index: input.index,
      paragraph: input.paragraph,
    });

    return this.buildActionResult({
      account: active.account,
      action: "add-text-question",
      message: `Added a text question to Google Form ${input.formId}.`,
      sessionPath: active.path,
      user: active.user,
      id: result.question?.questionId ?? result.form.id,
      url: result.form.webViewLink,
      data: {
        form: result.form,
        question: result.question,
        questions: result.form.questions ?? [],
      },
    });
  }

  async addChoiceQuestion(input: {
    account?: string;
    formId: string;
    title: string;
    options: string[];
    description?: string;
    required?: boolean;
    index?: number;
    type?: string;
    shuffle?: boolean;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const title = input.title.trim();
    if (!title) {
      throw new MikaCliError("GOOGLE_FORMS_QUESTION_TITLE_REQUIRED", "Google Forms add-choice-question requires --title.");
    }

    const options = input.options.map((value) => value.trim()).filter(Boolean);
    if (options.length < 2) {
      throw new MikaCliError("GOOGLE_FORMS_OPTIONS_REQUIRED", "Google Forms add-choice-question requires at least two options.");
    }

    const result = await this.createClient(active.accessToken).addChoiceQuestion({
      formId: input.formId,
      title,
      options,
      description: input.description,
      required: input.required,
      index: input.index,
      type: input.type,
      shuffle: input.shuffle,
    });

    return this.buildActionResult({
      account: active.account,
      action: "add-choice-question",
      message: `Added a choice question to Google Form ${input.formId}.`,
      sessionPath: active.path,
      user: active.user,
      id: result.question?.questionId ?? result.form.id,
      url: result.form.webViewLink,
      data: {
        form: result.form,
        question: result.question,
        questions: result.form.questions ?? [],
      },
    });
  }

  async deleteItem(input: { account?: string; formId: string; index: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const form = await this.createClient(active.accessToken).deleteItem({
      formId: input.formId,
      index: input.index,
    });

    return this.buildActionResult({
      account: active.account,
      action: "delete-item",
      message: `Deleted item ${input.index} from Google Form ${input.formId}.`,
      sessionPath: active.path,
      user: active.user,
      id: form.id,
      url: form.webViewLink,
      data: {
        form,
        questions: form.questions ?? [],
      },
    });
  }

  async publish(input: {
    account?: string;
    formId: string;
    published: boolean;
    acceptingResponses?: boolean;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const isAcceptingResponses = input.published ? input.acceptingResponses ?? true : false;
    if (!input.published && input.acceptingResponses) {
      throw new MikaCliError(
        "GOOGLE_FORMS_INVALID_PUBLISH_STATE",
        "Google Forms cannot accept responses while unpublished. Use --published true or remove --accepting-responses true.",
      );
    }

    const form = await this.createClient(active.accessToken).setPublishSettings({
      formId: input.formId,
      isPublished: input.published,
      isAcceptingResponses,
    });

    return this.buildActionResult({
      account: active.account,
      action: "publish",
      message: `${input.published ? "Updated publish settings for" : "Unpublished"} Google Form ${input.formId}.`,
      sessionPath: active.path,
      user: active.user,
      id: form.id,
      url: form.webViewLink,
      data: {
        form,
        questions: form.questions ?? [],
      },
    });
  }

  async delete(input: { account?: string; formId: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    await this.createClient(active.accessToken).deleteForm(input.formId);

    return this.buildActionResult({
      account: active.account,
      action: "delete",
      message: `Deleted Google Form ${input.formId}.`,
      sessionPath: active.path,
      user: active.user,
      id: input.formId,
      data: {
        form: {
          id: input.formId,
          status: "deleted",
        },
      },
    });
  }

  private createClient(accessToken: string): FormsApiClient {
    return new FormsApiClient(accessToken, this.fetchImpl);
  }
}

export const formsAdapter = new FormsAdapter();
