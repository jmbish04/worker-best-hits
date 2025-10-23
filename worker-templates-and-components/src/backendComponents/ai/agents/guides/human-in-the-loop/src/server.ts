import { openai } from "@ai-sdk/openai";
import { routeAgentRequest } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type StreamTextOnFinishCallback,
  streamText,
  stepCountIs
} from "ai";
import { tools } from "./tools";
import {
  processToolCalls,
  hasToolConfirmation,
  getWeatherInformation
} from "./utils";

type Env = {
  OPENAI_API_KEY: string;
};

export class HumanInTheLoop extends AIChatAgent<Env> {
  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>) {
    const startTime = Date.now();

    const lastMessage = this.messages[this.messages.length - 1];

    if (hasToolConfirmation(lastMessage)) {
      // Process tool confirmations using UI stream
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          await processToolCalls(
            { writer, messages: this.messages, tools },
            { getWeatherInformation }
          );
        }
      });
      return createUIMessageStreamResponse({ stream });
    }

    // Use streamText directly and return with metadata
    const result = streamText({
      messages: convertToModelMessages(this.messages),
      model: openai("gpt-4o"),
      onFinish,
      tools,
      stopWhen: stepCountIs(5)
    });

    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => {
        // This is optional, purely for demo purposes in this example
        if (part.type === "start") {
          return {
            model: "gpt-4o",
            createdAt: Date.now(),
            messageCount: this.messages.length
          };
        }
        if (part.type === "finish") {
          return {
            responseTime: Date.now() - startTime,
            totalTokens: part.totalUsage?.totalTokens
          };
        }
      }
    });
  }
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
