/**
 * @file log_integration_worker.ts
 * @description Cloudflare Worker acting as a Log Integration Layer with a class-based client.
 *
 * Responsibilities:
 * 1) API Gateway (`fetch`): /search, /analyze, /ingest, /ingest-batch → forwards to log-tail service
 * 2) Log Consumer (`tail`): transforms tail events → batch ingest to log-tail service
 *
 * Design: LogIntegrationClient encapsulates env, base URL, service name resolution, conditional auth,
 *         and request helpers. Keeps fetch/tail handlers thin, stateless, and testable.
 */

// -----------------------------
// ENV & TYPES
// -----------------------------

interface Env {
  LOG_TAIL_CONSUMER: {
    tail(events: TailEvent[]): Promise<void>;
  };
  LOG_SERVICE_API_KEY: string;
}

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
type LogSourceType = 'http' | 'tail' | 'agent';

interface LogEntry {
  service_name: string;
  level: LogLevel;
  message: string;
  timestamp?: number;
  metadata?: Record<string, any>;
  source_type?: LogSourceType;
}

interface LogSearchParams {
  service?: string;
  level?: LogLevel;
  start_time?: number;
  end_time?: number;
  limit?: number;
  offset?: number;
  query?: string;
}

interface LogSearchResult {
  id: string;
  service_name: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  metadata_json?: string;
  source_type: LogSourceType;
}

interface SearchResponse {
  logs: LogSearchResult[];
  total?: number;
  has_more?: boolean;
}

interface IngestResponse {
  success: boolean;
  id?: string;
  ingested?: number;
  failed?: number;
}

// -----------------------------
// UTILITIES
// -----------------------------

/** JSON response helper */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Extract subdomain (worker/service name) from a *.workers.dev URL */
function getServiceNameFromURL(requestUrl: string): string {
  try {
    const url = new URL(requestUrl);
    const parts = url.hostname.split('.');
    if (parts.length >= 3) {
      const [sub, secondLast, last] = parts.slice(-3);
      if (secondLast === 'workers' && last === 'dev') {
        return parts[0];
      }
    }
    return 'unknown-service';
  } catch {
    return 'unknown-service';
  }
}

// -----------------------------
// CLASS: LogIntegrationClient
// -----------------------------

class LogIntegrationClient {
  private readonly env: Env;
  private readonly baseUrl = 'https://log-tail.hacolby.workers.dev';
  public readonly serviceName: string;

  constructor(env: Env, requestUrl?: string, fallbackName = 'unknown-service') {
    this.env = env;
    this.serviceName = requestUrl ? getServiceNameFromURL(requestUrl) : fallbackName;
  }

  private endpoint(path: string): string {
    const cleanBase = this.baseUrl.replace(/\/$/, '');
    const cleanPath = path.replace(/^\//, '');
    return `${cleanBase}/${cleanPath}`;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const url = this.endpoint(path);
    const headers = new Headers(init.headers || {});
    headers.set('Content-Type', 'application/json');

    const isIngest = path.startsWith('/api/v1/logs/ingest');
    if (!isIngest) {
      headers.set('Authorization', `Bearer ${this.env.LOG_SERVICE_API_KEY}`);
    }

    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      let msg = `Log Service Error (${res.status})`;
      try {
        const err = await res.json();
        msg = err.error || err.message || msg;
      } catch {}
      throw new Error(msg);
    }
    return res;
  }

  async ingestOne(entry: Omit<LogEntry, 'service_name'>): Promise<IngestResponse> {
    const logs = [{ ...entry, service_name: this.serviceName }];
    const res = await this.request('/api/v1/logs/ingest/batch', {
      method: 'POST',
      body: JSON.stringify({ logs }),
    });
    return res.json();
  }

  async ingestBatch(entries: Array<Partial<LogEntry> & { message: string; level: LogLevel }>): Promise<IngestResponse> {
    const logs = entries.map(e => ({
      service_name: e.service_name ?? this.serviceName,
      level: e.level,
      message: e.message,
      timestamp: e.timestamp,
      metadata: e.metadata,
      source_type: e.source_type,
    }));
    const res = await this.request('/api/v1/logs/ingest/batch', {
      method: 'POST',
      body: JSON.stringify({ logs }),
    });
    return res.json();
  }

  async search(params: LogSearchParams = {}): Promise<SearchResponse> {
    const qp = new URLSearchParams();
    const withDefaults = { service: this.serviceName, limit: 100, ...params };
    for (const [k, v] of Object.entries(withDefaults)) {
      if (v !== undefined && v !== null) qp.set(k, String(v));
    }
    const res = await this.request(`/api/v1/logs/search?${qp.toString()}`, { method: 'GET' });
    return res.json();
  }

  async analyze(params: LogSearchParams = {}): Promise<string> {
    const payload = {
      service_name: params.service ?? this.serviceName,
      start_time: params.start_time,
      end_time: params.end_time,
      search_keywords: params.query,
    };
    const res = await this.request('/api/v1/ai-analysis', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return typeof data?.analysis === 'string' ? data.analysis : 'No analysis content returned.';
  }
}

// -----------------------------
// WORKER EXPORT
// -----------------------------

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const client = new LogIntegrationClient(env, request.url);

    try {
      if (method === 'GET' && path === '/search') {
        const params: LogSearchParams = {
          level: (url.searchParams.get('level') as LogLevel) || undefined,
          query: url.searchParams.get('query') || undefined,
          limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined,
          start_time: url.searchParams.get('start_time') ? parseInt(url.searchParams.get('start_time')!, 10) : undefined,
          end_time: url.searchParams.get('end_time') ? parseInt(url.searchParams.get('end_time')!, 10) : undefined,
        };
        const results = await client.search(params);
        return jsonResponse(results);
      }

      if (method === 'POST' && path === '/analyze') {
        const body: LogSearchParams = await request.json();
        const analysis = await client.analyze(body);
        return jsonResponse({ analysis });
      }

      if (method === 'POST' && path === '/ingest') {
        const entry = (await request.json()) as Omit<LogEntry, 'service_name'>;
        const result = await client.ingestOne(entry);
        return jsonResponse(result);
      }

      if (method === 'POST' && path === '/ingest-batch') {
        const { logs } = (await request.json()) as { logs: Array<Partial<LogEntry> & { message: string; level: LogLevel }> };
        const result = await client.ingestBatch(logs);
        return jsonResponse(result);
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    } catch (err: any) {
      console.error('Fetch error:', err?.stack || err?.message || err);
      return jsonResponse({ error: err?.message || 'Internal Server Error' }, 500);
    }
  },

  async tail(events: TailEvent[], env: Env, ctx: ExecutionContext): Promise<void> {
    const client = new LogIntegrationClient(env, undefined, 'log-integration');
    const entries: Array<Partial<LogEntry> & { message: string; level: LogLevel }> = [];

    for (const event of events) {
      try {
        let msg: any;
        if (typeof event.message === 'string') {
          try {
            msg = JSON.parse(event.message);
          } catch {
            msg = { message: event.message };
          }
        } else if (typeof event.message === 'object' && event.message) {
          msg = event.message;
        } else {
          msg = { message: 'Non-string/object tail message' };
        }

        entries.push({
          level: (msg.level || 'INFO') as LogLevel,
          message: msg.message || 'No message',
          timestamp: event.timestamp,
          metadata: { ...msg.metadata, tail_source: event.source, exception: event.exception },
          source_type: 'tail',
        });
      } catch (e: any) {
        console.error('Tail event parse error:', e?.message || e);
      }
    }

    if (entries.length) {
      ctx.waitUntil(
        client
          .ingestBatch(entries)
          .then(res => console.log(`Ingested ${res.ingested || 0} tail logs.`))
          .catch(err => console.error('Tail ingest error:', err?.stack || err?.message || err))
      );
    }
  },
};

// -----------------------------
// USAGE EXAMPLE (LOCAL TEST)
// -----------------------------

/**
 * Example local usage:
 *
 * const env = { LOG_SERVICE_API_KEY: 'your-key', LOG_TAIL_CONSUMER: { tail: async () => {} } };
 * const client = new LogIntegrationClient(env, 'https://my-worker.hacolby.workers.dev');
 *
 * // Send one log
 * await client.ingestOne({
 *   level: 'INFO',
 *   message: 'Startup complete',
 *   metadata: { version: '1.0.0', region: 'us-west1' },
 * });
 *
 * // Batch logs
 * await client.ingestBatch([
 *   { level: 'WARN', message: 'Disk space low', metadata: { freePercent: 8 } },
 *   { level: 'ERROR', message: 'Connection failed', metadata: { retry: true } },
 * ]);
 *
 * // Search logs
 * const results = await client.search({ query: 'ERROR', limit: 5 });
 * console.log(results.logs);
 *
 * // Analyze logs
 * const analysis = await client.analyze({ query: 'timeout' });
 * console.log('AI Analysis:', analysis);
 */
