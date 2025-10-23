import {
	CloudflareEmbeddings,
	CloudflareKVFacts,
	CloudflareMemory,
	CloudflareRAG,
	LLMP,
	LogLevelLogger,
	OpenAIChat,
} from "llmp"

export interface Env {
	AI: Ai
	AI_GATEWAY_URL: string
	D1_DATABASE: D1Database
	KV: KVNamespace
	OPENAI_API_KEY: string
	VECTOR_INDEX: Vectorize
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const userId = request.headers.get("X-User-Id")
		if (!userId) return new Response("Missing X-User-Id header", { status: 400 })

		const jsonBody = await request.json()
		if (!jsonBody) return new Response("Missing JSON body", { status: 400 })
		const query = (jsonBody as { query: string }).query

		const logger = new LogLevelLogger("debug")
		logger.debug('Starting LLMP', { userId })

		const chat = new OpenAIChat({
			gatewayUrl: env.AI_GATEWAY_URL,
			logger,
			model: 'gpt-4o',
			openaiApiKey: env.OPENAI_API_KEY,
			systemPrompt: "You are a helpful assistant",
			userId,
		})

		const memory = new CloudflareMemory({
			db: env.D1_DATABASE,
			logger,
			userId,
		})

		const embeddings = new CloudflareEmbeddings(
			env.AI,
			logger
		)

		const rag = new CloudflareRAG(
			env.VECTOR_INDEX,
			env.D1_DATABASE,
			userId,
			logger
		)

		const facts = new CloudflareKVFacts(
			env.KV,
			env.VECTOR_INDEX,
			embeddings,
			env.OPENAI_API_KEY,
			userId,
			logger
		)

		const context = { userId }

		const llmp = new LLMP({
			chat,
			context,
			embeddings,
			facts,
			memory,
			rag,
			logger
		})

		const resp = await llmp.handleQuery(query)
		return new Response(resp)
	},
};
