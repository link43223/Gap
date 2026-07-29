import json, subprocess

with open(r'C:\Users\lyen\AppData\Local\Temp\claude\C--Users-lyen\fab6598f-db14-4aae-a2fd-3979e3126a2b\tasks\wedb7rw38.output', 'r', encoding='utf-8') as f:
    data = json.load(f)

arts = data['result']['articles']
print(f'Got {len(arts)} articles')

lines = []
lines.append('')
lines.append('// ===== 体育')
for a in arts[:10]:
    key = a['key']
    title = a['title']
    src = a['source']
    txt = a['text'].replace('\n', ' ')

    # Escape for JavaScript string
    title = title.replace('\\', '\\\\').replace('"', '\\"')
    src = src.replace('\\', '\\\\').replace('"', '\\"')
    txt = txt.replace('\\', '\\\\').replace('"', '\\"')

    entry = '"{}":{{title:"{}",source:"{}",text:"{}"}},'.format(key, title, src, txt)
    lines.append(entry)

lines.append('')
lines.append('// ===== 游戏')
for a in arts[10:]:
    key = a['key']
    title = a['title'].replace('\\', '\\\\').replace('"', '\\"')
    src = a['source'].replace('\\', '\\\\').replace('"', '\\"')
    txt = a['text'].replace('\n', ' ').replace('\\', '\\\\').replace('"', '\\"')

    entry = '"{}":{{title:"{}",source:"{}",text:"{}"}},'.format(key, title, src, txt)
    lines.append(entry)

new_block = '\n'.join(lines)

for fname in ['articles.js', 'gap-share.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()

    close_pos = content.rfind('};')
    content = content[:close_pos] + new_block + '\n' + content[close_pos:]

    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'{fname}: updated')

r = subprocess.run(['node', '-e', 'try { new Function(require("fs").readFileSync("articles.js","utf8")); console.log("OK"); } catch(e) { console.log("ERROR", e.message.substring(0,80)); }'], capture_output=True, text=True)
print('Verify:', r.stdout.strip())
