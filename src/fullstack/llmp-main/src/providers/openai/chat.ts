import { generateText } from 'ai';

// This is defined in the @ai-sdk/openai package, but not exported
type OpenAIChatModelId = 'o1-preview' | 'o1-mini' | 'gpt-4o' | 'gpt-4o-2024-05-13' | 'gpt-4o-2024-08-06' | 'gpt-4o-mini' | 'gpt-4o-mini-2024-07-18' | 'gpt-4-turbo' | 'gpt-4-turbo-2024-04-09' | 'gpt-4-turbo-preview' | 'gpt-4-0125-preview' | 'gpt-4-1106-preview' | 'gpt-4' | 'gpt-4-0613' | 'gpt-3.5-turbo-0125' | 'gpt-3.5-turbo' | 'gpt-3.5-turbo-1106' | (string & {});

import { createOpenAI } from '@ai-sdk/openai';

import Chat from "@/interfaces/chat";
import Logger from "@/interfaces/logger";

class OpenAIChat extends Chat {
  private includeDate: boolean;
  private model: OpenAIChatModelId;
  private openai: any;
  private userId: string;

  constructor({
    gatewayUrl,
    logger,
    model,
    openaiApiKey,
    systemPrompt,
    userId,
    includeDate = true,
  }: {
    gatewayUrl?: string,
    logger: Logger,
    model: OpenAIChatModelId,
    openaiApiKey: string,
    systemPrompt: string,
    userId: string,
    includeDate?: boolean
  }) {
    super(systemPrompt, logger);
    this.includeDate = includeDate;
    this.model = model;
    this.openai = createOpenAI({
      apiKey: openaiApiKey,
      ...(gatewayUrl ? { baseURL: gatewayUrl } : {})
    });
    this.userId = userId;
  }

  async generateResponse(
    query: string,
    context: string,
    userPreferences: string,
    facts: string
  ): Promise<string> {
    this.logger.info('Generating AI response', { userId: this.userId });
    const model = this.openai.chat(this.model, { user: this.userId });

    let currentDateTimeSection = '';
    if (this.includeDate) {
      const currentDateTime = new Date().toISOString();
      currentDateTimeSection = `<currentDateTime>${currentDateTime}</currentDateTime>`;
    }

    const systemPrompt = `<prompt>${this.systemPrompt.trim()}</prompt>
${currentDateTimeSection}
<userPreferences>${userPreferences.trim()}</userPreferences>
<facts>${facts.trim()}</facts>
<previousConversation>${context.trim()}</previousConversation>`;

    try {
      const resp = await generateText({
        messages: [{ role: 'user', content: query }],
        model,
        system: systemPrompt,
      });
      this.logger.debug('AI response generated successfully');
      return resp.text;
    } catch (error) {
      this.logger.error('Error generating AI response', { error });
      throw new Error('Failed to generate AI response.');
    }
  }
}

export default OpenAIChat;