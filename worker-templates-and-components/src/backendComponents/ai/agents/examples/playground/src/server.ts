import { routeAgentRequest } from "agents";
import { Chat } from "./agents/chat";
import { Rpc } from "./agents/rpc";
import { Scheduler } from "./agents/scheduler";
import { Stateful } from "./agents/stateful";

export type Env = {
  Scheduler: DurableObjectNamespace<Scheduler>;
  Stateful: DurableObjectNamespace<Stateful>;
  OPENAI_API_KEY: string;
};

export { Scheduler, Stateful, Chat, Rpc };

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
