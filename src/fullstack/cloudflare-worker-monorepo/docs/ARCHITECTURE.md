# Architecture Overview

This document summarizes how the monorepo pieces fit together.

- **Frontend (`apps/frontend`)** renders a shadcn-inspired interface with a persistent thread rail, conversational workspace, and curated resource explorer backed by the GitHub integration.
- **Worker (`apps/worker`)** exposes an authenticated API, orchestrates Durable Object chat sessions, and triggers AI-powered automation for repository analysis and newsletter creation.
- **Agent Package (`packages/agent`)** wraps the Cloudflare Agents SDK, providing composable tools for GitHub, D1, KV, and R2 while exposing helper factories used across the worker and frontend.
- **GitHub Package (`packages/github`)** centralizes GitHub REST/GraphQL calls, repository metadata caching, and scaffolding utilities for creating derivative workers from existing templates.
- **Data Package (`packages/data`)** stores schema definitions and query helpers for the `assistant_prompts` and `repository_digests` tables within D1.
- **Templates Package (`packages/templates`)** collects modular boilerplates for backend, frontend, and full-stack worker scaffolds, including RAG and agentic recipes.
- **Email Package (`packages/email`)** formats and delivers newsletter digests once repository analyses complete.

Each module prioritizes readability and includes docstrings that explain the intent of exported functions to accelerate onboarding for Cloudflare worker developers.
