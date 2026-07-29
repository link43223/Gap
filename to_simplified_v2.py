import re, subprocess

more = [
    ('谜','謎'),('迁','遷'),('叶','葉'),('亚','亞'),('逊','遜'),
    ('类','類'),('闪','閃'),('么','麼'),('气','氣'),('胶','膠'),
    ('脚','腳'),('乌','烏'),('鸦','鴉'),('别','別'),('总','總'),
    ('响','響'),('矶','磯'),('势','勢'),('热','熱'),('观','觀'),
    ('亿','億'),('军','軍'),('资','資'),('徙','徙'),('丛','叢'),
    ('丢','丟'),('并','並'),('临','臨'),('干','乾'),('众','眾'),
    ('忧','憂'),('忆','憶'),('怜','憐'),('悯','憫'),('愤','憤'),
    ('慨','慨'),('惫','憊'),('惧','懼'),('恋','戀'),('扫','掃'),
    ('挂','掛'),('卷','捲'),('采','採'),('拥','擁'),('挡','擋'),
    ('据','據'),('挤','擠'),('拧','擰'),('扩','擴'),('摆','擺'),
    ('扰','擾'),('揽','攬'),('败','敗'),('启','啟'),('叙','敘'),
    ('敌','敵'),('敛','斂'),('斩','斬'),('断','斷'),('晓','曉'),
    ('昼','晝'),('畅','暢'),('暂','暫'),('昙','曇'),
    ('愛','爱'),('葉','叶'),('腳','脚'),('烏','乌'),('鴉','鸦'),
    ('總','总'),('響','响'),('磯','矶'),('勢','势'),('熱','热'),
    ('觀','观'),('億','亿'),('軍','军'),
]

t2s = {}
for s, t in more:
    t2s[t] = s

for fname in ['articles.js', 'gap-share.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    def fix_cn(m):
        cn = m.group(1)
        orig = cn
        for t, s in sorted(t2s.items(), key=lambda x: -len(x[0])):
            cn = cn.replace(t, s)
        if cn != orig:
            print('  ' + orig + ' -> ' + cn)
        return 'titleCn:"' + cn + '"'
    content = re.sub(r'titleCn:"([^"]*)"', fix_cn, content)
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)
    print(fname + ': done')

r = subprocess.run(['node', '-e', 'var fs=require("fs"); eval(fs.readFileSync("articles.js","utf8")); console.log("OK: "+Object.keys(articles).length);'], capture_output=True, text=True)
print(r.stdout.strip())
