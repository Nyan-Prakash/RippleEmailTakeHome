/**
 * LLM error codes
 */
export type LLMErrorCode =
  | "INVALID_PROMPT"
  | "LLM_CONFIG_MISSING"
  | "LLM_FAILED"
  | "LLM_TIMEOUT"
  | "LLM_OUTPUT_INVALID";

/**
 * LLM-specific error class
 */
export class LLMError extends Error {
  constructor(
    public code: LLMErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "LLMError";
  }
}

/**
 * Create typed LLM error
 */
export function createLLMError(
  code: LLMErrorCode,
  message: string,
  cause?: unknown
): LLMError {
  return new LLMError(code, message, cause);
}

/**
 * Error messages for each code
 */
export const LLM_ERROR_MESSAGES: Record<LLMErrorCode, string> = {
  INVALID_PROMPT: "The prompt is empty or invalid",
  LLM_CONFIG_MISSING: "LLM API configuration is missing",
  LLM_FAILED: "Failed to generate campaign intent",
  LLM_TIMEOUT: "LLM request timed out",
  LLM_OUTPUT_INVALID: "LLM output could not be validated",
};
