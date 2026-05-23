import { endpointRequiresAuth } from "../config/endpoint";
import type { ProviderConfig } from "../config/types";

export const assertProviderReady = (config: ProviderConfig): void => {
  if (config.type === "mistral" && !config.apiKey) {
    throw new Error("Missing Mistral API key. Set MISTRAL_API_KEY, provider.apiKeyEnv, or macOS Keychain settings.");
  }

  if (config.type === "openai-compatible" && endpointRequiresAuth(config.endpoint) && !config.apiKey) {
    throw new Error("Missing STT API key for non-local OpenAI-compatible endpoint. Set provider.apiKeyEnv or provider.apiKey.");
  }
};
