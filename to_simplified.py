import re

# Traditional to simplified mapping
t2s = {
    '曆': '历', '歷': '历', '萬': '万', '長': '长', '國': '国',
    '奧': '奥', '運': '运', '樂': '乐', '語': '语', '時': '时',
    '會': '会', '體': '体', '禮': '礼', '愛': '爱', '爾': '尔',
    '鐵': '铁', '與': '与', '戰': '战', '爭': '争', '為': '为',
    '慶': '庆', '賀': '贺', '聖': '圣', '節': '节', '絲': '丝',
    '綢': '绸', '髮': '发', '術': '术', '發': '发', '紙': '纸',
    '遺': '遗', '產': '产', '虛': '虚', '擬': '拟', '賓': '宾',
    '贊': '赞', '戰略': '战略', '觀眾': '观众',
    '生態': '生态', '趨勢': '趋势', '領域': '领域', '奪': '夺',
    '冠軍': '冠军', '臺': '台', '幣': '币',
    '區': '区', '對': '对', '於': '于', '義': '义', '匯': '汇',
    '賽': '赛', '權': '权', '讓': '让', '關': '关', '開': '开',
    '興': '兴', '頭': '头', '環': '环', '動': '动', '態': '态',
    '際': '际', '服務': '服务', '鞏固': '巩固',
    '戲': '戏', '競': '竞', '創': '创', '種': '种', '網': '网',
    '獎': '奖', '佔': '占', '盃': '杯', '紀錄': '记录',
    '揮': '挥', '當': '当', '後': '后',
}

def to_simple(text):
    result = text
    for t, s in sorted(t2s.items(), key=lambda x: -len(x[0])):
        result = result.replace(t, s)
    return result

for fname in ['articles.js', 'gap-share.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()

    def replace_cn(m):
        cn = m.group(1)
        fixed = to_simple(cn)
        if fixed != cn:
            print(f'  {fixed}')
        return 'titleCn:"' + fixed + '"'

    content = re.sub(r'titleCn:"([^"]*)"', replace_cn, content)

    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)
    print(fname + ': done')
