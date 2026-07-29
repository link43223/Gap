import urllib.request, json, time, re, subprocess

PEXELS_KEY = "563492ad6f917000010000014c0e2b9e1f0e4367b6d9e8e4d5e4f3e2"

def search_pexels(query, delay=2):
    url = "https://api.pexels.com/v1/search?query=" + urllib.parse.quote(query) + "&per_page=3"
    time.sleep(delay)
    try:
        req = urllib.request.Request(url, headers={"Authorization": PEXELS_KEY, "User-Agent": "GapApp/1.0"})
        res = urllib.request.urlopen(req, timeout=15)
        data = json.loads(res.read())
        photos = data.get("photos", [])
        if photos:
            return photos[0]["src"]["medium"]
    except:
        pass
    return ""

queries = {
    "science-3": "dark matter space galaxy",
    "science-4": "wifi router internet",
    "science-5": "earthquake crack ground",
    "science-7": "vaccine syringe medical",
    "science-8": "internet network server",
    "science-9": "stars milky way space",
    "science-10": "gps satellite navigation",
    "science-12": "airplane wing sky",
    "science-13": "artificial intelligence brain",
    "science-14": "light speed prism",
    "science-15": "3d printer object",
    "science-16": "touchscreen smartphone",
    "science-17": "quantum computer chip",
    "science-18": "rainbow sky",
    "science-19": "telephone microphone",
    "science-20": "telescope space stars",
    "science-21": "popcorn snack",
    "science-22": "antimatter particle physics",
    "science-23": "microwave oven kitchen",
    "science-24": "space rocket launch",
    "science-25": "seasons earth sun",
    "life": "morning coffee routine",
    "life-2": "reading book library",
    "life-3": "habit routine daily",
    "life-4": "procrastination clock time",
    "life-5": "journal notebook writing",
    "life-6": "sleep student bed",
    "life-7": "presentation speech audience",
    "life-8": "question mark asking",
    "life-9": "minimalist room interior",
    "life-10": "calendar time management",
    "life-11": "hobby painting music",
    "life-12": "email computer screen",
    "life-13": "language learning books",
    "life-14": "criticism feedback conversation",
    "life-15": "travel backpack adventure",
    "life-16": "clock timer deadline",
    "life-17": "listening ear headphones",
    "life-18": "apologize sorry handshake",
    "life-19": "multitasking distraction phone",
    "life-20": "reading book fast",
    "life-21": "brain growth mindset",
    "life-22": "networking people meeting",
    "life-23": "piano music instrument",
    "life-24": "argue debate conversation",
    "life-25": "volunteer helping community",
    "culture": "handshake business",
    "culture-2": "tea ceremony cup",
    "culture-3": "birthday cake candles",
    "culture-4": "chocolate sweet food",
    "culture-5": "olympic rings stadium",
    "culture-6": "music orchestra concert",
    "culture-7": "storytelling book ancient",
    "culture-8": "money coins currency",
    "culture-9": "bonsai tree plant",
    "culture-10": "coffee cup beans",
    "culture-11": "golden rule helping hands",
    "culture-12": "body language gesture",
    "culture-13": "fashion clothing style",
    "culture-14": "new year fireworks",
    "culture-15": "social media phone",
    "culture-16": "ancient scroll manuscript",
    "culture-17": "halloween pumpkin",
    "culture-18": "great wall china",
    "culture-19": "hero story mythology",
    "culture-20": "zero number symbol",
    "culture-21": "silk road camel desert",
    "culture-22": "chess board game",
    "culture-23": "stonehenge standing stones",
    "culture-24": "eiffel tower paris",
    "culture-25": "paper craft vintage",
    "nature": "honey bee flower",
    "nature-2": "coral reef ocean",
    "nature-3": "water cycle river",
    "nature-4": "monarch butterfly insect",
    "nature-5": "volcano eruption lava",
    "nature-6": "deep ocean sea",
    "nature-7": "plants communicate forest",
    "nature-8": "northern lights aurora",
    "nature-9": "octopus sea creature",
    "nature-10": "autumn leaves fall",
    "nature-11": "amazon rainforest jungle",
    "nature-12": "bird migration flock",
    "nature-13": "lightning storm sky",
    "nature-14": "mushroom fungi forest",
    "nature-15": "glacier ice mountain",
    "nature-16": "honey bee honeycomb",
    "nature-17": "cheetah fastest animal",
    "nature-18": "climate change earth",
    "nature-19": "plastic pollution ocean",
    "nature-20": "dolphin sea mammal",
    "nature-21": "gecko lizard reptile",
    "nature-22": "desert sand dunes",
    "nature-23": "endangered species animals",
    "nature-24": "solar panels renewable energy",
    "nature-25": "crow bird intelligent",
    "sports-2": "lionel messi football",
    "sports-3": "basketball nba player",
    "sports-4": "basketball game arena",
    "sports-5": "basketball player dunk",
    "sports-6": "basketball nba court",
    "sports-7": "olympic games stadium",
    "sports-8": "esports gaming tournament",
    "sports-9": "sports technology trainer",
    "sports-10": "marathon running race",
}

print(f"Searching images for {len(queries)} articles...")
found = 0
for key, query in queries.items():
    url = search_pexels(query, delay=1.5)
    if url:
        found += 1
        for fname in ["articles.js", "gap-share.html"]:
            with open(fname, "r", encoding="utf-8") as f:
                content = f.read()
            pos = content.find('"' + key + '":{')
            if pos < 0: continue
            end = content.find("},", pos)
            entry = content[pos:end+2]
            if 'image:"' in entry:
                new_entry = re.sub(r'image:"[^"]*"', 'image:"' + url + '"', entry)
            else:
                before = entry.rstrip().rstrip(",").rstrip("}")
                new_entry = before + ',image:"' + url + '"}'
                if entry.endswith("},"): new_entry += ","
            content = content.replace(entry, new_entry, 1)
            with open(fname, "w", encoding="utf-8") as f:
                f.write(content)
        print(f"  OK: {key}")
        if found % 20 == 0:
            print(f"  [{found}/{len(queries)}]...")
    else:
        print(f"  NO: {key}")

print(f"\nDone: {found}/{len(queries)} images added")

r = subprocess.run(["node", "--check", "articles.js"], capture_output=True, text=True)
print("Syntax:", "OK" if r.returncode == 0 else "FAIL")
