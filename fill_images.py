import re, subprocess

images = {
    'science-8': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Internet_map_1024.jpg/500px-Internet_map_1024.jpg',
    'science-9': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/NGC_281_Crop.jpg/500px-NGC_281_Crop.jpg',
    'science-10': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/GPS_Satellite_NASA_art-iif.jpg/500px-GPS_Satellite_NASA_art-iif.jpg',
    'science-11': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/DNA_animation.gif/500px-DNA_animation.gif',
    'science-12': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Airplane_vortex_edit.jpg/500px-Airplane_vortex_edit.jpg',
    'science-14': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Light_dispersion_conceptual_waves.gif/500px-Light_dispersion_conceptual_waves.gif',
    'science-15': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/3D_Printer_%286012407795%29.jpg/500px-3D_Printer_%286012407795%29.jpg',
    'science-21': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Zeamayspopcorn.jpg/500px-Zeamayspopcorn.jpg',
    'science-22': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/CMS_Higgs-event.jpg/500px-CMS_Higgs-event.jpg',
    'science-23': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Microwave_oven_002.JPG/500px-Microwave_oven_002.JPG',
    'science-24': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Atlantis_taking_off_on_STS-132.jpg/500px-Atlantis_taking_off_on_STS-132.jpg',
    'science-25': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Earth%27s_tilt.svg/500px-Earth%27s_tilt.svg.png',
    'life': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Coffee_and_croissant.jpg/500px-Coffee_and_croissant.jpg',
    'life-2': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Books_and_reading_%284183422996%29.jpg/500px-Books_and_reading_%284183422996%29.jpg',
    'life-8': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Question_mark_%28black%29.svg/500px-Question_mark_%28black%29.svg.png',
    'life-9': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Minimalist_interior.jpg/500px-Minimalist_interior.jpg',
    'life-10': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Clock_tower_from_lower_manhattan_%28cropped%29.jpg/500px-Clock_tower_from_lower_manhattan_%28cropped%29.jpg',
    'life-11': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Hobbies_%28PSF%29.png/500px-Hobbies_%28PSF%29.png',
    'life-12': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Email_Shiny_Icon.svg/500px-Email_Shiny_Icon.svg.png',
    'life-13': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Language_learning_books.jpg/500px-Language_learning_books.jpg',
    'life-14': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Constructive_criticism.jpg/500px-Constructive_criticism.jpg',
    'life-15': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Travel_photo_collage.jpg/500px-Travel_photo_collage.jpg',
    'life-18': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Handshake_%28cropped%29.jpg/500px-Handshake_%28cropped%29.jpg',
    'life-21': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Growth_mindset.png/500px-Growth_mindset.png',
    'life-22': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Networking_events.jpg/500px-Networking_events.jpg',
    'life-23': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Piano_%28PSF%29.png/500px-Piano_%28PSF%29.png',
    'life-24': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Argument_clipart.svg/500px-Argument_clipart.svg.png',
    'life-25': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Volunteer_icon.svg/500px-Volunteer_icon.svg.png',
    'culture': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Handshake_%28portrait%29.jpg/500px-Handshake_%28portrait%29.jpg',
    'culture-2': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Chinese_tea_culture.jpg/500px-Chinese_tea_culture.jpg',
    'culture-3': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Birthday_cake_%28PSF%29.png/500px-Birthday_cake_%28PSF%29.png',
    'culture-9': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Bonsai_tree_Madrid_01.jpg/500px-Bonsai_tree_Madrid_01.jpg',
    'culture-10': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Coffee_beans_%28unroasted%29.jpg/500px-Coffee_beans_%28unroasted%29.jpg',
    'culture-11': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Golden_rule_image.jpg/500px-Golden_rule_image.jpg',
    'culture-12': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Body_language_%28PSF%29.png/500px-Body_language_%28PSF%29.png',
    'culture-13': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Fashion_show_2010.jpg/500px-Fashion_show_2010.jpg',
    'culture-14': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/New_Year_fireworks_2011.jpg/500px-New_Year_fireworks_2011.jpg',
    'culture-15': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Social_media_icons.svg/500px-Social_media_icons.svg.png',
    'culture-16': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Dead_Sea_Scrolls_%28PSF%29.png/500px-Dead_Sea_Scrolls_%28PSF%29.png',
    'culture-22': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Chess_set.jpg/500px-Chess_set.jpg',
    'culture-23': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Stonehenge_%28sunset%29.jpg/500px-Stonehenge_%28sunset%29.jpg',
    'culture-24': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Eiffel_Tower_%28PSF%29.png/500px-Eiffel_Tower_%28PSF%29.png',
    'culture-25': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Papermaking_%28PSF%29.png/500px-Papermaking_%28PSF%29.png',
    'nature': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Honeybee_on_a_daisy.jpg/500px-Honeybee_on_a_daisy.jpg',
    'nature-2': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Coral_reef_%28PSF%29.png/500px-Coral_reef_%28PSF%29.png',
    'nature-8': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Northern_lights_%28PSF%29.png/500px-Northern_lights_%28PSF%29.png',
    'nature-9': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Octopus_%28PSF%29.png/500px-Octopus_%28PSF%29.png',
    'nature-10': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Autumn_leaves_%28PSF%29.png/500px-Autumn_leaves_%28PSF%29.png',
    'nature-11': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Amazon_rainforest_%28PSF%29.png/500px-Amazon_rainforest_%28PSF%29.png',
    'nature-12': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Bird_migration_%28PSF%29.png/500px-Bird_migration_%28PSF%29.png',
    'nature-13': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Lightning_%28PSF%29.png/500px-Lightning_%28PSF%29.png',
    'nature-14': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Fungi_%28PSF%29.png/500px-Fungi_%28PSF%29.png',
    'nature-20': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Dolphin_%28PSF%29.png/500px-Dolphin_%28PSF%29.png',
    'nature-21': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Gecko_%28PSF%29.png/500px-Gecko_%28PSF%29.png',
    'nature-22': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Desert_%28PSF%29.png/500px-Desert_%28PSF%29.png',
    'nature-23': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Biodiversity_%28PSF%29.png/500px-Biodiversity_%28PSF%29.png',
    'nature-24': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Renewable_energy_%28PSF%29.png/500px-Renewable_energy_%28PSF%29.png',
    'nature-25': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Crow_%28PSF%29.png/500px-Crow_%28PSF%29.png',
    'sports-2': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Lionel_Messi_20180626.jpg/500px-Lionel_Messi_20180626.jpg',
    'sports-3': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Basketball_%28PSF%29.png/500px-Basketball_%28PSF%29.png',
    'sports-4': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/NBA_%28PSF%29.png/500px-NBA_%28PSF%29.png',
    'sports-5': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Basketball_player_%28PSF%29.png/500px-Basketball_player_%28PSF%29.png',
    'sports-6': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/NBA_logo_%28PSF%29.png/500px-NBA_logo_%28PSF%29.png',
    'sports-7': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Olympic_rings_%28PSF%29.png/500px-Olympic_rings_%28PSF%29.png',
    'sports-8': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Esports_%28PSF%29.png/500px-Esports_%28PSF%29.png',
    'sports-9': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Sports_technology_%28PSF%29.png/500px-Sports_technology_%28PSF%29.png',
    'sports-10': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Marathon_%28PSF%29.png/500px-Marathon_%28PSF%29.png',
}

for fname in ['articles.js', 'gap-share.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    for key, url in images.items():
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
    print(fname + ': updated')

r = subprocess.run(['node', '--check', 'articles.js'], capture_output=True, text=True)
print('Syntax:', 'OK' if r.returncode == 0 else 'FAIL')
