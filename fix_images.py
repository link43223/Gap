import json, urllib.request, urllib.parse, re, sys, time

def search_wikimedia(query, max_results=3):
    """Search Wikimedia Commons for free images matching the query."""
    params = {
        'action': 'query',
        'list': 'search',
        'srsearch': query + ' filetype:image',
        'format': 'json',
        'srlimit': max_results,
        'srnamespace': '6'
    }
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params) + '&origin=*'
    req = urllib.request.Request(url, headers={'User-Agent': 'GapApp/1.0'})
    try:
        res = urllib.request.urlopen(req, timeout=15)
        data = json.loads(res.read())
        return [r['title'].replace('File:', '') for r in data.get('query', {}).get('search', [])]
    except Exception as e:
        print(f'  Search error: {e}')
        return []

def get_image_url(filename):
    """Get direct URL for a Wikimedia Commons file."""
    clean = filename.replace(' ', '_')
    encoded = clean
    try:
        encoded = urllib.parse.quote(clean, safe='_.()/- ')
    except:
        pass
    encoded = encoded.replace(' ', '_')
    return f'https://commons.wikimedia.org/wiki/Special:FilePath/{encoded}'

# Article topics to search images for
article_images = {
    'health': 'Sleep medicine bedroom',
    'health-2': 'Brain MRI dementia',
    'health-3': 'Reading book library',
    'health-4': 'Ultra-processed food junk food',
    'health-5': 'Stress cortisol anxiety',
    'health-6': 'Vitamin supplements pill',
    'health-7': 'GLP-1 weight loss obesity medicine',
    'health-8': 'Meditation yoga mindfulness',
    'health-9': 'Lungs respiratory breathing',
    'health-10': 'Allergy pollen sneeze',
    'health-11': 'Dreaming sleep brain REM',
    'health-12': 'Antibiotic resistance bacteria',
    'health-13': 'Antibiotic bacteria infection',
    'health-14': 'Fever temperature thermometer',
    'health-15': 'Air pollution smog city',
    'health-16': 'Alzheimer brain elderly',
    'health-17': 'Stretching flexibility exercise',
    'health-18': 'Wound healing bandage',
    'health-19': 'Music therapy headphones',
    'health-20': 'Vaccine mRNA vaccination',
    'health-21': 'Cancer immunotherapy treatment',
}

print('Searching Wikimedia Commons for real images...')
for key, query in article_images.items():
    time.sleep(1)  # Avoid rate limiting
    results = search_wikimedia(query)
    if results:
        url = get_image_url(results[0])
        print(f'{key}: {results[0][:60]}...')
        article_images[key] = url
    else:
        print(f'{key}: NO RESULTS FOUND')
        article_images[key] = ''

# Now update articles.js
with open('articles.js', 'r', encoding='utf-8') as f:
    js = f.read()

for key, img_url in article_images.items():
    if not img_url:
        continue

    # Find the article entry
    pattern = '("' + key + '":\\{[^}]+?)image:"[^"]*"'
    replacement = '\\1image:"' + img_url + '"'
    js = re.sub(pattern, replacement, js)

    # Also add image field if it doesn't exist
    # Check if image: exists
    key_match = re.search(rf'"{key}":\{{', js)
    if key_match:
        entry_start = key_match.start()
        entry_end = js.find('},', entry_start)
        entry = js[entry_start:entry_end + 2]
        if 'image:"' not in entry:
            new_entry = entry.rstrip(',') + ',image:"' + img_url + '"'
            if entry.endswith(',}'):
                new_entry += '}'
            elif entry.endswith('},'):
                new_entry += '},'
            js = js[:entry_start] + new_entry + js[entry_end + 2:]
            print(f'  Added image to {key}')

with open('articles.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('\narticles.js updated!')

# Same for gap-share.html
with open('gap-share.html', 'r', encoding='utf-8') as f:
    html = f.read()

for key, img_url in article_images.items():
    if not img_url:
        continue
    pattern = '("' + key + '":\\{[^}]+?)image:"[^"]*"'
    replacement = '\\1image:"' + img_url + '"'
    html = re.sub(pattern, replacement, html)

with open('gap-share.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('gap-share.html updated!')
