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
var BOOKMARK_KEY = "gap_bookmarks";
var audioCache = {};

// ==========================================
// 单词库
// ==========================================
function getWordBank() {
    var data = localStorage.getItem("gap_wordbank");
    return data ? JSON.parse(data) : [];
}

function addToWordBank(word, meaning) {
    var bank = getWordBank();
    if (!bank.find(function(item) { return item.word === word; })) {
        bank.unshift({ word: word, meaning: meaning, time: new Date().toISOString() });
        localStorage.setItem("gap_wordbank", JSON.stringify(bank));
    }
}

function removeFromWordBank(word) {
    var bank = getWordBank();
    bank = bank.filter(function(item) { return item.word !== word; });
    localStorage.setItem("gap_wordbank", JSON.stringify(bank));
}

function isInWordBank(word) {
    return getWordBank().some(function(item) { return item.word === word; });
}

// ==========================================
// 文章收藏
// ==========================================
function getBookmarks() {
    var data = localStorage.getItem(BOOKMARK_KEY);
    return data ? JSON.parse(data) : [];
}

function toggleBookmark() {
    var key = currentArticleKey;
    var article = articles[key];
    if (!article) return;
    var bookmarks = getBookmarks();
    var idx = bookmarks.findIndex(function(b) { return b.key === key; });
    if (idx !== -1) {
        bookmarks.splice(idx, 1);
    } else {
        bookmarks.push({ key: key, title: article.title, topic: currentTopic });
    }
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
    updateBookmarkBtn();
}

function isBookmarked(key) {
    return getBookmarks().some(function(b) { return b.key === key; });
}

function updateBookmarkBtn() {
    var btn = document.getElementById("bookmarkBtn");
    if (isBookmarked(currentArticleKey)) {
        btn.textContent = "★";
        btn.classList.add("bookmarked");
    } else {
        btn.textContent = "☆";
        btn.classList.remove("bookmarked");
    }
}

function renderBookmarks() {
    var bookmarks = getBookmarks();
    var listDiv = document.getElementById("bookmarkList");
    var emptyHint = document.getElementById("bmEmptyHint");
    if (bookmarks.length === 0) { listDiv.innerHTML = ""; emptyHint.style.display = "block"; return; }
    emptyHint.style.display = "none";
    var topics = { "science": "科学科技", "health": "健康", "life": "生活", "culture": "文化", "nature": "自然" };
    listDiv.innerHTML = bookmarks.map(function(bm) {
        return '<div class="bookmark-article-item" onclick="openBookmark(\'' + bm.key + '\',\'' + bm.topic + '\')">' +
            '<div><div class="bm-title">' + bm.title + '</div>' +
            '<span style="font-size:12px;color:#aeaeb2;">' + (topics[bm.topic] || bm.topic) + '</span></div>' +
            '<button class="bm-remove" onclick="event.stopPropagation();removeBookmark(\'' + bm.key + '\')">×</button></div>';
    }).join("");
}

function openBookmark(key, topic) {
    currentTopic = topic;
    openArticle(key);
    showTab("read");
}

function removeBookmark(key) {
    var bookmarks = getBookmarks().filter(function(b) { return b.key !== key; });
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
    renderBookmarks();
    updateBookmarkBtn();
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
    if (action === "read") showArticleList(currentTopic);
    else if (action === "wordbank") showTab("wordbank");
    else if (action === "bookmarks") showTab("bookmarks");
    else if (action === "review") showTab("review");
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
    if (!e.target.closest("#reviewSourceWrap") && !e.target.closest("#reviewSourcePicker")) {
        var el = document.getElementById("reviewSourcePicker");
        if (el) el.classList.remove("show");
    }
    if (!e.target.closest("#reviewCountWrap") && !e.target.closest("#reviewCountPicker")) {
        var el = document.getElementById("reviewCountPicker");
        if (el) el.classList.remove("show");
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
});

// ==========================================
// 面板切换
// ==========================================
function showTab(tabName) {
    document.getElementById("read-panel").style.display = (tabName === "read") ? "block" : "none";
    document.getElementById("wordbank-panel").style.display = (tabName === "wordbank") ? "block" : "none";
    document.getElementById("bookmarks-panel").style.display = (tabName === "bookmarks") ? "block" : "none";
    document.getElementById("review-panel").style.display = (tabName === "review") ? "block" : "none";
    document.getElementById("topic-bar").style.display = (tabName === "read") ? "flex" : "none";
    if (tabName === "wordbank") renderWordBank();
    if (tabName === "bookmarks") renderBookmarks();
}

// ==========================================
// 主题/文章
// ==========================================
function selectTopic(topic) {
    currentTopic = topic;
    document.querySelectorAll(".topic-btn").forEach(function(btn) { btn.classList.remove("active"); });
    var topics = ["science", "health", "life", "culture", "nature", "sports", "gaming"];
    var buttons = document.querySelectorAll(".topic-btn");
    var idx = topics.indexOf(topic);
    if (idx >= 0) buttons[idx].classList.add("active");
    showArticleList(topic);
    closePopup();
}

// 显示文章列表
function showArticleList(topic) {
    currentTopic = topic;
    document.getElementById("articleListView").style.display = "block";
    document.getElementById("articleDetailView").style.display = "none";
    document.getElementById("textSettingsGroup").style.display = "none";
    document.getElementById("read-panel").style.display = "block";
    document.getElementById("wordbank-panel").style.display = "none";
    document.getElementById("bookmarks-panel").style.display = "none";
    document.getElementById("topic-bar").style.display = "flex";

    var keys = getTopicArticles(topic);
    var listDiv = document.getElementById("articleList");
    listDiv.innerHTML = keys.map(function(key) {
        var a = articles[key];
        var preview = a.text.replace(/\. /g, ". ").split(". ").slice(0, 2).join(". ") + ".";
        if (preview.length > 150) preview = preview.slice(0, 150) + "...";
        return '<div class="article-list-item" onclick="openArticle(\'' + key + '\')">' +
            '<div class="ali-title">' + a.title + '</div>' +
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
function makeWordsClickable(container, text) {
    container.innerHTML = "";
    var knownWords = getWordBank().map(function(item) { return item.word.toLowerCase(); });
    var tokens = text.split(/(\s+)/);
    tokens.forEach(function(token) {
        if (/^\s+$/.test(token)) { container.appendChild(document.createTextNode(token)); return; }
        var match = token.match(/^([a-zA-Z]+)([\.,;:!\?\)\]\"\']*)$/);
        if (match) {
            var word = match[1], punct = match[2];
            var span = document.createElement("span");
            span.className = "word";
            span.textContent = word;
            span.title = "点击查词";
            if (knownWords.indexOf(word.toLowerCase()) !== -1) span.classList.add("known");
            span.addEventListener("click", function(e) { e.stopPropagation(); lookupWord(word, span); });
            container.appendChild(span);
            if (punct) container.appendChild(document.createTextNode(punct));
        } else { container.appendChild(document.createTextNode(token)); }
    });
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
    updateBookmarkBtn();
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
    var TOPIC_NAMES = { "science": "科学科技", "health": "健康", "life": "生活", "culture": "文化", "nature": "自然", "sports": "体育", "gaming": "游戏" };
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
            '<div class="ali-title">' + r.title + '</div>' +
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
    wordEl.innerHTML = word + ' <span class="speaker-icon" onclick="playPronunciation(\'' + word.replace(/'/g, "\\'") + '\')" title="播放读音"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg></span>';
    document.getElementById("popupMeaning").textContent = "查询中...";
    popup.classList.add("show");
    document.getElementById("overlay").style.display = "block";
    var saveBtn = document.getElementById("saveWordBtn");
    if (isInWordBank(word)) {
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

async function lookupChinese(word) {
    var showEn = getSetting("showEn", true);
    var found = findInDict(word);
    var html = "";

    // ① 先显示内置词典（瞬间响应）
    var phonetic = PHONETIC[word.toLowerCase()];
    if (!phonetic && found && found.base !== word.toLowerCase()) {
        phonetic = PHONETIC[found.base.toLowerCase()];
    }

    if (found) {
        html += '<p style="font-size:16px;font-weight:600;margin-bottom:4px;">' + found.entry +
                (phonetic ? ' <span style="font-size:13px;color:#aeaeb2;font-weight:400;">/' + phonetic + '/</span>' : '') +
                '</p>';
    }
    document.getElementById("popupMeaning").innerHTML = html || "<p>加载中...</p>";

    // ② 后台加载在线数据
    if (showEn || !found) {
        try { currentDictData = await fetchDictAPI(word); } catch(e) { currentDictData = null; }
    } else {
        currentDictData = null;
    }

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

    // 完善音标
    if (!phonetic && currentDictData) {
        if (currentDictData[0].phonetic) {
            phonetic = currentDictData[0].phonetic;
        } else if (currentDictData[0].phonetics && currentDictData[0].phonetics.length > 0) {
            for (var p = 0; p < currentDictData[0].phonetics.length; p++) {
                if (currentDictData[0].phonetics[p].text) { phonetic = currentDictData[0].phonetics[p].text; break; }
            }
        }
    }

    // ③ 重新渲染完整内容
    html = "";
    if (found) {
        html += '<p style="font-size:16px;font-weight:600;margin-bottom:4px;">' + found.entry +
                (phonetic ? ' <span style="font-size:13px;color:#aeaeb2;font-weight:400;">/' + phonetic + '/</span>' : '') +
                '</p>';
        if (currentDictData) html += '<hr style="border:none;border-top:1px solid #e5e5ea;margin:8px 0;">';
    }
    if (currentDictData) {
        currentDictData.forEach(function(entry) { entry.meanings.forEach(function(m) { html += "<p><em>" + shortPos(m.partOfSpeech) + "</em> " + m.definitions.slice(0,2).map(function(d){return d.definition}).join("；") + "</p>"; }); });
    }
    document.getElementById("popupMeaning").innerHTML = html || "<p>该单词暂未收录</p>";
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
    addToWordBank(currentWord, document.getElementById("popupMeaning").textContent);
    var btn = document.getElementById("saveWordBtn");
    btn.textContent = "✓ 已在单词库中"; btn.className = "action-btn saved"; btn.onclick = removeSavedWord;
    if (currentWordElement) currentWordElement.classList.add("known");
}

function removeSavedWord() {
    if (!currentWord) return;
    removeFromWordBank(currentWord);
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
// 单词库渲染
// ==========================================
function renderWordBank() {
    var bank = getWordBank();
    var listDiv = document.getElementById("wordList");
    var emptyHint = document.getElementById("emptyHint");
    if (bank.length === 0) { listDiv.innerHTML = ""; emptyHint.style.display = "block"; return; }
    emptyHint.style.display = "none";
    listDiv.innerHTML = bank.map(function(item, i) {
        return '<div class="word-item-wrapper"><div class="word-item-row"><div class="word-item-delete" onclick="deleteWord(' + i + ')">删除</div>' +
            '<div class="word-item" id="wi-' + i + '"><span class="eng">' + item.word + '</span>' +
            '<div class="word-item-right"><button class="meaning-toggle-btn" onclick="toggleWordMeaning(' + i + ',this)">释义</button></div></div></div>' +
            '<div class="word-meaning" id="wm-' + i + '">' + (item.meaning || "") + '</div></div>';
    }).join("");
    bindSwipeEvents();
}

function toggleWordMeaning(index, btn) {
    var div = document.getElementById("wm-" + index);
    if (div.classList.contains("open")) { div.classList.remove("open"); btn.textContent = "释义"; }
    else { div.classList.add("open"); btn.textContent = "收起"; }
}

// 左滑删除
var swipeState = { el: null, startX: 0, moved: false };
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
function onSwipeStart(e) { resetAllSwipes(); swipeState.el = e.currentTarget; swipeState.startX = e.touches[0].clientX; swipeState.moved = false; }
function onSwipeMove(e) { if (!swipeState.el) return; e.preventDefault(); var dx = e.touches[0].clientX - swipeState.startX; if (dx < -5) { swipeState.moved = true; swipeState.el.style.transform = "translateX(" + Math.max(dx, -80) + "px)"; } }
function onSwipeEnd() {
    if (!swipeState.el) return;
    var el = swipeState.el, wrapper = el.closest(".word-item-wrapper");
    if (swipeState.moved) { var cx = parseFloat(el.style.transform.replace(/[^-\d.]/g, "")) || 0; if (cx < -40) { el.style.transform = "translateX(-80px)"; if (wrapper) wrapper.classList.add("swiped"); } else { el.style.transform = "translateX(0)"; if (wrapper) wrapper.classList.remove("swiped"); } }
    swipeState.el = null; swipeState.moved = false;
}
function onMouseStart(e) {
    resetAllSwipes(); var el = e.currentTarget, startX = e.clientX, moved = false;
    function mm(ev) { var dx = ev.clientX - startX; if (dx < -5) { moved = true; el.style.transform = "translateX(" + Math.max(dx, -80) + "px)"; } }
    function mu() { document.removeEventListener("mousemove", mm); document.removeEventListener("mouseup", mu); var wrapper = el.closest(".word-item-wrapper"); if (moved) { var cx = parseFloat(el.style.transform.replace(/[^-\d.]/g, "")) || 0; if (cx < -40) { el.style.transform = "translateX(-80px)"; if (wrapper) wrapper.classList.add("swiped"); } else { el.style.transform = "translateX(0)"; if (wrapper) wrapper.classList.remove("swiped"); } } }
    document.addEventListener("mousemove", mm); document.addEventListener("mouseup", mu);
}
function deleteWord(index) {
    var bank = getWordBank(); bank.splice(index, 1);
    localStorage.setItem("gap_wordbank", JSON.stringify(bank));
    renderWordBank(); loadArticle(currentArticleKey);
}
function exportWords() {
    var bank = getWordBank(); if (!bank.length) return;
    var text = "我的单词库 - Gap\n==============================\n\n";
    bank.forEach(function(item) { text += item.word + "\n  " + item.meaning + "\n\n"; });
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], {type:"text/plain"})); a.download = "gap-wordbank.txt"; a.click();
}

// ==========================================
// 背单词
// ==========================================
var REVIEW_SOURCE = "wordbank";
var REVIEW_COUNT = 20;
var REVIEW_WORDS = [];
var REVIEW_IDX = 0;
var REVIEW_SCORE = 0;
var REVIEW_TOTAL = 0;
var REVIEW_CORRECT = [];

function getReviewWords() {
    if (REVIEW_SOURCE === "wordbank") {
        var bank = getWordBank();
        if (!bank.length) return [];
        return bank.map(function(item) { return { word: item.word, meaning: item.meaning }; });
    }
    if (!window.WORD_DATA || !WORD_DATA[REVIEW_SOURCE]) return [];
    var list = WORD_DATA[REVIEW_SOURCE];
    // Shuffle and get meanings from dict
    var shuffled = list.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }
    return shuffled.map(function(w) {
        var meaning = "";
        if (window.ZH_DICT && ZH_DICT[w]) meaning = ZH_DICT[w];
        var lower = w.toLowerCase();
        if (!meaning && window.ZH_DICT) {
            // Try base forms
            if (lower.endsWith("ing")) { var b = lower.slice(0,-3); if (ZH_DICT[b]) meaning = ZH_DICT[b]; }
            if (!meaning && lower.endsWith("ed")) { var b = lower.slice(0,-2); if (ZH_DICT[b]) meaning = ZH_DICT[b]; }
            if (!meaning && lower.endsWith("s") && !lower.endsWith("ss")) { var b = lower.slice(0,-1); if (ZH_DICT[b]) meaning = ZH_DICT[b]; }
        }
        return { word: w, meaning: meaning };
    });
}

function selectReviewSource(src) {
    REVIEW_SOURCE = src;
    var labels = { "wordbank": "单词库", "高中必修1": "必修1", "高中必修2": "必修2", "高中必修3": "必修3", "四级高频": "四级", "六级高频": "六级" };
    document.getElementById("reviewSourceLabel").textContent = labels[src] || src;
    document.getElementById("reviewSourcePicker").classList.remove("show");
}
function setReviewCount(n) {
    REVIEW_COUNT = n;
    document.getElementById("reviewCountLabel").textContent = n;
    document.getElementById("reviewCountPicker").classList.remove("show");
}
function toggleReviewSource() {
    document.getElementById("reviewCountPicker").classList.remove("show");
    document.getElementById("reviewSourcePicker").classList.toggle("show");
}
function toggleReviewCount() {
    document.getElementById("reviewSourcePicker").classList.remove("show");
    document.getElementById("reviewCountPicker").classList.toggle("show");
}

function setReviewCount(n) {
    REVIEW_COUNT = n;
    document.querySelectorAll("#reviewCountSelect button").forEach(function(b) { b.classList.remove("active"); });
    var btns = document.querySelectorAll("#reviewCountSelect button");
    var vals = [10,20,30,50];
    var idx = vals.indexOf(n);
    if (idx >= 0 && idx < btns.length) btns[idx].classList.add("active");
}

function startReview() {
    var words = getReviewWords();
    if (!words.length) {
        alert(REVIEW_SOURCE === "wordbank" ? "单词库为空" : "该词库暂无数据");
        return;
    }
    REVIEW_WORDS = words.slice(0, Math.min(REVIEW_COUNT, words.length));
    REVIEW_IDX = 0; REVIEW_SCORE = 0; REVIEW_TOTAL = 0; REVIEW_CORRECT = [];
    document.getElementById("reviewStart").style.display = "none";
    document.getElementById("reviewResult").style.display = "none";
    document.getElementById("reviewQuiz").style.display = "block";
    renderReviewQuestion();
}

var REVIEW_BG = ["linear-gradient(135deg,#667eea,#764ba2)","linear-gradient(135deg,#f093fb,#f5576c)","linear-gradient(135deg,#4facfe,#00f2fe)","linear-gradient(135deg,#43e97b,#38f9d7)","linear-gradient(135deg,#fa709a,#fee140)","linear-gradient(135deg,#a18cd1,#fbc2eb)","linear-gradient(135deg,#fccb90,#d57eeb)","linear-gradient(135deg,#e0c3fc,#8ec5fc)","linear-gradient(135deg,#f5576c,#ff6f00)","linear-gradient(135deg,#667eea,#43e97b)"];

function renderReviewQuestion() {
    if (REVIEW_IDX >= REVIEW_WORDS.length) { showReviewResult(); return; }
    var w = REVIEW_WORDS[REVIEW_IDX];
    document.getElementById("reviewProgress").textContent = (REVIEW_IDX+1) + " / " + REVIEW_WORDS.length;
    document.getElementById("reviewWordEl").textContent = w.word;
    var phon = window.PHONETIC && PHONETIC[w.word.toLowerCase()] || "";
    document.getElementById("reviewPhonEl").textContent = phon ? "/" + phon + "/" : "";
    var opts = [w.meaning];
    var pool = REVIEW_WORDS.filter(function(x) { return x.meaning && x.meaning !== w.meaning; });
    var allM = Object.values(ZH_DICT || {}).filter(function(m) { return m && m !== w.meaning; });
    while (opts.length < 4 && (pool.length || allM.length)) {
        var p;
        if (pool.length) { var idx = Math.floor(Math.random()*pool.length); p = pool[idx].meaning; pool.splice(idx,1); }
        else { var idx = Math.floor(Math.random()*allM.length); p = allM[idx]; allM.splice(idx,1); }
        if (opts.indexOf(p) === -1 && p) opts.push(p);
    }
    for (var i = opts.length-1; i > 0; i--) { var j = Math.floor(Math.random()*(i+1)); var t = opts[i]; opts[i] = opts[j]; opts[j] = t; }
    var labels = ["A","B","C","D"];
    var html = "";
    for (var i = 0; i < opts.length; i++) {
        html += '<div class="review-option" data-correct="' + (opts[i] === w.meaning) + '" onclick="checkReviewAnswer(this)">';
        html += '<span class="review-opt-label">' + labels[i] + '</span><span>' + opts[i] + '</span></div>';
    }
    document.getElementById("reviewOptions").innerHTML = html;
    document.getElementById("reviewFeedback").textContent = "";
    document.getElementById("reviewNextBtn").style.display = "none";
    setTimeout(function() { playPronunciation(w.word); }, 300);
}

function checkReviewAnswer(el) {
    if (document.querySelector(".review-option.selected")) return;
    el.classList.add("selected");
    REVIEW_TOTAL++;
    if (el.getAttribute("data-correct") === "true") {
        REVIEW_SCORE++; REVIEW_CORRECT.push(REVIEW_WORDS[REVIEW_IDX].word);
        el.classList.add("correct");
        document.getElementById("reviewFeedback").innerHTML = '<span>✓ 正确！</span>';
    } else {
        el.classList.add("wrong");
        document.getElementById("reviewFeedback").innerHTML = '<span>正确答案：' + REVIEW_WORDS[REVIEW_IDX].meaning + '</span>';
        document.querySelectorAll(".review-option").forEach(function(o) { if (o.getAttribute("data-correct") === "true") o.classList.add("correct"); });
        addWrongWord(REVIEW_WORDS[REVIEW_IDX].word);
    }
    document.getElementById("reviewNextBtn").style.display = "block";
}

function nextReviewQuestion() {
    REVIEW_IDX++;
    renderReviewQuestion();
}

function showReviewResult() {
    document.getElementById("reviewQuiz").style.display = "none";
    document.getElementById("reviewResult").style.display = "flex";
    var pct = REVIEW_TOTAL > 0 ? Math.round(REVIEW_SCORE / REVIEW_TOTAL * 100) : 0;
    var msg = pct >= 80 ? "太棒了！" : pct >= 60 ? "不错！" : "再练练！";
    var html = '<div class="review-result-score">' + REVIEW_SCORE + '/' + REVIEW_TOTAL + '</div>';
    html += '<div class="review-result-pct">' + pct + '%</div>';
    html += '<div class="review-result-msg">' + msg + '</div>';
    if (REVIEW_CORRECT.length) {
        html += '<div class="review-result-words">';
        REVIEW_CORRECT.forEach(function(w) { html += '<span class="review-result-word">' + w + '</span> '; });
        html += '</div>';
    }
    html += '<button class="review-result-btn primary" onclick="startReview()">再来一轮</button>';
    html += '<button class="review-result-btn secondary" onclick="closeReview()">返回</button>';
    document.getElementById("reviewResult").innerHTML = html;
}

function closeReview() { showTab("read"); }
function openReviewSettings() { document.getElementById("reviewSettingsPanel").style.display = "block"; }
function closeReviewSettings() { document.getElementById("reviewSettingsPanel").style.display = "none"; }
function openReviewStudy() { startReview(); }
function openReviewWrong() {
    var wrong = getWrongWords();
    if (!wrong.length) { alert("还没有错词记录，先背单词吧！"); return; }
    REVIEW_WORDS = [];
    for (var i = 0; i < wrong.length; i++) {
        var meaning = ZH_DICT && ZH_DICT[wrong[i]] || getBasicMeaning(wrong[i]);
        REVIEW_WORDS.push({ word: wrong[i], meaning: meaning || "" });
    }
    REVIEW_IDX = 0; REVIEW_SCORE = 0; REVIEW_TOTAL = 0; REVIEW_CORRECT = [];
    document.getElementById("reviewStart").style.display = "none";
    document.getElementById("reviewResult").style.display = "none";
    document.getElementById("reviewQuiz").style.display = "block";
    renderReviewQuestion();
}
function getWrongWords() { try { return JSON.parse(localStorage.getItem("gap_wrong_words") || "[]"); } catch(e) { return []; } }
function addWrongWord(word) { var wrong = getWrongWords(); if (wrong.indexOf(word) === -1) wrong.push(word); localStorage.setItem("gap_wrong_words", JSON.stringify(wrong)); }
function getBasicMeaning(word) {
    if (!window.ZH_DICT) return "";
    if (ZH_DICT[word]) return ZH_DICT[word];
    var lower = word.toLowerCase();
    if (lower.endsWith("ing")) { var b = lower.slice(0,-3); if (ZH_DICT[b]) return ZH_DICT[b]; }
    if (lower.endsWith("ed")) { var b = lower.slice(0,-2); if (ZH_DICT[b]) return ZH_DICT[b]; }
    if (lower.endsWith("s") && !lower.endsWith("ss")) { var b = lower.slice(0,-1); if (ZH_DICT[b]) return ZH_DICT[b]; }
    return "";
}
