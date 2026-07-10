"""
One-time OAuth2 setup to get a WordPress.com access token.

Prerequisites (local only -- NOT needed on Railway):
  pip install requests

Steps:
  1. Go to https://developer.wordpress.com/apps/new/ and register an app:
       - Website URL: https://ai119.netlify.app
       - Redirect URL: http://localhost:8891   (must match exactly)
       - Type: Web
  2. Copy the Client ID and Client Secret shown after creating the app.
  3. Run: python setup_wordpress_auth.py
  4. Browser opens -> sign in with the WordPress.com account that owns the target blog
  5. Copy the printed env vars to Railway / backend/.env

Notes:
  - WordPress.com access tokens do NOT expire (unless revoked), so there is no
    refresh-token step here -- this script only needs to run once per target site.
  - SITE is the site ID or domain of the target blog, e.g. your-blog.wordpress.com
"""

import http.server
import os
import sys
import threading
import urllib.parse
import webbrowser

try:
    import requests
except ImportError:
    print("Run: pip install requests")
    sys.exit(1)

PORT = 8891
REDIRECT_URI = f"http://localhost:{PORT}"
AUTH_URL = "https://public-api.wordpress.com/oauth2/authorize"
TOKEN_URL = "https://public-api.wordpress.com/oauth2/token"


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
    # Reads from env vars if set (WP_CLIENT_ID / WP_CLIENT_SECRET / WP_TARGET) so this
    # can be run non-interactively without echoing the secret to the terminal history;
    # falls back to interactive prompts otherwise.
    client_id = os.environ.get("WP_CLIENT_ID") or input("Client ID (from developer.wordpress.com/apps/): ").strip()
    client_secret = os.environ.get("WP_CLIENT_SECRET") or input("Client Secret: ").strip()

    server = http.server.HTTPServer(("localhost", PORT), _CallbackHandler)
    server.auth_code = None
    server.error = None

    auth_url = AUTH_URL + "?" + urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "global",
    })

    print("\nOpening browser for WordPress.com authorization...")
    print("If the browser does not open, go to:\n")
    print(auth_url)
    webbrowser.open(auth_url)

    print(f"\nWaiting for callback on {REDIRECT_URI} ...")
    server.handle_request()  # blocks until one request comes in

    if server.error:
        print(f"\nAuthorization denied or error: {server.error}")
        sys.exit(1)

    code = server.auth_code
    if not code:
        print("\nNo authorization code received.")
        sys.exit(1)

    resp = requests.post(TOKEN_URL, data={
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    })

    if resp.status_code != 200:
        print(f"\nToken exchange failed ({resp.status_code}): {resp.text}")
        sys.exit(1)

    tokens = resp.json()
    access_token = tokens.get("access_token")
    if not access_token:
        print(f"\nNo access_token in response: {tokens}")
        sys.exit(1)

    target = os.environ.get("WP_TARGET") or input("\nWhich target is this for? (trending/classics) [classics]: ").strip() or "classics"
    prefix = f"WORDPRESS_{target.upper()}"

    print("\n[OK] Authorization successful! Set these on Railway (and backend/.env for local dev):\n")
    print(f"  railway variables set {prefix}_ACCESS_TOKEN={access_token}")
    print(f"  railway variables set {prefix}_SITE=<your-blog>.wordpress.com")
    print("\n[NOTE] Access tokens do not expire unless the app/access is revoked from")
    print("       https://wordpress.com/me/security/connected-applications")


if __name__ == "__main__":
    main()
