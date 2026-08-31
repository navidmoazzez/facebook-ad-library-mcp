/**
 * One error type, so every failure reaching a model says what to do next.
 *
 * A tool that fails with "Error: request failed" costs the model a turn and
 * usually a wrong guess. Every message here names the fix: which variable to
 * set, which backend to switch to, how long to wait.
 */

export class AdLibraryError extends Error {
  readonly hint?: string;
  readonly backend?: string;

  constructor(message: string, options: { hint?: string; backend?: string } = {}) {
    super(message);
    this.name = "AdLibraryError";
    this.hint = options.hint;
    this.backend = options.backend;
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      ...(this.hint ? { hint: this.hint } : {}),
      ...(this.backend ? { backend: this.backend } : {}),
    };
  }
}
