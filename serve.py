from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

directory = Path(__file__).resolve().parent / "docs"
handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
with ThreadingHTTPServer(("127.0.0.1", 8765), handler) as server:
    url = "http://localhost:8765/"
    print(f"Mercenaries Play Assistant is available at {url}", flush=True)
    webbrowser.open(url)
    server.serve_forever()
