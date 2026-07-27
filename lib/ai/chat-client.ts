import OpenAI, { AzureOpenAI } from "openai";

// Where the conversation partner's brain comes from.
//
// Clara started on OpenAI's gpt-4o-mini, which is cheap and fine for scripted
// drills but weak at holding a character — its loose instruction-following is
// what let it ask a student whether she had "a vase for her books". The call
// simulator needs a model that can play a specific person under specific rules,
// so chat moves to a stronger deployment on Joel's own Azure account.
//
// Both paths are env-gated and the Azure one wins when fully configured. With no
// Azure variables set, this behaves exactly as before, so nothing breaks in
// production until the deployment exists.

export interface ChatModel {
  client: OpenAI;
  /** On Azure this is the deployment name, not the model name. */
  model: string;
  provider: "azure" | "openai";
}

/** The API version must support strict Structured Outputs (json_schema). */
const DEFAULT_AZURE_API_VERSION = "2024-10-21";

/** Fallback when running on plain OpenAI. */
const OPENAI_MODEL = "gpt-4o-mini";

export function getChatModel(): ChatModel | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (endpoint && azureKey && deployment) {
    return {
      client: new AzureOpenAI({
        endpoint,
        apiKey: azureKey,
        deployment,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || DEFAULT_AZURE_API_VERSION,
      }),
      model: deployment,
      provider: "azure",
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return { client: new OpenAI({ apiKey: openaiKey }), model: OPENAI_MODEL, provider: "openai" };
  }

  return null;
}
