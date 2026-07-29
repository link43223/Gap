import urllib.request, urllib.parse, json, time, re, subprocess

# Map article keys to Wikipedia page titles
wiki_pages = {
    'science-8': 'Internet', 'science-9': 'Star', 'science-10': 'GPS',
    'science-11': 'DNA', 'science-12': 'Airplane', 'science-13': 'Artificial_intelligence',
    'science-14': 'Speed_of_light', 'science-15': '3D_printing',
    'science-21': 'Popcorn', 'science-22': 'Antimatter',
    'science-23': 'Microwave_oven', 'science-24': 'Space_exploration',
    'science-25': 'Season',
    'life': 'Morning', 'life-2': 'Reading_(process)',
    'life-8': 'Question', 'life-9': 'Minimalism', 'life-10': 'Time_management',
    'life-11': 'Hobby', 'life-12': 'Email', 'life-13': 'Language_acquisition',
    'life-14': 'Criticism', 'life-15': 'Travel', 'life-18': 'Apology',
    'life-21': 'Growth_mindset', 'life-22': 'Social_network',
    'life-23': 'Musical_instrument', 'life-24': 'Argument', 'life-25': 'Volunteering',
    'culture': 'Handshake', 'culture-2': 'Tea', 'culture-3': 'Birthday',
    'culture-9': 'Bonsai', 'culture-10': 'Coffee', 'culture-11': 'Golden_Rule',
    'culture-12': 'Body_language', 'culture-13': 'Fashion', 'culture-14': 'New_Year',
    'culture-15': 'Social_media', 'culture-16': 'Dead_Sea_Scrolls',
    'culture-22': 'Chess', 'culture-23': 'Stonehenge',
    'culture-24': 'Eiffel_Tower', 'culture-25': 'Paper',
    'nature': 'Bee', 'nature-2': 'Coral_reef',
    'nature-8': 'Aurora', 'nature-9': 'Octopus',
    'nature-10': 'Autumn_leaf_color', 'nature-11': 'Amazon_rainforest',
    'nature-12': 'Bird_migration', 'nature-13': 'Lightning', 'nature-14': 'Fungus',
    'nature-20': 'Dolphin', 'nature-21': 'Gecko', 'nature-22': 'Desert',
    'nature-23': 'Biodiversity_loss', 'nature-24': 'Renewable_energy',
    'nature-25': 'Corvus',
    'sports-2': 'Lionel_Messi', 'sports-3': 'NBA_Finals_Most_Valuable_Player_Award',
    'sports-4': 'NBA_All-Star_Game', 'sports-5': 'Victor_Wembanyama',
    'sports-6': 'National_Basketball_Association',
    'sports-7': '2028_Summer_Olympics',
    'sports-8': 'Esports', 'sports-9': 'Sports_technology',
    'sports-10': 'Marathon',
}

base_url = 'https://en.wikipedia.org/w/api.php'

def get_img(page_title, delay=2):
    params = {'action':'query','titles':page_title,'prop':'pageimages','pithumbsize':500,'format':'json','origin':'*'}
    url = base_url + '?' + urllib.parse.urlencode(params)
    time.sleep(delay)
    try:
        res = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'GapApp/1.0'}), timeout=20)
        data = json.loads(res.read())
        for pid, pg in data.get('query',{}).get('pages',{}).items():
            if 'thumbnail' in pg:
                return pg['thumbnail']['source']
    except Exception as e:
        pass
    return ''

print(f'Fetching {len(wiki_pages)} images...')
found = 0
for key, page in wiki_pages.items():
    url = get_img(page, delay=2.5)
    if url:
        found += 1
        for fname in ['articles.js', 'gap-share.html']:
            with open(fname, 'r', encoding='utf-8') as f:
                content = f.read()
            start = content.find('"' + key + '":{')
            if start < 0: continue
            end = content.find('},', start)
            entry = content[start:end+2]
            if 'image:"' in entry:
                new_entry = re.sub(r'image:"[^"]*"', 'image:"' + url + '"', entry)
            else:
                before = entry.rstrip().rstrip(',').rstrip('}')
                new_entry = before + ',image:"' + url + '"}'
                if entry.endswith('},'): new_entry += ','
            content = content.replace(entry, new_entry, 1)
            with open(fname, 'w', encoding='utf-8') as f:
                f.write(content)
        print(f'  OK: {key}')
    else:
        print(f'  NO: {key}')

print(f'Done: {found}/{len(wiki_pages)}')

r = subprocess.run(['node', '--check', 'articles.js'], capture_output=True, text=True)
print('Syntax:', 'OK' if r.returncode == 0 else 'FAIL')
