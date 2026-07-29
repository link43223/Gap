import json, subprocess

with open(r'C:\Users\lyen\AppData\Local\Temp\claude\C--Users-lyen\fab6598f-db14-4aae-a2fd-3979e3126a2b\tasks\w1nyig112.output', 'r', encoding='utf-8') as f:
    data = json.load(f)

arts = data['result']['articles']
print(f'Got {len(arts)} articles')

cn_titles = {
    'gaming': 'GTA 6 发售在即',
    'gaming-2': '索尼2028年停售实体光盘',
    'gaming-3': 'Switch 2 推可换电池版',
    'gaming-4': '游戏订阅服务的崛起',
    'gaming-5': '电竞世界杯2026登陆巴黎',
    'gaming-6': '云游戏时代到来',
    'gaming-7': '独立游戏蓬勃发展',
    'gaming-8': 'AI重塑游戏开发',
    'gaming-9': '手游全球霸主地位',
    'gaming-10': '游戏全面数字化未来',
}

entries = []
for a in arts:
    key = a['key']
    title = a['title'].replace('\\', '\\\\').replace('"', '\\"')
    src = a['source'].replace('\\', '\\\\').replace('"', '\\"')
    txt = a['text'].replace('\n', ' ').replace('\\', '\\\\').replace('"', '\\"')
    cn = cn_titles.get(key, '')
    entry = '"{}":{{title:"{}",titleCn:"{}",source:"{}",text:"{}"}},'.format(key, title, cn, src, txt)
    entries.append(entry)

new_section = '// ===== 游戏\n' + '\n'.join(entries) + '\n'

for fname in ['articles.js', 'gap-share.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    gaming_start = content.find('// ===== 游戏')
    if gaming_start > 0:
        next_section = content.find('// =====', gaming_start + 10)
        if next_section > gaming_start:
            content = content[:gaming_start] + new_section + content[next_section:]
        else:
            close = content.rfind('};')
            if close > gaming_start:
                content = content[:gaming_start] + new_section + '};'
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)
    print(fname + ': updated')

r = subprocess.run(['node', '-e', 'var fs=require("fs"); try { new Function(fs.readFileSync("articles.js","utf8")); console.log("OK"); } catch(e) { console.log("ERROR"); }'], capture_output=True, text=True)
print('Verify:', r.stdout.strip())
