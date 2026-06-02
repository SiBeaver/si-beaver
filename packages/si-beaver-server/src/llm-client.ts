import OpenAI from "openai";
import { config } from './config/index.js';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: config.llmApiKey,
      baseURL: config.llmBaseUrl,
    });
  }
  return client;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResponse {
  content: string;
  reasoning?: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export async function chatCompletion(messages: ChatMessage[], options?: { model?: string; temperature?: number }): Promise<LlmResponse> {
  const res = await getClient().chat.completions.create({
    model: options?.model ?? config.llmModel,
    messages,
    temperature: options?.temperature ?? 0.3,
  });

  const choice = res.choices[0];
  const msg = choice?.message as any;
  return {
    content: msg?.content ?? "",
    reasoning: msg?.reasoning_content || undefined,
    usage: res.usage ? { prompt_tokens: res.usage.prompt_tokens, completion_tokens: res.usage.completion_tokens } : undefined,
  };
}

export async function jsonCompletion<T>(messages: ChatMessage[], options?: { model?: string }): Promise<T> {
  const res = await getClient().chat.completions.create({
    model: options?.model ?? config.llmModel,
    messages,
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const content = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(content) as T;
}
