// ============================================
// gap 音频批量生成脚本
// 用法:
//   node gen-audio.js                      # 全部文章 × 全部语音
//   node gen-audio.js science,health-2     # 只生成指定文章（逗号分隔 key）
//   node gen-audio.js science jenny        # 指定文章 + 指定语音
// 依赖: pip install edge-tts
// ============================================
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const SRCDIR = __dirname;
const AUDIODIR = path.join(SRCDIR, 'audio');

// 语音方案：女声=美音 Jenny，男声=英音 Ryan
const VOICES = { jenny: 'en-US-JennyNeural', ryan: 'en-GB-RyanNeural' };

// 读取文章数据
const code = fs.readFileSync(path.join(SRCDIR, 'articles.js'), 'utf8');
eval(code); // 定义全局 articles

function norm(text) {
    return String(text).replace(/\s+/g, ' ').trim();
}

// 生成一篇文章的一个语音：mp3 + vtt（句子级时间戳）
function genOne(key, article, voice) {
    return new Promise((resolve, reject) => {
        const outMp3 = path.join(AUDIODIR, `${key}-${voice}.mp3`);
        const outVtt = path.join(AUDIODIR, `${key}-${voice}.vtt`);
        const tmpTxt = path.join(AUDIODIR, `_tmp_${key}_${voice}.txt`);
        const txt = norm(article.title) + '. ' + norm(article.text);
        fs.writeFileSync(tmpTxt, txt, 'utf8');

        execFile('python', ['-m', 'edge_tts',
            '--voice', VOICES[voice],
            '--file', tmpTxt,
            '--write-media', outMp3,
            '--write-subtitles', outVtt
        ], (err) => {
            try { fs.unlinkSync(tmpTxt); } catch (e) {}
            if (err) reject(new Error(err.message));
            else resolve();
        });
    });
}

async function main() {
    const argKeys = process.argv[2];
    const argVoice = process.argv[3];
    const keys = argKeys ? argKeys.split(',').filter(k => articles[k]) : Object.keys(articles);
    const voices = argVoice ? argVoice.split(',') : Object.keys(VOICES);

    if (!keys.length) { console.log('没有找到可生成的文章'); return; }
    fs.mkdirSync(AUDIODIR, { recursive: true });

    console.log(`开始生成: ${keys.length} 篇文章 × ${voices.length} 个语音`);
    let ok = 0, fail = 0;
    const start = Date.now();

    for (const key of keys) {
        for (const voice of voices) {
            try {
                await genOne(key, articles[key], voice);
                ok++;
                console.log(`✓ ${key}-${voice}`);
            } catch (e) {
                fail++;
                console.log(`✗ ${key}-${voice}: ${e.message}`);
            }
        }
    }

    const secs = Math.round((Date.now() - start) / 1000);
    console.log(`\n完成: 成功 ${ok} 个, 失败 ${fail} 个, 耗时 ${Math.floor(secs / 60)}分${secs % 60}秒`);
    console.log(`音频目录: ${AUDIODIR}`);
}

main();
