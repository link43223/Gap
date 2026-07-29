import json, subprocess

with open(r'C:\Users\lyen\AppData\Local\Temp\claude\C--Users-lyen\fab6598f-db14-4aae-a2fd-3979e3126a2b\tasks\wyijge85m.output', 'r', encoding='utf-8') as f:
    data = json.load(f)

arts = data['result']['articles']
print(f'Got {len(arts)} articles: life={sum(1 for a in arts if a["key"].startswith("life"))}, culture={sum(1 for a in arts if a["key"].startswith("culture"))}')

# Build sections
sections = {}
for a in arts:
    key = a['key']
    topic = key.split('-')[0]
    if topic == 'life': topic_key = '生活'
    elif topic == 'culture': topic_key = '文化'
    else: continue

    if topic_key not in sections:
        sections[topic_key] = []

    title = a['title'].replace('\\', '\\\\').replace('"', '\\"')
    src = a['source'].replace('\\', '\\\\').replace('"', '\\"')
    txt = a['text'].replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ')
    entry = '"' + key + '":{title:"' + title + '",source:"' + src + '",text:"' + txt + '"},'
    sections[topic_key].append(entry)

for fname in ['articles.js', 'gap-share.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()

    for topic_key, entries in sections.items():
        marker = '// ===== ' + topic_key
        start = content.find(marker)
        if start == -1:
            print(f'ERROR: {marker} not found in {fname}')
            continue

        # Find end of this section
        rest = content[start + len(marker):]
        next_marker_pos = len(content)
        for m in ['// ===== 科学', '// ===== 健康', '// ===== 生活', '// ===== 文化', '// ===== 自然']:
            p = content.find(m, start + len(marker) + 1)
            if p > 0 and p < next_marker_pos:
                next_marker_pos = p

        new_section_text = '\n'.join(entries) + '\n'
        content = content[:start + len(marker) + 1] + '\n' + new_section_text + content[next_marker_pos:]

    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'{fname}: updated ({len(content)} chars)')

# Verify
r = subprocess.run(['node', '-e', 'try { new Function(require("fs").readFileSync("articles.js","utf8")); console.log("OK"); } catch(e) { console.log("ERROR", e.message.substring(0,80)); }'], capture_output=True, text=True)
print('articles.js:', r.stdout.strip())
if r.stderr: print('stderr:', r.stderr[:100])
