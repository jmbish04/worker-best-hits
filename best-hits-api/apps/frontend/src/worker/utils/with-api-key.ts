export async function withApiKey(request: Request, env: Env) {
  const headerKey = request.headers.get("x-worker-api-key");
  const apiKey = env.WORKER_API_KEY;

  let equal = false;
  if (headerKey && apiKey && headerKey.length === apiKey.length) {
    let mismatch = 0;
    for (let i = 0; i < apiKey.length; i++) {
      mismatch |= headerKey.charCodeAt(i) ^ apiKey.charCodeAt(i);
    }
    equal = mismatch === 0;
  }

  if (!equal) {
    return new Response("Unauthorized", { status: 401 });
  }
}
