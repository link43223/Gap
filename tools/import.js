// ============================================
// tools/import.js — Standard Ebooks → Gap 数据管道
//
// 用法:
//   node tools/import.js                 # 导入 books.txt 中的全部书
//   node tools/import.js --book <slug>   # 只导入书名匹配的书
//   node tools/import.js --keep-tmp      # 保留下载/解压临时文件（调试用）
//
// 流程: 读 books.txt → 下载官方 GitHub 源仓库 zip → 解压 → 解析 content.opf
//       → 清洗正文章节 XHTML → 计算 Flesch 难度
//       → 生成 se-books/{slug}/data.js + 章节纯文本 + 封面 → 更新 se-catalog.json
//
// 来源说明: Standard Ebooks 全部为公有领域（CC0）。
//   SE 官网的 epub 下载链接对脚本有反爬（跟随会封 IP 24 小时），
//   故从官方 GitHub 源仓库（github.com/standardebooks/{author}_{title}）获取，
//   源仓库 src/epub/ 即 epub 的源文件（XHTML + OPF + 图片）。
//
// 依赖: 系统 curl（下载）、unzip 或 tar（解压 zip），均为 Windows 11 / Git Bash 自带。
// ============================================
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BOOKS_FILE = path.join(__dirname, 'books.txt');
const TITLES_ZH_FILE = path.join(__dirname, 'se-titles-zh.json');
const TMP_DIR = path.join(__dirname, '_tmp');
const SE_DIR = path.join(ROOT, 'se-books');
const CATALOG_FILE = path.join(SE_DIR, 'se-catalog.json');

// ---- 命令行参数 ----
const argv = process.argv.slice(2);
const KEEP_TMP = argv.includes('--keep-tmp');
const bookFilter = (() => {
    const i = argv.indexOf('--book');
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
})();

// ============================================
// 1. HTML 清洗工具
// ============================================
const ENT = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
    mdash: '—', ndash: '–', hellip: '…',
};

function decodeEntities(s) {
    return s
        .replace(/&(#x?[0-9a-fA-F]+);/g, (m, code) => {
            const n = /^#x/i.test(code)
                ? parseInt(code.slice(2), 16)
                : parseInt(code.slice(1), 10);
            try { return String.fromCodePoint(n); } catch (e) { return m; }
        })
        .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => ENT[name] !== undefined ? ENT[name] : m);
}

// 清理不可见/特殊空白字符
function cleanInvisible(s) {
    return s
        // 零宽字符：word-joiner(U+2060)、ZWSP(U+200B)、ZWJ(U+200D)、ZWNJ(U+200C) 等 → 删除
        .replace(/[⁠​‌‍‎‏﻿]/g, '')
        // 各种宽度空格（nbsp、thin space、en space 等）→ 普通空格
        .replace(/[             ]/g, ' ');
}

// 段落内 HTML 片段 → 纯文本（去标签、解实体、空白归一、保留诗歌换行）
function htmlToText(html) {
    html = html.replace(/<br\s*\/?>/gi, '\n');     // 行内换行 → 诗歌用
    html = html.replace(/<[^>]+>/g, '');           // 去标签（内嵌 <abbr>Mr.</abbr> 文本保留）
    html = decodeEntities(html);
    html = cleanInvisible(html);
    html = html.replace(/[^\S\n]+/g, ' ')          // 非换行空白 → 单空格
               .replace(/ *\n */g, '\n');
    return html.trim();
}

// 提取章节正文为段落数组。
// 普通 <p> → 各为一段；诗歌容器（poem/stanza）内行合并为一段（行间保留 \n）。
function extractParagraphs(bodyHtml) {
    const poemBlocks = [];
    const protectPoem = (m) => { poemBlocks.push(m); return '@@POEM' + (poemBlocks.length - 1) + '@@'; };
    // 保护诗歌容器，避免内部 <p> 被普通提取打散
    bodyHtml = bodyHtml.replace(/<(?:div|section)[^>]*class="[^"]*poem[^"]*"[^>]*>[\s\S]*?<\/(?:div|section)>/gi, protectPoem);
    bodyHtml = bodyHtml.replace(/<(?:div|section)[^>]*epub:type="[^"]*poem[^"]*"[^>]*>[\s\S]*?<\/(?:div|section)>/gi, protectPoem);

    const paras = [];
    const segRe = /<p[^>]*>[\s\S]*?<\/p>|@@POEM\d+@@/g;
    let m;
    while ((m = segRe.exec(bodyHtml)) !== null) {
        const seg = m[0];
        if (seg.indexOf('@@POEM') === 0) {
            const idx = parseInt(seg.match(/@@POEM(\d+)@@/)[1], 10);
            const block = poemBlocks[idx];
            const lines = [];
            let pm;
            const pRe = /<p[^>]*>([\s\S]*?)<\/p>/g;
            while ((pm = pRe.exec(block)) !== null) lines.push(htmlToText(pm[1]));
            if (lines.length) paras.push(lines.join('\n'));
        } else {
            const inner = seg.replace(/^<p[^>]*>/, '').replace(/<\/p>$/, '');
            paras.push(htmlToText(inner));
        }
    }
    return paras;
}

// ============================================
// 2. Flesch 可读性（难度分级）
// ============================================
function countWords(text) {
    return (text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) || []).length;
}

// 句子计数：识别 . ! ? 句末，跳过缩写（Mr./Dr./e.g. 等）、单字母点、小数
function countSentences(text) {
    const ABBR = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'jr', 'sr', 'no', 'vol', 'fig', 'vs', 'etc', 'viz', 'e.g', 'i.e', 'v']);
    let n = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch !== '.' && ch !== '!' && ch !== '?') continue;
        // 往回取点前的完整词
        let j = i - 1;
        while (j >= 0 && /[A-Za-z]/.test(text[j])) j--;
        const word = text.slice(j + 1, i).toLowerCase();
        if (ch === '.') {
            if (ABBR.has(word) || word.length === 1) continue;  // Mr. / e.g. / A.
            if (/[0-9]/.test(text[i + 1] || '')) continue;      // 3.14 小数
        }
        n++;
    }
    return Math.max(1, n);
}

function countSyllables(text) {
    const words = text.match(/[A-Za-z]+/g) || [];
    let total = 0;
    for (const w of words) {
        let x = w.toLowerCase().replace(/[^a-z]/g, '');
        if (!x) continue;
        // 去结尾 silent e（-e 结尾且前一个字符不是元音）
        if (x.endsWith('e') && x.length > 2 && !/[aeiou]/.test(x[x.length - 2])) x = x.slice(0, -1);
        const groups = x.match(/[aeiouy]+/g);
        total += Math.max(1, groups ? groups.length : 1);
    }
    return total;
}

// 返回 { words, sentences, syllables, fre, grade, difficulty }
function fleschStats(text) {
    const words = countWords(text);
    const sentences = countSentences(text);
    const syllables = countSyllables(text);
    const fre = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
    let difficulty;
    if (grade <= 6) difficulty = 1;        // 简单
    else if (grade <= 10) difficulty = 2;  // 中等
    else difficulty = 3;                   // 难
    return {
        words, sentences, syllables,
        fre: Math.round(fre * 100) / 100,
        grade: Math.round(grade * 100) / 100,
        difficulty,
    };
}

// ============================================
// 3. OPF 解析
// ============================================
function textOf(xml, tag) {
    const m = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>'));
    return m ? m[1].trim() : '';
}

function parseOpf(opfPath) {
    const xml = fs.readFileSync(opfPath, 'utf8');
    const dir = path.dirname(opfPath);

    const manifest = {};
    const itemRe = /<item\s[^>]*\/?>/g;
    let m;
    while ((m = itemRe.exec(xml)) !== null) {
        const attrs = m[0];
        const href = (attrs.match(/href="([^"]*)"/) || [])[1];
        const id = (attrs.match(/id="([^"]*)"/) || [])[1];
        const props = (attrs.match(/properties="([^"]*)"/) || [])[1] || '';
        if (href && id) manifest[id] = { href, props };
    }

    const spine = [];
    const refRe = /<itemref\s[^>]*\/?>/g;
    while ((m = refRe.exec(xml)) !== null) {
        const idref = (m[0].match(/idref="([^"]*)"/) || [])[1];
        if (idref && manifest[idref]) spine.push(manifest[idref]);
    }

    // 封面：properties 含 cover-image 的 item
    let cover = Object.values(manifest).find((it) => /cover-image/.test(it.props));
    if (cover) cover = cover.href;

    const meta = {
        title: decodeEntities(textOf(xml, 'dc:title')),
        author: decodeEntities(textOf(xml, 'dc:creator')),
        language: textOf(xml, 'dc:language'),
        // 简介：优先 dc:abstract，缺失时回退 dc:description（XML 内实体先解码再去标签）
        abstract: decodeEntities(textOf(xml, 'dc:abstract') || textOf(xml, 'dc:description'))
            .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        date: (textOf(xml, 'dc:date') || '').slice(0, 4),
        wordCount: ((xml.match(/property="schema:wordCount">(\d+)/) || [])[1]) || null,
        educationalLevel: ((xml.match(/property="schema:educationalLevel">([\d.]+)/) || [])[1]) || null,
    };

    return { meta, spine, cover, dir };
}

// ============================================
// 4. 下载 / 解压
// ============================================
function run(cmd, args, opts) {
    return execFileSync(cmd, args, Object.assign({ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }, opts || {}));
}

function downloadZip(url, outPath) {
    run('curl', ['-sL', '-f', '-o', outPath, url]);
}

// 从 SE 书页解析真实 GitHub 仓库名（SE 部分书含版本后缀，如 the-count-of-monte-cristo_chapman-and-hall）
function getGitHubRepo(url, fallback) {
    try {
        const page = run('curl', ['-sL', '-A', 'Mozilla/5.0', url]);
        const m = page.match(/github\.com\/standardebooks\/([A-Za-z0-9._-]+)/);
        if (m && m[1]) return m[1];
    } catch (e) { /* 书页解析失败，用 fallback */ }
    return fallback;
}

function extractZip(zipPath, destDir) {
    // 依次尝试 unzip → tar（Windows 自带 bsdtar）→ PowerShell
    try { run('unzip', ['-q', '-o', zipPath, '-d', destDir]); return; } catch (e) { /* 尝试下一个 */ }
    try { run('tar.exe', ['-xf', zipPath, '-C', destDir]); return; } catch (e) { /* 尝试下一个 */ }
    run('powershell', ['-NoProfile', '-Command',
        'Expand-Archive -LiteralPath "' + zipPath + '" -DestinationPath "' + destDir + '" -Force']);
}

// ============================================
// 5. 章节清洗
// ============================================
const NON_CHAPTER = /titlepage|imprint|colophon|uncopyright|halftitle|copyright|epigraph|dedication|toc|endnote|foreword|introduction|preface|acknowledg|appendix|advert/i;

function isChapterFile(href) {
    const base = path.basename(href).toLowerCase();
    return /^(chapter|volume|part)-\d/i.test(base) || /^chapter\.\d/i.test(base);
}

// 从章节 XHTML 提取 { title, paragraphs }
function cleanChapter(html, fileBase) {
    // 章节标题：优先 epub:type="title" 的 h1-h3
    let title = '';
    const titleRe = /<h[1-6][^>]*epub:type="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h[1-6]>/i;
    const tm = html.match(titleRe);
    if (tm) title = htmlToText(tm[1]);
    if (!title) {
        const m2 = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
        if (m2) title = htmlToText(m2[1]);
    }
    if (!title) title = fileBase.replace(/\.xhtml$/i, '');

    // 章节正文：取 <section epub:type="chapter"> 块；无则取整个 body
    let bodyHtml = html;
    const sec = html.match(/<section[^>]*epub:type="[^"]*chapter[^"]*"[^>]*>[\s\S]*?<\/section>/i);
    if (sec) bodyHtml = sec[0];
    else {
        const b = html.match(/<body[^>]*>[\s\S]*?<\/body>/i);
        if (b) bodyHtml = b[0];
    }
    // 去掉章节标题标签本身（避免标题文本重复出现在正文）
    bodyHtml = bodyHtml.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '');

    const paragraphs = extractParagraphs(bodyHtml);
    return { title, paragraphs };
}

// ============================================
// 6. 输出
// ============================================
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function writeDataJs(slug, meta, chaptersObj) {
    const outDir = path.join(SE_DIR, slug);
    ensureDir(outDir);
    const payload = { meta, chapters: chaptersObj };
    const js = [
        '/* Auto-generated by tools/import.js — do not edit. */',
        '/* Source: Standard Ebooks (CC0). URL: ' + meta.sourceUrl + ' */',
        '(function (g) {',
        '"use strict";',
        'g.SE_BOOKS = g.SE_BOOKS || {};',
        'g.SE_BOOKS[' + JSON.stringify(slug) + '] = ' + JSON.stringify(payload, null, 2) + ';',
        '})(typeof globalThis !== "undefined" ? globalThis : this);',
        '',
    ].join('\n');
    fs.writeFileSync(path.join(outDir, 'data.js'), js, 'utf8');
}

function writeChapterTxt(slug, n, title, paragraphs) {
    const outDir = path.join(SE_DIR, slug);
    const txt = '/* ' + n + '. ' + title + ' — 清洗后纯文本（供人工校对 / TTS 续跑） */\n\n' +
        paragraphs.join('\n\n') + '\n';
    fs.writeFileSync(path.join(outDir, 'chapter-' + n + '.txt'), txt, 'utf8');
}

function updateCatalog(entry) {
    let catalog = {};
    if (fs.existsSync(CATALOG_FILE)) {
        try { catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8')); } catch (e) { catalog = {}; }
    }
    const books = catalog.books || [];
    const idx = books.findIndex((b) => b.slug === entry.slug);
    if (idx >= 0) books[idx] = entry; else books.push(entry);
    books.sort((a, b) => a.title.localeCompare(b.title));
    catalog.books = books;
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
}

// ============================================
// 7. 单书导入
// ============================================
function parseBookUrl(url) {
    const m = url.match(/\/ebooks\/([^/]+)\/([^/]+)\/?$/);
    if (!m) throw new Error('无法解析书页 URL: ' + url);
    return { authorSlug: m[1], titleSlug: m[2] };
}

function importBook(url, titlesZh) {
    const { authorSlug, titleSlug } = parseBookUrl(url);
    const slug = titleSlug;
    console.log('\n=== 导入: ' + slug + ' ===');

    const zh = titlesZh[slug] || {};
    const tmpDir = path.join(TMP_DIR, slug);
    const extractDir = path.join(tmpDir, 'extract');
    ensureDir(tmpDir);

    // 1) 下载 GitHub 源仓库（真实仓库名优先从 SE 书页解析，兼容带版本后缀的书）
    const repo = getGitHubRepo(url, authorSlug + '_' + titleSlug);
    const repoUrl = 'https://github.com/standardebooks/' + repo;
    const zipPath = path.join(tmpDir, 'repo.zip');
    console.log('下载源仓库: ' + repoUrl);
    downloadZip(repoUrl + '/archive/refs/heads/master.zip', zipPath);
    if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1000) {
        throw new Error('仓库 zip 下载失败');
    }
    console.log('仓库 zip: ' + fs.statSync(zipPath).size + ' bytes');

    // 2) 解压
    ensureDir(extractDir);
    extractZip(zipPath, extractDir);

    // 3) 定位 content.opf（src/epub/content.opf）
    const repoDir = fs.readdirSync(extractDir).find((d) => d.startsWith(repo)) || (repo + '-master');
    const opfPath = path.join(extractDir, repoDir, 'src', 'epub', 'content.opf');
    if (!fs.existsSync(opfPath)) {
        throw new Error('未找到 content.opf: ' + opfPath);
    }
    const { meta, spine, cover, dir } = parseOpf(opfPath);
    console.log('书名: ' + meta.title);
    console.log('作者: ' + meta.author);
    console.log('语言: ' + meta.language + ' | SE 版年份: ' + meta.date);
    console.log('SE 官方 wordCount=' + meta.wordCount + '  educationalLevel=' + meta.educationalLevel);

    // 4) 复制封面
    const outDir = path.join(SE_DIR, slug);
    ensureDir(outDir);
    let coverFile = '';
    if (cover) {
        const src = path.join(dir, cover);
        if (fs.existsSync(src)) {
            coverFile = 'se-books/' + slug + '/cover.svg';
            fs.copyFileSync(src, path.join(outDir, 'cover.svg'));
        }
    }

    // 5) 遍历 spine 清洗章节
    const chaptersObj = {};
    let n = 0;
    let bookText = [];
    const skipped = [];
    for (const item of spine) {
        const href = item.href;
        const base = path.basename(href).toLowerCase();
        const filePath = path.join(dir, href);
        if (!fs.existsSync(filePath)) continue;
        const html = fs.readFileSync(filePath, 'utf8');
        const bodyType = (html.match(/<body[^>]*epub:type="([^"]*)"/) || [])[1] || '';
        // 只保留正文：文件名像正文章节，或 body 标记为 bodymatter
        if (!isChapterFile(base) && !/bodymatter/.test(bodyType)) {
            skipped.push(base);
            continue;
        }
        n++;
        const { title, paragraphs } = cleanChapter(html, base);
        if (!paragraphs.length) { console.log('  ✗ ' + base + ' 为空，跳过'); n--; continue; }
        const text = paragraphs.join('  ');   // 段落间双空格（与现有 articles 格式一致）
        bookText.push(text);
        const key = 'se-' + slug + '-' + n;
        const chapterWords = countWords(text);
        chaptersObj[key] = {
            title,
            titleCn: '',
            source: meta.author + ' · ' + meta.title + ' — Chapter ' + n,
            text,
            book: slug,
            chapter: n,
            wordCount: chapterWords,
            readingMinutes: Math.max(1, Math.round(chapterWords / 200)),
            difficulty: 0, // 下面按全书平均覆盖
        };
        writeChapterTxt(slug, n, title, paragraphs);
        console.log('  ✓ ' + base + ' → ' + key + ' (' + countWords(text) + ' 词)');
    }
    console.log('跳过 front/end matter: ' + skipped.join(', '));

    if (n === 0) throw new Error('没有解析到任何章节');

    // 6) Flesch 难度（全书平均，覆盖到每章）
    const stats = fleschStats(bookText.join('  '));
    console.log('Flesch: words=' + stats.words + ' sentences=' + stats.sentences +
        ' syllables=' + stats.syllables + ' FRE=' + stats.fre + ' Grade=' + stats.grade +
        ' difficulty=' + stats.difficulty);
    for (const key of Object.keys(chaptersObj)) chaptersObj[key].difficulty = stats.difficulty;

    // 7) 写 data.js + catalog
    const bookMeta = {
        slug,
        title: meta.title,
        titleCn: zh.titleCn || '',
        originalYear: zh.originalYear || null,
        author: meta.author,
        // 展示年份优先用原著年份（映射表），否则退回 SE 数字化版本年份
        year: zh.originalYear || (meta.date ? Number(meta.date) : null),
        language: meta.language,
        description: meta.abstract,
        wordCount: meta.wordCount ? Number(meta.wordCount) : stats.words,
        educationalLevel: meta.educationalLevel ? Number(meta.educationalLevel) : stats.fre,
        difficulty: stats.difficulty,
        grade: stats.grade,
        chapters: n,
        cover: coverFile,
        dataUrl: 'se-books/' + slug + '/data.js',
        sourceUrl: url,
    };
    writeDataJs(slug, bookMeta, chaptersObj);
    updateCatalog(bookMeta);
    const dataSize = fs.statSync(path.join(outDir, 'data.js')).size;
    console.log('完成: se-books/' + slug + '/  (data.js ' + dataSize + ' bytes)');
}

// ============================================
// 8. main
// ============================================
function main() {
    if (!fs.existsSync(BOOKS_FILE)) { console.error('缺少 ' + BOOKS_FILE); process.exit(1); }
    const lines = fs.readFileSync(BOOKS_FILE, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));
    if (!lines.length) { console.error('books.txt 没有书单'); process.exit(1); }

    const urls = bookFilter
        ? lines.filter((l) => l.includes('/' + bookFilter) || l.includes(bookFilter))
        : lines;
    if (!urls.length) {
        console.error('没有匹配 --book ' + bookFilter + ' 的条目');
        process.exit(1);
    }

    let titlesZh = {};
    if (fs.existsSync(TITLES_ZH_FILE)) {
        titlesZh = JSON.parse(fs.readFileSync(TITLES_ZH_FILE, 'utf8'));
    }

    let ok = 0, fail = 0;
    for (const url of urls) {
        try {
            importBook(url, titlesZh);
            ok++;
        } catch (e) {
            fail++;
            console.error('✗ 导入失败: ' + e.message);
        }
    }

    console.log('\n===== 结果: 成功 ' + ok + ' 本, 失败 ' + fail + ' 本 =====');
    if (!KEEP_TMP) {
        try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch (e) {}
        console.log('临时目录已清理（--keep-tmp 可保留）');
    } else {
        console.log('临时目录保留在 tools/_tmp/');
    }
}

main();
