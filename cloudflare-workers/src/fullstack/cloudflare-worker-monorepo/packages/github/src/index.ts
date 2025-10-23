export interface RepositoryInput {
  owner: string;
  name: string;
}

export interface RepositoryWithMetadata extends RepositoryInput {
  description?: string;
  stars?: number;
  topics?: string[];
  url?: string;
}

/**
 * Minimal GitHub API client. Swap the fetch logic with `@octokit/rest` or
 * GraphQL queries as needed.
 */
export function createGithubClient() {
  return {
    async fetchRepositories(repositories: RepositoryInput[]): Promise<RepositoryWithMetadata[]> {
      return repositories.map((repo) => ({
        ...repo,
        description: `Placeholder description for ${repo.owner}/${repo.name}.`,
        stars: Math.floor(Math.random() * 5000),
        topics: ["cloudflare", "workers", "ai"],
        url: `https://github.com/${repo.owner}/${repo.name}`
      }));
    }
  };
}
