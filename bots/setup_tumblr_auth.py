"""
One-time OAuth 1.0a setup to get Tumblr OAuth token and secret.

Prerequisites (local only -- NOT needed on Railway):
  pip install requests requests-oauthlib

Steps:
  1. Go to https://www.tumblr.com/oauth/apps → Register application
       - Default callback URL: http://localhost (or leave blank)
       - Copy Consumer Key and Consumer Secret
  2. Run: python setup_tumblr_auth.py
  3. Browser opens → log in to Tumblr → click Allow
  4. You are redirected to a localhost URL (may show "site can't be reached" — that's fine)
     Copy the 'oauth_verifier' value from the URL bar.
  5. Paste the verifier code when prompted.
  6. Copy the printed env vars to Railway.

Troubleshooting:
  - "Invalid signature": wrong Consumer Key or Secret — double-check from the app page.
  - "Invalid oauth_verifier": copy the full value from the redirect URL query param.
  - "401 Unauthorized" on post: TUMBLR_BLOG_NAME may be wrong — use just the subdomain
    (e.g. for "myblog.tumblr.com" use "myblog").
"""

import http.server
import pathlib
import socket
import sys
import threading
import urllib.parse
import webbrowser

try:
    import requests
except ImportError:
    print("Run: pip install requests requests-oauthlib")
    sys.exit(1)

try:
    from requests_oauthlib import OAuth1Session
except ImportError:
    print("Run: pip install requests-oauthlib")
    sys.exit(1)

REQUEST_TOKEN_URL = "https://www.tumblr.com/oauth/request_token"
AUTHORIZE_URL = "https://www.tumblr.com/oauth/authorize"
ACCESS_TOKEN_URL = "https://www.tumblr.com/oauth/access_token"


def _find_free_port() -> int:
    with socket.socket() as s:
        s.bind(("", 0))
        return s.getsockname()[1]


class _CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        self.server.oauth_token = params.get("oauth_token", [None])[0]
        self.server.oauth_verifier = params.get("oauth_verifier", [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(
            b"<h2>Authorization received. You can close this tab and return to the terminal.</h2>"
        )
        threading.Thread(target=self.server.shutdown, daemon=True).start()

    def log_message(self, fmt, *args):
        pass


def _read_env_value(name: str, prompt: str) -> str:
    """Read from .env if present, otherwise prompt the user."""
    env_file = pathlib.Path(__file__).parent / "treasure-hunt-bot" / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith(f"{name}=") and not line.startswith("#"):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                if val and not val.startswith("your_"):
                    return val
    return input(prompt).strip()


def main() -> None:
    print("\n=== Tumblr OAuth 1.0a Setup ===\n")
    print("You need Consumer Key and Consumer Secret from:")
    print("  https://www.tumblr.com/oauth/apps\n")

    consumer_key = _read_env_value("TUMBLR_CONSUMER_KEY", "Consumer Key: ")
    consumer_secret = _read_env_value("TUMBLR_CONSUMER_SECRET", "Consumer Secret: ")

    if not consumer_key or not consumer_secret:
        print("\nConsumer Key and Secret are required.")
        sys.exit(1)

    port = _find_free_port()
    callback_uri = f"http://localhost:{port}"

    # Step 1: Get request token
    oauth = OAuth1Session(consumer_key, client_secret=consumer_secret, callback_uri=callback_uri)
    try:
        resp = oauth.fetch_request_token(REQUEST_TOKEN_URL)
    except Exception as e:
        print(f"\nFailed to get request token: {e}")
        print("Check that your Consumer Key and Secret are correct.")
        sys.exit(1)

    request_token = resp.get("oauth_token")
    request_secret = resp.get("oauth_token_secret")

    # Step 2: Authorize in browser
    auth_url = f"{AUTHORIZE_URL}?oauth_token={request_token}"
    print(f"\nOpening browser for Tumblr authorization...")
    print("If the browser does not open, go to:\n")
    print(f"  {auth_url}\n")

    server = http.server.HTTPServer(("localhost", port), _CallbackHandler)
    server.oauth_token = None
    server.oauth_verifier = None

    webbrowser.open(auth_url)
    print(f"Waiting for callback on http://localhost:{port} ...")
    server.handle_request()

    verifier = server.oauth_verifier
    if not verifier:
        print("\nNo verifier received from Tumblr callback.")
        print("If the redirect failed, check the URL in your browser for '?oauth_verifier=...' and enter it:")
        verifier = input("oauth_verifier: ").strip()

    if not verifier:
        print("No verifier provided. Aborting.")
        sys.exit(1)

    # Step 3: Exchange for access token
    oauth = OAuth1Session(
        consumer_key,
        client_secret=consumer_secret,
        resource_owner_key=request_token,
        resource_owner_secret=request_secret,
        verifier=verifier,
    )
    try:
        tokens = oauth.fetch_access_token(ACCESS_TOKEN_URL)
    except Exception as e:
        print(f"\nFailed to exchange for access token: {e}")
        sys.exit(1)

    access_token = tokens.get("oauth_token")
    access_secret = tokens.get("oauth_token_secret")

    if not access_token or not access_secret:
        print("\nUnexpected response — no access token returned.")
        sys.exit(1)

    print("\n[OK] Authorization successful! Set these on Railway:\n")
    print(f"  railway variables set TUMBLR_CONSUMER_KEY={consumer_key}")
    print(f"  railway variables set TUMBLR_CONSUMER_SECRET={consumer_secret}")
    print(f"  railway variables set TUMBLR_OAUTH_TOKEN={access_token}")
    print(f"  railway variables set TUMBLR_OAUTH_SECRET={access_secret}")
    print("\n[NOTE] TUMBLR_BLOG_NAME = subdomain only, e.g. 'myblog' for myblog.tumblr.com")
    print("  railway variables set TUMBLR_BLOG_NAME=<your-blog-name>")
    print("\n  Or set all at once from .env:")
    print("  Get-Content .env | Where-Object { $_ -match '=' } | ForEach-Object { railway variables set \"$_\" }")


if __name__ == "__main__":
    main()
