import { ExternalLink } from "lucide-react";
import type { TemplateEntry } from "../../lib/useTemplates";

export interface TemplateCardProps {
  template: TemplateEntry;
}

export function TemplateCard({ template }: TemplateCardProps) {
  return (
    <article className="template-card">
      <header>
        <h4>{template.title}</h4>
        <p>{template.summary}</p>
      </header>
      <footer>
        <span className="tag">{template.tag}</span>
        <a href={template.sourceUrl} target="_blank" rel="noreferrer" className="link">
          View Source <ExternalLink size={16} />
        </a>
      </footer>
    </article>
  );
}
