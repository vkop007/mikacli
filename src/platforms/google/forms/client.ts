import { AutoCliError } from "../../../errors.js";
import { GoogleApiClient } from "../shared/client.js";

export interface GoogleFormSummary {
  id?: string;
  title?: string;
  documentTitle?: string;
  description?: string;
  createdTime?: string;
  modifiedTime?: string;
  ownerName?: string;
  ownerEmail?: string;
  questionCount?: number;
  published?: boolean;
  acceptingResponses?: boolean;
  responderUri?: string;
  linkedSheetId?: string;
  webViewLink?: string;
}

export interface GoogleFormQuestionSummary {
  index?: number;
  itemId?: string;
  questionId?: string;
  title?: string;
  description?: string;
  required?: boolean;
  type?: string;
  options?: string[];
  optionCount?: number;
  paragraph?: boolean;
}

export interface GoogleFormDetail extends GoogleFormSummary {
  revisionId?: string;
  questions?: GoogleFormQuestionSummary[];
}

export interface GoogleFormResponseAnswer {
  questionId?: string;
  values?: string[];
  score?: number;
}

export interface GoogleFormResponseSummary {
  responseId?: string;
  formId?: string;
  createTime?: string;
  lastSubmittedTime?: string;
  respondentEmail?: string;
  answerCount?: number;
  answersPreview?: string[];
  totalScore?: number;
}

export interface GoogleFormResponseDetail extends GoogleFormResponseSummary {
  answers?: GoogleFormResponseAnswer[];
}

type DriveFileOwner = {
  displayName?: string;
  emailAddress?: string;
};

type DriveFile = {
  id?: string;
  name?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: DriveFileOwner[];
};

type DriveFilesResponse = {
  files?: DriveFile[];
};

type GoogleFormsInfo = {
  title?: string;
  documentTitle?: string;
  description?: string;
};

type GoogleFormsPublishState = {
  isPublished?: boolean;
  isAcceptingResponses?: boolean;
};

type GoogleFormsPublishSettings = {
  publishState?: GoogleFormsPublishState;
};

type GoogleFormsChoiceOption = {
  value?: string;
};

type GoogleFormsChoiceQuestion = {
  type?: string;
  options?: GoogleFormsChoiceOption[];
  shuffle?: boolean;
};

type GoogleFormsTextQuestion = {
  paragraph?: boolean;
};

type GoogleFormsQuestion = {
  questionId?: string;
  required?: boolean;
  choiceQuestion?: GoogleFormsChoiceQuestion;
  textQuestion?: GoogleFormsTextQuestion;
  scaleQuestion?: Record<string, unknown>;
  dateQuestion?: Record<string, unknown>;
  timeQuestion?: Record<string, unknown>;
  fileUploadQuestion?: Record<string, unknown>;
  rowQuestion?: Record<string, unknown>;
  ratingQuestion?: Record<string, unknown>;
};

type GoogleFormsQuestionItem = {
  question?: GoogleFormsQuestion;
};

type GoogleFormsItem = {
  itemId?: string;
  title?: string;
  description?: string;
  questionItem?: GoogleFormsQuestionItem;
  questionGroupItem?: Record<string, unknown>;
  pageBreakItem?: Record<string, unknown>;
  textItem?: Record<string, unknown>;
  imageItem?: Record<string, unknown>;
  videoItem?: Record<string, unknown>;
};

type GoogleFormsForm = {
  formId?: string;
  info?: GoogleFormsInfo;
  items?: GoogleFormsItem[];
  revisionId?: string;
  responderUri?: string;
  linkedSheetId?: string;
  publishSettings?: GoogleFormsPublishSettings;
};

type GoogleFormsAnswerText = {
  value?: string;
};

type GoogleFormsTextAnswers = {
  answers?: GoogleFormsAnswerText[];
};

type GoogleFormsFileUploadAnswer = {
  fileId?: string;
  fileName?: string;
  mimeType?: string;
};

type GoogleFormsFileUploadAnswers = {
  answers?: GoogleFormsFileUploadAnswer[];
};

type GoogleFormsAnswerGrade = {
  score?: number;
};

type GoogleFormsAnswer = {
  questionId?: string;
  grade?: GoogleFormsAnswerGrade;
  textAnswers?: GoogleFormsTextAnswers;
  fileUploadAnswers?: GoogleFormsFileUploadAnswers;
};

type GoogleFormsResponse = {
  formId?: string;
  responseId?: string;
  createTime?: string;
  lastSubmittedTime?: string;
  respondentEmail?: string;
  answers?: Record<string, GoogleFormsAnswer>;
  totalScore?: number;
};

type GoogleFormsBatchUpdateResponse = {
  form?: GoogleFormsForm;
  replies?: Array<{
    createItem?: {
      itemId?: string;
      questionId?: string[];
    };
  }>;
};

type GoogleFormsSetPublishSettingsResponse = {
  formId?: string;
  publishSettings?: GoogleFormsPublishSettings;
};

type GoogleFormsResponsesListResponse = {
  responses?: GoogleFormsResponse[];
  nextPageToken?: string;
};

export class FormsApiClient {
  private readonly formsClient: GoogleApiClient;
  private readonly driveClient: GoogleApiClient;

  constructor(accessToken: string, fetchImpl?: typeof fetch) {
    this.formsClient = new GoogleApiClient({
      accessToken,
      baseUrl: "https://forms.googleapis.com/v1",
      errorCode: "GOOGLE_FORMS_API_ERROR",
      fetchImpl,
    });
    this.driveClient = new GoogleApiClient({
      accessToken,
      baseUrl: "https://www.googleapis.com/drive/v3",
      errorCode: "GOOGLE_FORMS_API_ERROR",
      fetchImpl,
    });
  }

  async listForms(input: { query?: string; limit?: number } = {}): Promise<GoogleFormSummary[]> {
    const payload = await this.driveClient.json<DriveFilesResponse>("/files", {}, {
      q: buildDriveFormsQuery(input.query),
      pageSize: input.limit ?? 20,
      fields: "files(id,name,createdTime,modifiedTime,webViewLink,owners(displayName,emailAddress))",
      orderBy: "modifiedTime desc",
    });

    return (payload.files ?? []).map((file) => summarizeDriveForm(file));
  }

  async getForm(formId: string): Promise<GoogleFormDetail> {
    const payload = await this.formsClient.json<GoogleFormsForm>(`/forms/${encodeURIComponent(formId)}`);
    return summarizeForm(payload);
  }

  async createForm(input: {
    title: string;
    description?: string;
    documentTitle?: string;
    unpublished?: boolean;
  }): Promise<GoogleFormDetail> {
    const created = await this.formsClient.json<GoogleFormsForm>(
      "/forms",
      {
        method: "POST",
        body: {
          info: {
            title: input.title,
            ...(input.documentTitle?.trim() ? { documentTitle: input.documentTitle.trim() } : {}),
          },
        },
      },
      {
        unpublished: input.unpublished ? true : undefined,
      },
    );

    const formId = created.formId?.trim();
    if (!formId) {
      throw new AutoCliError("GOOGLE_FORM_ID_MISSING", "Google Forms did not return a form id.");
    }

    const description = input.description?.trim();
    if (description) {
      await this.updateFormInfo({
        formId,
        description,
      });
    }

    return this.getForm(formId);
  }

  async updateFormInfo(input: { formId: string; title?: string; description?: string }): Promise<GoogleFormDetail> {
    const info: Record<string, string> = {};
    const updateMask: string[] = [];

    if (input.title?.trim()) {
      info.title = input.title.trim();
      updateMask.push("title");
    }

    if (input.description !== undefined) {
      info.description = input.description.trim();
      updateMask.push("description");
    }

    if (updateMask.length === 0) {
      throw new AutoCliError("GOOGLE_FORMS_UPDATE_EMPTY", "Google Forms update-info requires at least one change.");
    }

    const payload = await this.formsClient.json<GoogleFormsBatchUpdateResponse>(
      `/forms/${encodeURIComponent(input.formId)}:batchUpdate`,
      {
        method: "POST",
        body: {
          includeFormInResponse: true,
          requests: [
            {
              updateFormInfo: {
                info,
                updateMask: updateMask.join(","),
              },
            },
          ],
        },
      },
    );

    return summarizeForm(payload.form ?? await this.fetchFormOrThrow(input.formId));
  }

  async addTextQuestion(input: {
    formId: string;
    title: string;
    description?: string;
    required?: boolean;
    index?: number;
    paragraph?: boolean;
  }): Promise<{ form: GoogleFormDetail; question?: GoogleFormQuestionSummary }> {
    const payload = await this.formsClient.json<GoogleFormsBatchUpdateResponse>(
      `/forms/${encodeURIComponent(input.formId)}:batchUpdate`,
      {
        method: "POST",
        body: {
          includeFormInResponse: true,
          requests: [
            {
              createItem: {
                item: {
                  title: input.title,
                  ...(input.description?.trim() ? { description: input.description.trim() } : {}),
                  questionItem: {
                    question: {
                      required: Boolean(input.required),
                      textQuestion: {
                        paragraph: Boolean(input.paragraph),
                      },
                    },
                  },
                },
                ...(typeof input.index === "number" ? { location: { index: input.index } } : {}),
              },
            },
          ],
        },
      },
    );

    const form = summarizeForm(payload.form ?? await this.fetchFormOrThrow(input.formId));
    const createdQuestionIds = payload.replies?.flatMap((reply) => reply.createItem?.questionId ?? []) ?? [];
    return {
      form,
      question: findQuestionByIds(form.questions, createdQuestionIds),
    };
  }

  async addChoiceQuestion(input: {
    formId: string;
    title: string;
    options: string[];
    description?: string;
    required?: boolean;
    index?: number;
    type?: string;
    shuffle?: boolean;
  }): Promise<{ form: GoogleFormDetail; question?: GoogleFormQuestionSummary }> {
    const payload = await this.formsClient.json<GoogleFormsBatchUpdateResponse>(
      `/forms/${encodeURIComponent(input.formId)}:batchUpdate`,
      {
        method: "POST",
        body: {
          includeFormInResponse: true,
          requests: [
            {
              createItem: {
                item: {
                  title: input.title,
                  ...(input.description?.trim() ? { description: input.description.trim() } : {}),
                  questionItem: {
                    question: {
                      required: Boolean(input.required),
                      choiceQuestion: {
                        type: normalizeChoiceType(input.type),
                        shuffle: Boolean(input.shuffle),
                        options: input.options.map((value) => ({ value })),
                      },
                    },
                  },
                },
                ...(typeof input.index === "number" ? { location: { index: input.index } } : {}),
              },
            },
          ],
        },
      },
    );

    const form = summarizeForm(payload.form ?? await this.fetchFormOrThrow(input.formId));
    const createdQuestionIds = payload.replies?.flatMap((reply) => reply.createItem?.questionId ?? []) ?? [];
    return {
      form,
      question: findQuestionByIds(form.questions, createdQuestionIds),
    };
  }

  async deleteItem(input: { formId: string; index: number }): Promise<GoogleFormDetail> {
    const payload = await this.formsClient.json<GoogleFormsBatchUpdateResponse>(
      `/forms/${encodeURIComponent(input.formId)}:batchUpdate`,
      {
        method: "POST",
        body: {
          includeFormInResponse: true,
          requests: [
            {
              deleteItem: {
                location: {
                  index: input.index,
                },
              },
            },
          ],
        },
      },
    );

    return summarizeForm(payload.form ?? await this.fetchFormOrThrow(input.formId));
  }

  async listResponses(input: { formId: string; filter?: string; limit?: number }): Promise<{
    responses: GoogleFormResponseSummary[];
    nextPageToken?: string;
  }> {
    const payload = await this.formsClient.json<GoogleFormsResponsesListResponse>(
      `/forms/${encodeURIComponent(input.formId)}/responses`,
      {},
      {
        filter: input.filter?.trim() || undefined,
        pageSize: input.limit ?? 20,
      },
    );

    return {
      responses: (payload.responses ?? []).map((response) => summarizeResponse(response)),
      ...(payload.nextPageToken ? { nextPageToken: payload.nextPageToken } : {}),
    };
  }

  async getResponse(input: { formId: string; responseId: string }): Promise<GoogleFormResponseDetail> {
    const payload = await this.formsClient.json<GoogleFormsResponse>(
      `/forms/${encodeURIComponent(input.formId)}/responses/${encodeURIComponent(input.responseId)}`,
    );
    return summarizeResponse(payload, {
      includeAnswers: true,
    });
  }

  async setPublishSettings(input: {
    formId: string;
    isPublished: boolean;
    isAcceptingResponses: boolean;
  }): Promise<GoogleFormDetail> {
    const payload = await this.formsClient.json<GoogleFormsSetPublishSettingsResponse>(
      `/forms/${encodeURIComponent(input.formId)}:setPublishSettings`,
      {
        method: "POST",
        body: {
          publishSettings: {
            publishState: {
              isPublished: input.isPublished,
              isAcceptingResponses: input.isAcceptingResponses,
            },
          },
          updateMask: "publishState",
        },
      },
    );

    const form = await this.getForm(input.formId);
    const publishState = payload.publishSettings?.publishState;
    return {
      ...form,
      ...(typeof publishState?.isPublished === "boolean" ? { published: publishState.isPublished } : {}),
      ...(typeof publishState?.isAcceptingResponses === "boolean" ? { acceptingResponses: publishState.isAcceptingResponses } : {}),
    };
  }

  async deleteForm(formId: string): Promise<void> {
    await this.driveClient.request(`/files/${encodeURIComponent(formId)}`, {
      method: "DELETE",
      headers: {
        accept: "*/*",
      },
    });
  }

  private async fetchFormOrThrow(formId: string): Promise<GoogleFormsForm> {
    return this.formsClient.json<GoogleFormsForm>(`/forms/${encodeURIComponent(formId)}`);
  }
}

function summarizeDriveForm(file: DriveFile): GoogleFormSummary {
  const owner = file.owners?.[0];
  return {
    ...(file.id ? { id: file.id } : {}),
    ...(file.name ? { title: file.name } : {}),
    ...(file.createdTime ? { createdTime: file.createdTime } : {}),
    ...(file.modifiedTime ? { modifiedTime: file.modifiedTime } : {}),
    ...(owner?.displayName ? { ownerName: owner.displayName } : {}),
    ...(owner?.emailAddress ? { ownerEmail: owner.emailAddress } : {}),
    ...(file.webViewLink ? { webViewLink: file.webViewLink } : {}),
  };
}

function summarizeForm(form: GoogleFormsForm): GoogleFormDetail {
  const questions = (form.items ?? [])
    .map((item, index) => summarizeQuestion(item, index))
    .filter((question): question is GoogleFormQuestionSummary => Boolean(question));
  const publishState = form.publishSettings?.publishState;

  return {
    ...(form.formId ? { id: form.formId } : {}),
    ...(form.info?.title ? { title: form.info.title } : {}),
    ...(form.info?.documentTitle ? { documentTitle: form.info.documentTitle } : {}),
    ...(form.info?.description ? { description: form.info.description } : {}),
    ...(form.revisionId ? { revisionId: form.revisionId } : {}),
    ...(form.responderUri ? { responderUri: form.responderUri } : {}),
    ...(form.linkedSheetId ? { linkedSheetId: form.linkedSheetId } : {}),
    questions,
    questionCount: questions.length,
    ...(typeof publishState?.isPublished === "boolean" ? { published: publishState.isPublished } : {}),
    ...(typeof publishState?.isAcceptingResponses === "boolean" ? { acceptingResponses: publishState.isAcceptingResponses } : {}),
    ...(form.formId ? { webViewLink: buildFormEditUrl(form.formId) } : {}),
  };
}

function summarizeQuestion(item: GoogleFormsItem, index: number): GoogleFormQuestionSummary | undefined {
  const question = item.questionItem?.question;
  if (!question) {
    return undefined;
  }

  const choiceOptions = question.choiceQuestion?.options
    ?.map((option) => option.value?.trim())
    .filter((value): value is string => Boolean(value));
  const type = detectQuestionType(question);

  return {
    index,
    ...(item.itemId ? { itemId: item.itemId } : {}),
    ...(question.questionId ? { questionId: question.questionId } : {}),
    ...(item.title ? { title: item.title } : {}),
    ...(item.description ? { description: item.description } : {}),
    ...(typeof question.required === "boolean" ? { required: question.required } : {}),
    ...(type ? { type } : {}),
    ...(choiceOptions && choiceOptions.length > 0 ? { options: choiceOptions, optionCount: choiceOptions.length } : {}),
    ...(typeof question.textQuestion?.paragraph === "boolean" ? { paragraph: question.textQuestion.paragraph } : {}),
  };
}

function detectQuestionType(question: GoogleFormsQuestion): string | undefined {
  if (question.choiceQuestion) {
    return normalizeChoiceType(question.choiceQuestion.type).toLowerCase();
  }

  if (question.textQuestion) {
    return question.textQuestion.paragraph ? "paragraph" : "text";
  }

  if (question.scaleQuestion) {
    return "scale";
  }

  if (question.dateQuestion) {
    return "date";
  }

  if (question.timeQuestion) {
    return "time";
  }

  if (question.fileUploadQuestion) {
    return "file_upload";
  }

  if (question.rowQuestion) {
    return "row";
  }

  if (question.ratingQuestion) {
    return "rating";
  }

  return undefined;
}

function summarizeResponse(
  response: GoogleFormsResponse,
  options: { includeAnswers?: boolean } = {},
): GoogleFormResponseDetail {
  const answers = Object.values(response.answers ?? {}).map((answer) => summarizeAnswer(answer));
  const answersPreview = answers
    .flatMap((answer) => answer.values ?? [])
    .filter((value): value is string => Boolean(value))
    .slice(0, 5);

  return {
    ...(response.responseId ? { responseId: response.responseId } : {}),
    ...(response.formId ? { formId: response.formId } : {}),
    ...(response.createTime ? { createTime: response.createTime } : {}),
    ...(response.lastSubmittedTime ? { lastSubmittedTime: response.lastSubmittedTime } : {}),
    ...(response.respondentEmail ? { respondentEmail: response.respondentEmail } : {}),
    answerCount: answers.length,
    ...(answersPreview.length > 0 ? { answersPreview } : {}),
    ...(typeof response.totalScore === "number" ? { totalScore: response.totalScore } : {}),
    ...(options.includeAnswers ? { answers } : {}),
  };
}

function summarizeAnswer(answer: GoogleFormsAnswer): GoogleFormResponseAnswer {
  const textValues = answer.textAnswers?.answers
    ?.map((entry) => entry.value?.trim())
    .filter((value): value is string => Boolean(value)) ?? [];
  const fileValues = answer.fileUploadAnswers?.answers
    ?.map((entry) => entry.fileName?.trim() || entry.fileId?.trim())
    .filter((value): value is string => Boolean(value)) ?? [];
  const values = [...textValues, ...fileValues];

  return {
    ...(answer.questionId ? { questionId: answer.questionId } : {}),
    ...(values.length > 0 ? { values } : {}),
    ...(typeof answer.grade?.score === "number" ? { score: answer.grade.score } : {}),
  };
}

function buildDriveFormsQuery(query?: string): string {
  const parts = ["mimeType='application/vnd.google-apps.form'", "trashed=false"];
  const trimmed = query?.trim();
  if (trimmed) {
    parts.push(`(${trimmed})`);
  }
  return parts.join(" and ");
}

function buildFormEditUrl(formId: string): string {
  return `https://docs.google.com/forms/d/${encodeURIComponent(formId)}/edit`;
}

function normalizeChoiceType(input?: string): string {
  const value = input?.trim().toUpperCase();
  if (value === "CHECKBOX" || value === "DROP_DOWN") {
    return value;
  }

  return "RADIO";
}

function findQuestionByIds(
  questions: readonly GoogleFormQuestionSummary[] | undefined,
  createdQuestionIds: readonly string[],
): GoogleFormQuestionSummary | undefined {
  if (!questions?.length || createdQuestionIds.length === 0) {
    return questions?.[questions.length - 1];
  }

  return questions.find((question) => question.questionId && createdQuestionIds.includes(question.questionId))
    ?? questions[questions.length - 1];
}
