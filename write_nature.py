import json, re, subprocess, sys

with open(r'C:\Users\lyen\AppData\Local\Temp\claude\C--Users-lyen\fab6598f-db14-4aae-a2fd-3979e3126a2b\tasks\whb3u7tao.output', 'r', encoding='utf-8') as f:
    data = json.load(f)

arts = data['result']['articles']
print(f'Got {len(arts)} nature articles')

# Build new section
lines = ['// ===== 自然']
for a in arts:
    key = a['key']
    title = a['title'].replace('\\', '\\\\').replace('"', '\\"')
    src = a['source'].replace('\\', '\\\\').replace('"', '\\"')
    txt = a['text'].replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ')
    line = '"' + key + '":{title:"' + title + '",source:"' + src + '",text:"' + txt + '"},'
    lines.append(line)

new_section = '\n'.join(lines) + '\n'

for fname in ['articles.js', 'gap-share.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()

    nature_start = content.find('// ===== 自然')
    if nature_start == -1:
        print(f'ERROR: Could not find nature section in {fname}')
        continue

    # Nature is the last section, find the closing };
    close_pos = content.rfind('};')
    if close_pos > nature_start:
        section_end = close_pos + 2
    else:
        section_end = len(content)

    updated = content[:nature_start] + new_section + '};'
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(updated)
    print(f'{fname}: updated ({len(updated)} chars)')

# Verify
r = subprocess.run(['node', '-e', 'try { new Function(require("fs").readFileSync("articles.js","utf8")); console.log("OK"); } catch(e) { console.log("ERROR", e.message.substring(0,80)); }'], capture_output=True, text=True)
print('articles.js:', r.stdout.strip())
if r.stderr: print('stderr:', r.stderr.strip()[:100])
