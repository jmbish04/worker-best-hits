export async function withApiKey(request: Request, env: Env) {
  const headerKey = request.headers.get("x-worker-api-key");
  if (!headerKey || headerKey !== env.WORKER_API_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }
}
