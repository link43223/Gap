import json, subprocess

with open(r'C:\Users\lyen\AppData\Local\Temp\claude\C--Users-lyen\fab6598f-db14-4aae-a2fd-3979e3126a2b\tasks\w4wcekzj8.output', 'r', encoding='utf-8') as f:
    data = json.load(f)

arts = data['result']['articles']
print(f'Got {len(arts)} articles')

# Fix keys
for a in arts:
    if a['key'] == 'sports-1': a['key'] = 'sports'
    if a['key'] == 'gaming-1': a['key'] = 'gaming'

sports_lines = ['// ===== 体育']
gaming_lines = ['// ===== 游戏']

for a in arts:
    key = a['key']
    t = a['title'].replace('\\', '\\\\').replace('"', '\\"')
    s = a['source'].replace('\\', '\\\\').replace('"', '\\"')
    x = a['text'].replace('\n', ' ').replace('\\', '\\\\').replace('"', '\\"')
    entry = '"' + key + '":{title:"' + t + '",source:"' + s + '",text:"' + x + '"},'
    if key.startswith('sports'):
        sports_lines.append(entry)
    else:
        gaming_lines.append(entry)

new_block = '\n'.join(sports_lines) + '\n\n' + '\n'.join(gaming_lines) + '\n'

for fname in ['articles.js', 'gap-share.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    sports_start = content.find('// ===== 体育')
    if sports_start > 0:
        content = content[:sports_start] + new_block + '\n};'
    else:
        close_pos = content.rfind('};')
        content = content[:close_pos] + '\n' + new_block + content[close_pos:]
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'{fname}: updated')

r = subprocess.run(['node', '-e', 'try { new Function(require("fs").readFileSync("articles.js","utf8")); console.log("OK"); } catch(e) { console.log("ERROR", e.message.substring(0,80)); }'], capture_output=True, text=True)
print('Verify:', r.stdout.strip())
