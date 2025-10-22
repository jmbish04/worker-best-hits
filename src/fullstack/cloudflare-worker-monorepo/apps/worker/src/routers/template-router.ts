import { json } from "itty-router";
import { createTemplateCatalogService } from "../services/template-catalog-service";

const templateCatalog = createTemplateCatalogService();

export const createTemplateRouter = async (_request: Request, env: Env) => {
  const templates = await templateCatalog.list(env);
  return json(templates);
};
