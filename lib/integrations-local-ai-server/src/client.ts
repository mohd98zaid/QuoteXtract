import OpenAI from "openai";

if (!process.env.LOCAL_AI_BASE_URL) {
  throw new Error(
    "LOCAL_AI_BASE_URL must be set. Did you forget to configure the local model?",
  );
}

if (!process.env.LOCAL_AI_API_KEY) {
  throw new Error(
    "LOCAL_AI_API_KEY must be set. Did you forget to configure the local model?",
  );
}

export const openai = new OpenAI({
  apiKey: process.env.LOCAL_AI_API_KEY,
  baseURL: process.env.LOCAL_AI_BASE_URL,
});
