import type { TemplateIndex } from "../../lib/useTemplates";
import { TemplateCard } from "../templates/TemplateCard";

export interface ResourceExplorerProps {
  templates: TemplateIndex;
}

export function ResourceExplorer({ templates }: ResourceExplorerProps) {
  return (
    <div>
      <h2>Reusable Patterns</h2>
      <p className="subtitle">
        Curated snippets sourced from this repository via the GitHub integration.
      </p>

      {Object.entries(templates).map(([category, entries]) => (
        <section key={category} className="template-section">
          <header>
            <h3>{category}</h3>
            <p>{entries.description}</p>
          </header>
          <div className="template-grid">
            {entries.items.map((entry) => (
              <TemplateCard key={entry.slug} template={entry} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
