"""
One-time OAuth2 setup to get a Google Blogger refresh token.

Prerequisites (local only -- NOT needed on Railway):
  pip install requests

Steps:
  1. Go to Google Cloud Console → APIs & Services → Credentials
     → Create OAuth Client ID → Application type: "Desktop app"
     → Download the JSON and save as client_secret.json next to this script
  2. IMPORTANT: Go to "OAuth consent screen" → set Publishing status to "Production"
     (if left in "Testing", refresh tokens expire after 7 days!)
  3. Enable "Blogger API v3" in APIs & Services → Library
  4. Run: python setup_blogger_auth.py
  5. Browser opens → sign in with the Google account that owns the blog
  6. Copy the printed env vars to Railway: railway variables set BLOGGER_REFRESH_TOKEN=...

Troubleshooting:
  - "Token expired" / posts stop appearing: app is in Testing mode → publish to Production
  - "403 Forbidden" on post: Blogger API not enabled → enable it in Cloud Console
  - "invalid_client": wrong client_secret.json → re-download from Cloud Console
"""

import http.server
import json
import pathlib
import socket
import sys
import threading
import urllib.parse
import webbrowser

try:
    import requests
except ImportError:
    print("Run: pip install requests")
    sys.exit(1)

SECRET_FILE = pathlib.Path(__file__).parent / "client_secret.json"
SCOPE = "https://www.googleapis.com/auth/blogger"


def _find_free_port() -> int:
    with socket.socket() as s:
        s.bind(("", 0))
        return s.getsockname()[1]


class _CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        self.server.auth_code = params.get("code", [None])[0]
        self.server.error = params.get("error", [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(b"<h2>Authorization received. You can close this tab.</h2>")
        threading.Thread(target=self.server.shutdown, daemon=True).start()

    def log_message(self, fmt, *args):
        pass  # suppress HTTP request logs


def main() -> None:
    if not SECRET_FILE.exists():
        print(f"\nclient_secret.json not found at {SECRET_FILE}")
        print("Download it from Google Cloud Console → Credentials → your Desktop app client → Download JSON")
        sys.exit(1)

    raw = json.loads(SECRET_FILE.read_text())
    # Supports both "installed" (Desktop) and "web" key formats
    app_cfg = raw.get("installed") or raw.get("web")
    if not app_cfg:
        print("Unexpected client_secret.json format. Expected 'installed' or 'web' key.")
        sys.exit(1)

    client_id = app_cfg["client_id"]
    client_secret = app_cfg["client_secret"]

    port = _find_free_port()
    redirect_uri = f"http://localhost:{port}"

    server = http.server.HTTPServer(("localhost", port), _CallbackHandler)
    server.auth_code = None
    server.error = None

    auth_url = "https://accounts.google.com/o/oauth2/auth?" + urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "select_account consent",
    })

    print("\nOpening browser for Google authorization...")
    print("If the browser does not open, go to:\n")
    print(auth_url)
    webbrowser.open(auth_url)

    print(f"\nWaiting for callback on http://localhost:{port} ...")
    server.handle_request()  # blocks until one request comes in

    if server.error:
        print(f"\nAuthorization denied or error: {server.error}")
        sys.exit(1)

    code = server.auth_code
    if not code:
        print("\nNo authorization code received.")
        sys.exit(1)

    resp = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    })

    if resp.status_code != 200:
        print(f"\nToken exchange failed ({resp.status_code}): {resp.text}")
        sys.exit(1)

    tokens = resp.json()
    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        print(
            "\nNo refresh_token in response.\n"
            "This usually means access was already granted before without 'prompt=consent'.\n"
            "Go to https://myaccount.google.com/permissions → revoke access for this app → re-run."
        )
        sys.exit(1)

    print("\n[OK] Authorization successful! Set these on Railway:\n")
    print(f"  railway variables set BLOGGER_CLIENT_ID={client_id}")
    print(f"  railway variables set BLOGGER_CLIENT_SECRET={client_secret}")
    print(f"  railway variables set BLOGGER_REFRESH_TOKEN={refresh_token}")
    print("\n[NOTE] If your OAuth app is in 'Testing' mode, this token expires in 7 days.")
    print("   Go to Google Cloud Console → OAuth consent screen → change to 'Production' for permanent tokens.")
    print("\n  BLOGGER_BLOG_ID=<find at blogger.com → select blog → URL bar shows /blog/posts/<ID>>")


if __name__ == "__main__":
    main()
