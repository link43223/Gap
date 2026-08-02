// ==========================================
// 设置
// ==========================================
function getSetting(key, defaultValue) {
    var data = localStorage.getItem("gap_settings");
    var settings = data ? JSON.parse(data) : {};
    return settings[key] !== undefined ? settings[key] : defaultValue;
}

function setSetting(key, value) {
    var data = localStorage.getItem("gap_settings");
    var settings = data ? JSON.parse(data) : {};
    settings[key] = value;
    localStorage.setItem("gap_settings", JSON.stringify(settings));
}

// ==========================================
// 全局状态
// ==========================================
var currentTopic = "science";
var currentArticleKey = "science";
var currentWord = "";
var currentWordElement = null;
var currentDictData = null;
var currentPhonetic = "";
var audioCache = {};

// ==========================================
// 单词库
// ==========================================
function getWordBank() {
    var data = localStorage.getItem("gap_wordbank");
    var bank = data ? JSON.parse(data) : [];
    // 兼容旧数据：没 articleKey 的归到"其他文章"
    var changed = false;
    bank.forEach(function(item) {
        if (!item.articleKey) {
            item.articleKey = "_other";
            item.articleTitle = item.articleTitle || "其他文章";
            changed = true;
        }
    });
    if (changed) localStorage.setItem("gap_wordbank", JSON.stringify(bank));
    return bank;
}

function addToWordBank(word, meaning, articleKey, articleTitle) {
    var bank = getWordBank();
    if (!bank.find(function(item) { return item.word === word && item.articleKey === articleKey; })) {
        bank.unshift({ word: word, meaning: meaning, time: new Date().toISOString(), articleKey: articleKey, articleTitle: articleTitle });
        localStorage.setItem("gap_wordbank", JSON.stringify(bank));
    }
}

function removeFromWordBank(word, articleKey) {
    var bank = getWordBank();
    bank = bank.filter(function(item) { return !(item.word === word && item.articleKey === articleKey); });
    localStorage.setItem("gap_wordbank", JSON.stringify(bank));
}

function isInWordBank(word, articleKey) {
    return getWordBank().some(function(item) { return item.word === word && item.articleKey === articleKey; });
}

// ==========================================
// 下拉菜单
// ==========================================
function toggleDropdown() {
    var dd = document.getElementById("dropdown");
    dd.classList.toggle("show");
    document.getElementById("settingsDropdown").classList.remove("show");
}

function menuAction(action) {
    document.getElementById("dropdown").classList.remove("show");
    if (action === "read") switchTab("read");
    else if (action === "wordbank") showTab("wordbank");
}

function toggleShowEn() {
    var checked = document.getElementById("showEnToggle").checked;
    setSetting("showEn", checked);
}

// ==========================================
// 排版设置面板
// ==========================================
var fontSizeLevels = [14, 16, 18, 20, 22];
var fontSizeIdx = 1; // 默认 16px
var lineHeights = [1.5, 1.8, 2.1, 2.4, 2.8];
var lineHeightIdx = 2; // 默认 2.1

function toggleSettings() {
    var dd = document.getElementById("settingsDropdown");
    var opening = !dd.classList.contains("show");
    dd.classList.toggle("show");
    document.getElementById("dropdown").classList.remove("show");
    if (opening) {
        var fl = ["小","较小","标准","较大","大"];
        document.getElementById("fontSizeLabel").textContent = fl[fontSizeIdx] + " (" + fontSizeLevels[fontSizeIdx] + "px)";
        var ll = ["紧凑","较松","标准","宽松","很宽"];
        document.getElementById("lineHeightLabel").textContent = ll[lineHeightIdx];
    }
}

function changeLineHeight(delta) {
    lineHeightIdx = Math.max(0, Math.min(lineHeights.length - 1, lineHeightIdx + delta));
    document.querySelector(".article-content").style.lineHeight = lineHeights[lineHeightIdx];
    var labels = ["紧凑", "较松", "标准", "宽松", "很宽"];
    document.getElementById("lineHeightLabel").textContent = labels[lineHeightIdx];
    setSetting("lineHeightIdx", lineHeightIdx);
}

function changeFontSize(delta) {
    fontSizeIdx = Math.max(0, Math.min(fontSizeLevels.length - 1, fontSizeIdx + delta));
    document.querySelector(".article-content").style.fontSize = fontSizeLevels[fontSizeIdx] + "px";
    var labels = ["小", "较小", "标准", "较大", "大"];
    document.getElementById("fontSizeLabel").textContent = labels[fontSizeIdx] + " (" + fontSizeLevels[fontSizeIdx] + "px)";
    setSetting("fontSizeIdx", fontSizeIdx);
}

function changeAlign() {
    var val = document.getElementById("alignSelect").value;
    document.querySelector(".article-content").style.textAlign = val;
    setSetting("textAlign", val);
}

function toggleDarkMode() {
    var on = document.getElementById("darkModeToggle").checked;
    document.body.classList.toggle("dark", on);
    setSetting("darkMode", on);
}

// ==========================================
// 色彩主题
// ==========================================
var COLOR_PRESETS = [
    { name: "淡蓝", hex: "#4a90d9", bg: "#edf3fa" },
    { name: "浅绿", hex: "#4caf50", bg: "#edf7ee" },
    { name: "暖橙", hex: "#f4a236", bg: "#fef7ed" },
    { name: "柔粉", hex: "#e57373", bg: "#fdf0f0" },
    { name: "丁香紫", hex: "#9575cd", bg: "#f3eff9" },
    { name: "灰蓝", hex: "#607d8b", bg: "#eef1f3" },
    { name: "青绿", hex: "#26a69a", bg: "#eaf5f4" },
    { name: "雅金", hex: "#b8860b", bg: "#fdf8ed" }
];

function buildColorPalette() {
    var palette = document.getElementById("colorPalette");
    if (!palette) return;
    var current = getSetting("accentColor", "#4a90d9");
    palette.innerHTML = "";

    COLOR_PRESETS.forEach(function(c) {
        var dot = document.createElement("div");
        dot.className = "color-dot" + (c.hex === current ? " active" : "");
        dot.style.background = c.hex;
        dot.title = c.name;
        dot.onclick = function() { setAccent(c.hex, c.bg); };
        palette.appendChild(dot);
    });

    var custom = document.createElement("div");
    custom.className = "color-dot custom";
    custom.title = "自定义颜色";
    custom.onclick = pickCustomColor;
    palette.appendChild(custom);
}

function setAccent(hex, bg) {
    document.documentElement.style.setProperty("--accent", hex);
    document.documentElement.style.setProperty("--accent-light", hex + "25");
    document.documentElement.style.setProperty("--accent-dark", darkenColor(hex));
    document.body.style.background = bg || hex + "10";
    // 毛玻璃导航栏也带一点主题色
    document.documentElement.style.setProperty("--bar-bg", hex + "12");
    setSetting("accentColor", hex);
    setSetting("accentBg", bg || hex + "10");
    document.documentElement.style.setProperty("--bg-tint", bg || hex + "10");
    buildColorPalette();
}

function pickCustomColor() {
    var input = document.createElement("input");
    input.type = "color";
    input.value = getSetting("accentColor", "#4a90d9");
    input.onchange = function() { setAccent(input.value, input.value + "15"); input.remove(); };
    input.style.position = "absolute"; input.style.opacity = "0"; input.style.pointerEvents = "none";
    document.body.appendChild(input);
    setTimeout(function() { input.click(); }, 50);
}

function darkenColor(hex) {
    var r = Math.max(0, parseInt(hex.slice(1,3), 16) - 40);
    var g = Math.max(0, parseInt(hex.slice(3,5), 16) - 40);
    var b = Math.max(0, parseInt(hex.slice(5,7), 16) - 40);
    return "#" + r.toString(16).padStart(2,"0") + g.toString(16).padStart(2,"0") + b.toString(16).padStart(2,"0");
}

function toggleFontPicker() {
    var picker = document.getElementById("fontPicker");
    picker.classList.toggle("show");
}

function selectFont(font, label) {
    document.getElementById("fontSelectLabel").textContent = label;
    document.getElementById("fontPicker").classList.remove("show");
    // 高亮当前选中
    document.querySelectorAll(".font-option").forEach(function(o) { o.classList.remove("active"); });
    document.querySelector('.font-option[data-font="' + font + '"]').classList.add("active");

    if (font === "default") {
        document.body.style.fontFamily = "";
    } else {
        document.body.style.fontFamily = "'" + font + "', serif";
    }
    setSetting("fontFamily", font);
}

function initFont() {
    var saved = getSetting("fontFamily", "Merriweather");
    if (saved === "default") {
        document.getElementById("fontSelectLabel").textContent = "System Default";
    } else {
        document.getElementById("fontSelectLabel").textContent = saved;
    }
    if (saved !== "default") {
        document.body.style.fontFamily = "'" + saved + "', serif";
    }
    // 标记当前选项
    var active = document.querySelector('.font-option[data-font="' + saved + '"]');
    if (active) active.classList.add("active");
}

// 点击其他地方关闭字体选择器
document.addEventListener("click", function(e) {
    if (!e.target.closest("#fontSelectWrap") && !e.target.closest("#fontPicker")) {
        document.getElementById("fontPicker").classList.remove("show");
    }
});

function initAccent() {
    var saved = getSetting("accentColor", "#e57373");
    var savedBg = getSetting("accentBg", "#fdf0f0");
    document.documentElement.style.setProperty("--accent", saved);
    document.documentElement.style.setProperty("--accent-light", saved + "25");
    document.documentElement.style.setProperty("--accent-dark", darkenColor(saved));
    document.documentElement.style.setProperty("--bar-bg", saved + "12");
    document.body.style.background = savedBg;
    document.documentElement.style.setProperty("--bg-tint", savedBg);
    buildColorPalette();
}

function applyDisplaySettings() {
    var c = document.querySelector(".article-content");
    if (!c) return;
    fontSizeIdx = getSetting("fontSizeIdx", 1);
    c.style.fontSize = fontSizeLevels[fontSizeIdx] + "px";
    lineHeightIdx = getSetting("lineHeightIdx", 2);
    c.style.lineHeight = lineHeights[lineHeightIdx];
    c.style.textAlign = getSetting("textAlign", "left");
}

function initDisplaySettings() {
    fontSizeIdx = getSetting("fontSizeIdx", 1);
    lineHeightIdx = getSetting("lineHeightIdx", 2);
    document.getElementById("alignSelect").value = getSetting("textAlign", "left");
    var dm = getSetting("darkMode", false);
    document.getElementById("darkModeToggle").checked = dm;
    document.body.classList.toggle("dark", dm);
}

// 点击空白关闭下拉
document.addEventListener("click", function(e) {
    var dd = document.getElementById("dropdown");
    var sd = document.getElementById("settingsDropdown");
    if (dd.classList.contains("show") && !e.target.closest(".dropdown-wrapper")) {
        dd.classList.remove("show");
    }
    if (sd.classList.contains("show") && !e.target.closest(".dropdown-wrapper")) {
        sd.classList.remove("show");
    }
});

// ==========================================
// 初始化
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("showEnToggle").checked = getSetting("showEn", true);
    initFont();
    initAccent();
    initDisplaySettings();
    showArticleList("science");
    // 页面隐藏/切后台/离开时停止朗读，防止退出文章后继续播放（机器音 bug 兜底）
    document.addEventListener("visibilitychange", function() {
        if (document.hidden && TTS.on) ttsStop();
    });
    window.addEventListener("pagehide", function() {
        if (TTS.on) ttsStop();
    });
});

// ==========================================
// 面板切换
// ==========================================
function showTab(tabName) {
    document.getElementById("read-panel").style.display = (tabName === "read") ? "block" : "none";
    document.getElementById("wordbank-panel").style.display = (tabName === "wordbank") ? "block" : "none";
    document.getElementById("topic-bar").style.display = (tabName === "read") ? "flex" : "none";
    if (tabName === "wordbank") renderWordBank();
}

function switchTab(tabName) {
    showTab(tabName);
    if (tabName === "read") showArticleList(currentTopic);
}

// ==========================================
// 主题/文章
// ==========================================
function selectTopic(topic) {
    currentTopic = topic;
    document.querySelectorAll(".topic-btn").forEach(function(btn) { btn.classList.remove("active"); });
    var topics = ["daily", "science", "health", "life", "culture", "nature", "sports", "gaming"];
    var buttons = document.querySelectorAll(".topic-btn");
    var idx = topics.indexOf(topic);
    if (idx >= 0) buttons[idx].classList.add("active");
    showArticleList(topic);
    closePopup();
}

// 难度菱形（红色旋转45°正方形）
function difficultyDiamonds(d) {
    if (!d || d < 1) return "";
    var html = '<span class="difficulty-diamonds">';
    for (var i = 0; i < d; i++) html += '<span class="difficulty-diamond"></span>';
    html += '</span>';
    return html;
}

// 显示文章列表
function showArticleList(topic) {
    currentTopic = topic;
    document.getElementById("articleListView").style.display = "block";
    document.getElementById("articleDetailView").style.display = "none";
    document.getElementById("textSettingsGroup").style.display = "none";
    document.getElementById("read-panel").style.display = "block";
    document.getElementById("wordbank-panel").style.display = "none";
    document.getElementById("topic-bar").style.display = "flex";
    document.getElementById("searchBar").style.display = (topic === "daily") ? "none" : "flex";

    var keys = getTopicArticles(topic);
    var listDiv = document.getElementById("articleList");
    listDiv.innerHTML = keys.map(function(key) {
        var a = articles[key];
        var preview = a.text.replace(/\. /g, ". ").split(". ").slice(0, 2).join(". ") + ".";
        if (preview.length > 150) preview = preview.slice(0, 150) + "...";
        return '<div class="article-list-item" onclick="openArticle(\'' + key + '\')">' +
            '<div class="ali-title-row">' +
            '<div class="ali-title">' + a.title + '</div>' +
            difficultyDiamonds(a.difficulty) +
            '</div>' +
            (a.titleCn ? '<div class="ali-title-cn">' + a.titleCn + '</div>' : '') +
            '<div class="ali-preview">' + preview + '</div>' +
            (a.source ? '<div class="ali-source">' + a.source + '</div>' : '') +
            '</div>';
    }).join("");
}

// 打开文章详情
function openArticle(key) {
    currentArticleKey = key;
    document.getElementById("articleListView").style.display = "none";
    document.getElementById("articleDetailView").style.display = "block";
    document.getElementById("textSettingsGroup").style.display = "block";
    loadArticle(key);
    window.scrollTo(0, 0);
}

// 返回列表
function backToList() {
    ttsStop();
    var detail = document.getElementById("articleDetailView");
    detail.classList.add("slide-out");
    setTimeout(function() {
        document.getElementById("articleListView").style.display = "block";
        detail.style.display = "none";
        detail.classList.remove("slide-out");
        document.getElementById("textSettingsGroup").style.display = "none";
        closePopup();
        window.scrollTo(0, 0);
    }, 200);
}

// ==========================================
// 文章
// ==========================================
// 判断 "." 前的词是否为常见缩写（Mr./Dr./U.S. 等，不应在此断句）
function isAbbrevAt(text, dotIdx) {
    var start = dotIdx;
    while (start > 0 && /\S/.test(text[start - 1])) start--;
    var word = text.substring(start, dotIdx).toLowerCase();
    if (!word) return false;
    var core = word.replace(/\./g, "");
    return /^(mr|mrs|ms|dr|st|sr|jr|vs|etc|inc|ltd|co|prof|rev|hon|dept|ave|blvd|apt|no|nos|mt|ft|sec|min|hr|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|us|uk|fig|vol|eds|al|est|approx|east|west|north|south)$/i.test(core);
}

// 按句子切分英文文本（供朗读/高亮使用）
function splitSentences(text) {
    var raw = [], cur = "";
    for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        cur += ch;
        if (ch === "." || ch === "!" || ch === "?") {
            var next = text[i + 1];
            // 只有后面是空白/结尾才算句末，引号（如 "Hello." 的 "."）作为句子一部分继续累积
            var boundary = (next === undefined || /\s/.test(next));
            if (ch === "." && isAbbrevAt(text, i)) boundary = false;
            if (boundary) { raw.push(cur); cur = ""; }
        }
    }
    if (cur.trim()) raw.push(cur);
    var result = [];
    for (var k = 0; k < raw.length; k++) {
        var s = raw[k].trim();
        if (s) result.push(s);
    }
    return result;
}

function makeWordsClickable(container, text) {
    container.innerHTML = "";
    var knownWords = getWordBank().map(function(item) { return item.word.toLowerCase(); });
    var sentences = splitSentences(text);
    for (var si = 0; si < sentences.length; si++) {
        var sentEl = document.createElement("span");
        sentEl.className = "sentence";
        container.appendChild(sentEl);
        var tokens = sentences[si].split(/(\s+)/);
        tokens.forEach(function(token) {
            if (/^\s+$/.test(token)) { sentEl.appendChild(document.createTextNode(token)); return; }
            var match = token.match(/^([a-zA-Z]+)([\.,;:!\?\)\]\"\']*)$/);
            if (match) {
                var word = match[1], punct = match[2];
                var span = document.createElement("span");
                span.className = "word";
                span.textContent = word;
                span.title = "点击查词";
                // 用原型匹配：库里存 start，文章里的 starting/starts 也算已认识
                if (knownWords.indexOf(getBaseWord(word)) !== -1) span.classList.add("known");
                span.addEventListener("click", function(e) { e.stopPropagation(); lookupWord(word, span); });
                sentEl.appendChild(span);
                if (punct) sentEl.appendChild(document.createTextNode(punct));
            } else { sentEl.appendChild(document.createTextNode(token)); }
        });
        if (si < sentences.length - 1) container.appendChild(document.createTextNode(" "));
    }
}

function loadArticle(key) {
    var article = articles[key];
    if (!article) return;
    currentArticleKey = key;
    currentTopic = key.split("-")[0];
    var detailView = document.getElementById("articleDetailView");
    detailView.classList.remove("show", "slide-out");
    // Force reflow then add show class for animation
    void detailView.offsetWidth;
    detailView.classList.add("show");
    makeWordsClickable(document.getElementById("articleTitle"), article.title);
    document.getElementById("articleDifficulty").innerHTML = difficultyDiamonds(article.difficulty);
    var titleCnEl = document.getElementById("articleTitleCn");
    if (article.titleCn) {
        titleCnEl.textContent = article.titleCn;
        titleCnEl.style.display = "block";
    } else {
        titleCnEl.style.display = "none";
    }
    var src = article.source || "";
    if (src.indexOf("Wikipedia") === 0) src = "Wikipedia";
    document.getElementById("articleSource").textContent = src ? "来源：" + src : "";
    // 图片：加载完成后再显示
    var imgEl = document.getElementById("articleImage");
    var capEl = document.getElementById("articleImageCaption");
    if (article.image) {
        imgEl.style.display = "none";
        capEl.style.display = "none";
        imgEl.onload = function() {
            imgEl.classList.add("loaded");
            imgEl.style.display = "block";
            if (article.imageCaption) {
                capEl.textContent = article.imageCaption;
                capEl.style.display = "block";
            }
        };
        imgEl.onerror = function() {
            imgEl.style.display = "none";
            capEl.style.display = "none";
        };
        imgEl.src = article.image;
        imgEl.alt = article.title;
        imgEl.referrerPolicy = "no-referrer";
    } else {
        imgEl.style.display = "none";
        capEl.style.display = "none";
    }
    makeWordsClickable(document.getElementById("articleContent"), article.text);
    applyDisplaySettings();
    ttsOnArticleLoad();
}

function getTopicArticles(topic) {
    var keys = [];
    if (articles[topic]) keys.push(topic);
    var n = 2;
    while (articles[topic + "-" + n]) { keys.push(topic + "-" + n); n++; }
    return keys;
}

// ==========================================
// 文章搜索
// ==========================================
var _searchActive = false;

function handleSearch(query) {
    var q = query.trim();
    var clearBtn = document.getElementById("searchClearBtn");
    if (q.length === 0) {
        clearBtn.style.display = "none";
        if (_searchActive) {
            _searchActive = false;
            showArticleList(currentTopic);
        }
        return;
    }
    clearBtn.style.display = "inline-block";
    _searchActive = true;
    renderSearchResults(searchArticles(q));
}

function clearSearch() {
    document.getElementById("searchInput").value = "";
    handleSearch("");
    document.getElementById("searchInput").focus();
}

function searchArticles(query) {
    var q = query.toLowerCase();
    var results = [];
    var TOPIC_NAMES = { "daily": "每日精选", "science": "科学科技", "health": "健康", "life": "生活", "culture": "文化", "nature": "自然", "sports": "体育", "gaming": "游戏" };
    for (var key in articles) {
        var a = articles[key];
        var inTitle = a.title.toLowerCase().indexOf(q) !== -1;
        var inTitleCn = a.titleCn && a.titleCn.toLowerCase().indexOf(q) !== -1;
        var inText = a.text.toLowerCase().indexOf(q) !== -1;
        if (inTitle || inTitleCn || inText) {
            var topicKey = key.split("-")[0];
            results.push({
                key: key,
                title: a.title,
                titleCn: a.titleCn || "",
                text: a.text,
                source: a.source || "",
                topic: TOPIC_NAMES[topicKey] || "",
                difficulty: a.difficulty || 0,
                score: inTitle ? 2 : 1
            });
        }
    }
    results.sort(function(a, b) { return b.score - a.score; });
    return results;
}

function renderSearchResults(results) {
    var listDiv = document.getElementById("articleList");
    if (results.length === 0) {
        listDiv.innerHTML = '<div class="empty-hint" style="padding:48px 0;text-align:center;color:#aeaeb2;">没有找到匹配的文章</div>';
        return;
    }
    listDiv.innerHTML = results.map(function(r) {
        var preview = r.text.replace(/\. /g, ". ").split(". ").slice(0, 2).join(". ") + ".";
        if (preview.length > 150) preview = preview.slice(0, 150) + "...";
        return '<div class="article-list-item" onclick="openArticle(\'' + r.key + '\')">' +
            '<div class="ali-title-row">' +
            '<div class="ali-title">' + r.title + '</div>' +
            difficultyDiamonds(r.difficulty) +
            '</div>' +
            (r.titleCn ? '<div class="ali-title-cn">' + r.titleCn + '</div>' : '') +
            '<div class="ali-preview">' + preview + '</div>' +
            (r.topic ? '<div class="ali-source">话题：' + r.topic + '</div>' : '') +
            '</div>';
    }).join("");
}

// ==========================================
// 查词
// ==========================================
async function lookupWord(word, element) {
    if (currentWordElement) currentWordElement.classList.remove("tapped");
    element.classList.add("tapped");
    currentWordElement = element;
    currentWord = word;
    var popup = document.getElementById("wordPopup");
    var wordEl = document.getElementById("popupWord");
    // 本地音标（优先），显示在单词旁边
    var localPhonetic = PHONETIC[word.toLowerCase()];
    if (!localPhonetic) {
        var baseInfo = findInDict(word);
        if (baseInfo && baseInfo.base !== word.toLowerCase()) {
            localPhonetic = PHONETIC[baseInfo.base.toLowerCase()];
        }
    }
    currentPhonetic = localPhonetic || "";
    wordEl.innerHTML = word +
            (localPhonetic ? ' <span class="popup-phonetic">/' + localPhonetic + '/</span>' : '') +
            ' <span class="speaker-icon" onclick="playPronunciation(\'' + word.replace(/'/g, "\\'") + '\')" title="播放读音"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg></span>';
    document.getElementById("popupMeaning").textContent = "查询中...";
    popup.classList.add("show");
    ttsUpdateBar(); // 查词弹窗打开 → 淡出隐藏底部控制条
    document.getElementById("overlay").style.display = "block";
    var saveBtn = document.getElementById("saveWordBtn");
    if (isInWordBank(getBaseWord(word), currentArticleKey)) {
        saveBtn.textContent = "✓ 已在单词库中"; saveBtn.className = "action-btn saved"; saveBtn.onclick = removeSavedWord;
    } else {
        saveBtn.textContent = "+ 加入单词库"; saveBtn.className = "action-btn"; saveBtn.onclick = saveWord;
    }
    await lookupChinese(word);
}

// ==========================================
// 词性缩写 + 变形词还原
// ==========================================
var POS_MAP = { "noun": "n.", "verb": "v.", "adjective": "adj.", "adverb": "adv.", "preposition": "prep.", "conjunction": "conj.", "interjection": "interj.", "pronoun": "pron.", "determiner": "det.", "numeral": "num.", "article": "art.", "auxiliary": "aux." };
function shortPos(p) { return POS_MAP[p.toLowerCase()] || p + "."; }

function getBaseForms(word) {
    var lower = word.toLowerCase();
    var forms = [lower];
    if (lower.endsWith("ing")) { var b = lower.slice(0, -3); forms.push(b); forms.push(b + "e"); if (b.length > 2 && b[b.length-1] === b[b.length-2]) forms.push(b.slice(0, -1)); }
    if (lower.endsWith("ed")) { var b = lower.slice(0, -2); forms.push(b); forms.push(b.slice(0, -1)); forms.push(b + "e"); }
    if (lower.endsWith("es") && lower.length > 3) { forms.push(lower.slice(0, -1)); forms.push(lower.slice(0, -2)); }
    else if (lower.endsWith("s") && !lower.endsWith("ss")) { forms.push(lower.slice(0, -1)); }
    if (lower.endsWith("er") && lower.length > 4) { forms.push(lower.slice(0, -2)); forms.push(lower.slice(0, -2) + "e"); }
    if (lower.endsWith("est") && lower.length > 5) { var b = lower.slice(0, -3); forms.push(b); if (b.length > 1 && b[b.length-1] === b[b.length-2]) forms.push(b.slice(0, -1)); }
    if (lower.endsWith("ly") && lower.length > 4) forms.push(lower.slice(0, -2));
    if (lower.endsWith("ies") && lower.length > 4) forms.push(lower.slice(0, -3) + "y");
    // -able: rechargeable → recharge
    if (lower.endsWith("able") && lower.length > 6) { var b = lower.slice(0, -4); forms.push(b); forms.push(b + "e"); }
    // -ment: government → govern
    if (lower.endsWith("ment") && lower.length > 6) forms.push(lower.slice(0, -4));
    // -ness: happiness → happy (approximate)
    if (lower.endsWith("ness") && lower.length > 6) { var b = lower.slice(0, -4); forms.push(b); forms.push(b.slice(0, -1) + "y"); }
    // -tion/-sion: 不精确，跳过
    return forms;
}

function findInDict(word) {
    var lower = word.toLowerCase();
    var forms = getBaseForms(word);
    var exceptions = ["news","means","series","species","always","perhaps","bias","canvas","lens","atlas","chaos","focus","campus","virus","genius","versus"];
    if (exceptions.indexOf(lower) !== -1 && ZH_DICT[lower]) return { base: lower, entry: ZH_DICT[lower] };
    for (var i = 1; i < forms.length; i++) { if (ZH_DICT[forms[i]]) return { base: forms[i], entry: ZH_DICT[forms[i]] }; }
    if (ZH_DICT[lower]) return { base: lower, entry: ZH_DICT[lower] };
    return null;
}

// ==========================================
// 单词入库原型还原（变形→原型）
// ==========================================
var BASE_WORD_EXCEPTIONS = ["news","means","series","species","always","perhaps","bias","canvas","lens","atlas","chaos","focus","campus","virus","genius","versus","plus","minus","bus","gas","this","status","analysis","basis","crisis","thesis","emphasis","ever","letter"];

// 带 -ing/-ed 的形容词（不能还原成动词）
var PARTICIPIAL_ADJS = ["interesting","interested","exciting","excited","boring","bored","tiring","tired","surprising","surprised","amazing","amazed","confusing","confused","worrying","worried","disappointing","disappointed","frustrating","frustrated","embarrassing","embarrassed","frightening","frightened","relaxing","relaxed","exhausting","exhausted","annoying","annoyed","pleasing","pleased","satisfying","satisfied","fascinating","fascinated","shocking","shocked","moving","moved","convincing","convinced","determined","devoted","impressed","impressive","surrounded","limited","unexpected","related","complicated","experienced","dedicated","occupied","intended","following","remaining","challenging","growing","surrounding"];

function isVerbEntry(entry) { return /^v[t]?[i]?\./.test((entry || "").trim()); }
function isAdjEntry(entry) { return /^adj\.|^a\./.test((entry || "").trim()); }

// 把变形词还原成原型（starting→start, things→thing, bigger→big）
// 规则：-ies/-s/-es → 单数/原形；-ing/-ed → 动词原形；-er/-est → 形容词原级
// 保护：例外清单 + 还原结果必须在词典里能找到
function getBaseWord(word) {
    var lower = word.toLowerCase();
    if (BASE_WORD_EXCEPTIONS.indexOf(lower) !== -1) return lower;
    if (PARTICIPIAL_ADJS.indexOf(lower) !== -1) return lower;  // -ing/-ed 形容词不还原
    if (lower.length < 3) return lower;
    var origInDict = !!ZH_DICT[lower];
    // 带 -ing/-ed 且词典标为形容词 → 不还原（如 interesting, tired, bored）
    if (origInDict && isAdjEntry(ZH_DICT[lower]) && (lower.endsWith("ing") || lower.endsWith("ed"))) return lower;

    var cands = [];
    if (lower.endsWith("ies") && lower.length > 4) cands.push({ c: lower.slice(0, -3) + "y", r: "ies" });
    if (lower.endsWith("ing") && lower.length > 4) {
        var b = lower.slice(0, -3);
        cands.push({ c: b, r: "ing" });
        cands.push({ c: b + "e", r: "ing" });
        if (b.length > 2 && b[b.length-1] === b[b.length-2]) cands.push({ c: b.slice(0, -1), r: "ing" });
    }
    if (lower.endsWith("ed") && lower.length > 3) {
        var b = lower.slice(0, -2);
        cands.push({ c: b, r: "ed" });
        cands.push({ c: b + "e", r: "ed" });
        if (b.length > 1 && b[b.length-1] === b[b.length-2]) cands.push({ c: b.slice(0, -1), r: "ed" });
    }
    if (lower.endsWith("es") && lower.length > 3) {
        cands.push({ c: lower.slice(0, -1), r: "es" });
        cands.push({ c: lower.slice(0, -2), r: "es" });
    } else if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 3) {
        cands.push({ c: lower.slice(0, -1), r: "s" });
    }
    if (lower.endsWith("er") && lower.length > 4) {
        var b = lower.slice(0, -2);
        cands.push({ c: b, r: "er" });
        cands.push({ c: b + "e", r: "er" });
        if (b.length > 1 && b[b.length-1] === b[b.length-2]) cands.push({ c: b.slice(0, -1), r: "er" });
    }
    if (lower.endsWith("est") && lower.length > 5) {
        var b = lower.slice(0, -3);
        cands.push({ c: b, r: "est" });
        if (b.length > 1 && b[b.length-1] === b[b.length-2]) cands.push({ c: b.slice(0, -1), r: "est" });
    }

    for (var i = 0; i < cands.length; i++) {
        var c = cands[i].c, entry = ZH_DICT[c];
        if (!entry) continue;
        var rule = cands[i].r;
        if (rule === "ing" || rule === "ed") {
            if (isVerbEntry(entry)) return c;
            if (!origInDict) return c;
        } else if (rule === "er" || rule === "est") {
            if (isAdjEntry(entry)) return c;
        } else {
            return c;
        }
    }
    return lower;
}

async function lookupChinese(word) {
    var showEn = getSetting("showEn", true);
    var found = findInDict(word);
    var popupEl = document.getElementById("popupMeaning");

    // ① 先显示"翻译中..."（避免本地词典和有道结果来回闪）
    popupEl.innerHTML = '<p style="font-size:15px;color:#aeaeb2;">翻译中...</p>';

    // ③ 有道中文翻译（优先显示）
    var youdaoData = await fetchYoudao(word);
    var youdaoEntry = youdaoData ? youdaoData.explain : null;

    // ④ 渲染中文部分 + 淡入（音标已放在标题栏单词旁边）
    var html = "";
    if (youdaoEntry) {
        html += '<p style="font-size:16px;font-weight:600;margin-bottom:4px;">' + youdaoEntry + '</p>';
    } else if (found) {
        html += '<p style="font-size:16px;font-weight:600;margin-bottom:4px;">' + found.entry + '</p>';
    }
    if (html) {
        popupEl.innerHTML = html;
        fadeInPopup(popupEl);
    }

    // ⑤ 后台加载词典API（音标/音频始终需要，与英文释义开关无关）
    try { currentDictData = await fetchDictAPI(word); } catch(e) { currentDictData = null; }

    // 缓存音频 URL
    if (currentDictData && !audioCache[word]) {
        for (var i2 = 0; i2 < currentDictData.length; i2++) {
            var phs2 = currentDictData[i2].phonetics || [];
            for (var j2 = 0; j2 < phs2.length; j2++) {
                if (phs2[j2].audio) { audioCache[word] = phs2[j2].audio; break; }
            }
            if (audioCache[word]) break;
        }
    }
    if (!audioCache[word] && found && found.base !== word.toLowerCase()) {
        if (!audioCache[found.base]) {
            try {
                var baseData = await fetchDictAPI(found.base);
                if (baseData) {
                    for (var k = 0; k < baseData.length; k++) {
                        var phs3 = baseData[k].phonetics || [];
                        for (var m = 0; m < phs3.length; m++) {
                            if (phs3[m].audio) { audioCache[found.base] = phs3[m].audio; break; }
                        }
                        if (audioCache[found.base]) break;
                    }
                }
            } catch(e) {}
        }
        if (audioCache[found.base]) audioCache[word] = audioCache[found.base];
    }

    // 音标补全：本地音标缺失时，用词典API的音标更新标题栏
    if (!currentPhonetic && currentDictData && currentDictData[0]) {
        var pText = currentDictData[0].phonetic;
        if (!pText && currentDictData[0].phonetics && currentDictData[0].phonetics.length > 0) {
            for (var p = 0; p < currentDictData[0].phonetics.length; p++) {
                if (currentDictData[0].phonetics[p].text) { pText = currentDictData[0].phonetics[p].text; break; }
            }
        }
        if (pText) {
            var phSpan = document.querySelector("#popupWord .popup-phonetic");
            if (phSpan) {
                phSpan.textContent = "/" + pText + "/";
            } else {
                // 标题栏还没有音标，插到单词和小喇叭之间
                var wordNode = document.getElementById("popupWord");
                var speaker = wordNode.querySelector(".speaker-icon");
                var newSpan = document.createElement("span");
                newSpan.className = "popup-phonetic";
                newSpan.textContent = "/" + pText + "/";
                if (speaker) {
                    wordNode.insertBefore(newSpan, speaker);
                } else {
                    wordNode.appendChild(newSpan);
                }
            }
            currentPhonetic = pText;
        }
    }

    // ⑥ 英文释义淡入补充（独立容器，不闪中文）
    // 显示条件：开英文释义 或 没有中文结果时兜底
    if (currentDictData && (showEn || !(youdaoEntry || found))) {
        var enHtml = "";
        currentDictData.forEach(function(entry) { entry.meanings.forEach(function(m) { enHtml += "<p><em>" + shortPos(m.partOfSpeech) + "</em> " + m.definitions.slice(0,2).map(function(d){return d.definition}).join("；") + "</p>"; }); });
        if (enHtml) {
            var enDiv = document.createElement("div");
            enDiv.className = "popup-english";
            enDiv.innerHTML = (html ? '<hr style="border:none;border-top:1px solid #e5e5ea;margin:8px 0;">' : "") + enHtml;
            popupEl.appendChild(enDiv);
            fadeInPopup(enDiv);
        }
    }

    // ⑦ 兜底：确实查不到
    if (!popupEl.textContent || popupEl.textContent.trim() === "翻译中...") {
        popupEl.innerHTML = "<p>该单词暂未收录</p>";
    }
}

// 淡入动画辅助函数
function fadeInPopup(el) {
    el.classList.remove("popup-fade");
    void el.offsetWidth;
    el.classList.add("popup-fade");
}

async function fetchDictAPI(word) {
    try {
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, 5000);
        var r = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word), { signal: controller.signal });
        clearTimeout(timer);
        return r.ok ? await r.json() : null;
    } catch(e) { return null; }
}

// 有道词典中文翻译（JSONP 方式，绕过跨域限制，无需API Key）
var _youdaoCbCount = 0;
function fetchYoudao(word) {
    return new Promise(function(resolve) {
        var callbackName = "youdaoCb" + (++_youdaoCbCount) + "_" + Math.floor(Math.random() * 100000);
        var script = document.createElement("script");
        script.src = "https://dict.youdao.com/suggest?num=5&ver=3.0&doctype=json&cache=false&le=en&q=" + encodeURIComponent(word) + "&callback=" + callbackName;

        var done = false;
        var timer = setTimeout(function() { if (!done) { done = true; cleanup(); resolve(null); } }, 5000);

        function cleanup() {
            clearTimeout(timer);
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        }

        window[callbackName] = function(data) {
            if (done) return;
            done = true;
            cleanup();
            try {
                if (data && data.data && data.data.entries && data.data.entries.length > 0) {
                    // 优先精确匹配，其次取第一条
                    for (var i = 0; i < data.data.entries.length; i++) {
                        if (data.data.entries[i].entry.toLowerCase() === word.toLowerCase()) {
                            resolve(data.data.entries[i]);
                            return;
                        }
                    }
                    resolve(data.data.entries[0]);
                } else {
                    resolve(null);
                }
            } catch(e) { resolve(null); }
        };

        script.onerror = function() { if (!done) { done = true; cleanup(); resolve(null); } };
        document.head.appendChild(script);
    });
}

// ==========================================
// 句子翻译
// ==========================================
function findSentence(wordEl) {
    var contentDiv = document.getElementById("articleContent");
    var fullText = contentDiv.textContent;
    var allWords = contentDiv.querySelectorAll(".word");
    var wi = -1;
    for (var i = 0; i < allWords.length; i++) { if (allWords[i] === wordEl) { wi = i; break; } }
    if (wi === -1) return "";
    var positions = [], sp = 0;
    for (var j = 0; j < allWords.length; j++) { var w = allWords[j]; var idx = fullText.indexOf(w.textContent, sp); if (idx !== -1) { positions.push({s:idx, e:idx+w.textContent.length}); sp = idx + w.textContent.length; } }
    if (wi >= positions.length) return "";
    var ss = 0, se = fullText.length;
    for (var k = wi; k >= 0; k--) { if (k > 0) { if (/[.!?]/.test(fullText.substring(positions[k-1].e, positions[k].s))) { ss = positions[k].s; break; } } else { var p = fullText.substring(0, positions[0].s); var lp = Math.max(p.lastIndexOf("."), p.lastIndexOf("!"), p.lastIndexOf("?")); if (lp !== -1) { ss = lp + 1; while (ss < fullText.length && fullText[ss] === " ") ss++; } } }
    for (var m = wi; m < positions.length; m++) { var pi = fullText.indexOf(".", positions[m].e), ei = fullText.indexOf("!", positions[m].e), qi = fullText.indexOf("?", positions[m].e); var ei2 = fullText.length; if (pi !== -1) ei2 = Math.min(ei2, pi); if (ei !== -1) ei2 = Math.min(ei2, ei); if (qi !== -1) ei2 = Math.min(ei2, qi); if (ei2 < fullText.length) { se = ei2 + 1; break; } }
    return fullText.substring(ss, se).trim();
}

async function translateSentence() {
    if (!currentWordElement) return;
    var sentence = findSentence(currentWordElement);
    if (!sentence) return;
    highlightSentence(currentWordElement);
    var popup = document.getElementById("popupMeaning");
    popup.innerHTML += '<hr style="border:none;border-top:1px solid #e5e5ea;margin:12px 0;"><p style="color:#6b7280;margin-bottom:4px;"><strong>整句翻译</strong></p><p style="color:#aeaeb2;font-size:13px;">"' + sentence + '"</p><p id="sentTransResult" style="margin-top:8px;">翻译中...</p>';
    try {
        var r = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(sentence) + "&langpair=en|zh-CN");
        if (r.ok) { var d = await r.json(); document.getElementById("sentTransResult").innerHTML = "<strong>" + d.responseData.translatedText + "</strong>"; }
    } catch(e) {}
}

function highlightSentence(wordEl) {
    document.querySelectorAll(".sentence-highlight").forEach(function(el) { el.classList.remove("sentence-highlight"); });
    var allWords = document.getElementById("articleContent").querySelectorAll(".word");
    var wi = -1;
    for (var i = 0; i < allWords.length; i++) { if (allWords[i] === wordEl) { wi = i; break; } }
    if (wi === -1) return;
    var start = Math.max(0, wi - 5), end = Math.min(allWords.length - 1, wi + 15);
    for (var k = start; k <= end; k++) allWords[k].classList.add("sentence-highlight");
    setTimeout(function() { document.querySelectorAll(".sentence-highlight").forEach(function(el) { el.classList.remove("sentence-highlight"); }); }, 4000);
}

// ==========================================
// 弹窗
// ==========================================
function saveWord() {
    if (!currentWord) return;
    var article = articles[currentArticleKey];
    var title = article ? article.title : "未知文章";
    var base = getBaseWord(currentWord);  // 入库前还原成原型
    addToWordBank(base, document.getElementById("popupMeaning").textContent, currentArticleKey, title);
    var btn = document.getElementById("saveWordBtn");
    btn.textContent = "✓ 已在单词库中"; btn.className = "action-btn saved"; btn.onclick = removeSavedWord;
    if (currentWordElement) currentWordElement.classList.add("known");
}

function removeSavedWord() {
    if (!currentWord) return;
    removeFromWordBank(currentWord, currentArticleKey);
    var btn = document.getElementById("saveWordBtn");
    btn.textContent = "+ 加入单词库"; btn.className = "action-btn"; btn.onclick = saveWord;
    if (currentWordElement) currentWordElement.classList.remove("known");
}

// 小喇叭播放 - 有道词典（国内稳定）+ 词典API兜底
function getAudioUrl(word) {
    // 有道词典 TTS，type=0 美式，type=1 英式
    return "https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(word) + "&type=0";
}

function playPronunciation(word) {
    var speaker = document.querySelector(".speaker-icon");
    if (speaker) speaker.style.color = "#10b981";

    // 直接用有道音频（国内访问快，覆盖全）
    var url = getAudioUrl(word);
    var audio = new Audio(url);
    audio.onended = function() { if (speaker) speaker.style.color = ""; };
    audio.onerror = function() {
        // 有道失败，试词典API缓存
        if (audioCache[word]) {
            playAudio(audioCache[word], speaker);
            return;
        }
        if (speaker) speaker.style.color = "#ff3b30";
        setTimeout(function() { if (speaker) speaker.style.color = ""; }, 1500);
    };
    audio.play().catch(function() {
        if (audioCache[word]) {
            playAudio(audioCache[word], speaker);
        } else {
            if (speaker) speaker.style.color = "#ff3b30";
            setTimeout(function() { if (speaker) speaker.style.color = ""; }, 1500);
        }
    });
}

function playAudio(url, speaker) {
    var audio = new Audio(url);
    if (speaker) speaker.style.color = "#10b981";
    audio.onended = function() { if (speaker) speaker.style.color = ""; };
    audio.onerror = function() { if (speaker) speaker.style.color = "#ff3b30"; };
    audio.play().catch(function() { if (speaker) speaker.style.color = "#ff3b30"; });
}

function closePopup() {
    document.getElementById("wordPopup").classList.remove("show");
    document.getElementById("overlay").style.display = "none";
    if (currentWordElement) currentWordElement.classList.remove("tapped");
    currentWord = ""; currentWordElement = null;
    ttsUpdateBar(); // 弹窗关闭后，若仍在朗读则淡入恢复控制条
}

document.addEventListener("click", function(e) {
    if (!e.target.closest(".word-popup") && !e.target.closest(".word")) closePopup();
    if (!e.target.closest(".word-item")) resetAllSwipes();
});

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closePopup();
});

// 确保遮罩层可点击关闭
document.getElementById("overlay").addEventListener("click", function(e) {
    closePopup();
});

// ==========================================
// 单词库渲染（岛式分组）
// ==========================================
function renderWordBank() {
    var bank = getWordBank();
    var listDiv = document.getElementById("wordList");
    var emptyHint = document.getElementById("emptyHint");
    if (bank.length === 0) { listDiv.innerHTML = ""; emptyHint.style.display = "block"; return; }
    emptyHint.style.display = "none";

    // 按文章分组
    var groups = {};
    bank.forEach(function(item) {
        var key = item.articleKey || "_other";
        if (!groups[key]) {
            groups[key] = { articleKey: key, articleTitle: item.articleTitle || "其他文章", words: [] };
        }
        groups[key].words.push(item);
    });

    // 按最新单词时间排序（岛）
    var sortedGroups = Object.values(groups).sort(function(a, b) {
        return (b.words[0].time || "").localeCompare(a.words[0].time || "");
    });

    // 渲染岛
    var html = "";
    sortedGroups.forEach(function(group) {
        // 编码 articleKey 和 articleTitle 用于 HTML
        var safeKey = group.articleKey.replace(/'/g, "\\'");
        var safeTitle = group.articleTitle.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        html += '<div class="word-island">';
        html += '<div class="word-island-header" onclick="openArticle(\'' + safeKey + '\')">📖 ' + safeTitle + '</div>';
        html += '<div class="word-island-body">';
        group.words.forEach(function(item) {
            var safeWord = item.word.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            html += '<div class="word-item-wrapper"><div class="word-item-row">' +
                '<div class="word-item-delete" onclick="deleteWord(this)">删除</div>' +
                '<div class="word-item" data-word="' + safeWord + '" data-article="' + safeKey + '">' +
                '<span class="eng">' + item.word + '</span>' +
                '<div class="word-item-right"><button class="meaning-toggle-btn" onclick="toggleWordMeaning(this)">释义</button></div>' +
                '</div></div>' +
                '<div class="word-meaning">' + (item.meaning || "") + '</div></div>';
        });
        html += '</div></div>';
    });

    listDiv.innerHTML = html;
    bindSwipeEvents();
}

function toggleWordMeaning(btn) {
    var wrapper = btn.closest(".word-item-wrapper");
    var meaning = wrapper.querySelector(".word-meaning");
    var isOpen = meaning.classList.contains("open");
    meaning.classList.toggle("open");
    btn.textContent = isOpen ? "释义" : "收起";
}

// 左滑删除
var swipeState = { el: null, startX: 0, startY: 0, moved: false };
function bindSwipeEvents() {
    document.querySelectorAll("#wordList .word-item").forEach(function(item) {
        item.removeEventListener("touchstart", onSwipeStart); item.removeEventListener("touchmove", onSwipeMove);
        item.removeEventListener("touchend", onSwipeEnd); item.removeEventListener("mousedown", onMouseStart);
        item.addEventListener("touchstart", onSwipeStart, { passive: false });
        item.addEventListener("touchmove", onSwipeMove, { passive: false });
        item.addEventListener("touchend", onSwipeEnd);
        item.addEventListener("mousedown", onMouseStart);
    });
}
function resetAllSwipes() {
    document.querySelectorAll("#wordList .word-item-wrapper").forEach(function(w) { w.classList.remove("swiped"); });
    document.querySelectorAll("#wordList .word-item").forEach(function(el) { el.style.transform = "translateX(0)"; });
}
function onSwipeStart(e) { resetAllSwipes(); swipeState.el = e.currentTarget; swipeState.startX = e.touches[0].clientX; swipeState.startY = e.touches[0].clientY; swipeState.moved = false; }
function onSwipeMove(e) {
    if (!swipeState.el) return;
    var dx = e.touches[0].clientX - swipeState.startX;
    var dy = Math.abs(e.touches[0].clientY - swipeState.startY);
    // 水平滑动占主导时才阻止滚动（左滑删除）
    if (Math.abs(dx) > dy && dx < -5) {
        e.preventDefault();
        swipeState.moved = true;
        swipeState.el.style.transform = "translateX(" + Math.max(dx, -80) + "px)";
    }
    // 垂直滑动：不阻止，让页面自然滚动
}
function onSwipeEnd() {
    if (!swipeState.el) return;
    var el = swipeState.el, wrapper = el.closest(".word-item-wrapper");
    if (swipeState.moved) { var cx = parseFloat(el.style.transform.replace(/[^-\d.]/g, "")) || 0; if (cx < -40) { el.style.transform = "translateX(-80px)"; if (wrapper) wrapper.classList.add("swiped"); } else { el.style.transform = "translateX(0)"; if (wrapper) wrapper.classList.remove("swiped"); } }
    swipeState.el = null; swipeState.moved = false;
}
function onMouseStart(e) {
    resetAllSwipes(); var el = e.currentTarget, startX = e.clientX, startY = e.clientY, moved = false;
    function mm(ev) {
        var dx = ev.clientX - startX;
        var dy = Math.abs(ev.clientY - startY);
        if (Math.abs(dx) > dy && dx < -5) { moved = true; el.style.transform = "translateX(" + Math.max(dx, -80) + "px)"; }
    }
    function mu() { document.removeEventListener("mousemove", mm); document.removeEventListener("mouseup", mu); var wrapper = el.closest(".word-item-wrapper"); if (moved) { var cx = parseFloat(el.style.transform.replace(/[^-\d.]/g, "")) || 0; if (cx < -40) { el.style.transform = "translateX(-80px)"; if (wrapper) wrapper.classList.add("swiped"); } else { el.style.transform = "translateX(0)"; if (wrapper) wrapper.classList.remove("swiped"); } } }
    document.addEventListener("mousemove", mm); document.addEventListener("mouseup", mu);
}
function deleteWord(btn) {
    var wrapper = btn.closest(".word-item-wrapper");
    var item = wrapper.querySelector(".word-item");
    var word = item.dataset.word;
    var articleKey = item.dataset.article;

    // 检查是不是岛的最后一个单词
    var bank = getWordBank();
    var groupWords = bank.filter(function (i) { return i.articleKey === articleKey; });
    var isLastWord = groupWords.length <= 1;

    if (isLastWord) {
        // 最后一个单词 → 整个岛淡出折叠
        var island = wrapper.closest(".word-island");
        var islandH = island.offsetHeight;
        island.style.maxHeight = islandH + "px";
        island.style.transition = "none";
        void island.offsetWidth;
        island.style.transition = "";
        island.classList.add("deleting");
    } else {
        // 单词滑出 + 折叠
        var h = wrapper.offsetHeight;
        wrapper.style.maxHeight = h + "px";
        wrapper.style.transition = "none";
        void wrapper.offsetWidth;
        wrapper.style.transition = "";
        wrapper.classList.add("deleting");
    }

    // 动画结束后再真正删除数据
    setTimeout(function () {
        bank = getWordBank();
        bank = bank.filter(function (i) { return !(i.word === word && i.articleKey === articleKey); });
        localStorage.setItem("gap_wordbank", JSON.stringify(bank));
        renderWordBank();
        loadArticle(currentArticleKey);
    }, 380);
}
function exportWords() {
    var bank = getWordBank(); if (!bank.length) return;
    var text = "我的单词库 - Gap\n==============================\n\n";
    // 按文章分组导出
    var groups = {};
    bank.forEach(function(item) {
        var key = item.articleKey || "_other";
        if (!groups[key]) groups[key] = { title: item.articleTitle || "其他文章", words: [] };
        groups[key].words.push(item);
    });
    for (var k in groups) {
        text += "📖 " + groups[k].title + "\n";
        groups[k].words.forEach(function(item) { text += "  " + item.word + "  " + item.meaning + "\n"; });
        text += "\n";
    }
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], {type:"text/plain"})); a.download = "gap-wordbank.txt"; a.click();
}

// ==========================================
// 听文章（TTS 朗读）
// ==========================================
var TTS = {
    supported: ("speechSynthesis" in window),
    mode: "speech",          // "audio"(mp3) | "speech"(系统语音)
    on: false, paused: false,
    sentences: [], index: 0,
    subChunks: [], subIndex: 0,
    audio: null, cues: [],   // audio 模式：<audio> 元素 + VTT 句子时间戳
    rate: 1,
    voiceName: "jenny",      // 女声(美音 Jenny) / 男声(英音 Ryan)
    voice: null              // speech 模式的系统语音
};

// 优先挑一个好听的英文语音
function ttsPickVoice() {
    var vs = speechSynthesis.getVoices();
    var prefs = ["Samantha", "Google US English", "Google UK English Female",
                 "Microsoft Aria Online (Natural) - English (United States)",
                 "Microsoft Jenny Online (Natural) - English (United States)",
                 "Microsoft Guy Online (Natural) - English (United Kingdom)", "Daniel"];
    for (var i = 0; i < prefs.length; i++)
        for (var j = 0; j < vs.length; j++)
            if (vs[j].name === prefs[i]) return vs[j];
    for (var j = 0; j < vs.length; j++)
        if (/^en/i.test(vs[j].lang)) return vs[j];
    return null;
}

function ttsEnsureVoices() {
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.onvoiceschanged = function() { TTS.voice = ttsPickVoice(); };
    } else if (!TTS.voice) {
        TTS.voice = ttsPickVoice();
    }
}

// 超长句子按逗号二次切分，规避 Chrome 长文本朗读 bug
function ttsChunkText(text) {
    if (text.length <= 400) return [text];
    var parts = text.split(/([,;:])/);
    var chunks = [], cur = "";
    for (var i = 0; i < parts.length; i++) {
        var piece = parts[i];
        if (cur.length + piece.length > 300 && cur) { chunks.push(cur.trim()); cur = piece; }
        else cur += piece;
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks;
}

function ttsSpeakNextChunk() {
    if (!TTS.on || TTS.paused) return; // 已停止/暂停则不再继续
    if (TTS.subIndex >= TTS.subChunks.length) { ttsSpeakAt(TTS.index + 1); return; }
    var text = TTS.subChunks[TTS.subIndex++];
    var u = new SpeechSynthesisUtterance(text);
    if (TTS.voice) { u.voice = TTS.voice; u.lang = TTS.voice.lang || "en-US"; }
    else { u.lang = "en-US"; }
    u.rate = TTS.rate;
    u.onend = function() {
        if (!TTS.on || TTS.paused) return; // 防 Chrome cancel bug 后链式继续
        ttsSpeakNextChunk();
    };
    u.onerror = function() { ttsStop(); };
    TTS.utter = u;
    speechSynthesis.speak(u);
}

function ttsSpeakAt(i) {
    if (!TTS.on || TTS.paused) return;
    if (i >= TTS.sentences.length) { ttsStop(); return; }
    TTS.index = i;
    TTS.subIndex = 0;
    TTS.subChunks = ttsChunkText(TTS.sentences[i].textContent);
    ttsHighlight(i);
    ttsSpeakNextChunk();
}

function ttsStart() {
    if (!currentArticleKey) return;
    // 彻底停止正在播放的一切：防止 mp3 与系统语音混播、防止多实例叠加
    if (TTS.audio) {
        TTS.audio.pause();
        try { TTS.audio.src = ""; } catch(e) {}
        TTS.audio = null;
    }
    if (TTS.supported && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();

    var key = currentArticleKey;
    var mp3Url = "audio/" + key + "-" + TTS.voiceName + ".mp3";
    var vttUrl = "audio/" + key + "-" + TTS.voiceName + ".vtt";

    // 同步创建 audio 并立即开始播放（必须在用户手势内，满足 iOS/安卓自动播放限制）
    var a = new Audio(mp3Url);
    a.preload = "auto";
    a.playbackRate = TTS.rate;

    // mp3 加载失败 → 降级系统语音；但须校验"用户仍在听这篇"，防止退出/切换时
    // ttsStop 清空 src 触发的 play() reject 误降级重启系统语音（机器音 bug 根因）
    var startedForKey = key;
    function ttsFallbackToSpeech() {
        if (!TTS.on) return;                          // 用户已停止/退出
        if (TTS.audio !== a) return;                  // audio 已被替换/清空
        if (currentArticleKey !== startedForKey) return; // 已切到其他文章
        ttsStop();
        ttsStartSpeech();
    }

    a.addEventListener("timeupdate", ttsOnAudioTime);
    a.addEventListener("ended", function() { ttsStop(); });
    a.addEventListener("error", ttsFallbackToSpeech);
    var playPromise = a.play();
    if (playPromise && playPromise.catch) {
        playPromise.catch(ttsFallbackToSpeech);
    }

    // 先进入播放状态（不依赖 VTT，VTT 只用于句子高亮）
    TTS.mode = "audio";
    TTS.audio = a;
    TTS.on = true; TTS.paused = false;
    var content = document.getElementById("articleContent");
    TTS.sentences = Array.prototype.slice.call(content.querySelectorAll(".sentence"));
    TTS.index = 0;
    TTS.cues = [];
    ttsUpdateUI();

    // 异步加载 VTT 时间戳（用于句子高亮；失败则只播音频、不跟高亮）
    fetch(vttUrl)
        .then(function(res) { if (!res.ok) throw new Error("no vtt"); return res.text(); })
        .then(function(txt) {
            var cues = ttsParseVTT(txt);
            if (!cues.length) throw new Error("empty vtt");
            TTS.cues = cues;
            ttsUpdateBar(); // 句子时间戳就绪后刷新进度显示
        })
        .catch(function() {});
}

// 解析 edge-tts 生成的 VTT（句子级时间戳）
function ttsParseVTT(text) {
    var cues = [];
    var blocks = text.split(/\r?\n\r?\n/);
    for (var i = 0; i < blocks.length; i++) {
        var lines = blocks[i].split(/\r?\n/);
        var tl = -1;
        for (var j = 0; j < lines.length; j++) {
            if (lines[j].indexOf("-->") !== -1) { tl = j; break; }
        }
        if (tl === -1) continue;
        var m = lines[tl].match(/([\d:,.]+)\s*-->\s*([\d:,.]+)/);
        if (!m) continue;
        var start = ttsToSec(m[1]), end = ttsToSec(m[2]);
        var cueText = "";
        for (var j = tl + 1; j < lines.length; j++) {
            if (lines[j].trim()) cueText += (cueText ? " " : "") + lines[j].trim();
        }
        if (cueText) cues.push({ start: start, end: end, text: cueText });
    }
    return cues;
}

function ttsToSec(ts) {
    var p = String(ts).replace(",", ".").split(":");
    var sec = parseFloat(p[p.length - 1]);
    var total = 0;
    for (var i = 0; i < p.length - 1; i++) total = total * 60 + parseInt(p[i]);
    return total * 60 + sec;
}

function ttsOnAudioTime() {
    if (!TTS.audio) return;
    var t = TTS.audio.currentTime;
    var idx = -1;
    for (var i = 0; i < TTS.cues.length; i++) {
        if (t >= TTS.cues[i].start) idx = i;
        else break;
    }
    if (idx !== -1 && idx !== TTS.index) {
        TTS.index = idx;
        ttsHighlightCue(idx);
    }
}

// 根据 VTT 句子文本在 DOM 中找到对应句子并高亮（edge-tts 切句与 splitSentences 有细微差异，用文本匹配）
function ttsHighlightCue(cueIdx) {
    var cue = TTS.cues[cueIdx];
    if (!cue) return;
    var norm = cue.text.replace(/\s+/g, " ").trim().toLowerCase();
    var target = null;
    for (var i = 0; i < TTS.sentences.length; i++) {
        var st = TTS.sentences[i].textContent.replace(/\s+/g, " ").trim().toLowerCase();
        if (norm.indexOf(st) === 0 || st.indexOf(norm) === 0 || norm.indexOf(st) !== -1) { target = TTS.sentences[i]; break; }
    }
    for (var i = 0; i < TTS.sentences.length; i++) TTS.sentences[i].classList.remove("tts-reading");
    if (!target) return;
    target.classList.add("tts-reading");
    ttsUpdateBar(); // 同步句子进度
    var r = target.getBoundingClientRect(), vh = window.innerHeight;
    if (r.top < 80 || r.bottom > vh - 140) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
}

// speech 降级模式
function ttsStartSpeech() {
    if (!TTS.supported) return;
    if (!TTS.on) return; // 用户已停止/退出，不再降级启动系统语音
    if (speechSynthesis.speaking) speechSynthesis.cancel();
    ttsEnsureVoices();
    var content = document.getElementById("articleContent");
    TTS.sentences = Array.prototype.slice.call(content.querySelectorAll(".sentence"));
    if (!TTS.sentences.length) return;
    TTS.mode = "speech";
    TTS.on = true; TTS.paused = false;
    ttsSpeakAt(TTS.index);
    ttsUpdateUI();
}

function ttsToggle() {
    if (!TTS.supported) return;
    if (TTS.on && !TTS.paused) ttsPause();
    else if (TTS.on && TTS.paused) ttsResume();
    else ttsStart();
}

function ttsPause() {
    if (!TTS.on) return;
    TTS.paused = true;
    if (TTS.mode === "audio" && TTS.audio) TTS.audio.pause();
    else if (TTS.mode === "speech") speechSynthesis.cancel();
    ttsUpdateUI();
}

function ttsResume() {
    if (!TTS.on) return;
    TTS.paused = false;
    if (TTS.mode === "audio" && TTS.audio) {
        TTS.audio.play();
    } else if (TTS.mode === "speech") {
        if (TTS.subIndex >= TTS.subChunks.length) ttsSpeakAt(TTS.index + 1);
        else { ttsHighlight(TTS.index); ttsSpeakNextChunk(); }
    }
    ttsUpdateUI();
}

function ttsStop() {
    TTS.on = false; TTS.paused = false;
    if (TTS.mode === "audio" && TTS.audio) {
        TTS.audio.pause();
        try { TTS.audio.src = ""; } catch(e) {}
        TTS.audio = null;
    }
    if (TTS.supported && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
    TTS.subChunks = []; TTS.subIndex = 0;
    ttsClearHighlight();
    ttsUpdateUI();
}

function ttsSetRate(r) {
    TTS.rate = r;
    ttsSyncRateBtns();
    if (TTS.on && !TTS.paused) {
        if (TTS.mode === "audio" && TTS.audio) TTS.audio.playbackRate = r;
        else if (TTS.mode === "speech") { speechSynthesis.cancel(); ttsSpeakAt(TTS.index); }
    }
}

function ttsSyncRateBtns() {
    var btns = document.querySelectorAll(".rate-btn[data-rate]");
    for (var i = 0; i < btns.length; i++)
        btns[i].classList.toggle("active", parseFloat(btns[i].getAttribute("data-rate")) === TTS.rate);
}

// 语音切换：女声(美音 Jenny) / 男声(英音 Ryan)
function ttsSetVoice(v) {
    if (v !== "jenny" && v !== "ryan") return;
    if (TTS.voiceName === v) return;
    TTS.voiceName = v;
    try { localStorage.setItem("gap_tts_voice", v); } catch(e) {}
    ttsSyncVoiceBtns();
    if (TTS.on && !TTS.paused) {
        // 同步重启（保持用户手势内，避免被自动播放策略拦截）
        ttsStop();
        ttsStart();
    }
}

function ttsSyncVoiceBtns() {
    var btns = document.querySelectorAll(".voice-btn");
    for (var i = 0; i < btns.length; i++)
        btns[i].classList.toggle("active", btns[i].getAttribute("data-voice") === TTS.voiceName);
}

// 上一句 / 下一句
function ttsPrev() {
    if (!TTS.on) return;
    if (TTS.mode === "audio" && TTS.audio && TTS.cues.length) {
        var idx = Math.max(0, TTS.index - 1);
        TTS.audio.currentTime = TTS.cues[idx].start + 0.01;
        ttsOnAudioTime();
    } else if (TTS.mode === "speech" && TTS.sentences.length) {
        TTS.index = Math.max(0, TTS.index - 1);
        speechSynthesis.cancel();
        ttsSpeakAt(TTS.index);
    }
}

function ttsNext() {
    if (!TTS.on) return;
    if (TTS.mode === "audio" && TTS.audio && TTS.cues.length) {
        var idx = Math.min(TTS.cues.length - 1, TTS.index + 1);
        TTS.audio.currentTime = TTS.cues[idx].start + 0.01;
        ttsOnAudioTime();
    } else if (TTS.mode === "speech" && TTS.sentences.length) {
        TTS.index = Math.min(TTS.sentences.length - 1, TTS.index + 1);
        speechSynthesis.cancel();
        ttsSpeakAt(TTS.index);
    }
}

function ttsHighlight(i) {
    for (var k = 0; k < TTS.sentences.length; k++) TTS.sentences[k].classList.remove("tts-reading");
    var el = TTS.sentences[i];
    if (!el) return;
    el.classList.add("tts-reading");
    ttsUpdateBar(); // 同步句子进度
    var r = el.getBoundingClientRect(), vh = window.innerHeight;
    if (r.top < 80 || r.bottom > vh - 140) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
}

function ttsClearHighlight() {
    var els = document.querySelectorAll("#articleContent .sentence.tts-reading");
    for (var k = 0; k < els.length; k++) els[k].classList.remove("tts-reading");
}

function ttsUpdateUI() {
    // 标题行小喇叭：与查词弹窗同款 SVG 图标；朗读中高亮为主题色
    var btn = document.getElementById("ttsArticleBtn");
    if (btn) {
        if (TTS.on) btn.classList.add("tts-playing");
        else btn.classList.remove("tts-playing");
    }
    ttsSyncVoiceBtns();
    ttsSyncRateBtns();
    ttsUpdateBar();
}

// 底部悬浮播放控制条：朗读时显示、播放按钮文案、句子进度
function ttsUpdateBar() {
    var bar = document.getElementById("ttsBar");
    if (!bar) return;
    // 仅在文章详情页可见时才显示控制条（切到别的页面则隐藏）
    var detail = document.getElementById("articleDetailView");
    // 查词弹窗打开时也要隐藏控制条，避免挡住"翻译整句"等弹窗底部按钮
    var popup = document.getElementById("wordPopup");
    var popupOpen = popup && popup.classList.contains("show");
    var visible = TTS.on && detail && detail.style.display !== "none" && !popupOpen;
    bar.classList.toggle("show", visible);
    var playBtn = document.getElementById("ttsPlayBtn");
    if (playBtn) {
        // 播放中 → 显示"两条竖杠"暂停图标（无填充底）；暂停/未播放 → 显示"三角"播放图标（填充底）
        var isPausedIcon = TTS.on && !TTS.paused;
        playBtn.innerHTML = isPausedIcon
            ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>'
            : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
        playBtn.classList.toggle("paused", isPausedIcon);
    }
    var total = (TTS.mode === "audio") ? TTS.cues.length : TTS.sentences.length;
    var prog = document.getElementById("ttsProgress");
    if (prog) prog.textContent = total > 0 ? (TTS.index + 1) + " / " + total : "";
}

function ttsOnArticleLoad() {
    if (TTS.mode === "audio" && TTS.audio) {
        TTS.audio.pause();
        try { TTS.audio.src = ""; } catch(e) {}
        TTS.audio = null;
    }
    if (TTS.supported && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
    TTS.on = false; TTS.paused = false; TTS.index = 0;
    TTS.subChunks = []; TTS.subIndex = 0; TTS.cues = [];
    ttsClearHighlight();
    ttsUpdateUI();
}

