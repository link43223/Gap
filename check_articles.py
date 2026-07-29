import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('articles.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Extract science section
start = js.find('// ===== 科学科技')
end = js.find('// ===== 健康')
section = js[start:end]

# Check for problem patterns
print(f"Science section: {len(section)} chars")

# Find the line with science-7 (vaccines) - it had a 'duplicate' in the source
# Also check for any unescaped quotes that would break JS
import re

# Find all text field contents and check for issues
articles = re.findall(r'text:"([^"]*)"', section)
print(f"Articles parsed with simple regex: {len(articles)}")

if len(articles) < 25:
    print("SOME ARTICLES ARE BROKEN - text field has unescaped quotes!")
    # Find problematic lines
    lines = section.split('\n')
    for i, line in enumerate(lines):
        if 'text:"' in line:
            # Count escaped vs unescaped quotes
            in_text = False
            quote_count = 0
            j = 0
            while j < len(line):
                if line[j] == '"':
                    if j > 0 and line[j-1] == '\\':
                        j += 1
                        continue
                    quote_count += 1
                j += 1
            if quote_count != 6:  # 6 = title:"", source:"", text:""
                print(f"  Line {i+1}: {quote_count} quotes - {line[:120]}...")
else:
    print("All 25 articles parsed correctly")

# Check for non-ASCII characters that might cause issues
non_ascii = sum(1 for c in section if ord(c) > 127)
print(f"Non-ASCII chars: {non_ascii}")
if non_ascii > 0:
    # Show some
    special = [c for c in section if ord(c) > 127][:20]
    print(f"  Examples: {special}")
