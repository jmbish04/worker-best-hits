"""
Cloudflare Logger Client

This Python module provides a client class (`CloudflareLogger`) for interacting
with the `log-tail.hacolby.workers.dev` log service.

Features:
-   Convenience methods for logging (info, error, warn).
-   Batch log ingestion.
-   Log searching and AI analysis.
-   **Conditional Authentication:**
    -   Log ingestion endpoints (`/api/v1/logs/ingest*`) are public and
        do not send an API key.
    -   Search and Analysis endpoints (`/api/v1/logs/search`,
        `/api/v1/ai-analysis`) are secure and automatically send the
        `Authorization` header.
"""
import os
import requests
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

class CloudflareLogger:
    """
    A Python client for the Cloudflare Log Service.
    
    Manages sending logs, searching logs, and running AI analysis,
    applying authentication only when required.
    """
    
    def __init__(self, service_name: str, api_key: str):
        """
        Initializes the logger client.

        Args:
            service_name (str): The name of the service logging. This will
                                be attached to all log entries.
            api_key (str): The secret API key. This is *only* used for
                           secure endpoints (search, analysis) and is
                           *not* sent during log ingestion.
        """
        self.service_name = service_name
        self.api_key = api_key
        self.session = requests.Session()
        self.base_url = "https://log-tail.hacolby.workers.dev"

    def _endpoint_url(self, uri: str) -> str:
        """
        Creates the full, hardcoded URL for the log service API.
        Safely joins the base URL and the URI path, handling slashes.

        Args:
            uri (str): The API path (e.g., '/api/v1/test').
        
        Returns:
            str: The complete, combined URL.
        """
        clean_base = self.base_url.rstrip('/')
        clean_uri = uri.lstrip('/')
        return f"{clean_base}/{clean_uri}"

    def _request(
        self,
        method: str,
        path: str,
        json_payload: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        timeout: int = 10
    ) -> requests.Response:
        """
        A centralized helper for making API requests to the main log service.
        
        **Conditional Authentication:**
        This function automatically attaches the `Authorization` header
        *only* for non-ingestion endpoints (e.g., search, analysis).
        Ingestion endpoints are treated as public and do not send the key.
        """
        full_url = self._endpoint_url(path)
        
        headers = {
            'Content-Type': 'application/json'
        }

        # --- Conditional Authentication Logic ---
        # Only add the API key if the path is NOT for ingestion.
        is_ingestion = path.startswith('/api/v1/logs/ingest')
        if not is_ingestion:
            headers['Authorization'] = f'Bearer {self.api_key}'
        # ----------------------------------------

        try:
            response = self.session.request(
                method=method,
                url=full_url,
                headers=headers,
                json=json_payload,
                params=params,
                timeout=timeout
            )
            # Raise an HTTPError for bad responses (4xx or 5xx)
            response.raise_for_status()
            return response
        except requests.exceptions.HTTPError as http_err:
            print(f"[HTTP Error] {http_err.response.status_code} for {full_url}: {http_err.response.text}")
            raise
        except requests.exceptions.ConnectionError as conn_err:
            print(f"[Connection Error] Failed to connect to {full_url}: {conn_err}")
            raise
        except requests.exceptions.Timeout as timeout_err:
            print(f"[Timeout Error] Request to {full_url} timed out: {timeout_err}")
            raise
        except requests.exceptions.RequestException as req_err:
            print(f"[Request Error] An error occurred: {req_err}")
            raise

    def log(self, level: str, message: str, **metadata):
        """
        Sends a single log entry to the (public) ingestion endpoint.
        """
        payload = {
            'service_name': self.service_name,
            'level': level.upper(),
            'message': message,
            'timestamp': int(datetime.utcnow().timestamp() * 1000), # UTC ms
            'metadata': {
                **metadata,
                'timestamp_iso': datetime.utcnow().isoformat()
            }
        }
        
        try:
            self._request(
                'POST',
                '/api/v1/logs/ingest',
                json_payload=payload,
                timeout=5
            )
        except Exception as e:
            # Fallback to local print if service is unavailable
            print(f"[LOG ERROR] {e}: {message}")

    def batch_log(self, logs: List[Dict[str, Any]]):
        """
        Sends multiple logs at once to the (public) batch ingestion endpoint.
        
        Args:
            logs (List[Dict]): A list of log dictionaries. Each dict
                               should have 'level', 'message', 'metadata'.
        """
        processed_logs = [
            {
                'service_name': self.service_name,
                'level': log['level'].upper(),
                'message': log['message'],
                'timestamp': log.get('timestamp', int(datetime.utcnow().timestamp() * 1000)),
                'metadata': log.get('metadata', {})
            }
            for log in logs
        ]
        
        payload = {'logs': processed_logs}
        
        try:
            self._request(
                'POST',
                '/api/v1/logs/ingest/batch',
                json_payload=payload,
                timeout=10
            )
        except Exception as e:
            print(f"[BATCH LOG ERROR] {e}")

    # --- Convenience Methods ---

    def info(self, message: str, **metadata):
        """Logs an INFO level message."""
        self.log('INFO', message, **metadata)
    
    def error(self, message: str, **metadata):
        """Logs an ERROR level message."""
        self.log('ERROR', message, **metadata)
    
    def warning(self, message: str, **metadata):
        """Logs a WARN level message."""
        self.log('WARN', message, **metadata)
        
    def debug(self, message: str, **metadata):
        """Logs a DEBUG level message."""
        self.log('DEBUG', message, **metadata)

    # --- Secure Endpoints ---

    def search_logs(
        self,
        service: Optional[str] = None,
        level: Optional[str] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        limit: int = 100,
        offset: Optional[int] = None,
        query: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Searches logs from the main logging service.
        This function calls a *secure* (auth-required) endpoint.

        Args:
            service (str, optional): Filter by service name.
            level (str, optional): Filter by log level.
            start_time (int, optional): UTC milliseconds start time.
            end_time (int, optional): UTC milliseconds end time.
            limit (int): Number of logs to return. Default 100.
            offset (int, optional): Offset for pagination.
            query (str, optional): Free-text search query.
        
        Returns:
            Dict[str, Any]: The JSON response from the search API
                            (e.g., {'logs': [...], 'total': ...}).
        """
        params = {
            'service': service,
            'level': level,
            'start_time': start_time,
            'end_time': end_time,
            'limit': limit,
            'offset': offset,
            'query': query
        }
        # Remove None values so they aren't in the query string
        clean_params = {k: v for k, v in params.items() if v is not None}
        
        try:
            response = self._request(
                'GET',
                '/api/v1/logs/search',
                params=clean_params
            )
            return response.json()
        except Exception as e:
            print(f"[SEARCH ERROR] {e}")
            return {'logs': [], 'error': str(e)}

    def analyze_logs(
        self,
        service: Optional[str] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        search_keywords: Optional[str] = None
    ) -> str:
        """
        Performs AI analysis by calling the log service's built-in AI endpoint.
        This function calls a *secure* (auth-required) endpoint.

        Args:
            service (str, optional): Filter by service name.
            start_time (int, optional): UTC milliseconds start time.
            end_time (int, optional): UTC milliseconds end time.
            search_keywords (str, optional): Keywords for the AI to focus on.
        
        Returns:
            str: The string-based analysis from the service.
        """
        payload = {
            'service_name': service,
            'start_time': start_time,
            'end_time': end_time,
            'search_keywords': search_keywords
        }
        
        try:
            response = self._request(
                'POST',
                '/api/v1/ai-analysis',
                json_payload=payload
            )
            result = response.json()
            return result.get('analysis', 'No analysis content returned.')
        except Exception as e:
            print(f"[ANALYSIS ERROR] {e}")
            return f"Analysis failed: {e}"

# --- Usage Example ---
if __name__ == "__main__":

    # Load environment variables from .env file
    load_dotenv()

    # Fetch API key from .env
    api_key = os.getenv("LOGTAIL_API_KEY") or 'your-api-key'

    # Fetch Service Name from .env
    service_name = os.getenv("PYTHON_APP_NAME") or 'your-python-service-name'

    
    # API key is only used for search/analysis
    logger = CloudflareLogger(
        service_name=service_name or 'your-python-service-name',
        api_key=api_key or 'your-api-key' # No key needed if just logging
    )

    print("--- Sending Logs (No Auth Key Sent) ---")
    logger.info('Starting data processing', job_id='123', batch_size=1000)
    logger.error('Database connection failed', error_code='DB_TIMEOUT', retry_count=3)
    
    # Example of batch logging
    log_batch = [
        {'level': 'WARN', 'message': 'Disk space running low', 'metadata': {'percent_free': 10}},
        {'level': 'DEBUG', 'message': 'Processed item 456', 'metadata': {'item_id': 456}}
    ]
    logger.batch_log(log_batch)
    print("Logs sent.")

    print("\n--- Searching Logs (Auth Key Sent) ---")
    # Example: 1 hour ago
    start_ms = int((datetime.utcnow() - timedelta(hours=1)).timestamp() * 1000)
    
    try:
        search_results = logger.search_logs(
            service=service_name,
            level='ERROR',
            start_time=start_ms
        )
        print(f"Found {len(search_results.get('logs', []))} ERROR logs:")
        print(json.dumps(search_results, indent=2))
    except Exception:
        pass # Error already printed by _request

    print("\n--- Analyzing Logs (Auth Key Sent) ---")
    try:
        analysis = logger.analyze_logs(
            service=service_name,
            start_time=start_ms,
            search_keywords="timeout"
        )
        print("--- AI Analysis Result ---")
        print(analysis)
        print("--------------------------")
    except Exception:
        pass # Error already printed by _request
