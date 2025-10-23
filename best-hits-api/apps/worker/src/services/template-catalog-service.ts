import { createTemplateLibrary } from "@cloudflare/templates";

export function createTemplateCatalogService() {
  const library = createTemplateLibrary();

  return {
    async list(env: Env) {
      return library.list(env);
    }
  };
}
