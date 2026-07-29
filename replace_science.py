import json
import re

# Read the rewritten articles from the output file
with open(r'C:\Users\lyen\AppData\Local\Temp\claude\C--Users-lyen\fab6598f-db14-4aae-a2fd-3979e3126a2b\tasks\wot3q3cdr.output', 'r', encoding='utf-8') as f:
    output_data = json.load(f)

articles = output_data['result']['articles']
print(f"Got {len(articles)} rewritten articles")

# Build the new science section string
lines = ['// ===== 科学科技']
for a in articles:
    key = a['key']
    title = a['title'].replace('\\', '\\\\').replace('"', '\\"')
    source = a['source'].replace('\\', '\\\\').replace('"', '\\"')
    text = a['text'].replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ')
    line = '"' + key + '":{title:"' + title + '",source:"' + source + '",text:"' + text + '"},'
    lines.append(line)

new_science = '\n'.join(lines) + '\n'
print(f"New science section: {len(new_science)} chars")

# Read articles.js
with open('articles.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

# Find the science section boundaries
section_start = js_content.find('// ===== 科学科技')
health_marker = '// ===== 健康'
science_end = js_content.find(health_marker)

if section_start == -1 or science_end == -1:
    print("ERROR: Could not find section boundaries")
    exit(1)

old_section = js_content[section_start:science_end]
new_js = js_content[:section_start] + new_science + js_content[science_end:]

with open('articles.js', 'w', encoding='utf-8') as f:
    f.write(new_js)

print(f"articles.js updated! Old: {len(old_section)} chars, New: {len(new_science)} chars")
print("Done!")
