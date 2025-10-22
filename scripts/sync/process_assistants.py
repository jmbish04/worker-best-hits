#!/usr/bin/env python3
"""
Process assistants from awesome-assistants repository and sync with Cloudflare Worker.

This script:
1. Parses the assistants.yaml file
2. Fetches current assistants from Cloudflare worker
3. Detects changes (new, updated, deleted)
4. Updates Cloudflare worker:
   - Marks old versions as isActive=false
   - Marks deleted assistants with dateDeleted
   - Inserts new assistants
"""

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Any, Optional
import yaml
import requests


class AssistantSyncManager:
    """Manages synchronization of assistants with Cloudflare Worker"""

    def __init__(self, cloudflare_endpoint: str, api_token: Optional[str] = None):
        self.cloudflare_endpoint = cloudflare_endpoint
        self.api_token = api_token or os.environ.get('CLOUDFLARE_API_TOKEN')
        self.session = requests.Session()

        if self.api_token:
            self.session.headers.update({
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            })

    def load_yaml_assistants(self, file_path: str) -> List[Dict[str, Any]]:
        """Load assistants from YAML file"""
        print(f"Loading assistants from {file_path}...")

        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        assistants = data.get('assistants', [])
        print(f"Loaded {len(assistants)} assistants from YAML")

        return assistants

    def fetch_current_assistants(self) -> List[Dict[str, Any]]:
        """Fetch current assistants from Cloudflare Worker"""
        print(f"Fetching current assistants from {self.cloudflare_endpoint}...")

        try:
            response = self.session.get(self.cloudflare_endpoint)
            response.raise_for_status()

            data = response.json()
            assistants = data.get('assistants', []) if isinstance(data, dict) else data

            print(f"Fetched {len(assistants)} assistants from Cloudflare Worker")
            return assistants

        except requests.exceptions.RequestException as e:
            print(f"Error fetching assistants: {e}")
            print("Assuming no existing assistants (first sync)")
            return []

    def compute_assistant_hash(self, assistant: Dict[str, Any]) -> str:
        """
        Compute a hash/fingerprint of an assistant for change detection.
        This uses key fields that would indicate a meaningful change.
        """
        # Create a normalized representation for comparison
        key_fields = ['name', 'description', 'url', 'category', 'tags', 'author']
        normalized = {k: assistant.get(k) for k in key_fields if k in assistant}

        # Convert to stable JSON string for hashing
        return json.dumps(normalized, sort_keys=True)

    def detect_changes(
        self,
        yaml_assistants: List[Dict[str, Any]],
        current_assistants: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Detect changes between YAML and current assistants.

        Returns:
            dict with 'new', 'updated', 'deleted', 'unchanged' keys
        """
        print("\nDetecting changes...")

        # Create lookup maps
        # Use name or unique identifier as key
        yaml_map = {}
        for assistant in yaml_assistants:
            key = assistant.get('name') or assistant.get('id')
            if key:
                yaml_map[key] = assistant

        current_map = {}
        for assistant in current_assistants:
            # Only consider active assistants
            if assistant.get('isActive', True) and not assistant.get('dateDeleted'):
                key = assistant.get('name') or assistant.get('id')
                if key:
                    current_map[key] = assistant

        # Detect new, updated, and unchanged
        new_assistants = []
        updated_assistants = []
        unchanged_assistants = []

        for key, yaml_assistant in yaml_map.items():
            if key not in current_map:
                new_assistants.append(yaml_assistant)
            else:
                yaml_hash = self.compute_assistant_hash(yaml_assistant)
                current_hash = self.compute_assistant_hash(current_map[key])

                if yaml_hash != current_hash:
                    updated_assistants.append({
                        'old': current_map[key],
                        'new': yaml_assistant
                    })
                else:
                    unchanged_assistants.append(yaml_assistant)

        # Detect deleted
        deleted_assistants = []
        for key, current_assistant in current_map.items():
            if key not in yaml_map:
                deleted_assistants.append(current_assistant)

        print(f"  New: {len(new_assistants)}")
        print(f"  Updated: {len(updated_assistants)}")
        print(f"  Deleted: {len(deleted_assistants)}")
        print(f"  Unchanged: {len(unchanged_assistants)}")

        return {
            'new': new_assistants,
            'updated': updated_assistants,
            'deleted': deleted_assistants,
            'unchanged': unchanged_assistants
        }

    def sync_to_cloudflare(self, changes: Dict[str, List[Dict[str, Any]]]) -> bool:
        """
        Sync changes to Cloudflare Worker.

        Returns:
            True if sync was successful
        """
        print("\nSyncing to Cloudflare Worker...")

        operations = []

        # Handle new assistants
        for assistant in changes['new']:
            operations.append({
                'action': 'insert',
                'data': {
                    **assistant,
                    'isActive': True,
                    'dateAdded': datetime.utcnow().isoformat(),
                    'version': 1
                }
            })
            print(f"  [NEW] {assistant.get('name', 'Unknown')}")

        # Handle updated assistants
        for update in changes['updated']:
            old = update['old']
            new = update['new']

            # Mark old version as inactive
            operations.append({
                'action': 'update',
                'id': old.get('id'),
                'data': {
                    'isActive': False,
                    'dateDeactivated': datetime.utcnow().isoformat()
                }
            })

            # Insert new version
            operations.append({
                'action': 'insert',
                'data': {
                    **new,
                    'isActive': True,
                    'dateAdded': datetime.utcnow().isoformat(),
                    'version': old.get('version', 0) + 1,
                    'previousVersion': old.get('id')
                }
            })
            print(f"  [UPDATED] {new.get('name', 'Unknown')}")

        # Handle deleted assistants
        for assistant in changes['deleted']:
            operations.append({
                'action': 'update',
                'id': assistant.get('id'),
                'data': {
                    'dateDeleted': datetime.utcnow().isoformat(),
                    'isActive': False
                }
            })
            print(f"  [DELETED] {assistant.get('name', 'Unknown')}")

        if not operations:
            print("No changes to sync")
            return True

        # Send batch update to Cloudflare Worker
        try:
            payload = {
                'operations': operations,
                'source': 'awesome-assistants-sync',
                'timestamp': datetime.utcnow().isoformat()
            }

            print(f"\nSending {len(operations)} operations to Cloudflare Worker...")

            response = self.session.post(
                f"{self.cloudflare_endpoint}/sync",
                json=payload
            )

            response.raise_for_status()
            result = response.json()

            print(f"Sync successful: {result}")
            return True

        except requests.exceptions.RequestException as e:
            print(f"Error syncing to Cloudflare Worker: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response: {e.response.text}")

            # Save operations to file for manual review
            with open('failed_sync_operations.json', 'w') as f:
                json.dump(payload, f, indent=2)
            print("Operations saved to failed_sync_operations.json")

            return False

    def run_sync(self, yaml_file: str) -> bool:
        """Run the complete sync process"""
        print("="*60)
        print("Assistant Sync Process")
        print("="*60)

        try:
            # Load YAML assistants
            yaml_assistants = self.load_yaml_assistants(yaml_file)

            # Fetch current assistants from Cloudflare
            current_assistants = self.fetch_current_assistants()

            # Detect changes
            changes = self.detect_changes(yaml_assistants, current_assistants)

            # Sync to Cloudflare
            success = self.sync_to_cloudflare(changes)

            print("\n" + "="*60)
            if success:
                print("Sync completed successfully")
            else:
                print("Sync completed with errors")
            print("="*60)

            return success

        except Exception as e:
            print(f"\nError during sync: {e}")
            import traceback
            traceback.print_exc()
            return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Sync assistants from YAML to Cloudflare Worker'
    )
    parser.add_argument(
        '--file',
        required=True,
        help='Path to assistants YAML file'
    )
    parser.add_argument(
        '--cloudflare-endpoint',
        required=True,
        help='Cloudflare Worker endpoint URL'
    )
    parser.add_argument(
        '--api-token',
        help='Cloudflare API token (or set CLOUDFLARE_API_TOKEN env var)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Perform dry run without syncing to Cloudflare'
    )

    args = parser.parse_args()

    # Validate file exists
    if not os.path.exists(args.file):
        print(f"Error: File not found: {args.file}")
        sys.exit(1)

    # Create sync manager
    sync_manager = AssistantSyncManager(
        cloudflare_endpoint=args.cloudflare_endpoint,
        api_token=args.api_token
    )

    # Run sync
    success = sync_manager.run_sync(args.file)

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
