import { createPromptRepository } from "@cloudflare/data";

/**
 * Handles GitHub Action integrations that synchronize assistant prompt YAML files
 * into the D1 database, while keeping a full audit trail of modifications.
 */
export function createPromptSyncService() {
  const prompts = createPromptRepository();

  return {
    async syncPrompts(env: Env, incoming: Array<{ id: string; content: string }>) {
      return prompts.sync(env.D1, incoming);
    },

    async markModified(env: Env, previousPromptId: string, modifiedPromptId: string) {
      return prompts.markModified(env.D1, previousPromptId, modifiedPromptId);
    },

    async markLastSeen(env: Env, promptId: string, lastSeen: string) {
      return prompts.markLastSeen(env.D1, promptId, lastSeen);
    }
  };
}
