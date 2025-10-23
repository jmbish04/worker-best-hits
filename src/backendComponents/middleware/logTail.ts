/**
 * @file log_integration_worker.ts
 * @description Cloudflare Worker acting as a Log Integration Layer.
 *
 * This worker serves two primary functions:
 * 1.  **API Gateway (`fetch`):** Exposes a public API for searching logs,
 * running AI analysis, and manually ingesting logs. It forwards these
 * requests to the main log service (`tail-logs.hacolby.workers.dev`).
 * 2.  **Log Consumer (`tail`):** Consumes logs from a bound `LOG_TAIL_CONSUMER`
 * service (another Worker), transforms them, and batches them for
 * ingestion into the main log service.
 *
 * @environment
 * - `LOG_TAIL_CONSUMER`: A Cloudflare Tail Worker binding. This worker's
 * `tail` handler will be invoked for every log event from the bound service.
 * - `LOG_SERVICE_API_KEY`: A secret API key required for *non-ingestion*
 * endpoints (like search and analysis) on the `tail-logs.hacolby.workers.dev` service.
 */

// --- ENVIRONMENT & TYPES ---

/**
 * Defines the bindings and secrets this worker expects in its environment.
 */
interface Env {
  /**
   * Binding to a Cloudflare Tail Worker.
   * @see https://developers.cloudflare.com/workers/observability/logging/tail-workers/
   */
  LOG_TAIL_CONSUMER: {
    tail(events: TailEvent[]): Promise<void>;
  };
  
  /**
   * Secret API key for authenticating with the main log service
   * for secure endpoints (search, analysis).
   */
  LOG_SERVICE_API_KEY: string;
}

// --- LOGGING SERVICE TYPES ---
// These types define the data contract with the `tail-logs.hacolby.workers.dev` service.

/** Supported log severity levels. */
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

/** The origin source of the log. */
type LogSourceType = 'http' | 'tail' | 'agent';

/**
 * Represents a single log entry to be ingested.
 */
interface LogEntry {
  service_name: string;
  level: LogLevel;
  message: string;
  timestamp?: number;
  metadata?: Record<string, any>;
  source_type?: LogSourceType;
}

/**
 * Defines the query parameters for searching logs.
 */
interface LogSearchParams {
  service?: string;
  level?: LogLevel;
  start_time?: number; // UTC milliseconds
  end_time?: number;   // UTC milliseconds
  limit?: number;
  offset?: number;
  query?: string; // Free-text query
}

/**
 * Represents a single log result returned from a search.
 */
interface LogSearchResult {
  id: string;
  service_name: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  metadata_json?: string;
  source_type: LogSourceType;
}

/**
 * The expected response shape from the log search endpoint.
 */
interface SearchResponse {
  logs: LogSearchResult[];
  total?: number;
  has_more?: boolean;
}

/**
 * The expected response shape from the log ingestion endpoint.
 */
interface IngestResponse {
  success: boolean;
  id?: string;
  ingested?: number;
  failed?: number;
}

// --- WORKER EXPORT ---

export default {
  /**
   * Main fetch handler acting as an API router.
   * It translates incoming requests from this worker's public URL
   * into authenticated API calls to the main log service.
   *
   * @param request - The incoming HTTP request.
   * @param env - The worker's environment bindings and secrets.
   * @param ctx - The execution context.
   * @returns A Response object containing search results, analysis, or ingestion status.
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // --- API ROUTER ---

      /**
       * @route GET /search
       * @description Searches logs by forwarding query parameters to the log service.
       * @example /search?service=my-app&level=ERROR&query=timeout
       */
      if (method === 'GET' && path === '/search') {
        const params = url.searchParams;
        const searchParams: LogSearchParams = {
          service: params.get('service') || undefined,
          level: params.get('level') as LogLevel || undefined,
          start_time: params.get('start_time') ? parseInt(params.get('start_time')!) : undefined,
          end_time: params.get('end_time') ? parseInt(params.get('end_time')!) : undefined,
          limit: params.get('limit') ? parseInt(params.get('limit')!) : 100,
          offset: params.get('offset') ? parseInt(params.get('offset')!) : undefined,
          query: params.get('query') || undefined,
        };
        const results = await searchLogs(searchParams, env);
        return jsonResponse(results);
      }

      /**
       * @route POST /analyze
       * @description Requests AI analysis from the log service based on search criteria.
       * @body {LogSearchParams}
       */
      if (method === 'POST' && path === '/analyze') {
        const searchParams: LogSearchParams = await request.json();
        const analysis = await analyzeLogs(searchParams, env);
        return jsonResponse({ analysis });
      }

      /**
       * @route POST /ingest
       * @description Ingests a single log entry. (Acts as a fallback).
       * @body {LogEntry}
       */
      if (method === 'POST' && path === '/ingest') {
        // Fallback for ingesting a single log
        const log: LogEntry = await request.json();
        const result = await ingestLogs([log], env);
        return jsonResponse(result);
      }

      /**
       * @route POST /ingest-batch
       * @description Ingests a batch of logs. (Primary fallback ingestion).
       * @body {{ logs: LogEntry[] }}
       */
      if (method === 'POST' && path === '/ingest-batch') {
        // Fallback for ingesting a batch of logs
        const { logs }: { logs: LogEntry[] } = await request.json();
        const result = await ingestLogs(logs, env);
        return jsonResponse(result);
      }

      // --- Not Found ---
      return jsonResponse({ error: 'Not Found' }, 404);

    } catch (err: any) {
      console.error('Error in fetch handler:', err.stack);
      return jsonResponse({ error: err.message || 'Internal Server Error' }, 500);
    }
  },

  /**
   * Tail handler for consuming logs from the bound `LOG_TAIL_CONSUMER` service.
   * This function is triggered by the Cloudflare runtime, not by a public request.
   *
   * @param events - An array of log events (TailEvent) from the bound service.
   * @param env - The worker's environment bindings and secrets.
   * @param ctx - The execution context, used for `waitUntil` to ensure async tasks complete.
   */
  async tail(events: TailEvent[], env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`Received ${events.length} tail events.`);
    const logEntries: LogEntry[] = [];

    for (const event of events) {
      try {
        // --- Event Transformation Logic ---
        // This logic parses the incoming TailEvent and transforms it
        // into the standardized LogEntry format.
        // This section MUST be adapted based on the *actual* structure
        // of the logs being sent by the `LOG_TAIL_CONSUMER` service.
        
        let logData: any;
        if (typeof event.message === 'string') {
          try {
            logData = JSON.parse(event.message);
          } catch {
            // Not JSON, treat as a plain message
            logData = { message: event.message };
          }
        } else if (typeof event.message === 'object') {
          logData = event.message;
        } else {
          logData = { message: 'Non-string/object tail message' };
        }

        const entry: LogEntry = {
          service_name: event.source?.service || 'unknown-tailed-service',
          level: (logData.level || 'INFO') as LogLevel,
          message: logData.message || 'No message content',
          timestamp: event.timestamp,
          metadata: {
            ...logData.metadata,
            tail_source: event.source,
            exception: event.exception,
          },
          source_type: 'tail',
        };
        logEntries.push(entry);
      } catch (err: any) {
        // Log errors internally without stopping the loop
        console.error('Error processing tail event:', err.message, event);
      }
    }

    if (logEntries.length > 0) {
      // Forward the processed batch to the main logging service.
      // Use `waitUntil` to ensure this background task completes
      // even after the `tail` function returns.
      ctx.waitUntil(
        ingestLogs(logEntries, env)
          .then(res => console.log(`Ingested ${res.ingested || 0} tailed logs.`))
          .catch(err => console.error('Error ingesting tailed logs:', err.stack))
      );
    }
  },
};

// --- INTERNAL CLIENT FUNCTIONS ---
// These functions abstract the communication with the `tail-logs.hacolby.workers.dev` service.

/**
 * A centralized helper for making API requests to the main log service.
 *
 * **Conditional Authentication:**
 * This function automatically attaches the `Authorization` header
 * *only* for non-ingestion endpoints (e.g., search, analysis).
 * Ingestion endpoints are treated as public and do not send the key.
 *
 * @param path - The API path (e.g., '/api/v1/logs/search').
 * @param options - Standard RequestInit options (method, body, etc.).
 * @param env - The worker's environment, used to access `LOG_SERVICE_API_KEY`.
 * @returns A promise that resolves to the raw Response object.
 * @throws An error if the network request fails or the service returns a non-ok status.
 */
async function logServiceRequest(path: string, options: RequestInit, env: Env): Promise<Response> {
  // Construct the full URL using the utility function
  const url = endpointUrl(path);
  
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  // --- Conditional Authentication Logic ---
  // Only add the API key if the path is NOT for ingestion.
  const isIngestion = path.startsWith('/api/v1/logs/ingest');
  if (!isIngestion) {
    headers.set('Authorization', `Bearer ${env.LOG_SERVICE_API_KEY}`);
  }
  // ----------------------------------------

  const request = new Request(url, {
    ...options,
    headers,
  });

  // Use standard fetch to call the hardcoded service URL
  const response = await fetch(request);

  if (!response.ok) {
    // Attempt to parse error details from the service
    let errorBody = 'Failed to fetch from log service';
    try {
      const err = await response.json();
      errorBody = err.error || err.message || errorBody;
    } catch {} // Ignore parsing errors
    throw new Error(`Log Service Error (${response.status}): ${errorBody}`);
  }

  return response;
}

/**
 * Ingests a batch of processed logs into the main logging service.
 * This function calls a *public* (non-auth) endpoint.
 *
 * @param logs - An array of `LogEntry` objects to ingest.
 * @param env - The worker's environment.
 * @returns A promise resolving to the `IngestResponse` from the service.
 */
async function ingestLogs(logs: LogEntry[], env: Env): Promise<IngestResponse> {
  const response = await logServiceRequest('/api/v1/logs/ingest/batch', {
    method: 'POST',
    body: JSON.stringify({ logs }),
  }, env);
  return response.json();
}

/**
 * Searches logs from the main logging service.
 * This function calls a *secure* (auth-required) endpoint.
 *
 * @param params - The `LogSearchParams` to filter by.
 * @param env - The worker's environment.
 * @returns A promise resolving to the `SearchResponse` from the service.
 */
async function searchLogs(params: LogSearchParams, env: Env): Promise<SearchResponse> {
  const queryParams = new URLSearchParams();
  
  // Build query string from valid parameters
  if (params.service) queryParams.set('service', params.service);
  if (params.level) queryParams.set('level', params.level);
  if (params.start_time) queryParams.set('start_time', params.start_time.toString());
  if (params.end_time) queryParams.set('end_time', params.end_time.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.offset) queryParams.set('offset', params.offset.toString());
  if (params.query) queryParams.set('query', params.query);

  const response = await logServiceRequest(`/api/v1/logs/search?${queryParams.toString()}`, {
    method: 'GET',
  }, env);
  
  return response.json();
}

/**
 * Performs AI analysis by calling the log service's built-in AI endpoint.
 * This function calls a *secure* (auth-required) endpoint.
 *
 * @param params - The `LogSearchParams` to define the log context for analysis.
 * @param env - The worker's environment.
 * @returns A promise resolving to the string-based analysis from the service.
 */
async function analyzeLogs(params: LogSearchParams, env: Env): Promise<string> {
  // 1. Prepare the payload for the /api/v1/ai-analysis endpoint
  const payload = {
    service_name: params.service,
    start_time: params.start_time,
    end_time: params.end_time,
    search_keywords: params.query, // Pass the 'query' as 'search_keywords'
  };

  // 2. Call the secure endpoint
  const response = await logServiceRequest('/api/v1/ai-analysis', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, env);

  // 3. Parse the response and return the analysis
  const result = await response.json();
  
  // Safely extract the analysis string
  if (result.analysis && typeof result.analysis === 'string') {
    return result.analysis;
  }
  
  // Fallback for different response shapes
  if (typeof result === 'string') {
    return result;
G  }
  
  return 'No analysis content returned from the service.';
}

// --- UTILITY FUNCTIONS ---

/**
 * Creates the full, hardcoded URL for the log service API.
 * Safely joins the base URL and the URI path, handling slashes.
 *
 * @param uri - The API path (e.Example: /api/v1/test)
 * @returns The complete, combined URL.
 */
function endpointUrl(uri: string): string {
  // Hardcode the base URL as requested
  const baseUrl = 'https://tail-logs.hacolby.workers.dev';
  
  // `replace(/\/$/, '')` removes a single trailing slash from the base URL, if present.
  const cleanBase = baseUrl.replace(/\/$/, ''); 
  // `replace(/^\//, '')` removes a single leading slash from the URI, if present.
  const cleanUri = uri.replace(/^\//, '');     
  
  return `${cleanBase}/${cleanUri}`;
}

/**
 * A helper factory to create a standardized JSON Response object.
 *
 * @param data - The JavaScript object to serialize into JSON.
 * @param status - The HTTP status code for the response (default: 200).
 * @returns A Cloudflare `Response` object.
 */
function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

