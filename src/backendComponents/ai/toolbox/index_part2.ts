/**
 * @file src/tools/index.ts
 * @description Integrated toolkit for Cloudflare AI, Browser Rendering, Auth, and Health Monitoring.
 * Includes batch processing capabilities for embeddings and structured responses.
 *
 * @module This file serves as the central barrel export for the entire tools ecosystem.
 * It defines and exports two primary AI tool classes:
 * 1. `EmbeddingTool`: Handles text embedding generation (single and batch async) and search result reranking.
 * 2. `StructuredResponseTool`: Provides robust, schema-enforced JSON output from LLMs (single and batch async),
 * with automatic model fallback and context-aware chunking for single requests.
 *
 * It also exports:
 * - Health monitoring tools (`createToolsHealthMonitor` and specific checkers).
 * - A browser rendering tool (`createBrowserRender`).
 * - An authentication tool (`createAuthTool`).
 * - An AI extractor tool (`createAIExtractorTool`).
 * - A high-level `createToolkit` factory to instantiate all tools with a shared environment.
 * - Default configuration (`DEFAULT_TOOL_CONFIG`) for the toolkit.
 * - Batch processing types (`BatchQueuedResponse`, `BatchEmbeddingPollResponse`, `BatchStructuredPollResponse`).
 *
 * @see EmbeddingTool For embedding (single, batch async) and reranking logic.
 * @see StructuredResponseTool For schema-enforced LLM responses (single, batch async).
 * @see createToolkit For the primary factory function to instantiate all tools.
 */

import type { ZodObject, ZodSchema, z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Env, ExtendedEnv } from "../types/env"; // Assuming these types exist in your project structure
// Note: Health, Browser, Auth, and Extractor imports are assumed to exist based on original context.
import {
    createToolsHealthMonitor,
    createAIToolsHealthChecker,
    createBrowserToolsHealthChecker,
    createAuthToolsHealthChecker,
    createExtractorToolsHealthChecker,
    ToolsHealthMonitor,
} from "./health"; // Assuming ./health exists
import type {
    SystemHealthStatus,
    QuickHealthStatus,
    AIToolsHealthStatus,
    BrowserToolsHealthStatus,
    AuthToolsHealthStatus,
    ExtractorToolsHealthStatus,
} from "./health"; // Assuming ./health exists
import { createBrowserRender } from "./browser-tools"; // Assuming ./browser-tools exists
import { createAuthTool } from "./auth-tools"; // Assuming ./auth-tools exists
import { createAIExtractorTool } from "./extractor-tools"; // Assuming ./extractor-tools exists

// --- Configuration & Model Definitions ---

/**
 * @constant Llama4Scout
 * @description Model ID for Llama 4 Scout.
 */
const Llama4Scout = "@cf/meta/llama-4-scout-17b-16e-instruct" as const;

/**
 * @constant MistralSmall3_1
 * @description Model ID for Mistral Small 3.1.
 */
const MistralSmall3_1 = "@cf/mistralai/mistral-small-3.1-24b-instruct" as const;

/**
 * @constant Hermes2Pro
 * @description Model ID for Hermes 2 Pro (Mistral 7B).
 */
const Hermes2Pro = "@hf/nousresearch/hermes-2-pro-mistral-7b" as const;

/**
 * @constant Llama3_3
 * @description Model ID for Llama 3.3 70B Instruct.
 */
const Llama3_3 = "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as const;

/**
 * @typedef {string} StructuredModel
 * @description A type union representing all AI model identifiers
 * supported by the `StructuredResponseTool`.
 */
type StructuredModel =
    | typeof Llama4Scout
    | typeof MistralSmall3_1
    | typeof Hermes2Pro
    | typeof Llama3_3;

/**
 * @constant EmbedModel
 * @description Model ID for the BAAI General Embedding (bge) model.
 */
const EmbedModel = "@cf/baai/bge-large-en-v1.5" as const;

/**
 * @constant RerankerModel
 * @description Model ID for the BAAI Reranker model.
 */
const RerankerModel = "@cf/baai/bge-reranker-base" as const;

// --- Interfaces & Types ---

/**
 * @interface AiBinding
 * @description Defines the expected interface for a Cloudflare AI binding (`env.AI`).
 * Updated to include the optional flags for batch requests.
 */
interface AiBinding {
    run: (model: string, options: any, flags?: { queueRequest?: boolean }) => Promise<any>;
}

/**
 * @interface VectorizeBinding
 * @description Defines the expected interface for a Cloudflare Vectorize binding.
 */
interface VectorizeBinding {
    query: (vector: number[], options: { topK: number }) => Promise<any>;
}

/**
 * @interface EmbeddingResponse
 * @description Represents the raw, successful response structure for a *single*
 * embedding from the Cloudflare embedding model.
 */
interface EmbeddingResponse {
    shape: number[];
    data: number[][]; // For a single request, data will have one inner array.
}

/**
 * @interface BatchQueuedResponse
 * @description Represents the initial response when queueing any batch request.
 */
interface BatchQueuedResponse {
    status: "queued";
    model: string;
    request_id: string;
}

/**
 * @interface BatchEmbeddingResultItem
 * @description Represents a single item within the final batch embedding results array.
 */
interface BatchEmbeddingResultItem {
    id: number; // Index corresponding to original request array
    result?: { shape: number[], data: number[][] }; // Embedding result for this item
    success: boolean;
    error?: string; // Present if success is false for this item
    external_reference?: string | null; // If provided in original request
}

/**
 * @interface BatchEmbeddingResult
 * @description Represents the final successful response structure for batch embeddings.
 */
interface BatchEmbeddingResult {
    responses: BatchEmbeddingResultItem[];
    usage?: { // Optional usage stats
        prompt_tokens?: number;
        completion_tokens?: number; // Usually 0 for embeddings
        total_tokens?: number;
    };
    status?: "completed"; // May be present in final response
}

/**
 * @interface BatchStructuredResultItem
 * @description Represents a single item within the final batch structured analysis results array.
 * @template T The type of the expected structured result for this item.
 */
interface BatchStructuredResultItem<T> {
    id: number; // Index corresponding to original request array
    result?: { response: T | any }; // The actual JSON object is nested here; 'any' before validation
    success: boolean;
    error?: string; // Present if success is false for this item
    external_reference?: string | null; // If provided in original request
}


/**
 * @interface BatchStructuredResult
 * @description Represents the final successful response structure for batch structured analysis.
 * @template T The type of the structured result after validation or an error marker.
 */
interface BatchStructuredResult<T> {
     responses: BatchStructuredResultItem<T>[];
     usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
     status?: "completed"; // May be present in final response
}

/**
 * @interface BatchIntermediateStatus
 * @description Represents intermediate batch status (queued or running) during polling.
 */
interface BatchIntermediateStatus {
    status: "queued" | "running";
    request_id: string;
    model: string;
    responses?: never; // Ensure responses field isn't present in intermediate status
}

/**
 * @type BatchEmbeddingPollResponse
 * @description Union type for polling embedding batch results.
 */
type BatchEmbeddingPollResponse = BatchEmbeddingResult | BatchIntermediateStatus;

/**
 * @type BatchStructuredPollResponse
 * @description Union type for polling structured analysis batch results.
 * @template T The type of the structured result after validation or an error marker.
 */
type BatchStructuredPollResponse<T> = BatchStructuredResult<T> | BatchIntermediateStatus;


/**
 * @interface StructuredResponse
 * @description A standardized wrapper for *single* (non-batch) responses from `StructuredResponseTool`.
 * @template T The type of the structured result, inferred from the provided Zod schema.
 */
interface StructuredResponse<T> {
    /**
     * @property {boolean} success - True if the AI call was successful *and*
     * the response was successfully parsed and validated against the schema.
     */
    success: boolean;
    /**
     * @property {StructuredModel} modelUsed - The string identifier of the AI model
     * that processed this request.
     */
    modelUsed: StructuredModel;
    /**
     * @property {T | null} structuredResult - The Zod-validated JSON object if
     * `success` is true, otherwise null.
     */
    structuredResult: T | null;
    /**
     * @property {string | undefined} error - A detailed error message if
     * `success` is false.
     */
    error?: string;
    /**
     * @property {boolean | undefined} isChunked - True if the response was generated
     * by splitting a large text payload into multiple AI calls.
     */
    isChunked?: boolean;
}

// --- Embedding Tool Class ---

/**
 * @class EmbeddingTool
 * @description Provides a high-level API for interacting with Cloudflare's
 * embedding (single and batch async) and reranking AI models.
 *
 * @example
 * // In a Worker:
 * const embedTool = new EmbeddingTool(env);
 * // Single embedding
 * const vector = await embedTool.generateEmbedding("Hello world");
 * // Batch async embedding
 * const batchRequest = await embedTool.requestBatchEmbeddings(["text1", "text2"]);
 * // ... poll later ...
 * const batchResult = await embedTool.pollBatchEmbeddingStatus(batchRequest.request_id);
 * if (batchResult.status === 'completed') { // Type guard
 * console.log(batchResult.responses[0].result?.data[0]); // Access embedding
 * }
 * // Reranking
 * const searchResults = [...] // from Vectorize
 * const reranked = await embedTool.rerankMatches("Hello world", searchResults);
 */
export class EmbeddingTool {
    private env: Env;

    /**
     * @constructor
     * @param {Env} env - The Cloudflare Worker environment object, must contain `AI`.
     */
    constructor(env: Env) {
        if (!env || !env.AI) {
            throw new Error("Cloudflare AI binding (env.AI) is required for EmbeddingTool.");
        }
        this.env = env;
    }

    /**
     * @method generateEmbedding
     * @description Generates a vector embedding for a single text string.
     * @param {string} query - The text to embed.
     * @returns {Promise<number[]>} A promise that resolves to the vector embedding.
     * @throws {Error} Throws if the AI model fails or returns unexpected data shape.
     */
    public async generateEmbedding(query: string): Promise<number[]> {
        if (!query) {
            throw new Error("Query text cannot be empty for embedding generation.");
        }
        try {
            // Note: Embedding model expects text in an array, even for single items.
            const response: EmbeddingResponse = await this.env.AI.run(EmbedModel, {
                text: [query],
            });

            // Defensive check for a valid response structure.
            if (!response?.data?.[0]) {
                console.error("Invalid embedding response structure:", response);
                throw new Error(
                    `Failed to generate embedding for query: ${query.substring(0, 100)}... Invalid response structure.`,
                );
            }

            return response.data[0]; // Return the first (and only) embedding.
        } catch (error) {
            console.error("Embedding generation failed:", error);
            // Wrap the error for better upstream logging.
            throw new Error(
                `Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

   /**
     * @method requestBatchEmbeddings
     * @description Initiates an asynchronous batch request to generate embeddings
     * for multiple text strings.
     * @param {string[]} texts - An array of non-empty text strings to embed.
     * @param {string[]} [externalReferences] - Optional array of strings to identify each request later. Length must match `texts`.
     * @returns {Promise<BatchQueuedResponse>} A promise resolving to the initial queue response containing the request_id.
     * @throws {Error} Throws if inputs are invalid or the AI binding fails to queue the request.
     */
    public async requestBatchEmbeddings(
        texts: string[],
        externalReferences?: string[]
    ): Promise<BatchQueuedResponse> {
        if (!texts || texts.length === 0) {
            throw new Error("At least one text string is required for batch embedding.");
        }
        if (texts.some(text => !text)) {
             throw new Error("All text strings in the batch must be non-empty.");
        }
        if (externalReferences && externalReferences.length !== texts.length) {
             throw new Error("Length of externalReferences must match the length of texts.");
        }

        // Format requests for the batch API
        const requests = texts.map((text, index) => ({
             text: [text], // Embedding model expects text in an array
             ...(externalReferences && { external_reference: externalReferences[index] })
        }));

        console.log(`Requesting batch embedding for ${texts.length} items.`);
        try {
            // Call AI binding with queueRequest flag
            const response: BatchQueuedResponse | any = await this.env.AI.run(
                EmbedModel,
                { requests: requests },
                { queueRequest: true } // Enable async batching
            );

            // Validate the queuing response
            if (response?.status !== 'queued' || !response?.request_id) {
                 console.error("Failed to queue batch embedding request. Invalid response:", response);
                throw new Error(`Failed to queue batch embedding request. Received status: ${response?.status}`);
            }
            console.log(`Batch embedding request queued successfully. Request ID: ${response.request_id}`);
            return response;
        } catch (error) {
            console.error("Batch embedding request failed:", error);
            throw new Error(
                `Batch embedding request failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * @method pollBatchEmbeddingStatus
     * @description Polls the status of an ongoing asynchronous batch embedding request.
     * @param {string} requestId - The request_id obtained from `requestBatchEmbeddings`.
     * @returns {Promise<BatchEmbeddingPollResponse>} A promise resolving to the current status ('queued', 'running') or the final results.
     * @throws {Error} Throws if the requestId is missing or the AI binding fails to poll the status.
     */
    public async pollBatchEmbeddingStatus(requestId: string): Promise<BatchEmbeddingPollResponse> {
        if (!requestId) {
            throw new Error("Request ID is required to poll batch status.");
        }
        console.log(`Polling batch embedding status for Request ID: ${requestId}`);
        try {
            const response: BatchEmbeddingPollResponse = await this.env.AI.run(EmbedModel, {
                request_id: requestId,
            });

            // Basic validation of the poll response structure
            if (!response || !response.status) {
                 console.error(`Invalid poll response for Request ID ${requestId}:`, response);
                 throw new Error(`Received invalid poll response structure for Request ID ${requestId}.`);
            }

            if (response.status === 'completed') {
                console.log(`Batch embedding completed for Request ID: ${requestId}`);
                // Further validation could be added here to check the structure of 'responses' array
                if (!Array.isArray((response as BatchEmbeddingResult).responses)) {
                     console.error(`Completed batch embedding response for ${requestId} missing 'responses' array:`, response);
                     throw new Error(`Completed batch embedding response for ${requestId} has invalid structure.`);
                }
            } else {
                 console.log(`Batch embedding status for Request ID ${requestId}: ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error(`Polling batch embedding status failed for request ID ${requestId}:`, error);
            throw new Error(
                `Polling batch embedding status failed for request ID ${requestId}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }


    /**
     * @method rerankMatches
     * @description Reranks a list of search results against a query using the reranker model.
     * @param {string} query - The original search query.
     * @param {any[]} matches - An array of match objects (e.g., from Vectorize). Expected to have a score and either a direct `contextField` property or `metadata[contextField]`.
     * @param {string} [contextField='text'] - The property name containing the text to rerank.
     * @returns {Promise<any[]>} A new array of match objects, sorted by the new reranked `score` (descending). Includes `originalIndex` and potentially `rerankError`.
     */
    public async rerankMatches(
        query: string,
        matches: any[],
        contextField: string = "text",
    ): Promise<any[]> {
         if (!query) {
             throw new Error("Query text cannot be empty for reranking.");
         }
         if (!matches || matches.length === 0) {
             console.warn("rerankMatches called with no matches to rerank.");
             return []; // Return empty array if no matches provided
         }
         console.log(`Reranking ${matches.length} matches against query: ${query.substring(0, 50)}...`);
        try {
            // Process each match individually using Promise.all for concurrency
            const rerankedMatchesPromises = matches.map(async (match, index) => {
                try {
                    // Extract the text content to be reranked, checking metadata first
                    const context = match?.metadata?.[contextField] || match?.[contextField];

                    if (typeof context !== 'string' || !context) {
                         console.warn(`Skipping rerank for match index ${index}: Context field '${contextField}' not found or empty.`);
                         // Return original match with a note about missing context
                         return {
                             ...match,
                             score: match?.score ?? 0, // Use original score or default to 0
                             originalIndex: index,
                             rerankError: `Context field '${contextField}' not found or empty.`,
                         };
                     }

                    // Call the reranker model
                    const response = await this.env.AI.run(RerankerModel, {
                        context,
                        query,
                    });

                     // Ensure score is a number, default to 0 if missing/invalid
                     const newScore = (typeof response?.score === 'number') ? response.score : 0;

                    // Return the original match object, augmented with the new score and original index
                    return {
                        ...match,
                        score: newScore,
                        originalIndex: index,
                    };
                } catch (error) {
                    // Failsafe for a single rerank failure
                    console.error(`Reranking failed for match index ${index}:`, error);
                    return {
                        ...match,
                        score: match?.score ?? 0, // Fallback to original score or 0
                        originalIndex: index,
                        rerankError: error instanceof Error ? error.message : String(error),
                    };
                }
            });

             const settledMatches = await Promise.all(rerankedMatchesPromises);

            // Sort the augmented matches by the new score in descending order.
            const sortedMatches = settledMatches.sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));
            console.log(`Reranking completed successfully for ${matches.length} matches.`);
            return sortedMatches;

        } catch (error) {
            // Global failsafe: If Promise.all itself fails unexpectedly
            console.error("Overall reranking process failed unexpectedly:", error);
            // Return the original, unsorted matches as a last resort
            return matches.map((match, index) => ({ ...match, originalIndex: index }));
        }
    }
}

// --- Structured Response Tool Class ---

/**
 * @class StructuredResponseTool
 * @description Provides a high-level API to force LLM output into a
 * Zod-defined schema (single and batch async). Manages JSON Mode, model selection/fallback (single only),
 * chunking (single only), and default value filling.
 *
 * @example
 * // In a Worker:
 * const { z } = await import("zod"); // Use dynamic import if needed
 * const structuredTool = new StructuredResponseTool(env);
 * const userSchema = z.object({ name: z.string(), email: z.string().email() });
 *
 * // Single analysis
 * const text = "My name is Jane Doe, email jane@example.com.";
 * const response = await structuredTool.analyzeText(userSchema, text);
 * if (response.success) console.log(response.structuredResult.name);
 *
 * // Batch async analysis
 * const batchReq = await structuredTool.requestBatchAnalysis(
 * Hermes2Pro, // Choose a model
 * ["text1...", "text2..."],
 * userSchema
 * );
 * // ... poll later ...
 * const batchRes = await structuredTool.pollBatchAnalysisStatus(
 * Hermes2Pro, // Use same model for polling
 * batchReq.request_id,
 * userSchema // Provide schema for validation
 * );
 * if (batchRes.status === 'completed') {
 * batchRes.responses.forEach(item => {
 * if (item.success) console.log(item.result?.response.name);
 * else console.error(`Item ${item.id} failed:`, item.error);
 * });
 * }
 */
export class StructuredResponseTool {
    private env: Env;
    /**
     * Character limit to determine if a text payload is "large" for single analysis.
     * Influences model choice and chunking strategy in `analyzeText`.
     */
    private maxSmallContextChars: number = 80000; // Approx 20k tokens

    /**
     * @constructor
     * @param {Env} env - The Cloudflare Worker environment, must contain `AI`.
     */
    constructor(env: Env) {
        if (!env || !env.AI) {
            throw new Error("Cloudflare AI binding (env.AI) is required for StructuredResponseTool.");
        }
        this.env = env;
    }

    /**
     * @private @method fillMissingFields
     * Fills missing fields in an AI's JSON response with schema-appropriate defaults
     * before final Zod validation. Crucial for handling omitted optional/empty fields.
     */
    private fillMissingFields<T extends ZodObject<any>>(
        schema: T,
        aiResponse: any, // Can be partial object from AI
    ): z.infer<T> {
        // Ensure aiResponse is an object, default to empty if not
        const responseObj = (aiResponse !== null && typeof aiResponse === 'object' && !Array.isArray(aiResponse))
                            ? aiResponse
                            : {};

        const fullResponse: Record<string, any> = { ...responseObj }; // Start with AI's response
        const properties = schema.shape as Record<string, ZodSchema<any>>;

        // Iterate over all keys defined in the Zod schema
        for (const key in properties) {
            // Check if the key is missing or explicitly undefined in the AI response
            if (!(key in fullResponse) || fullResponse[key] === undefined) {
                const zodType = properties[key];
                const typeName = (zodType._def as any)?.typeName; // Access Zod's internal type name

                // Assign a default value based on the Zod type.
                switch (typeName) {
                    case "ZodArray":
                        fullResponse[key] = [];
                        break;
                    case "ZodObject":
                        fullResponse[key] = {};
                        break;
                    case "ZodString":
                        fullResponse[key] = "";
                        break;
                    case "ZodNumber":
                        fullResponse[key] = 0;
                        break;
                    case "ZodBoolean":
                        fullResponse[key] = false;
                        break;
                    case "ZodOptional":
                    case "ZodNullable":
                        // For optional/nullable types, explicitly setting null might be safer
                        // than relying on Zod's default undefined behavior in some cases.
                        fullResponse[key] = null;
                        break;
                    default:
                        // For other complex types (e.g., ZodUnion, ZodDate), null is a reasonable default.
                        // Specific handling might be needed for ZodEnum, ZodDefault, etc. if required.
                        fullResponse[key] = null;
                        break;
                }
            }
        }

        // Perform the final validation parse. This will throw if the AI
        // provided a *wrong* type (e.g., string for number) even after filling.
        try {
           return schema.parse(fullResponse);
        } catch(zodError) {
            console.error("Zod validation failed after filling defaults:", zodError);
            // Re-throw the specific Zod error for detailed reporting
            throw zodError;
        }
    }

    /**
     * @private @method executeModel
     * Core internal function for a *single* structured analysis request against one model.
     */
    private async executeModel<T extends ZodObject<any>>(
        modelName: StructuredModel,
        text: string,
        schema: T,
        isChunk: boolean = false,
    ): Promise<StructuredResponse<z.infer<T>>> {
        if (!text) {
             return {
                success: false,
                modelUsed: modelName,
                structuredResult: null,
                error: `Model ${modelName} execution skipped: Input text cannot be empty.`,
                isChunked: isChunk,
            };
        }
        console.log(`Executing structured analysis with model ${modelName} for text length ${text.length}...`);
        try {
            // 1. Convert Zod schema to JSON Schema for the model.
            const jsonSchema = zodToJsonSchema(schema, {
                 $refStrategy: "none", // Inline all definitions
                 errorMessages: true // Include Zod error messages in schema description if available
            });

            // 2. Clean up $schema key added by zodToJsonSchema.
            if (jsonSchema && typeof jsonSchema === "object" && "$schema" in jsonSchema) {
                delete (jsonSchema as any).$schema;
            }
             // Basic validation of generated JSON schema
            if (!jsonSchema || typeof jsonSchema !== 'object' || !jsonSchema.properties || !jsonSchema.type || jsonSchema.type !== 'object' ) {
                 console.error("Generated invalid JSON schema:", jsonSchema);
                 throw new Error("Failed to generate a valid JSON schema from the Zod schema.");
            }

            // 3. Define the prompt. Emphasize schema adherence.
            // Using clear delimiters helps the model separate instructions from the text.
            const prompt = `You are an AI assistant tasked with analyzing the following text and extracting information according to a specific JSON schema.
--- TEXT START ---
${text}
--- TEXT END ---
Your response MUST be a single, valid JSON object that strictly adheres to the following JSON schema. Do not include any explanatory text, markdown formatting, or anything else outside the JSON object itself.
--- SCHEMA START ---
${JSON.stringify(jsonSchema, null, 2)}
--- SCHEMA END ---
Analyze the text and provide the JSON output.`;

            // 4. Call the Workers AI binding with native JSON Schema mode.
            const response = await this.env.AI.run(modelName, {
                messages: [
                    {
                        role: "system",
                        content: "You are an AI assistant specialized in extracting structured data from text into a specified JSON format.",
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                // Enable native JSON Schema mode
                response_format: {
                    type: "json_schema",
                    json_schema: jsonSchema,
                },
                // Optional: Consider adjusting temperature for structured output (lower might be better)
                // temperature: 0.2,
            });

            // 5. Extract the raw JSON response object.
            // Workers AI binding puts the result in `response.response` for chat models.
            const resultObject = response?.response;

            if (resultObject === undefined || resultObject === null) {
                 console.error(`Model ${modelName} returned undefined/null response.`);
                 throw new Error(`Model ${modelName} returned an empty or invalid response.`);
            }

            // 6. Fill potentially missing fields and perform final Zod validation.
             console.log(`Model ${modelName} raw response received, attempting validation...`);
            const validatedResponse = this.fillMissingFields(schema, resultObject);
             console.log(`Model ${modelName} response validated successfully.`);

            // 7. Return the standard success response wrapper.
            return {
                success: true,
                modelUsed: modelName,
                structuredResult: validatedResponse,
                isChunked: isChunk,
            };
        } catch (e: any) {
            console.error(`Execution failed for model ${modelName}:`, e);
            // 8. Return the standard error response wrapper.
            return {
                success: false,
                modelUsed: modelName,
                structuredResult: null,
                // Include error details, checking for ZodError specifically
                error: `Model ${modelName} failed: ${e.errors ? JSON.stringify(e.errors) : (e.message || String(e))}`, // More detail from ZodError
                isChunked: isChunk,
            };
        }
    }

    /**
     * @private @method chunkAndMerge
     * Fallback strategy for *single* requests with text too large even for large-context models.
     * Splits text, processes chunks individually, and merges results (arrays concatenated, objects shallow-merged).
     * **Note:** This is less reliable than a single large-context call and should be a last resort.
     */
    private async chunkAndMerge<T extends ZodObject<any>>(
        modelName: typeof Llama4Scout | typeof MistralSmall3_1, // Models suitable for chunking
        fullText: string,
        schema: T,
    ): Promise<StructuredResponse<z.infer<T>>> {
         console.warn(`Text length ${fullText.length} exceeds threshold, attempting chunking with ${modelName}...`);
        const chunkSize = this.maxSmallContextChars; // Use the defined limit for chunk size
        const textChunks: string[] = [];

        // 1. Split text into chunks.
        for (let i = 0; i < fullText.length; i += chunkSize) {
            textChunks.push(fullText.substring(i, i + chunkSize));
        }
         console.log(`Split text into ${textChunks.length} chunks.`);

        const mergedResults: Record<string, any> = {};
        let firstSuccessfulModel: StructuredModel | null = null; // Track the model used

        // 2. Process each chunk sequentially.
        for (let i = 0; i < textChunks.length; i++) {
             console.log(`Processing chunk ${i + 1}/${textChunks.length}...`);
            const result = await this.executeModel(
                modelName,
                textChunks[i],
                schema,
                true, // Mark as chunked
            );

            // If any chunk fails, the whole operation fails immediately.
            if (!result.success || !result.structuredResult) {
                console.error(`Chunking failure on chunk ${i + 1}/${textChunks.length} with model ${modelName}: ${result.error}`);
                return {
                    success: false,
                    modelUsed: modelName,
                    structuredResult: null,
                    error: `Chunking failure on chunk ${i + 1}/${textChunks.length}: ${result.error}`,
                    isChunked: true,
                };
            }

            if (!firstSuccessfulModel) {
                 firstSuccessfulModel = result.modelUsed; // Should be modelName, but confirms success
             }

            const currentResult = result.structuredResult;
             console.log(`Chunk ${i + 1} processed successfully.`);

            // 3. Perform the merge logic.
            for (const key in currentResult) {
                 // Ensure we are iterating over own properties if needed (though unlikely for LLM output)
                 // if (!Object.prototype.hasOwnProperty.call(currentResult, key)) continue;

                const newValue = currentResult[key as keyof typeof currentResult];
                const existingValue = mergedResults[key];

                // --- Merge Logic ---
                if (Array.isArray(newValue)) {
                    // Concatenate arrays, ensuring existing value is also an array
                    mergedResults[key] = Array.isArray(existingValue)
                        ? [...existingValue, ...newValue]
                        : [...newValue]; // If existing isn't array, overwrite with new array
                } else if (
                    newValue !== null &&
                    typeof newValue === "object" &&
                    !Array.isArray(newValue)
                ) {
                    // Shallow merge objects, ensuring existing value is also an object
                    mergedResults[key] = (existingValue !== null && typeof existingValue === 'object' && !Array.isArray(existingValue))
                        ? { ...existingValue, ...newValue }
                        : { ...newValue }; // If existing isn't object, overwrite with new object
                } else if (newValue !== null && newValue !== undefined) {
                    // Overwrite primitives (string, number, boolean) - last chunk wins
                    mergedResults[key] = newValue;
                 } else if (key in mergedResults && (newValue === null || newValue === undefined)) {
                     // If the new value is null/undefined, don't overwrite an existing value.
                     // Let the last non-null value persist.
                     continue;
                 } else {
                     // If the key didn't exist and the new value is null/undefined, store it.
                     mergedResults[key] = newValue;
                 }
                // --- End Merge Logic ---
            }
        }

         console.log("All chunks processed. Performing final validation on merged result...");
        // 4. Validate the final merged object against the schema after filling defaults.
        try {
            const validatedFinal = this.fillMissingFields(schema, mergedResults);
             console.log("Chunking and merging completed successfully.");
            return {
                success: true,
                modelUsed: firstSuccessfulModel || modelName, // Report the model used
                structuredResult: validatedFinal,
                isChunked: true,
            };
        } catch (finalValidationError: any) {
             console.error("Final validation after merging chunks failed:", finalValidationError);
             return {
                 success: false,
                 modelUsed: firstSuccessfulModel || modelName,
                 structuredResult: null,
                 error: `Final validation after merging failed: ${finalValidationError.errors ? JSON.stringify(finalValidationError.errors) : (finalValidationError.message || String(finalValidationError))}`,
                 isChunked: true,
             };
         }
    }

    /**
     * @public @method analyzeText
     * Primary public method for *single* text analysis. Handles model selection, fallback, and chunking.
     */
    public async analyzeText<T extends ZodObject<any>>(
        schema: T,
        textPayload: string,
    ): Promise<StructuredResponse<z.infer<T>>> {
         if (!textPayload) {
             throw new Error("Input textPayload cannot be empty for analyzeText.");
         }
        const textCharLength = textPayload.length;
         console.log(`Analyzing text of length ${textCharLength}. Schema: ${schema.description || 'Unnamed Schema'}`);

        if (textCharLength > this.maxSmallContextChars) {
            // --- Large Text Strategy ---
             console.log("Large text detected. Trying large-context models...");
            let result = await this.executeModel(Llama4Scout, textPayload, schema);
            if (result.success) {
                 console.log(`Success with ${Llama4Scout}.`);
                 return result;
             }
             console.warn(`${Llama4Scout} failed for large text: ${result.error}. Trying ${MistralSmall3_1}...`);

            result = await this.executeModel(MistralSmall3_1, textPayload, schema);
            if (result.success) {
                console.log(`Success with ${MistralSmall3_1}.`);
                return result;
            }
             console.warn(`${MistralSmall3_1} failed for large text: ${result.error}. Falling back to chunking with ${Llama4Scout}...`);

            // Fallback to chunking with a generally reliable large-context model
            return this.chunkAndMerge(Llama4Scout, textPayload, schema);
        } else {
            // --- Small Text Strategy (Prioritizes speed) ---
             console.log("Small text detected. Trying faster models first...");
            let result = await this.executeModel(Hermes2Pro, textPayload, schema);
            if (result.success) {
                 console.log(`Success with ${Hermes2Pro}.`);
                 return result;
            }
             console.warn(`${Hermes2Pro} failed: ${result.error}. Trying ${MistralSmall3_1}...`);

            result = await this.executeModel(MistralSmall3_1, textPayload, schema);
            if (result.success) {
                console.log(`Success with ${MistralSmall3_1}.`);
                return result;
            }
             console.warn(`${MistralSmall3_1} failed: ${result.error}. Trying ${Llama4Scout}...`);

            result = await this.executeModel(Llama4Scout, textPayload, schema);
            if (result.success) {
                 console.log(`Success with ${Llama4Scout}.`);
                 return result;
             }
            console.warn(`${Llama4Scout} failed: ${result.error}. Trying ${Llama3_3}...`);

            // Last attempt with another model
             result = await this.executeModel(Llama3_3, textPayload, schema);
             if (result.success) {
                 console.log(`Success with ${Llama3_3}.`);
                 return result;
             }
             console.error(`${Llama3_3} also failed: ${result.error}. All models attempted.`);


            // --- All models failed ---
            return {
                success: false,
                modelUsed: Llama3_3, // Reports the last model tried
                structuredResult: null,
                error: `All models (${Hermes2Pro}, ${MistralSmall3_1}, ${Llama4Scout}, ${Llama3_3}) failed to generate a valid structured response. Last error: ${result.error}`,
            };
        }
    }

    /**
     * @public @method analyzeTextWithModel
     * Bypasses automatic selection/fallback for *single* analysis with a *specific* model. No chunking.
     */
    public async analyzeTextWithModel<T extends ZodObject<any>>(
        schema: T,
        textPayload: string,
        modelName: StructuredModel,
    ): Promise<StructuredResponse<z.infer<T>>> {
        console.log(`Analyzing text with specific model: ${modelName}. Length: ${textPayload.length}`);
        // Directly call executeModel, bypassing fallback and chunking logic
        return this.executeModel(modelName, textPayload, schema);
    }

   /**
     * @public @method requestBatchAnalysis
     * Initiates an asynchronous batch request for structured analysis on multiple texts
     * using a *single specified model*. Does NOT support chunking or model fallback.
     */
    public async requestBatchAnalysis<T extends ZodObject<any>>(
        modelName: StructuredModel,
        textPayloads: string[],
        schema: T,
        externalReferences?: string[]
    ): Promise<BatchQueuedResponse> {
        if (!textPayloads || textPayloads.length === 0) {
            throw new Error("At least one text payload is required for batch analysis.");
        }
        if (textPayloads.some(text => !text)) {
            throw new Error("All text payloads in the batch must be non-empty.");
        }
        if (externalReferences && externalReferences.length !== textPayloads.length) {
             throw new Error("Length of externalReferences must match the length of textPayloads.");
        }

         console.log(`Requesting batch analysis for ${textPayloads.length} items using model ${modelName}.`);
        // Convert schema once for the whole batch
        const jsonSchema = zodToJsonSchema(schema, { $refStrategy: "none", errorMessages: true });
        if (jsonSchema && typeof jsonSchema === "object" && "$schema" in jsonSchema) {
             delete (jsonSchema as any).$schema;
        }
         if (!jsonSchema || typeof jsonSchema !== 'object' || !jsonSchema.properties || !jsonSchema.type || jsonSchema.type !== 'object' ) {
            console.error("Generated invalid JSON schema for batch request:", jsonSchema);
            throw new Error("Failed to generate a valid JSON schema for the batch request.");
        }
        // Define the common response format for all items in the batch
        const commonResponseFormat = {
             type: "json_schema",
             json_schema: jsonSchema,
        };

        // Format each text payload into a request object for the batch
        const requests = textPayloads.map((text, index) => {
            const prompt = `You are an AI assistant tasked with analyzing the following text and extracting information according to a specific JSON schema.
--- TEXT START ---
${text}
--- TEXT END ---
Your response MUST be a single, valid JSON object that strictly adheres to the provided JSON schema. Do not include any explanatory text, markdown formatting, or anything else outside the JSON object itself. Respond with the JSON for the text provided above.`;
            // Note: Schema itself isn't included in prompt here because it's in response_format
            return {
                 messages: [
                     {
                         role: "system",
                         content: "You are an AI assistant specialized in extracting structured data from text into a specified JSON format.",
                    },
                    {
                         role: "user",
                        content: prompt,
                    },
                ],
                response_format: commonResponseFormat, // Use the common format
                 ...(externalReferences && { external_reference: externalReferences[index] })
            };
        });

        try {
             // Call AI binding with queueRequest flag
            const response: BatchQueuedResponse | any = await this.env.AI.run(
                 modelName,
                { requests: requests },
                { queueRequest: true } // Enable async batching
            );

            // Validate the queuing response
            if (response?.status !== 'queued' || !response?.request_id) {
                 console.error("Failed to queue batch analysis request. Invalid response:", response);
                 throw new Error(`Failed to queue batch analysis request. Received status: ${response?.status}`);
             }
             console.log(`Batch analysis request queued successfully with model ${modelName}. Request ID: ${response.request_id}`);
             return response;
         } catch (error) {
            console.error(`Batch analysis request failed with model ${modelName}:`, error);
            throw new Error(
                `Batch analysis request failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

   /**
     * @public @method pollBatchAnalysisStatus
     * Polls the status of an ongoing batch analysis request. Validates each successful result against the schema upon completion.
     */
     public async pollBatchAnalysisStatus<T extends ZodObject<any>>(
         modelName: StructuredModel, // Model name is required for polling with Workers AI binding
         requestId: string,
         schema: T // Pass schema for validation of results
     ): Promise<BatchStructuredPollResponse<z.infer<T> | { error: string }>> { // Result type includes error marker
         if (!requestId) {
             throw new Error("Request ID is required to poll batch status.");
         }
         if (!modelName) {
             // Workers AI binding needs the model name even for polling by ID
             throw new Error("Model name used for the batch request is required for polling.");
         }
         console.log(`Polling batch analysis status for Request ID: ${requestId} (Model: ${modelName})`);
         try {
             // Poll using the request ID and the original model name
             const response: BatchStructuredResult<any> | BatchIntermediateStatus = await this.env.AI.run(modelName, {
                 request_id: requestId,
             });

             // Basic validation of the poll response structure
             if (!response || !response.status) {
                 console.error(`Invalid poll response for Request ID ${requestId}:`, response);
                 throw new Error(`Received invalid poll response structure for Request ID ${requestId}.`);
             }


             // If still queued or running, return the intermediate status directly
             if (response.status === 'queued' || response.status === 'running') {
                 console.log(`Batch analysis status for Request ID ${requestId}: ${response.status}`);
                 return response as BatchIntermediateStatus; // Type assertion is safe here
             }

             // --- Process Completed Batch ---
              console.log(`Batch analysis completed for Request ID: ${requestId}. Processing ${response.responses?.length ?? 0} responses...`);

             // Ensure 'responses' array exists for completed status
              if (!Array.isArray((response as BatchStructuredResult<any>)?.responses)) {
                 console.error(`Completed batch response for ${requestId} missing or invalid 'responses' array:`, response);
                 // Treat as failure, but maybe return a structured error response?
                 // For now, throw, as this indicates a platform issue or bug.
                 throw new Error(`Completed batch analysis response for ${requestId} has invalid structure (missing 'responses' array).`);
             }

             // Process each item in the completed batch
             const processedResponses = response.responses.map((item: BatchStructuredResultItem<any>) => {
                 // Check if the AI reported success for this specific item AND provided a result
                 if (item.success && item.result?.response !== undefined && item.result?.response !== null) {
                     try {
                         // Attempt validation using fillMissingFields and schema.parse
                         const validated = this.fillMissingFields(schema, item.result.response);
                         // Return the item with the validated object replacing the raw one
                         return {
                             ...item,
                             result: { response: validated } // Replace raw response with validated one
                         };
                     } catch (validationError: any) {
                         // Validation failed for this specific item
                         console.warn(`Schema validation failed for batch item ${item.id} (Request ID: ${requestId}):`, validationError.errors || validationError.message);
                         const errorMessage = `Schema validation failed: ${validationError.errors ? JSON.stringify(validationError.errors) : (validationError.message || String(validationError))}`;
                         return {
                             ...item,
                             success: false, // Mark as failed due to validation
                             error: errorMessage,
                             // Include an error marker in the result payload for consistency
                             result: { response: { error: errorMessage } }
                         };
                     }
                 } else {
                     // Item failed during AI processing or the structure was unexpected
                     const errorMessage = item.error || "AI processing failed or result structure invalid.";
                     if(!item.success) console.warn(`Batch item ${item.id} (Request ID: ${requestId}) failed during AI processing: ${errorMessage}`);
                     else console.warn(`Batch item ${item.id} (Request ID: ${requestId}) reported success but result was missing/null.`);

                     return {
                        ...item,
                        success: false, // Ensure success is false
                        error: errorMessage,
                        // Include error marker
                        result: { response: { error: errorMessage } }
                     };
                 }
             });

             // Return the full batch result with processed+validated/failed items
             return {
                 ...response,
                 responses: processedResponses,
                 status: "completed" // Explicitly mark as completed
                 // The type assertion helps TypeScript understand the final structure
             } as BatchStructuredResult<z.infer<T> | { error: string }>;

         } catch (error) {
             console.error(`Polling batch analysis status failed for request ID ${requestId}:`, error);
             throw new Error(
                 `Polling batch analysis status failed for request ID ${requestId}: ${error instanceof Error ? error.message : String(error)}`,
             );
         }
     }


    /**
     * @public @method getAvailableModels
     * Returns a list of all model identifiers supported by this tool for structured analysis.
     */
    public getAvailableModels(): StructuredModel[] {
        return [Llama4Scout, MistralSmall3_1, Hermes2Pro, Llama3_3];
    }
}

// --- Convenience Factory Functions ---

/**
 * @function createEmbeddingTool
 * Factory function to create a new instance of `EmbeddingTool`.
 */
export function createEmbeddingTool(env: Env): EmbeddingTool {
    return new EmbeddingTool(env);
}

/**
 * @function createStructuredResponseTool
 * Factory function to create a new instance of `StructuredResponseTool`.
 */
export function createStructuredResponseTool(env: Env): StructuredResponseTool {
    return new StructuredResponseTool(env);
}

// --- Export Model Constants ---
/**
 * Re-exporting model constants for easy import.
 */
export {
    EmbedModel, Hermes2Pro,
    Llama3_3, Llama4Scout,
    MistralSmall3_1, RerankerModel
};

/**
 * Re-exporting core types for external use.
 */
export type {
    StructuredModel,
    StructuredResponse,
    BatchQueuedResponse,
    BatchEmbeddingPollResponse,
    BatchStructuredPollResponse,
    BatchEmbeddingResult, // Export detailed result types too
    BatchEmbeddingResultItem,
    BatchStructuredResult,
    BatchStructuredResultItem,
    BatchIntermediateStatus
};

// --- Health Monitoring Exports ---
// Assuming these exist and are correctly implemented in their respective files
export {
    createToolsHealthMonitor,
    createAIToolsHealthChecker,
    createBrowserToolsHealthChecker,
    createAuthToolsHealthChecker,
    createExtractorToolsHealthChecker,
    ToolsHealthMonitor,
};
// Re-exports from sub-files (preserved from original context)
// export { createAIToolsHealthChecker as createAIToolsHealthChecker_sub } from './ai-tools.health';
// export { createBrowserToolsHealthChecker as createBrowserToolsHealthChecker_sub } from './browser-tools.health';
// export { createAuthToolsHealthChecker as createAuthToolsHealthChecker_sub } from './auth-tools.health';
// export { createExtractorToolsHealthChecker as createExtractorToolsHealthChecker_sub } from './extractor-tools.health';

export type {
    SystemHealthStatus,
    QuickHealthStatus,
    AIToolsHealthStatus,
    BrowserToolsHealthStatus,
    AuthToolsHealthStatus,
    ExtractorToolsHealthStatus
};

// --- High-Level Toolkit Factory ---

/**
 * @function createToolkit
 * Instantiates all tools (`ai`, `browser`, `auth`, `health`, etc.)
 * passing the shared environment.
 */
export function createToolkit(env: ExtendedEnv) {
     // Basic check for required bindings in the extended environment
     if (!env.AI || !env.BROWSER || !env.AUTH_SERVICE || !env.VECTORIZE_INDEX) { // Add checks based on actual ExtendedEnv
         console.warn("ExtendedEnv might be missing expected bindings for full toolkit functionality.");
     }
    return {
        ai: {
            embedding: createEmbeddingTool(env),
            structured: createStructuredResponseTool(env),
            extractor: createAIExtractorTool(env), // Assuming this factory exists
        },
        browser: createBrowserRender(env), // Assuming this factory exists
        auth: createAuthTool(env), // Assuming this factory exists
        health: createToolsHealthMonitor(env) // Assuming this factory exists
    };
}

/**
 * @interface ToolConfig
 * Defines the configuration structure for the toolkit.
 */
export interface ToolConfig {
    ai: {
        maxRetries: number; // Applied conceptually where relevant (e.g., in health checks, not direct AI calls here)
        timeout: number; // Relevant for polling logic, not implemented here yet
        fallbackModels: boolean; // Used in analyzeText logic
        // Batch specific config could be added here if needed
    };
    browser: {
        timeout: number;
        viewport: { width: number; height: number };
        userAgent?: string;
    };
    auth: {
        tokenExpiry: number; // in seconds
        allowedOrigins: string[];
    };
    health: {
        checkInterval: number; // in milliseconds
        enableMetrics: boolean;
    };
}

/**
 * @constant DEFAULT_TOOL_CONFIG
 * Provides sensible default values for the toolkit configuration.
 */
export const DEFAULT_TOOL_CONFIG: ToolConfig = {
    ai: {
        maxRetries: 3,
        timeout: 60000, // Increased default timeout potentially relevant for polling steps
        fallbackModels: true
    },
    browser: {
        timeout: 30000,
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Cloudflare-Worker-Toolkit/1.0' // Generic default
    },
    auth: {
        tokenExpiry: 3600, // 1 hour
        allowedOrigins: ['*'] // Default to allow all for simplicity, adjust for production
    },
    health: {
        checkInterval: 60000, // 1 minute
        enableMetrics: true
    }
};

/**
 * @function createToolkitWithHealth
 * Enhanced factory: instantiates toolkit, merges config, flattens health methods.
 */
export function createToolkitWithHealth(env: ExtendedEnv, config: Partial<ToolConfig> = {}) {
    // Simple shallow merge for demonstration. Deep merge recommended for complex configs.
    const finalConfig: ToolConfig = {
        ai: { ...DEFAULT_TOOL_CONFIG.ai, ...config.ai },
        browser: { ...DEFAULT_TOOL_CONFIG.browser, ...config.browser },
        auth: { ...DEFAULT_TOOL_CONFIG.auth, ...config.auth },
        health: { ...DEFAULT_TOOL_CONFIG.health, ...config.health },
    };

    const toolkit = createToolkit(env);

    // Flatten health check methods for easier access
    return {
        ...toolkit,
        config: finalConfig,
        // --- Convenience Health Methods ---
        healthCheck: () => toolkit.health.quickHealthCheck(),
        systemHealth: () => toolkit.health.checkSystemHealth(),
        isReady: () => toolkit.health.isReady(),
        isAlive: () => toolkit.health.isAlive(),
        getMetrics: () => toolkit.health.getMetrics()
        // Add more flattened methods if needed
    };
}

// --- Example Worker Usage Snippet (Conceptual) ---
/*
export default {
    async fetch(request: Request, env: ExtendedEnv, ctx: ExecutionContext): Promise<Response> {
        const toolkit = createToolkitWithHealth(env); // Or createToolkit(env)

        try {
            // === Example: Single Embedding ===
            const singleVector = await toolkit.ai.embedding.generateEmbedding("Test query");
            console.log("Single vector length:", singleVector.length);

            // === Example: Batch Embedding ===
            const textsToEmbed = ["First document.", "Second piece of text."];
            const batchEmbedRequest = await toolkit.ai.embedding.requestBatchEmbeddings(textsToEmbed);
            console.log("Batch Embed Request ID:", batchEmbedRequest.request_id);
            // ... need polling logic here ...
            // Example polling (implement with retries/delay):
            // let embedStatus = await toolkit.ai.embedding.pollBatchEmbeddingStatus(batchEmbedRequest.request_id);
            // while (embedStatus.status !== 'completed') {
            //    await new Promise(resolve => setTimeout(resolve, 5000)); // Delay
            //    embedStatus = await toolkit.ai.embedding.pollBatchEmbeddingStatus(batchEmbedRequest.request_id);
            // }
            // console.log("Batch Embed Results:", embedStatus.responses);


            // === Example: Single Structured Analysis ===
             const { z } = await import("zod");
             const analysisSchema = z.object({ summary: z.string().describe("Brief summary"), sentiment: z.enum(["positive", "negative", "neutral"]) });
             const analysisText = "Cloudflare Workers AI is really powerful and quite fast for inference.";
             const structuredResult = await toolkit.ai.structured.analyzeText(analysisSchema, analysisText);
             if (structuredResult.success) {
                 console.log("Structured Analysis:", structuredResult.structuredResult);
             } else {
                 console.error("Structured Analysis Failed:", structuredResult.error);
             }

            // === Example: Batch Structured Analysis ===
            const batchTexts = ["Great product!", "This is terrible."];
            const batchAnalysisRequest = await toolkit.ai.structured.requestBatchAnalysis(Hermes2Pro, batchTexts, analysisSchema);
            console.log("Batch Analysis Request ID:", batchAnalysisRequest.request_id);
             // ... need polling logic here, similar to embeddings ...
             // Example polling:
            // let analysisStatus = await toolkit.ai.structured.pollBatchAnalysisStatus(Hermes2Pro, batchAnalysisRequest.request_id, analysisSchema);
             // while (analysisStatus.status !== 'completed') {
            //     await new Promise(resolve => setTimeout(resolve, 5000));
            //     analysisStatus = await toolkit.ai.structured.pollBatchAnalysisStatus(Hermes2Pro, batchAnalysisRequest.request_id, analysisSchema);
            // }
            // console.log("Batch Analysis Results:", analysisStatus.responses);


            return new Response("Toolkit examples executed (check logs).");

        } catch (error: any) {
            console.error("Worker Error:", error);
            return new Response(`Error: ${error.message}`, { status: 500 });
        }
    }
}
*/
