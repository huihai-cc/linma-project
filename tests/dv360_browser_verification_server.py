from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
AUTH_STUB = b"""
function getSession(){return {token:'local-browser-verification',user:{name:'Local Browser Test',email:'local@test.invalid'}};}
function getUser(){return getSession().user;}
function checkAuth(){return getUser();}
function guardPage(){return getUser();}
function logout(){}
async function sendLog(){return {ok:true};}
"""


class VerificationHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/qc-auth.js":
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(AUTH_STUB)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(AUTH_STUB)
            return
        super().do_GET()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    ThreadingHTTPServer(("127.0.0.1", port), VerificationHandler).serve_forever()
