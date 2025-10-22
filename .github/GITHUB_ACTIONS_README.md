# GitHub Actions Documentation

This repository includes two automated GitHub Actions for maintaining repository data and discovering new repositories.

## 1. Repository Sync Action

**File**: `.github/workflows/repo-sync.yaml`

### Purpose

Maintains real-time data of configured repository assets by:
- Monitoring configured repositories for changes
- Syncing specific files when changes are detected
- Processing synced data using custom Python scripts
- Updating Cloudflare Worker endpoints with synchronized data

### Configuration

Repository tracking is configured in `.github/repo-sync-config.yaml`:

```yaml
repositories:
  - name: awesome-assistants
    url: https://github.com/awesome-assistants/awesome-assistants
    branch: main
    enabled: true
    sync_strategy: incremental
    check_interval_cron: "0 */6 * * *"
    files_to_sync:
      - source: assistants.yaml
        destination: synced-data/awesome-assistants/assistants.yaml
    post_sync_actions:
      - type: python_script
        script: scripts/sync/process_assistants.py
        args:
          - --file
          - synced-data/awesome-assistants/assistants.yaml
          - --cloudflare-endpoint
          - ${CLOUDFLARE_WORKER_URL}/assistants
```

### Schedule

- Runs every 6 hours automatically
- Can be triggered manually via workflow_dispatch

### Required Secrets

- `CLOUDFLARE_WORKER_URL`: Your Cloudflare Worker base URL
- `CLOUDFLARE_API_TOKEN`: API token for authenticating with Cloudflare Worker
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

### How It Works

1. **Load Configuration**: Reads `repo-sync-config.yaml` to determine which repositories to monitor
2. **Check for Changes**: Clones configured repositories and compares file hashes
3. **Sync Files**: Copies changed files to the repository
4. **Process Data**: Runs post-sync Python scripts (e.g., `process_assistants.py`)
5. **Update Cloudflare**: Sends updates to Cloudflare Worker API
6. **Commit Changes**: Commits synced data and state files

### Processing Assistants

**Script**: `scripts/sync/process_assistants.py`

This script:
- Parses the synced `assistants.yaml` file
- Fetches current assistants from Cloudflare Worker
- Detects changes (new, updated, deleted assistants)
- Updates Cloudflare Worker:
  - **New assistants**: Inserted with `isActive=true`, `dateAdded`
  - **Updated assistants**: Old version marked `isActive=false`, new version inserted
  - **Deleted assistants**: Marked with `dateDeleted`, `isActive=false`

Example usage:
```bash
python3 scripts/sync/process_assistants.py \
  --file synced-data/awesome-assistants/assistants.yaml \
  --cloudflare-endpoint "https://worker.example.com/assistants"
```

### State Management

The action maintains state in `.github/sync-state/` to track:
- File hashes for change detection
- Last sync timestamps
- Pending post-sync actions

---

## 2. Repository Discovery Action

**File**: `.github/workflows/repo-discovery.yaml`

### Purpose

Discovers new and inspiring GitHub repositories based on configured search terms:
- Searches multiple categories (Cloudflare Workers, Python apps, TypeScript libraries, etc.)
- Uses GitHub API for repository search
- Integrates with Cloudflare Worker for AI-powered analysis
- Maintains history to avoid duplicate recommendations
- Generates reports with 3-5 recommendations per category

### Categories

The discovery script searches these categories:

1. **Cloudflare Worker Agentic Apps**
   - AI agents built on Cloudflare Workers
   - LLM-powered Workers applications
   - Min stars: 20

2. **Cloudflare Worker React Frontends**
   - React apps deployed to Cloudflare
   - SSR frameworks (Remix, etc.)
   - Min stars: 30

3. **Python Agentic Apps**
   - LangChain, AutoGen, CrewAI applications
   - Autonomous agent frameworks
   - Min stars: 100

4. **TypeScript Libraries**
   - Utility libraries and SDKs
   - Frameworks and tools
   - Min stars: 200

5. **Python Libraries**
   - Popular Python packages
   - SDKs and frameworks
   - Min stars: 200

6. **AI Development Tools**
   - Prompt engineering tools
   - LLM observability platforms
   - Min stars: 100

### Schedule

- Runs daily at 00:00 UTC
- Can be triggered manually via workflow_dispatch

### Required Secrets

- `GITHUB_TOKEN`: For GitHub API access (automatically provided)
- `CLOUDFLARE_WORKER_URL`: Optional, for AI-powered analysis
- `CLOUDFLARE_API_TOKEN`: Optional, for Cloudflare Worker authentication

### How It Works

1. **Search GitHub**: Uses GitHub API to search repositories by category
2. **Filter New Repos**: Checks against `.github/discovery-state/processed-repos.json`
3. **Score Repositories**: Assigns scores based on:
   - Star count
   - Recent activity
   - Fork count
   - Documentation quality
   - Open issues count
4. **AI Analysis**: Optional integration with Cloudflare Worker for advanced ranking
5. **Generate Recommendations**: Selects top 3-5 repositories per category
6. **Create Report**: Generates markdown report in `discovery-results/`
7. **Update State**: Saves processed repositories to avoid future duplicates

### Discovery Script

**Script**: `scripts/discovery/discover_repos.py`

Example usage:
```bash
python3 scripts/discovery/discover_repos.py \
  --output discovery-results/recommendations-2025-01-15.json \
  --cloudflare-endpoint "https://worker.example.com/search" \
  --github-token "${GITHUB_TOKEN}" \
  --state-file .github/discovery-state/processed-repos.json
```

Options:
- `--categories`: Filter to specific categories (comma-separated)
- `--output`: Output JSON file path
- `--cloudflare-endpoint`: Optional Cloudflare Worker URL for AI analysis

### Output

The action generates:

1. **JSON Results**: `discovery-results/recommendations-YYYY-MM-DD.json`
   ```json
   {
     "timestamp": "2025-01-15T00:00:00",
     "recommendations": {
       "Python Agentic Apps": [
         {
           "name": "owner/repo",
           "url": "https://github.com/owner/repo",
           "description": "...",
           "stars": 1500,
           "discovery_score": 85.5,
           "reasoning": "AI-powered insight..."
         }
       ]
     }
   }
   ```

2. **Markdown Report**: `discovery-results/report-YYYY-MM-DD.md`
   - Summary of discoveries
   - Recommendations by category
   - Repository details and reasoning

3. **GitHub Actions Summary**: Report is also added to the Actions run summary

---

## Setup Instructions

### 1. Configure Secrets

Go to repository Settings → Secrets and variables → Actions:

1. Add `CLOUDFLARE_WORKER_URL`:
   - Example: `https://your-worker.your-subdomain.workers.dev`

2. Add `CLOUDFLARE_API_TOKEN`:
   - Create token in Cloudflare dashboard
   - Needs permission to call your Worker API

### 2. Customize Sync Configuration

Edit `.github/repo-sync-config.yaml` to add/modify tracked repositories.

### 3. Enable Actions

1. Go to repository Settings → Actions → General
2. Enable "Read and write permissions" for GITHUB_TOKEN
3. Enable "Allow GitHub Actions to create and approve pull requests" (if needed)

### 4. Manual Triggers

Both workflows can be manually triggered:

1. Go to Actions tab
2. Select the workflow (Repository Sync or Repository Discovery)
3. Click "Run workflow"
4. Choose branch and any input parameters

---

## Troubleshooting

### Sync Action Issues

**Files not syncing:**
- Check `.github/sync-state/` for file hashes
- Verify repository URL and branch in config
- Look for errors in Action logs

**Cloudflare Worker errors:**
- Verify `CLOUDFLARE_WORKER_URL` is correct
- Check `CLOUDFLARE_API_TOKEN` has proper permissions
- Review `failed_sync_operations.json` if sync fails

### Discovery Action Issues

**No repositories found:**
- GitHub API rate limits may be exceeded
- Adjust `min_stars` in category definitions
- Try more general search keywords

**Duplicate recommendations:**
- Delete `.github/discovery-state/processed-repos.json` to reset
- Adjust scoring algorithm in `discover_repos.py`

**Cloudflare Worker timeout:**
- AI analysis is optional and will be skipped on error
- Increase timeout in discovery script if needed

---

## Advanced Usage

### Adding New Repositories to Track

1. Edit `.github/repo-sync-config.yaml`
2. Add new repository entry:
   ```yaml
   - name: my-repo
     url: https://github.com/owner/repo
     branch: main
     enabled: true
     files_to_sync:
       - source: data.json
         destination: synced-data/my-repo/data.json
   ```
3. Commit and push changes
4. Next scheduled run will pick up the new repository

### Adding New Discovery Categories

Edit `scripts/discovery/discover_repos.py`:

```python
'my-category': SearchCategory(
    name='My Custom Category',
    keywords=['keyword1', 'keyword2'],
    filters={'language': ['python']},
    min_stars=50,
    recommendation_count=5
)
```

### Customizing Scoring Algorithm

Modify the `score_repository()` method in `discover_repos.py` to adjust:
- Weight of different metrics
- Scoring thresholds
- Additional criteria

---

## File Structure

```
.github/
├── workflows/
│   ├── repo-sync.yaml          # Repository sync action
│   └── repo-discovery.yaml     # Discovery action
├── repo-sync-config.yaml       # Sync configuration
├── sync-state/                 # Sync state tracking
│   └── *.json
└── discovery-state/            # Discovery state tracking
    └── processed-repos.json

scripts/
├── sync/
│   └── process_assistants.py   # Assistant processing script
└── discovery/
    └── discover_repos.py       # Repository discovery script

synced-data/                    # Synced repository data
└── awesome-assistants/
    └── assistants.yaml

discovery-results/              # Discovery output
├── recommendations-*.json
└── report-*.md
```

---

## Contributing

To improve these actions:

1. Fork the repository
2. Make changes to workflows or scripts
3. Test using workflow_dispatch
4. Submit pull request with description of changes

---

## License

These GitHub Actions are part of the worker-best-hits repository and follow the same license.
