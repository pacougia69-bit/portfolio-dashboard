
import { ENV } from "./env";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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

// List of models to try in order of preference
const MODELS_TO_TRY = [
  "gpt-4o",           // Try GPT-4o first if available
  "gpt-4o-mini",      // Fallback to GPT-4o mini
  "gpt-4-turbo",      // Then GPT-4 Turbo
  "gpt-3.5-turbo",    // Most reliable fallback
];

export async function invokeLLM(messages: Message[], modelIndex: number = 0): Promise<string> {
  if (!openai) {
    const error = "OpenAI API key is missing. AI features are disabled.";
    console.error(error);
    throw new Error(error);
  }

  const model = MODELS_TO_TRY[modelIndex];
  
  if (!model) {
    const error = "All OpenAI models failed. Please check your API key and quota.";
    console.error(error);
    throw new Error(error);
  }

  try {
    console.log(`Attempting to use OpenAI model: ${model}`);
    console.log(`Messages parameter type: ${Array.isArray(messages) ? 'array' : typeof messages}`);
    console.log(`Messages being sent:`, JSON.stringify(messages, null, 2));
    
    // CRITICAL FIX: Ensure messages is always an array
    const messagesArray = Array.isArray(messages) ? messages : [messages];
    
    if (messagesArray.length === 0) {
      throw new Error("Messages array is empty");
    }
    
    // Convert messages to the exact format OpenAI expects
    const formattedMessages: ChatCompletionMessageParam[] = messagesArray.map(msg => {
      // Ensure msg is an object with required properties
      if (!msg || typeof msg !== 'object' || !msg.role) {
        console.error("Invalid message object:", msg);
        throw new Error("Invalid message format");
      }
      
      // Convert content to string
      let contentStr: string;
      if (typeof msg.content === 'string') {
        contentStr = msg.content;
      } else if (Array.isArray(msg.content)) {
        contentStr = msg.content.map(c => 
          typeof c === 'string' ? c : (c as TextContent).text
        ).join(' ');
      } else if (msg.content && typeof msg.content === 'object' && 'text' in msg.content) {
        contentStr = (msg.content as TextContent).text;
      } else {
        console.error("Invalid content format:", msg.content);
        throw new Error("Message content must be a string or text object");
      }
      
      return {
        role: msg.role as "system" | "user" | "assistant",
        content: contentStr
      };
    });
    
    // CRITICAL: Verify formattedMessages is an array before sending to OpenAI
    if (!Array.isArray(formattedMessages) || formattedMessages.length === 0) {
      console.error("formattedMessages is not a valid array:", formattedMessages);
      throw new Error("Failed to format messages array");
    }
    
    console.log(`Formatted messages count: ${formattedMessages.length}`);
    console.log(`Formatted messages for OpenAI:`, JSON.stringify(formattedMessages, null, 2));
    
    const response = await openai.chat.completions.create({
      model: model,
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    
    if (!content) {
      throw new Error("OpenAI returned empty response");
    }
    
    console.log(`Successfully generated response using model: ${model}`);
    return content;
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorCode = error?.code || error?.status;
    
    console.error(`Error with model ${model}:`, {
      message: errorMessage,
      code: errorCode,
      type: error?.type,
      status: error?.status,
      fullError: error,
    });
    
    // Check if it's a model-specific error and we have more models to try
    if (
      (errorMessage.includes("model") || 
       errorMessage.includes("does not exist") ||
       errorCode === "model_not_found" ||
       error?.status === 404) &&
      modelIndex < MODELS_TO_TRY.length - 1
    ) {
      console.log(`Trying next model...`);
      return invokeLLM(messages, modelIndex + 1);
    }
    
    // For other errors or if we've exhausted all models, throw with detailed info
    const detailedError = `OpenAI API Error: ${errorMessage} (Model: ${model}, Code: ${errorCode || 'unknown'})`;
    console.error(detailedError);
    throw new Error(detailedError);
  }
}
