import json, urllib.request, urllib.parse, time, re, subprocess

def search_wiki(query, delay=2.5):
    params = {'action': 'query', 'list': 'search', 'srsearch': query + ' filetype:image', 'format': 'json', 'srlimit': 5, 'srnamespace': '6'}
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params) + '&origin=*'
    time.sleep(delay)
    try:
        res = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'GapApp/1.0'}), timeout=15)
        data = json.loads(res.read())
        return [r['title'].replace('File:', '') for r in data.get('query', {}).get('search', [])]
    except:
        return []

def get_thumb(filename, width=500):
    params = {'action': 'query', 'titles': 'File:' + filename, 'prop': 'imageinfo', 'iiprop': 'url', 'iiurlwidth': str(width), 'format': 'json'}
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params) + '&origin=*'
    time.sleep(1.2)
    try:
        res = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'GapApp/1.0'}), timeout=10)
        data = json.loads(res.read())
        for pid, pg in data.get('query', {}).get('pages', {}).items():
            if 'imageinfo' in pg:
                return pg['imageinfo'][0].get('thumburl', '')
    except:
        return ''

# Find articles in current files that lack image field
with open('articles.js', 'r', encoding='utf-8') as f:
    js = f.read()

remaining = []
for topic in ['science', 'nature', 'life', 'culture']:
    for i in range(1, 26):
        key = topic if i == 1 else topic + '-' + str(i)
        pattern = '"' + key + '":{'
        pos = js.find(pattern)
        if pos > 0:
            end = js.find('},', pos)
            if end > 0:
                entry = js[pos:end+2]
                if 'image:"' not in entry:
                    remaining.append(key)

print(f'Articles without images: {len(remaining)}')

# Better search queries
alt_queries = {
    'science-6': 'Black hole space astronomy',
    'science-7': 'Vaccine syringe injection',
    'science-8': 'Internet server network',
    'science-9': 'Milky way galaxy stars',
    'science-10': 'GPS satellite navigation',
    'science-11': 'DNA double helix',
    'science-12': 'Airplane aircraft wing',
    'science-13': 'Artificial intelligence robot',
    'science-14': 'Light prism spectrum',
    'science-15': '3D printer object',
    'science-21': 'Popcorn food snack',
    'science-22': 'CERN particle accelerator',
    'science-23': 'Microwave oven kitchen',
    'science-24': 'Space rocket launch',
    'science-25': 'Earth planet globe',
    'nature': 'Honey bee insect flower',
    'nature-2': 'Coral reef ocean fish',
    'nature-3': 'Water cycle rain',
    'nature-4': 'Monarch butterfly insect',
    'nature-5': 'Volcano eruption lava',
    'nature-6': 'Ocean sea waves',
    'nature-7': 'Forest tree green',
    'nature-13': 'Lightning sky storm',
    'nature-14': 'Mushroom fungi forest',
    'nature-15': 'Glacier ice snow',
    'nature-16': 'Honeybee wax comb',
    'nature-17': 'Cheetah wild cat',
    'nature-18': 'Climate change earth',
    'nature-19': 'Plastic ocean pollution',
    'nature-20': 'Dolphin sea mammal',
    'nature-21': 'Gecko lizard reptile',
    'nature-22': 'Desert sand sand dunes',
    'nature-23': 'Endangered species animals',
    'life': 'Sunrise morning coffee',
    'life-4': 'Clock time deadline',
    'life-5': 'Notebook journal writing',
    'life-6': 'Bed sleep bedroom',
    'life-7': 'Stage presentation speech',
    'life-8': 'Question mark help',
    'life-9': 'Minimalist room interior',
    'life-10': 'Calendar schedule planner',
    'life-11': 'Hobby painting art',
    'life-12': 'Email computer screen',
    'life-13': 'Books learning language',
    'life-14': 'Conversation talk discussion',
    'life-15': 'Travel backpack map',
    'life-16': 'Clock alarm timer',
    'life-18': 'Handshake apologize sorry',
    'life-19': 'Multitasking phone computer',
    'life-21': 'Brain mind intelligence',
    'life-23': 'Piano music keyboard',
    'life-24': 'Debate argument talk',
    'life-25': 'Volunteer helping community',
    'culture': 'Handshake business deal',
    'culture-2': 'Tea ceremony china',
    'culture-3': 'Birthday cake candles',
    'culture-4': 'Chocolate bar sweet',
    'culture-5': 'Olympic rings games',
    'culture-6': 'Orchestra music concert',
    'culture-7': 'Book story reading',
    'culture-8': 'Coins money currency',
    'culture-9': 'Bonsai tree miniature',
    'culture-15': 'Smartphone social media',
    'culture-16': 'Ancient scroll manuscript',
    'culture-17': 'Halloween pumpkin lantern',
    'culture-18': 'Great Wall China',
    'culture-19': 'Knight hero armor',
    'culture-20': 'Number zero digit',
    'culture-21': 'Silk Road camel',
    'culture-22': 'Chess board king',
    'culture-23': 'Stonehenge standing stones',
    'culture-24': 'Eiffel Tower Paris',
    'culture-25': 'Paper texture vintage',
}

found = 0
for key in remaining:
    query = alt_queries.get(key, key)
    qstr = query.replace('-', ' ') if len(query) < 5 else query
    files = search_wiki(qstr, delay=2.5)
    if not files:
        print(f'  SKIP: {key}')
        continue
    thumb = get_thumb(files[0], 500)
    if not thumb:
        print(f'  NO THUMB: {key}')
        continue
    found += 1
    # Write to both files
    for fname in ['articles.js', 'gap-share.html']:
        with open(fname, 'r', encoding='utf-8') as f:
            content = f.read()
        pattern = '"' + key + '":{'
        pos = content.find(pattern)
        if pos < 0:
            continue
        end = content.find('},', pos)
        if end < 0:
            continue
        entry = content[pos:end+2]
        if 'image:"' in entry:
            continue
        # Add image before trailing }
        insert = entry.rstrip().rstrip(',').rstrip('}')
        replacement = insert + ',image:"' + thumb + '"}'
        if entry.endswith('},'):
            replacement += ','
        content = content.replace(entry, replacement, 1)
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(content)
    print(f'  OK: {key}')

print(f'Found {found}/{len(remaining)}')

r = subprocess.run(['node', '-e', 'try { new Function(require("fs").readFileSync("articles.js","utf8")); console.log("OK"); } catch(e) { console.log("ERROR", e.message.substring(0,80)); }'], capture_output=True, text=True)
print('Verify:', r.stdout.strip())
