import { useQuery } from "@tanstack/react-query";
import type { TemplateIndex } from "./types";
import { fetchTemplates } from "./api";

/**
 * Loads the curated template catalog surfaced by the worker's GitHub integration.
 * The catalog is grouped by category so the UI can highlight backend, frontend,
 * full-stack, and AI-centric scaffolds.
 */
export function useTemplates(): TemplateIndex {
  const { data } = useQuery({ queryKey: ["templates"], queryFn: fetchTemplates });
  return data ?? {};
}

export type { TemplateIndex, TemplateEntry } from "./types";
