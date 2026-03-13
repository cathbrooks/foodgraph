import { ChatOpenAI } from "@langchain/openai";
import { serverEnv } from "@/lib/env";

let _client: ChatOpenAI | null = null;

export function getOpenAIClient(): ChatOpenAI {
  if (!_client) {
    _client = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0,
      openAIApiKey: serverEnv.OPENAI_API_KEY,
    });
  }
  return _client;
}
