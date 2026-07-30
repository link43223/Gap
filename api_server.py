import http.server, json, re, os

DIR = r"C:\Users\lyen\english-app"
KEY = "Gap053027"

class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8")
        data = json.loads(body) if body else {}
        path = self.path
        if path == "/verify-key":
            ok = data.get("key") == KEY
            self.r({"ok": ok, "error": None if ok else "密钥错误"})
        elif path == "/save":
            if data.get("key") != KEY: self.r({"ok": False, "error": "密钥错误"}); return
            self.r(self.save(data))
        else:
            self.r({"ok": False, "error": "not found"})
    def save(self, data):
        key = data.get("article_key", "")
        if not key: return {"ok": False, "error": "缺少key"}
        for fn in ["articles.js", "gap-share.html"]:
            fp = os.path.join(DIR, fn)
            if not os.path.exists(fp): continue
            with open(fp, "r", encoding="utf-8") as f:
                c = f.read()
            s = c.find('"' + key + '":{')
            if s < 0: return {"ok": False, "error": "未找到 " + key}
            e = c.find("},", s)
            old = c[s:e+2]
            n = old
            for field in ["title", "titleCn", "source", "text"]:
                v = data.get(field)
                if v is not None:
                    n = re.sub(r'(' + field + ':")([^"]*)(")', r'\1' + self.esc(v) + r'\3', n)
            v = data.get("image")
            if v is not None:
                if 'image:"' in n:
                    n = re.sub(r'image:"[^"]*"', 'image:"' + self.esc(v) + '"', n)
                else:
                    before = n.rstrip().rstrip(",").rstrip("}")
                    n = before + ',image:"' + self.esc(v) + '"}'
            c = c.replace(old, n, 1)
            with open(fp, "w", encoding="utf-8") as f:
                f.write(c)
        return {"ok": True, "message": key + " 已保存"}
    def esc(self, s):
        return s.replace("\\", "\\\\").replace('"', '\\"')
    def r(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))
    def log_message(self, fmt, *args):
        print(f"[API] {args[0]} {args[1]}")

PORT = 3002
print("API: http://localhost:" + str(PORT))
http.server.HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
