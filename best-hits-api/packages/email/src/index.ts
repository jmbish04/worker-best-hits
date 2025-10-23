import type { RepositoryDigestRecord } from "@cloudflare/data";

export interface NewsletterEmail {
  subject: string;
  html: string;
  to: string[];
}

export type EmailEnv = Record<string, unknown>;

export function createNewsletterService() {
  return {
    async compose(_env: EmailEnv, digests: RepositoryDigestRecord[]): Promise<NewsletterEmail> {
      const html = [
        `<h1>Weekly Repository Highlights</h1>`,
        `<p>Curated by the Cloudflare Agent Assistant.</p>`,
        `<ul>`,
        ...digests.map(
          (digest) =>
            `<li><strong>${digest.owner}/${digest.name}</strong><br />${digest.summary}</li>`
        ),
        `</ul>`
      ].join("\n");

      return {
        subject: `Cloudflare Worker Digest (${digests.length} repos)` ,
        html,
        to: ["developers@example.com"]
      };
    },

    async send(_env: EmailEnv, email: NewsletterEmail) {
      console.log("Sending newsletter", email.subject);
    }
  };
}
