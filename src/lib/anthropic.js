import Anthropic from "@anthropic-ai/sdk";

// Single shared client. The SDK reads ANTHROPIC_API_KEY from the environment.
export const anthropic = new Anthropic();

export const hasAnthropicKey = Boolean(
  process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
);
