# Helper script to replace health section after workflow completes
import json, sys

def replace_section(filepath, section_start_marker, section_end_marker, new_content):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    start = content.find(section_start_marker)
    end = content.find(section_end_marker)
    if start == -1 or end == -1:
        print(f"ERROR: Could not find markers in {filepath}")
        return False

    old = content[start:end]
    new_content_with_marker = section_start_marker + '\n' + new_content
    new_file = content[:start] + new_content_with_marker + content[end:]

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_file)

    print(f"{filepath}: {len(old)} chars -> {len(new_content_with_marker)} chars")
    return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: rewrite_health.py <workflow_output.json>")
        sys.exit(1)

    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)

    result = data['result'] if 'result' in data else data
    articles = result.get('articles', [])

    # Build new section text
    lines = []
    for a in articles:
        key = a['key']
        title = a['title'].replace('\\', '\\\\').replace('"', '\\"')
        source = a['source'].replace('\\', '\\\\').replace('"', '\\"')
        text = a['text'].replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ')
        image = a.get('image', '')
        imageCap = a.get('imageCaption', '')

        entry = '"' + key + '":{title:"' + title + '",source:"' + source + '",text:"' + text + '"'
        if image:
            entry += ',image:"' + image.replace('\\', '\\\\').replace('"', '\\"') + '"'
        if imageCap:
            entry += ',imageCaption:"' + imageCap.replace('\\', '\\\\').replace('"', '\\"') + '"'
        entry += '},'
        lines.append(entry)

    new_section = '\n'.join(lines) + '\n'

    replace_section('articles.js', '// ===== 健康', '// ===== 生活', new_section)
    replace_section('gap-share.html', '// ===== 健康', '// ===== 生活', new_section)

    print(f"Done! {len(articles)} articles written.")
