import ora, { type Ora } from "ora";
import pc from "picocolors";

export interface LoggerOptions {
  json?: boolean;
  verbose?: boolean;
}

export class Logger {
  private readonly json: boolean;
  private readonly verbose: boolean;

  constructor(options: LoggerOptions = {}) {
    this.json = options.json ?? false;
    this.verbose = options.verbose ?? false;
  }

  info(message: string): void {
    if (!this.json) {
      console.error(`${pc.cyan("info")} ${message}`);
    }
  }

  success(message: string): void {
    if (!this.json) {
      console.error(`${pc.green("success")} ${message}`);
    }
  }

  warn(message: string): void {
    if (!this.json) {
      console.error(`${pc.yellow("warn")} ${message}`);
    }
  }

  error(message: string): void {
    if (!this.json) {
      console.error(`${pc.red("error")} ${message}`);
    }
  }

  debug(message: string): void {
    if (!this.json && this.verbose) {
      console.error(`${pc.dim("debug")} ${message}`);
    }
  }

  spinner(text: string): Ora | null {
    if (this.json) {
      return null;
    }

    return ora({ text }).start();
  }
}
