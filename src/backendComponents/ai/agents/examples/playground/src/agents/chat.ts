import { AIChatAgent } from "agents/ai-chat-agent";
import {
  convertToModelMessages,
  streamText,
  createUIMessageStreamResponse,
  createUIMessageStream,
  type StreamTextOnFinishCallback
} from "ai";
import { model } from "../model";
import type { Env } from "../server";

export class Chat extends AIChatAgent<Env> {
  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>) {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const result = streamText({
          messages: convertToModelMessages(this.messages),
          model,
          onFinish
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
}
