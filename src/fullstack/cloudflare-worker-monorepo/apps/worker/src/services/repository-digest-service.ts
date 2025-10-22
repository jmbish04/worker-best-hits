import { createGithubClient } from "@cloudflare/github";
import { createDigestRepository } from "@cloudflare/data";
import { createNewsletterService } from "@cloudflare/email";
import { orchestrateRepoAnalysis } from "@cloudflare/agent";

/**
 * Coordinates GitHub discovery workflows: fetch metadata, summarize using AI,
 * persist the highlights, and email a digest once complete.
 */
export function createRepositoryDigestService() {
  const github = createGithubClient();
  const digests = createDigestRepository();
  const newsletter = createNewsletterService();

  return {
    async ingest(env: Env, repositories: Array<{ owner: string; name: string }>) {
      const reposWithMetadata = await github.fetchRepositories(repositories);
      const analyses = await orchestrateRepoAnalysis(env, reposWithMetadata);
      await digests.store(env.D1, analyses);
      const email = await newsletter.compose(env, analyses);
      await newsletter.send(env, email);
      return { processed: analyses.length };
    }
  };
}
