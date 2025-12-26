
import { ENV } from "./env";
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type MessageContent = string | TextContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
};

export async function invokeLLM(messages: Message[]) {
  if (!openai) {
    console.warn("OpenAI API key is missing. AI features are disabled.");
    return "AI features are currently disabled. Please provide an OpenAI API key to enable them.";
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages as any,
  });

  return response.choices[0].message.content;
}
