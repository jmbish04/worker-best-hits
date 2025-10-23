# Cloudflare Agent Worker

This Worker exposes the APIs consumed by the Cloudflare Agent Studio frontend and automation workflows.

- Protects every `/api/*` route with `WORKER_API_KEY` header enforcement.
- Stores chat transcripts, assistant prompts, and repository digests in D1.
- Streams repository metadata from GitHub, orchestrates AI summarization, and dispatches newsletter emails.
- Bridges the frontend chat to the Cloudflare Agents SDK, complete with Durable Object session management.

Use `wrangler dev --local` to emulate the worker locally and explore the JSON APIs described in the source files.
