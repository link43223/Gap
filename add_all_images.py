import json, urllib.request, urllib.parse, time, re, subprocess

def search_wiki(query, delay=1.5):
    params = {'action': 'query', 'list': 'search', 'srsearch': query + ' filetype:image', 'format': 'json', 'srlimit': 3, 'srnamespace': '6'}
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
    time.sleep(0.8)
    try:
        res = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'GapApp/1.0'}), timeout=10)
        data = json.loads(res.read())
        for pid, pg in data.get('query', {}).get('pages', {}).items():
            if 'imageinfo' in pg:
                return pg['imageinfo'][0].get('thumburl', '')
    except:
        return ''

queries = {
    'science': 'Battery electricity energy storage',
    'science-2': 'Sky blue clouds atmosphere',
    'science-3': 'Dark matter galaxy stars',
    'science-4': 'WiFi router wireless internet',
    'science-5': 'Earthquake crack ground destruction',
    'science-6': 'Black hole space event horizon',
    'science-7': 'Vaccine injection medical syringe',
    'science-8': 'Internet server data center',
    'science-9': 'Stars night sky milky way',
    'science-10': 'GPS satellite navigation system',
    'science-11': 'DNA double helix genetics',
    'science-12': 'Airplane wing sky flight',
    'science-13': 'Artificial intelligence brain network',
    'science-14': 'Light prism spectrum rainbow',
    'science-15': '3D printer printing object',
    'science-16': 'Smartphone touch screen',
    'science-17': 'Quantum computer processor',
    'science-18': 'Rainbow sky after rain',
    'science-19': 'Telephone microphone audio',
    'science-20': 'Telescope stars exoplanet',
    'science-21': 'Popcorn corn snack food',
    'science-22': 'Particle physics accelerator CERN',
    'science-23': 'Microwave oven kitchen appliance',
    'science-24': 'Space rocket launch takeoff',
    'science-25': 'Earth seasons summer winter',
    'nature': 'Honey bee flower pollination',
    'nature-2': 'Coral reef ocean underwater',
    'nature-3': 'Water cycle river rain',
    'nature-4': 'Monarch butterfly orange insect',
    'nature-5': 'Volcano eruption lava mountain',
    'nature-6': 'Deep ocean sea underwater',
    'nature-7': 'Forest tree roots nature',
    'nature-8': 'Northern lights aurora borealis',
    'nature-9': 'Octopus ocean sea creature',
    'nature-10': 'Autumn leaves fall colors',
    'nature-11': 'Amazon rainforest jungle trees',
    'nature-12': 'Bird migration flying flock',
    'nature-13': 'Lightning storm thunder sky',
    'nature-14': 'Mushroom fungi forest floor',
    'nature-15': 'Glacier ice mountain landscape',
    'nature-16': 'Honeycomb bees wax hive',
    'nature-17': 'Cheetah fastest animal running',
    'nature-18': 'Climate change global warming earth',
    'nature-19': 'Ocean plastic pollution garbage',
    'nature-20': 'Dolphin ocean swimming mammal',
    'nature-21': 'Gecko lizard climbing wall',
    'nature-22': 'Desert camel sand dunes',
    'nature-23': 'Biodiversity loss extinct species animals',
    'nature-24': 'Solar panels renewable energy wind',
    'nature-25': 'Crow bird black intelligent',
    'life': 'Morning sunrise coffee routine',
    'life-2': 'Book reading library quiet',
    'life-3': 'Habit routine daily life',
    'life-4': 'Clock procrastination time management',
    'life-5': 'Notebook journal writing diary',
    'life-6': 'Sleep bed student rest',
    'life-7': 'Presentation speech audience stage',
    'life-8': 'Question mark asking help',
    'life-9': 'Minimalist room clean simple',
    'life-10': 'Calendar schedule time planner',
    'life-11': 'Hobby painting gardening music',
    'life-12': 'Email computer message writing',
    'life-13': 'Language learning book translate',
    'life-14': 'Criticism feedback conversation discuss',
    'life-15': 'Travel backpack map adventure',
    'life-16': 'Clock timer five minutes',
    'life-17': 'Listening ear headphone attention',
    'life-18': 'Apology sorry forgive hands',
    'life-19': 'Multitasking computer phone distraction',
    'life-20': 'Book reading fast speed',
    'life-21': 'Brain growth mindset positive',
    'life-22': 'Networking people meeting conference',
    'life-23': 'Piano music instrument playing',
    'life-24': 'Argument debate disagreement discuss',
    'life-25': 'Volunteer helping community hands',
    'culture': 'Handshake business greeting',
    'culture-2': 'Tea ceremony cup drink',
    'culture-3': 'Birthday cake party celebration',
    'culture-4': 'Chocolate cocoa beans sweet',
    'culture-5': 'Olympic rings stadium games',
    'culture-6': 'Music orchestra concert performance',
    'culture-7': 'Storytelling book campfire story',
    'culture-8': 'Money coins currency cash',
    'culture-9': 'Bonsai tree miniature japanese',
    'culture-10': 'Coffee cup espresso beans',
    'culture-11': 'Golden rule hands helping',
    'culture-12': 'Body language gesture communication',
    'culture-13': 'Fashion clothing style model',
    'culture-14': 'New year fireworks celebration',
    'culture-15': 'Social media phone network',
    'culture-16': 'Dead sea scrolls ancient manuscript',
    'culture-17': 'Halloween pumpkin costume holiday',
    'culture-18': 'Great wall china ancient',
    'culture-19': 'Hero story mythology legend',
    'culture-20': 'Zero number math symbol',
    'culture-21': 'Silk road camel trade route',
    'culture-22': 'Chess board game strategy',
    'culture-23': 'Stonehenge ancient monument standing stones',
    'culture-24': 'Eiffel tower paris france',
    'culture-25': 'Paper making ancient craft',
}

print(f'Finding images for {len(queries)} articles...')
results = {}
for key, query in queries.items():
    files = search_wiki(query, delay=1.8)
    if files:
        thumb = get_thumb(files[0], 500)
        if thumb:
            results[key] = thumb
            print(f'  OK: {key}')
        else:
            print(f'  NO THUMB: {key}')
    else:
        print(f'  NO RESULT: {key}')

print(f'\nFound {len(results)}/{len(queries)} images')

for fname in ['articles.js', 'gap-share.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    for key, thumb_url in results.items():
        pattern = '"' + key + '":{'
        pos = content.find(pattern)
        if pos == -1:
            continue
        entry_end = content.find('},', pos)
        if entry_end == -1:
            continue
        entry = content[pos:entry_end + 2]
        if 'image:"' in entry:
            content = re.sub(r'image:"[^"]*"', 'image:"' + thumb_url + '"', content)
        else:
            # Add image before the final }
            before_close = entry.rstrip().rstrip(',')
            old = before_close + '}'
            new = before_close + ',image:"' + thumb_url + '"}'
            content = content.replace(old, new, 1)
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'{fname}: updated')

r = subprocess.run(['node', '-e', 'try { new Function(require("fs").readFileSync("articles.js","utf8")); console.log("OK"); } catch(e) { console.log("ERROR", e.message.substring(0,80)); }'], capture_output=True, text=True)
print('Verify:', r.stdout.strip())
