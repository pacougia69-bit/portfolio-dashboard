
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
    
    // CRITICAL FIX: Ensure messages is always an array with explicit validation
    let messagesArray: Message[];
    if (!Array.isArray(messages)) {
      console.warn("Messages is not an array, converting:", typeof messages);
      messagesArray = [messages as Message];
    } else {
      messagesArray = messages;
    }
    
    if (messagesArray.length === 0) {
      throw new Error("Messages array is empty");
    }
    
    // Convert messages to the exact format OpenAI expects with strict validation
    const formattedMessages: ChatCompletionMessageParam[] = [];
    
    for (const msg of messagesArray) {
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
      
      // Explicitly create each message object
      formattedMessages.push({
        role: msg.role as "system" | "user" | "assistant",
        content: contentStr
      });
    }
    
    // CRITICAL: Triple-check formattedMessages is a valid array
    if (!Array.isArray(formattedMessages)) {
      console.error("FATAL: formattedMessages is not an array!");
      throw new Error("Failed to create messages array");
    }
    
    if (formattedMessages.length === 0) {
      console.error("FATAL: formattedMessages array is empty!");
      throw new Error("Messages array cannot be empty");
    }
    
    // Validate each message object
    for (let i = 0; i < formattedMessages.length; i++) {
      const m = formattedMessages[i];
      if (!m || typeof m !== 'object' || !m.role || !m.content) {
        console.error(`Invalid formatted message at index ${i}:`, m);
        throw new Error(`Invalid message object at index ${i}`);
      }
    }
    
    console.log(`Formatted messages count: ${formattedMessages.length}`);
    console.log(`Formatted messages for OpenAI:`, JSON.stringify(formattedMessages, null, 2));
    
    // COMPREHENSIVE DEBUG LOGGING - RIGHT BEFORE API CALL
    console.log("=== DEBUG OpenAI API Call ===");
    console.log("DEBUG messages value:", JSON.stringify(formattedMessages, null, 2));
    console.log("DEBUG messages isArray:", Array.isArray(formattedMessages));
    console.log("DEBUG messages type:", typeof formattedMessages);
    console.log("DEBUG messages length:", formattedMessages?.length);
    console.log("DEBUG messages constructor:", formattedMessages?.constructor?.name);
    console.log("DEBUG first message:", JSON.stringify(formattedMessages[0]));
    console.log("=== END DEBUG ===");
    
    // CRITICAL FIX: Pass parameters directly inline to avoid any object transformation
    // Do NOT use intermediate variables that might get optimized/transformed by bundler
    const response = await openai.chat.completions.create({
      model: model,
      messages: Array.isArray(formattedMessages) ? formattedMessages : [formattedMessages],
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

/**
 * Invoke LLM with Vision API for image/document analysis
 * Supports: JPG, PNG images directly
 * PDFs: Tries image conversion first, falls back to text extraction
 */
export async function invokeLLMWithVision(
  messages: Message[],
  imageUrl: string,
  modelIndex: number = 0
): Promise<string> {
  if (!openai) {
    const error = "OpenAI API key is missing. AI features are disabled.";
    console.error(error);
    throw new Error(error);
  }

  // Use GPT-4 Vision models - gpt-4o is the current stable model with vision
  const VISION_MODELS = ["gpt-4o", "gpt-4-turbo"];
  const model = VISION_MODELS[modelIndex];

  if (!model) {
    const error = "All vision models failed. Please check your API key and quota.";
    console.error(error);
    throw new Error(error);
  }

  try {
    console.log(`Attempting to use OpenAI Vision model: ${model}`);
    console.log(`Analyzing image URL: ${imageUrl}`);

    // Check if URL is a PDF
    let finalImageUrl = imageUrl;
    const isPDF = imageUrl.toLowerCase().endsWith('.pdf');

    if (isPDF) {
      console.log('📄 PDF detected - attempting conversion to image...');

      try {
        // Download PDF as buffer (robust loading)
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(imageUrl);

        if (!response.ok) {
          throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`✅ PDF downloaded successfully (${buffer.length} bytes)`);

        // Try to convert PDF to image using pdf-to-img
        try {
          console.log('🖼️  Attempting PDF to image conversion...');

          const { pdf } = await import('pdf-to-img');
          const pdfDoc = await pdf(buffer, { scale: 2.0 }); // Higher scale for better quality

          // Get first page
          let firstPageImage: Buffer | undefined;
          for await (const page of pdfDoc) {
            firstPageImage = page;
            break; // Only take first page
          }

          if (!firstPageImage) {
            throw new Error('No pages extracted from PDF');
          }

          // Convert to JPEG base64
          const sharp = await import('sharp');
          const jpegBuffer = await sharp.default(firstPageImage)
            .jpeg({ quality: 90 })
            .toBuffer();

          const base64Image = jpegBuffer.toString('base64');
          finalImageUrl = `data:image/jpeg;base64,${base64Image}`;

          console.log('✅ PDF converted to JPEG image (Base64)');

        } catch (imageConversionError: any) {
          // FALLBACK: If image conversion fails, extract text instead
          console.warn('⚠️  Image conversion failed, falling back to text extraction');
          console.warn(`   Error: ${imageConversionError.message}`);

          const pdfParse = (await import('pdf-parse')).default;
          const pdfData = await pdfParse(buffer);

          console.log(`📝 Extracted text from PDF (${pdfData.numpages} page(s), ${pdfData.text.length} characters)`);

          if (!pdfData.text || pdfData.text.trim().length === 0) {
            throw new Error('PDF text extraction failed - document may be image-based or encrypted');
          }

          // Use text-based analysis instead of vision
          console.log('🔄 Using text-based analysis instead of vision API');

          // Combine system and user messages, then append the extracted text
          const textMessages: Message[] = [
            ...messages,
            {
              role: 'user' as const,
              content: `Hier ist der extrahierte Text aus dem PDF-Dokument:\n\n${pdfData.text}`
            }
          ];

          // Use regular LLM (not vision) for text analysis
          return invokeLLM(textMessages, 0);
        }

      } catch (downloadError: any) {
        console.error('❌ Failed to download or process PDF:', downloadError.message);
        throw new Error(`PDF processing failed: ${downloadError.message}`);
      }
    }

    // Format messages for Vision API (for images or successfully converted PDFs)
    const formattedMessages: ChatCompletionMessageParam[] = messages.map((msg, index) => {
      // Add image to the last user message
      if (msg.role === 'user' && index === messages.length - 1) {
        return {
          role: 'user' as const,
          content: [
            {
              type: 'text' as const,
              text: typeof msg.content === 'string' ? msg.content : String(msg.content),
            },
            {
              type: 'image_url' as const,
              image_url: {
                url: finalImageUrl,
                detail: 'high' as const, // Use high detail for financial documents
              },
            },
          ],
        };
      }

      return {
        role: msg.role as "system" | "user" | "assistant",
        content: typeof msg.content === 'string' ? msg.content : String(msg.content),
      };
    });

    console.log('Calling OpenAI Vision API...');
    const completion = await openai.chat.completions.create({
      model,
      messages: formattedMessages,
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more factual analysis
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Vision API');
    }

    console.log('✅ Vision API call successful');
    return content;

  } catch (error: any) {
    console.error(`Vision model ${model} failed:`, error);

    // Retry with next model (only for Vision API errors, not text fallback)
    if (modelIndex < VISION_MODELS.length - 1) {
      console.log(`Retrying with next vision model...`);
      return invokeLLMWithVision(messages, imageUrl, modelIndex + 1);
    }

    // All models failed
    const errorMessage = error?.message || String(error);
    console.error("All vision models failed:", errorMessage);
    throw error;
  }
}
