import re, subprocess

for fname in ['articles.js', 'gap-share.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    # Fix: titleCn:"..."source:  ->  titleCn:"...",source:
    content = re.sub(r'titleCn:\"([^\"]*)\"source:', r'titleCn:"\1",source:', content)
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)
    print(fname + ': fixed')

r = subprocess.run(['node', '-e', 'try { new Function(require("fs").readFileSync("articles.js","utf8")); console.log("OK"); } catch(e) { console.log("ERROR", e.message.substring(0,80)); }'], capture_output=True, text=True)
print('Verify:', r.stdout.strip())
