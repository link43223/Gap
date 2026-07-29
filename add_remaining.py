import re, subprocess

more = {
    'life': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500',
    'life-2': 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=500',
    'life-3': 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=500',
    'life-4': 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=500',
    'life-5': 'https://images.unsplash.com/photo-1504711434969-e33886168d8c?w=500',
    'life-6': 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500',
    'life-8': 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=500',
    'life-9': 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=500',
    'life-10': 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=500',
    'life-11': 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=500',
    'life-12': 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=500',
    'life-13': 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=500',
    'life-14': 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=500',
    'life-15': 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=500',
    'life-16': 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=500',
    'life-17': 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=500',
    'life-18': 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=500',
    'life-19': 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=500',
    'life-20': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=500',
    'life-21': 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=500',
    'life-22': 'https://images.unsplash.com/photo-1521791136064-2b5b75b6f5d0?w=500',
    'life-23': 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=500',
    'life-24': 'https://images.unsplash.com/photo-1541877944-ac82a091518a?w=500',
    'life-25': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=500',
    'culture': 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500',
    'culture-2': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500',
    'culture-3': 'https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=500',
    'culture-4': 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=500',
    'culture-5': 'https://images.unsplash.com/photo-1569517282132-25d22e3c6e3d?w=500',
    'culture-6': 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500',
    'culture-7': 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=500',
    'culture-8': 'https://images.unsplash.com/photo-1560472355-536de0d6c0e0?w=500',
    'culture-9': 'https://images.unsplash.com/photo-1512212400757-36f0f528b878?w=500',
    'culture-10': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500',
    'culture-11': 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500',
    'culture-12': 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500',
    'culture-13': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500',
    'culture-14': 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=500',
    'culture-15': 'https://images.unsplash.com/photo-1562577309-4932fdd64cd1?w=500',
    'culture-16': 'https://images.unsplash.com/photo-1461360228754-6e81c478b882?w=500',
    'culture-17': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
    'culture-18': 'https://images.unsplash.com/photo-1521830104447-8f17ab5a20f4?w=500',
    'culture-19': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500',
    'culture-20': 'https://images.unsplash.com/photo-1509868918748-a554ad25f858?w=500',
    'culture-21': 'https://images.unsplash.com/photo-1524661135c423f3c8b7b5e0e0?w=500',
    'culture-22': 'https://images.unsplash.com/photo-1529699211955-8f7e6f1d5d4d?w=500',
    'culture-23': 'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?w=500',
    'culture-24': 'https://images.unsplash.com/photo-1548579148-4880e8b0b9e0?w=500',
    'culture-25': 'https://images.unsplash.com/photo-1496243973325-404704ac8639?w=500',
    'nature': 'https://images.unsplash.com/photo-1535075387420-0f8a3e4d5e1b?w=500',
    'nature-2': 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=500',
    'nature-3': 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=500',
    'nature-4': 'https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=500',
    'nature-5': 'https://images.unsplash.com/photo-1462332420958-a05d1e002413?w=500',
    'nature-6': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=500',
    'nature-7': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500',
    'nature-8': 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=500',
    'nature-9': 'https://images.unsplash.com/photo-1545671913-b89ac1b4ac10?w=500',
    'nature-10': 'https://images.unsplash.com/photo-1477414348463-c0eb7f1359b6?w=500',
    'nature-11': 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=500',
    'nature-12': 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500',
    'nature-13': 'https://images.unsplash.com/photo-1451772741724-d20990422508?w=500',
    'nature-14': 'https://images.unsplash.com/photo-1465433045946-ba6506ce5a59?w=500',
    'nature-15': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500',
    'nature-16': 'https://images.unsplash.com/photo-1535075387420-0f8a3e4d5e1b?w=500',
    'nature-17': 'https://images.unsplash.com/photo-1504006833117-8886a355efbf?w=500',
    'nature-18': 'https://images.unsplash.com/photo-1569163139599-0f4517e36f51?w=500',
    'nature-19': 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=500',
    'nature-20': 'https://images.unsplash.com/photo-1570488344390-4a1b2c9c6e6e?w=500',
    'nature-21': 'https://images.unsplash.com/photo-1559561852-2e8d7c3e0f1a?w=500',
    'nature-22': 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=500',
    'nature-23': 'https://images.unsplash.com/photo-1546189973-34c6c7c4f0a0?w=500',
    'nature-24': 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=500',
    'nature-25': 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500',
    'sports-2': 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500',
    'sports-3': 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500',
    'sports-4': 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=500',
    'sports-5': 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=500',
    'sports-6': 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=500',
    'sports-7': 'https://images.unsplash.com/photo-1569517282132-25d22e3c6e3d?w=500',
    'sports-8': 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500',
    'sports-9': 'https://images.unsplash.com/photo-1571019613454-1cb2a0d1f5b2?w=500',
    'sports-10': 'https://images.unsplash.com/photo-1571019613454-1cb2a0d1f5b2?w=500',
}

count = 0
for fname in ['articles.js', 'gap-share.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    for key, url in more.items():
        pos = content.find('"' + key + '":{')
        if pos < 0: continue
        end = content.find('},', pos)
        entry = content[pos:end+2]
        if 'image:"' in entry:
            new_entry = re.sub(r'image:"[^"]*"', 'image:"' + url + '"', entry)
        else:
            before = entry.rstrip().rstrip(',').rstrip('}')
            new_entry = before + ',image:"' + url + '"}'
            if entry.endswith('},'): new_entry += ','
        content = content.replace(entry, new_entry, 1)
        count += 1
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)
    print(fname + ': ' + str(count) + ' images')

r = subprocess.run(['node', '--check', 'articles.js'], capture_output=True, text=True)
print('Syntax:', 'OK' if r.returncode == 0 else 'FAIL')
with open('articles.js', 'r', encoding='utf-8') as f:
    content = f.read()
imgs = len(re.findall(r'image:"', content))
print('Total with images:', imgs)
