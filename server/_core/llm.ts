import { ENV } from "./env";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages as any,
  });

  return response.choices[0].message.content;
}
