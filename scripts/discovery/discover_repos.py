#!/usr/bin/env python3
"""
Repository Discovery Script

Discovers new and inspiring GitHub repositories based on configured search terms.
Uses Cloudflare Worker API for agentic search support.
Maintains a history of processed repositories to avoid duplicates.
Recommends 3-5 repositories per category.

Categories:
- Cloudflare Worker agentic apps
- Cloudflare Worker React framework frontends
- Python agentic apps
- TypeScript libraries
- Python libraries
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set
import requests
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class SearchCategory:
    """Defines a search category for repository discovery"""
    name: str
    keywords: List[str]
    filters: Dict[str, Any]
    min_stars: int = 50
    max_age_days: int = 365
    recommendation_count: int = 5


class RepositoryDiscovery:
    """Manages repository discovery and recommendation"""

    # Define search categories
    CATEGORIES = {
        'cloudflare-worker-agentic': SearchCategory(
            name='Cloudflare Worker Agentic Apps',
            keywords=[
                'cloudflare workers ai agent',
                'cloudflare workers llm',
                'cloudflare workers autonomous',
                'cloudflare ai gateway agent',
                'workers ai assistant'
            ],
            filters={
                'language': ['javascript', 'typescript'],
                'topics': ['cloudflare-workers', 'ai-agent', 'llm']
            },
            min_stars=20,
            max_age_days=730
        ),
        'cloudflare-worker-react': SearchCategory(
            name='Cloudflare Worker React Frontends',
            keywords=[
                'cloudflare workers react',
                'cloudflare pages react',
                'workers react framework',
                'cloudflare react ssr',
                'remix cloudflare'
            ],
            filters={
                'language': ['javascript', 'typescript'],
                'topics': ['cloudflare-workers', 'react', 'frontend']
            },
            min_stars=30,
            max_age_days=730
        ),
        'python-agentic': SearchCategory(
            name='Python Agentic Apps',
            keywords=[
                'python ai agent framework',
                'python autonomous agent',
                'python llm agent',
                'langchain agent',
                'autogen agent python',
                'crewai python'
            ],
            filters={
                'language': ['python'],
                'topics': ['ai-agent', 'llm', 'autonomous-agent']
            },
            min_stars=100,
            max_age_days=365
        ),
        'typescript-libraries': SearchCategory(
            name='TypeScript Libraries',
            keywords=[
                'typescript utility library',
                'typescript framework',
                'typescript tools',
                'typescript sdk',
                'typescript api client'
            ],
            filters={
                'language': ['typescript'],
                'topics': ['library', 'sdk', 'framework']
            },
            min_stars=200,
            max_age_days=730
        ),
        'python-libraries': SearchCategory(
            name='Python Libraries',
            keywords=[
                'python utility library',
                'python framework',
                'python tools',
                'python sdk',
                'python api client'
            ],
            filters={
                'language': ['python'],
                'topics': ['library', 'sdk', 'framework']
            },
            min_stars=200,
            max_age_days=730
        ),
        'ai-development-tools': SearchCategory(
            name='AI Development Tools',
            keywords=[
                'ai development tools',
                'llm development toolkit',
                'prompt engineering tools',
                'ai agent builder',
                'llm observability'
            ],
            filters={
                'topics': ['ai', 'llm', 'developer-tools']
            },
            min_stars=100,
            max_age_days=365
        )
    }

    def __init__(
        self,
        github_token: str,
        cloudflare_endpoint: Optional[str] = None,
        state_file: str = '.github/discovery-state/processed-repos.json'
    ):
        self.github_token = github_token
        self.cloudflare_endpoint = cloudflare_endpoint
        self.state_file = state_file
        self.processed_repos: Set[str] = set()
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'token {github_token}',
            'Accept': 'application/vnd.github.v3+json'
        })

        # Load processed repositories
        self.load_state()

    def load_state(self):
        """Load previously processed repositories"""
        if os.path.exists(self.state_file):
            with open(self.state_file, 'r') as f:
                data = json.load(f)
                self.processed_repos = set(data.get('processed_repos', []))
                print(f"Loaded {len(self.processed_repos)} processed repositories")
        else:
            print("No previous state found, starting fresh")

    def save_state(self):
        """Save processed repositories state"""
        os.makedirs(os.path.dirname(self.state_file), exist_ok=True)

        data = {
            'processed_repos': list(self.processed_repos),
            'last_updated': datetime.utcnow().isoformat()
        }

        with open(self.state_file, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"Saved state: {len(self.processed_repos)} processed repositories")

    def search_github(
        self,
        query: str,
        min_stars: int = 50,
        max_age_days: int = 365,
        language: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Search GitHub repositories"""

        # Build search query
        created_date = (datetime.utcnow() - timedelta(days=max_age_days)).strftime('%Y-%m-%d')
        search_query = f"{query} stars:>={min_stars} created:>={created_date}"

        if language:
            search_query += f" language:{language}"

        params = {
            'q': search_query,
            'sort': 'stars',
            'order': 'desc',
            'per_page': 20
        }

        try:
            response = self.session.get(
                'https://api.github.com/search/repositories',
                params=params
            )
            response.raise_for_status()

            data = response.json()
            return data.get('items', [])

        except requests.exceptions.RequestException as e:
            print(f"Error searching GitHub: {e}")
            return []

    def get_agentic_analysis(self, repositories: List[Dict[str, Any]], category: str) -> Dict[str, Any]:
        """Get AI-powered analysis of repositories using Cloudflare Worker"""

        if not self.cloudflare_endpoint:
            print("Cloudflare endpoint not configured, skipping agentic analysis")
            return {}

        try:
            payload = {
                'repositories': repositories,
                'category': category,
                'task': 'analyze_and_rank',
                'criteria': [
                    'innovation',
                    'code_quality',
                    'community_activity',
                    'practical_utility',
                    'documentation'
                ]
            }

            response = requests.post(
                self.cloudflare_endpoint,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )

            if response.status_code == 200:
                return response.json()
            else:
                print(f"Cloudflare API returned status {response.status_code}")
                return {}

        except requests.exceptions.RequestException as e:
            print(f"Error calling Cloudflare Worker: {e}")
            return {}

    def score_repository(self, repo: Dict[str, Any]) -> float:
        """
        Score a repository based on various metrics.
        Returns a score between 0 and 100.
        """
        score = 0.0

        # Star count (max 30 points)
        stars = repo.get('stargazers_count', 0)
        if stars >= 10000:
            score += 30
        elif stars >= 5000:
            score += 25
        elif stars >= 1000:
            score += 20
        elif stars >= 500:
            score += 15
        elif stars >= 100:
            score += 10
        else:
            score += 5

        # Recent activity (max 20 points)
        updated_at = repo.get('updated_at', '')
        if updated_at:
            try:
                updated = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                days_since_update = (datetime.utcnow().replace(tzinfo=updated.tzinfo) - updated).days

                if days_since_update <= 7:
                    score += 20
                elif days_since_update <= 30:
                    score += 15
                elif days_since_update <= 90:
                    score += 10
                elif days_since_update <= 180:
                    score += 5
            except ValueError:
                pass

        # Fork count (max 15 points)
        forks = repo.get('forks_count', 0)
        if forks >= 1000:
            score += 15
        elif forks >= 500:
            score += 12
        elif forks >= 100:
            score += 9
        elif forks >= 50:
            score += 6
        else:
            score += 3

        # Has description (5 points)
        if repo.get('description'):
            score += 5

        # Has topics (5 points)
        if repo.get('topics') and len(repo.get('topics', [])) > 0:
            score += 5

        # Open issues (max 10 points - fewer is better for maintenance)
        open_issues = repo.get('open_issues_count', 0)
        if open_issues <= 10:
            score += 10
        elif open_issues <= 50:
            score += 7
        elif open_issues <= 100:
            score += 5
        else:
            score += 2

        # Has license (5 points)
        if repo.get('license'):
            score += 5

        # Has homepage/documentation (5 points)
        if repo.get('homepage'):
            score += 5

        return score

    def filter_new_repositories(self, repositories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter out repositories that have been processed before"""
        new_repos = []

        for repo in repositories:
            repo_url = repo.get('html_url', '')
            if repo_url and repo_url not in self.processed_repos:
                new_repos.append(repo)

        print(f"Found {len(new_repos)} new repositories out of {len(repositories)} total")
        return new_repos

    def discover_category(
        self,
        category_key: str,
        category: SearchCategory
    ) -> List[Dict[str, Any]]:
        """Discover repositories for a specific category"""

        print(f"\n{'='*60}")
        print(f"Discovering: {category.name}")
        print(f"{'='*60}")

        all_repos = []
        seen_urls = set()

        # Search with each keyword
        for keyword in category.keywords:
            print(f"\nSearching: {keyword}")

            for language in category.filters.get('language', [None]):
                repos = self.search_github(
                    query=keyword,
                    min_stars=category.min_stars,
                    max_age_days=category.max_age_days,
                    language=language
                )

                # Deduplicate
                for repo in repos:
                    url = repo.get('html_url', '')
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        all_repos.append(repo)

        print(f"\nTotal repositories found: {len(all_repos)}")

        # Filter out previously processed repos
        new_repos = self.filter_new_repositories(all_repos)

        if not new_repos:
            print("No new repositories to recommend")
            return []

        # Score repositories
        for repo in new_repos:
            repo['discovery_score'] = self.score_repository(repo)

        # Sort by score
        new_repos.sort(key=lambda r: r['discovery_score'], reverse=True)

        # Get top N recommendations
        recommendations = new_repos[:category.recommendation_count]

        # Get agentic analysis if available
        agentic_results = self.get_agentic_analysis(recommendations, category.name)

        # Enhance recommendations with agentic insights
        if agentic_results and 'rankings' in agentic_results:
            rankings = {r['url']: r for r in agentic_results.get('rankings', [])}

            for repo in recommendations:
                url = repo.get('html_url', '')
                if url in rankings:
                    repo['agentic_score'] = rankings[url].get('score', 0)
                    repo['reasoning'] = rankings[url].get('reasoning', '')

        # Mark as processed
        for repo in recommendations:
            self.processed_repos.add(repo.get('html_url', ''))

        print(f"\nRecommending {len(recommendations)} repositories")
        for i, repo in enumerate(recommendations, 1):
            print(f"  {i}. {repo['full_name']} ({repo['stargazers_count']} stars, score: {repo['discovery_score']:.1f})")

        return recommendations

    def run_discovery(
        self,
        categories: Optional[List[str]] = None,
        output_file: str = 'discovery-results.json'
    ) -> Dict[str, Any]:
        """Run discovery for all or specified categories"""

        print("\n" + "="*60)
        print("Repository Discovery")
        print("="*60)

        # Determine which categories to search
        if categories:
            search_categories = {
                k: v for k, v in self.CATEGORIES.items()
                if k in categories
            }
        else:
            search_categories = self.CATEGORIES

        print(f"\nSearching {len(search_categories)} categories")

        results = {
            'timestamp': datetime.utcnow().isoformat(),
            'categories_searched': list(search_categories.keys()),
            'recommendations': {},
            'total_discovered': 0,
            'total_recommendations': 0
        }

        # Discover for each category
        for category_key, category in search_categories.items():
            try:
                recommendations = self.discover_category(category_key, category)

                results['recommendations'][category.name] = [
                    {
                        'name': repo['full_name'],
                        'url': repo['html_url'],
                        'description': repo.get('description', ''),
                        'stars': repo.get('stargazers_count', 0),
                        'forks': repo.get('forks_count', 0),
                        'language': repo.get('language', ''),
                        'topics': repo.get('topics', []),
                        'updated_at': repo.get('updated_at', ''),
                        'license': repo.get('license', {}).get('name', '') if repo.get('license') else '',
                        'homepage': repo.get('homepage', ''),
                        'discovery_score': repo.get('discovery_score', 0),
                        'agentic_score': repo.get('agentic_score'),
                        'reasoning': repo.get('reasoning', '')
                    }
                    for repo in recommendations
                ]

                results['total_recommendations'] += len(recommendations)

            except Exception as e:
                print(f"\nError processing category {category_key}: {e}")
                import traceback
                traceback.print_exc()

        # Save state
        self.save_state()

        # Save results
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)

        print("\n" + "="*60)
        print(f"Discovery complete!")
        print(f"Total recommendations: {results['total_recommendations']}")
        print(f"Results saved to: {output_file}")
        print("="*60)

        return results


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Discover new and inspiring GitHub repositories'
    )
    parser.add_argument(
        '--output',
        default='discovery-results.json',
        help='Output file for results'
    )
    parser.add_argument(
        '--cloudflare-endpoint',
        help='Cloudflare Worker endpoint for agentic search'
    )
    parser.add_argument(
        '--github-token',
        help='GitHub API token (or set GITHUB_TOKEN env var)'
    )
    parser.add_argument(
        '--state-file',
        default='.github/discovery-state/processed-repos.json',
        help='State file to track processed repositories'
    )
    parser.add_argument(
        '--categories',
        help='Comma-separated list of categories to search'
    )

    args = parser.parse_args()

    # Get GitHub token
    github_token = args.github_token or os.environ.get('GITHUB_TOKEN')
    if not github_token:
        print("Error: GitHub token required (use --github-token or set GITHUB_TOKEN)")
        sys.exit(1)

    # Parse categories
    categories = None
    if args.categories:
        categories = [c.strip() for c in args.categories.split(',')]

    # Create discovery manager
    discovery = RepositoryDiscovery(
        github_token=github_token,
        cloudflare_endpoint=args.cloudflare_endpoint,
        state_file=args.state_file
    )

    # Run discovery
    try:
        results = discovery.run_discovery(
            categories=categories,
            output_file=args.output
        )

        sys.exit(0)

    except Exception as e:
        print(f"\nError during discovery: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
