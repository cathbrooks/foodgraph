import { ChatOpenAI } from "@langchain/openai";
import { getServerEnv } from "@/lib/env";

let _client: ChatOpenAI | null = null;
let _miniClient: ChatOpenAI | null = null;

export function getOpenAIClient(): ChatOpenAI {
  if (!_client) {
    _client = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0,
      openAIApiKey: getServerEnv().OPENAI_API_KEY,
    });
  }
  return _client;
}

export function getOpenAIMiniClient(): ChatOpenAI {
  if (!_miniClient) {
    _miniClient = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
      openAIApiKey: getServerEnv().OPENAI_API_KEY,
    });
  }
  return _miniClient;
}
