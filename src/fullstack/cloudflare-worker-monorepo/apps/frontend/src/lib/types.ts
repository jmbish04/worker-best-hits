export interface Thread {
  id: string;
  title: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface TemplateEntry {
  slug: string;
  title: string;
  summary: string;
  tag: string;
  sourceUrl: string;
}

export interface TemplateCategory {
  description: string;
  items: TemplateEntry[];
}

export type TemplateIndex = Record<string, TemplateCategory>;
