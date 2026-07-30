# Gap 本地服务器 - 提供文件服务 + /save 接口
# 启动: python server.py
# 访问: http://localhost:3000

import http.server
import json
import os
import re
import urllib.parse

DIR = os.path.dirname(os.path.abspath(__file__))
ARTICLES_FILE = os.path.join(DIR, "articles.js")
GAP_SHARE_FILE = os.path.join(DIR, "gap-share.html")

class GapHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length else "{}"
        data = json.loads(body) if body else {}

        if path == "/save":
            result = self.handle_save(data)
        elif path == "/verify-key":
            result = self.handle_verify(data)
        else:
            result = {"ok": False, "error": "unknown path"}

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode("utf-8"))

    def handle_verify(self, data):
        key = data.get("key", "")
        if key == "Gap053027":
            return {"ok": True}
        return {"ok": False, "error": "密钥错误"}

    def handle_save(self, data):
        key = data.get("key", "")
        if key != "Gap053027":
            return {"ok": False, "error": "密钥错误"}

        article_key = data.get("key", "")
        title = data.get("title")
        titleCn = data.get("titleCn")
        source = data.get("source")
        text = data.get("text")
        image = data.get("image")

        if not article_key:
            return {"ok": False, "error": "缺少文章key"}

        for fname in [ARTICLES_FILE, GAP_SHARE_FILE]:
            if not os.path.exists(fname):
                continue
            with open(fname, "r", encoding="utf-8") as f:
                content = f.read()

            # Find the article entry
            pattern = '"' + article_key + '":{'
            start = content.find(pattern)
            if start < 0:
                return {"ok": False, "error": f"未找到文章 {article_key}"}

            # Find the entry boundaries
            end = content.find("},", start)
            entry = content[start:end + 2]

            # Update fields
            new_entry = entry
            if title is not None:
                new_entry = re.sub(r'title:"[^"]*"', 'title:"' + self.escape(title) + '"', new_entry)
            if titleCn is not None:
                if 'titleCn:"' in new_entry:
                    new_entry = re.sub(r'titleCn:"[^"]*"', 'titleCn:"' + self.escape(titleCn) + '"', new_entry)
                else:
                    new_entry = new_entry.replace('title:"', 'title:"' + ',titleCn:"' + self.escape(titleCn) + '"')
                    # Actually that's wrong, let me fix
                    new_entry = entry
                    if title is not None:
                        new_entry = re.sub(r'title:"[^"]*"', 'title:"' + self.escape(title) + '"', entry)
                    new_entry = re.sub(r'(title:"[^"]*")', r'\1,titleCn:"' + self.escape(titleCn) + '"', new_entry)
            if source is not None:
                new_entry = re.sub(r'source:"[^"]*"', 'source:"' + self.escape(source) + '"', new_entry)
            if text is not None:
                new_entry = re.sub(r'text:"[^"]*"', 'text:"' + self.escape(text) + '"', new_entry)
            if image is not None:
                if 'image:"' in new_entry:
                    new_entry = re.sub(r'image:"[^"]*"', 'image:"' + self.escape(image) + '"', new_entry)
                else:
                    before = new_entry.rstrip().rstrip(",").rstrip("}")
                    comma = "," if new_entry.rstrip().endswith(",") else ""
                    new_entry = before + ',image:"' + self.escape(image) + '"' + comma + "}"

            content = content.replace(entry, new_entry, 1)

            with open(fname, "w", encoding="utf-8") as f:
                f.write(content)

        return {"ok": True, "message": f"{article_key} 已保存"}

    def escape(self, s):
        return s.replace("\\", "\\\\").replace('"', '\\"')

    def log_message(self, format, *args):
        print(f"[Gap] {args[0]} {args[1]} {args[2]}")


if __name__ == "__main__":
    port = 3000
    server = http.server.HTTPServer(("0.0.0.0", port), GapHandler)
    print(f"Gap 服务器启动: http://localhost:{port}")
    print(f"管理接口: POST /save (需密钥)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已关闭")
