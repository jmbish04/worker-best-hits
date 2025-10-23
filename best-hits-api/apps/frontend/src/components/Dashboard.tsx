import { Github, LayoutDashboard, Zap, Database, Cloud } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

const repoLink = 'https://github.com/cloudflare/templates/tree/main/saas-admin-template';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome to Best Hits API</h2>
          <p className="text-muted-foreground">AI-powered assistant for managing your best hits and templates</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold">AI Assistant</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Get intelligent help with your code, templates, and repository insights.
          </p>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex items-center space-x-2">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold">Templates</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Access curated code templates and patterns for faster development.
          </p>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex items-center space-x-2">
            <Cloud className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold">Cloudflare Workers</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Built on Cloudflare's edge computing platform for global performance.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-4">
          <a className={buttonVariants()} href="/admin">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Go to Admin
          </a>
          <a className={buttonVariants({ variant: 'outline' })} href={repoLink} target="_blank">
            <Github className="mr-2 h-4 w-4" />
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}