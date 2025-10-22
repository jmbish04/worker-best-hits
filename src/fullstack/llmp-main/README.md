`ai generated README, this library is not ready to use yet`

![](https://cdn.githubraw.com/kristianfreeman/llmp/8bb11ee3d0b077162764527928cf65c195a4b00b/.github/warning.jpg)

# llmp - Large Language Model+

Welcome to **LLMP**, a scalable and extensible platform for building AI-powered conversational agents using Large Language Models (LLMs) like GPT-4. This library provides a modular architecture that allows developers to integrate various AI services, memory stores, and retrieval systems to create rich conversational experiences.

---

## Table of Contents

- [llmp - Large Language Model+](#llmp---large-language-model)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Features](#features)
  - [Architecture](#architecture)
  - [Getting Started](#getting-started)
    - [Installation](#installation)
    - [Basic Usage](#basic-usage)
  - [Directory Structure](#directory-structure)
  - [Extensibility](#extensibility)
    - [Adding a New Provider](#adding-a-new-provider)
  - [Cloudflare Worker Example](#cloudflare-worker-example)
    - [Running the Cloudflare Worker Example](#running-the-cloudflare-worker-example)
  - [Contributing](#contributing)
    - [Reporting Issues](#reporting-issues)
  - [License](#license)

---

## Introduction

LLMP aims to simplify the development of conversational AI applications by providing a flexible framework that integrates with various AI providers, storage solutions, and retrieval systems. Whether you're building a simple chatbot or a complex conversational agent, LLMP provides the building blocks you need.

## Features

- **Modular Architecture**: Swap out components like AI providers, memory stores, and retrieval systems with ease.
- **Extensibility**: Implement custom providers to suit your specific needs.
- **Scalability**: Designed to handle large-scale applications with efficient resource management.
- **Cloudflare Worker Support**: Includes a `test-worker` directory with Cloudflare-specific implementations for seamless deployment.

## Architecture

LLMP is built around several core interfaces and classes:

- **Chat**: Handles interaction with AI models.
- **Memory**: Manages conversation history and context.
- **Embeddings**: Generates embeddings for text data.
- **RAG (Retrieval Augmented Generation)**: Retrieves relevant information to enhance AI responses.
- **Facts**: Manages factual information extraction and storage.

These components interact within the `LLMP` class, orchestrating the flow of data to generate coherent and context-aware responses.

## Getting Started

### Installation

You can install LLMP via npm:

```bash
npm install llmp
```

### Basic Usage

Here's a simple example to get you started:

```typescript
import { createLogger, format, transports } from 'winston';
import {
  OpenAIChat,
  CloudflareMemory,
  CloudflareEmbeddings,
  CloudflareRAG,
  CloudflareKVFacts,
  LLMP,
  Logger,
} from 'llmp'; // Importing from the LLMP package

// Initialize logger
const logger: Logger = createLogger({
  level: 'debug',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

// Environment bindings (replace with actual bindings)
const env = {
  AI: /* Your AI resource binding */,
  DB: /* Your D1 database binding */,
  OPENAI_API_KEY: 'your-openai-api-key',
  VECTORIZE_INDEX: /* Your Vectorize index binding */,
  SYSTEM_PROMPT: 'Your system prompt here',
  FACTS_KV: /* Your KV namespace for facts */,
};

// User-specific variables
const userId = 'user-123';
const userQuery = 'What is the weather like today?';
const userPreferences = 'I prefer metric units.';

// Instantiate the components
const embeddings = new CloudflareEmbeddings(env.AI, logger);
const memory = new CloudflareMemory(env.DB, userId, logger);
const rag = new CloudflareRAG(env.VECTORIZE_INDEX, env.DB, userId, logger);
const facts = new CloudflareKVFacts(
  env.FACTS_KV,
  env.VECTORIZE_INDEX,
  embeddings,
  env.OPENAI_API_KEY,
  userId,
  logger
);

// By default, includeDate is true
const chat = new OpenAIChat(env.SYSTEM_PROMPT, env.OPENAI_API_KEY, userId, logger);

const llmp = new LLMP({
  chat,
  memory,
  rag,
  facts,
  embeddings,
  context: { userId },
  logger,
});

// Handle a user query
(async () => {
  try {
    const response = await llmp.handleQuery(userQuery, userPreferences);
    console.log('AI Response:', response);
  } catch (error) {
    logger.error('Error handling user query', { error });
  }
})();
```

## Directory Structure

The project is organized to promote modularity and extensibility:

```
src/
├── types.ts
├── interfaces/
│   ├── Chat.ts
│   ├── Memory.ts
│   ├── Embeddings.ts
│   ├── RAG.ts
│   ├── Facts.ts
│   └── Logger.ts
├── providers/
│   ├── OpenAI/
│   │   └── OpenAIChat.ts
│   ├── Cloudflare/
│   │   ├── Memory.ts
│   │   ├── Embeddings.ts
│   │   ├── RAG.ts
│   │   └── KVFacts.ts
│   └── /* Other providers can be added here */
├── LLMP.ts
└── index.ts
```

- **types.ts**: Consolidated type definitions.
- **interfaces/**: Abstract classes defining the contracts for components.
- **providers/**: Concrete implementations, organized by provider.
- **LLMP.ts**: Main class orchestrating the components.
- **test-worker/**: Contains Cloudflare Worker-specific implementations.

## Extensibility

LLMP is designed to be provider-agnostic. You can easily add new providers by implementing the interfaces:

### Adding a New Provider

1. **Create a New Folder**: Under `src/providers/`, create a folder for your provider (e.g., `src/providers/Azure/`).

2. **Implement Interfaces**: Create classes that extend the interfaces, such as `Chat`, `Memory`, or `Embeddings`.

   ```typescript
   // src/providers/Azure/AzureMemory.ts

   import { Memory } from "../../interfaces/Memory";
   import { Logger, DatabaseMessage, MessageRole } from "../../types";

   export class AzureMemory extends Memory {
     // Implement the methods using Azure services
   }
   ```

3. **Export Your Classes**: Update `src/index.ts` to export your new classes.

   ```typescript
   // src/index.ts

   // ... existing exports
   export * from "./providers/Azure/AzureMemory";
   ```

4. **Use in LLMP**: Instantiate your classes and pass them into the `LLMP` constructor.

   ```typescript
   import { AzureMemory } from './providers/Azure/AzureMemory';

   const memory = new AzureMemory(/* parameters */);
   ```

## Cloudflare Worker Example

The `test-worker` directory provides a complete example of how to deploy LLMP within a Cloudflare Worker environment. It includes:

- **Worker Script**: Demonstrates how to set up the worker and handle requests.
- **Bindings Configuration**: Shows how to configure KV namespaces, D1 databases, and other Cloudflare services.
- **Deployment Instructions**: Step-by-step guide to deploy the worker using `wrangler`.

### Running the Cloudflare Worker Example

1. **Navigate to the Directory**:

   ```bash
   cd test-worker
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Configure Wrangler**:

   Ensure you have [Wrangler](https://developers.cloudflare.com/workers/wrangler/get-started/) installed and configured.

4. **Deploy the Worker**:

   ```bash
   wrangler publish
   ```

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

### Reporting Issues

If you encounter any issues or have feature requests, please [open an issue](https://github.com/yourusername/llmp/issues).

## License

This project is licensed under the [MIT License](LICENSE).

