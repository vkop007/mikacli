export class MikaCliError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly exitCode: number;

  constructor(
    code: string,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      exitCode?: number;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "MikaCliError";
    this.code = code;
    this.details = options?.details;
    this.exitCode = options?.exitCode ?? 1;
  }
}

export function isMikaCliError(error: unknown): error is MikaCliError {
  return error instanceof MikaCliError;
}

export function errorToJson(error: unknown): {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
} {
  if (isMikaCliError(error)) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: {
        code: "UNEXPECTED_ERROR",
        message: error.message,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "UNKNOWN_ERROR",
      message: "An unknown error occurred.",
    },
  };
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : "Unknown error");
}
