"""
One-time OAuth2 setup to get a long-lived Facebook Page access token.

This app only has "Facebook Login for Business" configured (Meta's newer
setup), which requires a Login Configuration ID instead of a raw `scope`
param -- passing `scope=pages_manage_posts,...` directly gets rejected with
"Invalid Scopes" on these apps.

Prerequisites (local only -- NOT needed on Railway):
  pip install requests

Steps:
  1. In the app dashboard -> "비즈니스용 Facebook 로그인" (Facebook Login for
     Business) -> "구성" (Configurations) -> "구성 만들기", create a
     configuration (Asset type: Pages, Access token: User Access Token) with
     the pages_show_list / pages_manage_posts / pages_read_engagement
     permissions checked. Copy the resulting Configuration ID.
  2. If pages_manage_posts / pages_read_engagement aren't selectable yet, go
     to "앱 검토" (App Review) -> "권한 및 기능" (Permissions and Features) and
     enable them there first (no review needed for your own Page as the
     app's admin/developer), then edit the configuration to add them.
  3. localhost redirects are auto-allowed while the app is in Development
     mode, so no separate "Valid OAuth Redirect URIs" entry is needed.
  4. Run: python setup_facebook_auth.py
  5. Browser opens -> log in with the account that manages the target Page,
     grant the requested permissions.
  6. The script exchanges the short-lived user token for a long-lived one
     (~60 days), then lists your Pages with their (effectively non-expiring)
     Page Access Tokens.
  7. Copy the printed env vars to Railway / backend/.env.

Notes:
  - A Page Access Token derived from a long-lived User Access Token does not
    expire on its own as long as the user stays an admin of the Page and
    doesn't revoke the app's access. Still, re-run this script if posting
    ever starts failing with an auth error.
"""

import http.server
import json
import sys
import threading
import urllib.parse
import webbrowser

try:
    import requests
except ImportError:
    print("Run: pip install requests")
    sys.exit(1)

PORT = 8893
REDIRECT_URI = f"http://localhost:{PORT}/"
GRAPH_VERSION = "v21.0"
AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_VERSION}"


class _CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        self.server.auth_code = params.get("code", [None])[0]
        self.server.error = params.get("error_description", [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(b"<h2>Authorization received. You can close this tab.</h2>")
        threading.Thread(target=self.server.shutdown, daemon=True).start()

    def log_message(self, fmt, *args):
        pass


def main() -> None:
    print("\n=== Facebook Page Access Token Setup ===\n")
    app_id = input("App ID: ").strip()
    app_secret = input("App Secret: ").strip()
    config_id = input("Login Configuration ID: ").strip()

    server = http.server.HTTPServer(("localhost", PORT), _CallbackHandler)
    server.auth_code = None
    server.error = None

    auth_url = AUTH_URL + "?" + urllib.parse.urlencode({
        "client_id": app_id,
        "redirect_uri": REDIRECT_URI,
        "config_id": config_id,
        "response_type": "code",
    })

    print("\nOpening browser for Facebook authorization...")
    print("If the browser does not open, go to:\n")
    print(auth_url)
    webbrowser.open(auth_url)

    print(f"\nWaiting for callback on {REDIRECT_URI} ...")
    server.handle_request()

    if server.error:
        print(f"\nAuthorization denied or error: {server.error}")
        sys.exit(1)

    code = server.auth_code
    if not code:
        print("\nNo authorization code received.")
        sys.exit(1)

    # Step 1: exchange code -> short-lived user access token
    resp = requests.get(f"{GRAPH_BASE}/oauth/access_token", params={
        "client_id": app_id,
        "client_secret": app_secret,
        "redirect_uri": REDIRECT_URI,
        "code": code,
    })
    if resp.status_code != 200:
        print(f"\nToken exchange failed ({resp.status_code}): {resp.text}")
        sys.exit(1)
    short_token = resp.json().get("access_token")

    # Step 2: exchange short-lived -> long-lived user access token (~60 days)
    resp = requests.get(f"{GRAPH_BASE}/oauth/access_token", params={
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_token,
    })
    if resp.status_code != 200:
        print(f"\nLong-lived token exchange failed ({resp.status_code}): {resp.text}")
        sys.exit(1)
    long_token = resp.json().get("access_token")

    # Diagnostic: show which permissions were actually granted in the dialog.
    resp = requests.get(f"{GRAPH_BASE}/me/permissions", params={"access_token": long_token})
    if resp.status_code == 200:
        perms = resp.json().get("data", [])
        print("\n[DEBUG] Granted permissions:")
        for perm in perms:
            print(f"  - {perm.get('permission')}: {perm.get('status')}")
        if not any(p.get("permission") == "pages_show_list" and p.get("status") == "granted" for p in perms):
            print("\n  ^ pages_show_list is NOT granted -- this is why no Pages were found.")
            print("  Go back to the Login Configuration and make sure pages_show_list is")
            print("  checked in its permissions list, then save and re-run this script.")

    # Step 3: list Pages this user manages, with their Page Access Tokens
    resp = requests.get(f"{GRAPH_BASE}/me/accounts", params={"access_token": long_token})
    if resp.status_code != 200:
        print(f"\nFailed to list Pages ({resp.status_code}): {resp.text}")
        sys.exit(1)
    pages = resp.json().get("data", [])

    if not pages:
        print("\nNo Pages found for this account. Make sure you're an admin of the target Page.")
        sys.exit(1)

    print(f"\n[OK] Found {len(pages)} Page(s):\n")
    for i, p in enumerate(pages):
        print(f"  [{i}] {p['name']} (id={p['id']})")

    if len(pages) == 1:
        chosen = pages[0]
    else:
        idx = int(input("\nWhich Page to use? Enter number: ").strip())
        chosen = pages[idx]

    print(f"\n[OK] Set these on Railway (and backend/.env for local dev):\n")
    print(f"  railway variables set FACEBOOK_APP_ID={app_id}")
    print(f"  railway variables set FACEBOOK_APP_SECRET={app_secret}")
    print(f"  railway variables set FACEBOOK_PAGE_ID={chosen['id']}")
    print(f"  railway variables set FACEBOOK_PAGE_ACCESS_TOKEN={chosen['access_token']}")
    print(f"\n[NOTE] Page: {chosen['name']}")
    print("[NOTE] This Page Access Token does not expire unless the app's access")
    print("       to the Page is revoked, or you stop being an admin of the Page.")


if __name__ == "__main__":
    main()
