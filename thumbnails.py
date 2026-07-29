import json, urllib.request, urllib.parse, re, time

def get_thumb_url(filename, width=500):
    """Get a properly sized Wikimedia thumbnail URL."""
    params = {
        'action': 'query',
        'titles': 'File:' + filename,
        'prop': 'imageinfo',
        'iiprop': 'url',
        'iiurlwidth': str(width),
        'format': 'json'
    }
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params) + '&origin=*'
    req = urllib.request.Request(url, headers={'User-Agent': 'GapApp/1.0'})
    try:
        res = urllib.request.urlopen(req, timeout=15)
        data = json.loads(res.read())
        pages = data.get('query', {}).get('pages', {})
        for page_id, page in pages.items():
            info = page.get('imageinfo', [{}])[0]
            return info.get('thumburl', '')
    except:
        return ''

# Extract all Wikimedia URLs from articles.js and convert to thumbnails
with open('articles.js', 'r', encoding='utf-8') as f:
    js = f.read()

wikimedia_urls = re.findall(r'https://commons\.wikimedia\.org/wiki/Special:FilePath/([^\"]+)', js)
print(f'Found {len(wikimedia_urls)} Wikimedia URLs')

thumb_map = {}
for i, fname in enumerate(wikimedia_urls):
    decoded = urllib.parse.unquote(fname)
    print(f'  [{i+1}/{len(wikimedia_urls)}] {decoded[:50]}...')
    thumb = get_thumb_url(decoded, 500)
    if thumb:
        thumb_map[fname] = thumb
        print(f'    -> {thumb[:70]}...')
    else:
        print(f'    -> FAILED')
    time.sleep(0.5)

# Replace URLs
for original, thumb in thumb_map.items():
    encoded_original = urllib.parse.quote(original, safe='/:?=&')
    js = js.replace('https://commons.wikimedia.org/wiki/Special:FilePath/' + original, thumb)

with open('articles.js', 'w', encoding='utf-8') as f:
    f.write(js)
print(f'\nUpdated articles.js with {len(thumb_map)} thumbnail URLs')

# Same for gap-share.html
with open('gap-share.html', 'r', encoding='utf-8') as f:
    html = f.read()

for original, thumb in thumb_map.items():
    html = html.replace('https://commons.wikimedia.org/wiki/Special:FilePath/' + original, thumb)

with open('gap-share.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Updated gap-share.html')
