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
// 图书馆（Standard Ebooks 公版书）
var SE_CATALOG = [];        // se-catalog.json 的书目索引
var SE_LOADED = {};         // 已加载 data.js 的 slug → 章节对象
var libraryNav = { book: null };  // 当前书内阅读的返回上下文
var currentWord = "";
var currentWordElement = null;
var currentDictData = null;
var currentPhonetic = "";
var audioCache = {};
// 阅读进度记忆（段落级）：localStorage 格式 { chapterId, paragraphIndex, percent, updatedAt }
var PROGRESS_PREFIX = "gap-progress:";
var readProgress = { para: 0, percent: 0, timer: null, observer: null, savedPara: -1, savedAt: 0 };

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
        // 自动建复习卡（学习闭环：查词 → 复习）
        upsertReviewCard(word, meaning, articleKey, articleTitle);
    }
}

function isInWordBank(word, articleKey) {
    return getWordBank().some(function(item) { return item.word === word && item.articleKey === articleKey; });
}

function removeFromWordBank(word, articleKey) {
    var bank = getWordBank();
    bank = bank.filter(function(item) { return !(item.word === word && item.articleKey === articleKey); });
    localStorage.setItem("gap_wordbank", JSON.stringify(bank));
    // 单词库中该词已全部删除 → 同步删复习卡
    var base = getBaseWord(word);
    var stillExists = bank.some(function(item) { return item.word === base; });
    if (!stillExists) removeReviewCard(base);
}

// ==========================================
// 单词复习卡（闪卡 · 简化版 SM-2）
// ==========================================
// 独立存储 gap_review_cards，按单词去重（一个词一张卡），
// 与单词库 gap_wordbank（word+article 去重，同词可多条）互不干扰。
function getReviewCards() {
    try {
        var data = localStorage.getItem("gap_review_cards");
        return data ? JSON.parse(data) : {};
    } catch(e) { return {}; }
}
function saveReviewCards(cards) {
    try { localStorage.setItem("gap_review_cards", JSON.stringify(cards)); } catch(e) {}
}
function pad2(n) { return n < 10 ? "0" + n : "" + n; }
function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
function addDays(dateStr, days) {
    var d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
function normalizeReviewCard(card, key) {
    var t = todayStr();
    card = card || {};
    var word = (card.word || key || "").toLowerCase();
    var interval = parseInt(card.interval, 10);
    if (isNaN(interval) || interval < 0) interval = 0;
    var ease = parseFloat(card.ease);
    if (isNaN(ease) || ease < 1.3) ease = 2.3;
    card.word = word;
    card.phonetic = card.phonetic || PHONETIC[word] || "";
    card.meaning = card.meaning || "";
    card.ease = ease;
    card.interval = interval;
    card.reps = Math.max(0, parseInt(card.reps, 10) || 0);
    card.lapses = Math.max(0, parseInt(card.lapses, 10) || 0);
    card.dueDate = card.dueDate || t;
    card.addedDate = card.addedDate || t;
    card.lastReviewedDate = card.lastReviewedDate || "";
    card.status = card.status || (interval === 0 ? "new" : (interval >= 30 ? "mastered" : "reviewing"));
    // 注意：不要把 {status:"learning", interval:0} 强制改回 "new" ——
    // rateReviewCard 在学习期复现时会合法地设置该状态，改回会清零学习进度。
    if (interval >= 30) card.status = "mastered";
    else if (interval > 0 && card.status === "mastered") card.status = "reviewing";
    if (card.source && !card.source.articleTitle) card.source.articleTitle = "";
    return card;
}
function migrateReviewCards() {
    var cards = getReviewCards();
    var changed = false;
    var merged = {};
    for (var key in cards) {
        if (!cards.hasOwnProperty(key)) continue;
        var normalized = normalizeReviewCard(cards[key], key);
        var w = normalized.word;
        if (!w) continue;
        if (merged[w]) {
            // key 大小写不统一（如 "Hello" 与 "hello"）→ 合并：保留进度更靠后的卡，补齐缺字段，避免静默覆盖丢数据
            var ex = merged[w];
            if (normalized.interval > ex.interval ||
                (normalized.interval === ex.interval && normalized.reps > ex.reps) ||
                (normalized.interval === ex.interval && normalized.reps === ex.reps &&
                 (normalized.lastReviewedDate || "") > (ex.lastReviewedDate || ""))) {
                if (!normalized.meaning && ex.meaning) normalized.meaning = ex.meaning;
                if (!normalized.source && ex.source) normalized.source = ex.source;
                merged[w] = normalized;
            } else {
                if (!ex.meaning && normalized.meaning) ex.meaning = normalized.meaning;
                if (!ex.source && normalized.source) ex.source = normalized.source;
            }
            changed = true;
        } else {
            merged[w] = normalized;
            changed = true;
        }
    }
    cards = merged;
    getWordBank().forEach(function(item) {
        var word = getBaseWord(item.word || "");
        if (!word) return;
        if (!cards[word]) {
            cards[word] = normalizeReviewCard({
                word: word,
                meaning: item.meaning || "",
                addedDate: item.time ? String(item.time).slice(0, 10) : todayStr(),
                dueDate: todayStr(),
                source: item.articleKey ? { articleKey: item.articleKey, articleTitle: item.articleTitle || "" } : null
            }, word);
            changed = true;
        } else {
            if (!cards[word].meaning && item.meaning) { cards[word].meaning = item.meaning; changed = true; }
            if (!cards[word].source && item.articleKey) {
                cards[word].source = { articleKey: item.articleKey, articleTitle: item.articleTitle || "" };
                changed = true;
            }
        }
    });
    if (changed) saveReviewCards(cards);
}
// 新词入库 → 自动建复习卡；已有卡片只刷新释义，不重置复习进度
function upsertReviewCard(word, meaning, articleKey, articleTitle) {
    var cards = getReviewCards();
    var key = word.toLowerCase();
    var t = todayStr();
    if (cards[key]) {
        if (meaning) cards[key].meaning = meaning;
        if (!cards[key].source && articleKey) {
            cards[key].source = { articleKey: articleKey, articleTitle: articleTitle };
        }
    } else {
        cards[key] = {
            word: key,
            phonetic: PHONETIC[key] || "",
            meaning: meaning || "",
            ease: 2.0,        // SM-2 记忆系数
            interval: 0,      // 当前间隔（天）
            reps: 0,          // 连续答对次数
            dueDate: t,       // 下次复习日期
            lapses: 0,        // 累计忘记次数
            status: "learning",
            addedDate: t,
            source: articleKey ? { articleKey: articleKey, articleTitle: articleTitle } : null
        };
    }
    if (cards[key]) cards[key] = normalizeReviewCard(cards[key], key);
    saveReviewCards(cards);
}
function removeReviewCard(word) {
    var cards = getReviewCards();
    delete cards[word.toLowerCase()];
    saveReviewCards(cards);
}
// 今日待复习数量
function getDueCount() {
    var cards = getReviewCards();
    var t = todayStr();
    var n = 0;
    for (var k in cards) { if (cards.hasOwnProperty(k) && cards[k].dueDate <= t) n++; }
    return n;
}
// 今日复习队列（按加入时间排序，早加入的先复习）
function getDueQueue() {
    var cards = getReviewCards();
    var t = todayStr();
    var due = [];
    for (var k in cards) {
        if (cards.hasOwnProperty(k) && cards[k].dueDate <= t) {
            var card = normalizeReviewCard(cards[k], k);
            card.sessionRetry = 0;
            card.reviewedOnce = false;
            due.push(card);
        }
    }
    due.sort(function(a, b) {
        var priority = { "new": 0, "learning": 1, "reviewing": 2, "mastered": 3 };
        var pa = priority[a.status] !== undefined ? priority[a.status] : 2;
        var pb = priority[b.status] !== undefined ? priority[b.status] : 2;
        if (pa !== pb) return pa - pb;
        if ((a.dueDate || "") !== (b.dueDate || "")) return (a.dueDate || "").localeCompare(b.dueDate || "");
        if ((b.lapses || 0) !== (a.lapses || 0)) return (b.lapses || 0) - (a.lapses || 0);
        return (a.addedDate || "").localeCompare(b.addedDate || "");
    });
    return due;
}
// 明天预计待复习数
function getTomorrowCount() {
    var cards = getReviewCards();
    var t = todayStr();
    var tm = addDays(t, 1);
    var n = 0;
    for (var k in cards) {
        if (cards.hasOwnProperty(k) && cards[k].dueDate > t && cards[k].dueDate <= tm) n++;
    }
    return n;
}
// 简化版 SM-2：三档自评更新记忆状态
// rating: "good"(想起来了) / "hard"(模糊) / "again"(忘了)
function rateReviewCard(word, rating, promote) {
    var cards = getReviewCards();
    var key = word.toLowerCase();
    if (!cards[key]) return;
    var card = normalizeReviewCard(cards[key], key);
    var t = todayStr();
    if (rating === "good") {
        if (card.interval === 0 && !promote) {
            card.status = "learning";
            card.dueDate = t;
        } else {
            card.reps += 1;
            if (card.interval === 0) card.interval = 1;
            else if (card.interval === 1) card.interval = 3;
            else if (card.interval === 3) card.interval = 7;
            else if (card.interval === 7) card.interval = 14;
            else if (card.interval === 14) card.interval = 30;
            else card.interval = Math.max(30, Math.round(card.interval * card.ease));
            card.status = card.interval >= 30 ? "mastered" : "reviewing";
            card.dueDate = addDays(t, card.interval);
        }
        card.ease = Math.min(2.8, card.ease + 0.08);
    } else if (rating === "hard") {
        card.ease = Math.max(1.3, card.ease - 0.08);
        card.interval = Math.max(1, Math.round((card.interval || 1) / 2));
        card.dueDate = addDays(t, card.interval);
        card.status = card.interval >= 7 ? "reviewing" : "learning";
    } else {
        card.lapses += 1;
        card.reps = 0;
        card.interval = 1;
        card.ease = Math.max(1.3, card.ease - 0.15);
        card.dueDate = addDays(t, 1);
        card.status = "learning";
    }
    card.lastReviewedDate = t;
    cards[key] = card;
    saveReviewCards(cards);
    return card;
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
    migrateReviewCards();
    updateReviewBadge();
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
    document.getElementById("review-panel").style.display = (tabName === "review") ? "block" : "none";
    var libPanel = document.getElementById("library-panel");
    if (libPanel) libPanel.style.display = (tabName === "library") ? "block" : "none";
    document.getElementById("topic-bar").style.display = (tabName === "read" || tabName === "library") ? "flex" : "none";
    if (tabName === "wordbank") { renderWordBank(); updateReviewBadge(); }
    if (tabName === "review") openReview();
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

// ==========================================
// 图书馆（Standard Ebooks 公版书）
// ==========================================
function hideLibraryPanel() {
    var p = document.getElementById("library-panel");
    if (p) p.style.display = "none";
}

// 进入图书馆 Tab（书架）
function selectLibrary() {
    document.querySelectorAll(".topic-btn").forEach(function(btn) { btn.classList.remove("active"); });
    var tabBtn = document.getElementById("libraryTabBtn");
    if (tabBtn) tabBtn.classList.add("active");
    showTab("library");
    // 重新进入时回到书架视图
    document.getElementById("bookChaptersView").style.display = "none";
    document.getElementById("shelfView").style.display = "block";
    if (!SE_CATALOG.length) loadCatalog();
    else renderShelf();
    closePopup();
}

// 加载书目录索引 se-catalog.json
function loadCatalog() {
    var listDiv = document.getElementById("shelfList");
    listDiv.innerHTML = '<div class="empty-hint" style="padding:48px 0;text-align:center;color:#aeaeb2;">正在加载书架…</div>';
    fetch("se-books/se-catalog.json")
        .then(function(r) { return r.json(); })
        .then(function(data) {
            SE_CATALOG = data.books || [];
            renderShelf();
        })
        .catch(function() {
            listDiv.innerHTML = '<div class="empty-hint" style="padding:48px 0;text-align:center;color:#aeaeb2;">书架加载失败，请检查网络后重试</div>';
        });
}

function formatNum(n) { return (n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
// 章节标题：纯罗马数字（如 "I"/"LXI"，《傲慢与偏见》类无文本标题的书）加 "Chapter " 前缀，增强书卷感；其余原样返回
function formatChapterTitle(title) {
    var t = String(title || "").trim();
    if (/^[IVXLC]+$/i.test(t)) return "Chapter " + t.toUpperCase();
    return title;
}

// 渲染书架
function renderShelf() {
    var listDiv = document.getElementById("shelfList");
    if (!SE_CATALOG.length) {
        listDiv.innerHTML = '<div class="empty-hint" style="padding:48px 0;text-align:center;color:#aeaeb2;">书架还是空的，用 tools/import.js 导入公版书吧</div>';
        return;
    }
    listDiv.innerHTML = SE_CATALOG.map(function(b) {
        var meta = [b.author, b.originalYear || b.year, b.chapters + " 章", formatNum(b.wordCount) + " 词"].filter(Boolean).join(" · ");
        return '<div class="book-card" onclick="openLibraryBook(\'' + b.slug + '\')">' +
            '<img class="book-cover" src="' + b.cover + '" alt="" loading="lazy">' +
            '<div class="book-info">' +
                '<div class="book-title-row"><span class="book-title">' + escHtml(b.title) + '</span></div>' +
                (b.titleCn ? '<div class="book-title-cn">' + escHtml(b.titleCn) + '</div>' : '') +
                '<div class="book-meta">' + escHtml(meta) + '</div>' +
                (b.description ? '<div class="book-desc">' + escHtml(b.description) + '</div>' : '') +
            '</div>' +
        '</div>';
    }).join("");
}

// 打开一本书：按需加载 data.js 并渲染章节列表
function openLibraryBook(slug) {
    libraryNav.book = slug;
    document.getElementById("shelfView").style.display = "none";
    document.getElementById("bookChaptersView").style.display = "block";
    var listDiv = document.getElementById("bookChapterList");
    listDiv.innerHTML = '<div class="empty-hint" style="padding:48px 0;text-align:center;color:#aeaeb2;">正在加载章节…</div>';
    loadBookData(slug).then(function() {
        var meta = window.SE_BOOKS[slug].meta;
        document.getElementById("bookHeroTitle").textContent = meta.title;
        document.getElementById("bookHeroTitleCn").textContent = meta.titleCn || "";
        document.getElementById("bookHeroMeta").textContent = [meta.author, (meta.originalYear || meta.year), meta.chapters + " 章", formatNum(meta.wordCount) + " 词"].filter(Boolean).join(" · ");
        document.getElementById("bookHeroDesc").textContent = meta.description || "";
        var coverEl = document.getElementById("bookHeroCover");
        if (meta.cover) { coverEl.src = meta.cover; coverEl.style.display = "block"; }
        else coverEl.style.display = "none";
        renderBookChapters(window.SE_BOOKS[slug].chapters);
    }).catch(function() {
        listDiv.innerHTML = '<div class="empty-hint" style="padding:48px 0;text-align:center;color:#aeaeb2;">章节加载失败</div>';
    });
}

// 按需加载某书 data.js，并把章节合并进全局 articles（供阅读/搜索复用）
function loadBookData(slug) {
    if (SE_LOADED[slug]) return Promise.resolve(SE_LOADED[slug]);
    return fetch("se-books/" + slug + "/data.js")
        .then(function(r) { return r.text(); })
        .then(function(code) {
            (new Function(code))();   // 执行后挂到 window.SE_BOOKS[slug]
            var chapters = window.SE_BOOKS[slug].chapters;
            for (var k in chapters) articles[k] = chapters[k];
            SE_LOADED[slug] = chapters;
            return chapters;
        });
}

// 渲染书内章节列表
function renderBookChapters(chapters) {
    var listDiv = document.getElementById("bookChapterList");
    var keys = Object.keys(chapters).sort(function(a, b) { return chapters[a].chapter - chapters[b].chapter; });
    if (!keys.length) { listDiv.innerHTML = '<div class="empty-hint" style="padding:48px 0;text-align:center;color:#aeaeb2;">本书暂无章节</div>'; return; }

    // 收集该书各章历史进度，找出最近在读章节（updatedAt 最新）
    var progressMap = {};
    var latestKey = null, latestTime = -1;
    keys.forEach(function(k) {
        var p = getSavedProgress(k);
        if (p) {
            progressMap[k] = p;
            if (p.updatedAt > latestTime) { latestTime = p.updatedAt; latestKey = k; }
        }
    });

    var html = "";
    // 顶部"继续阅读"卡片：该书有历史记录时显示（重点入口）
    if (latestKey && progressMap[latestKey]) {
        var lp = progressMap[latestKey];
        var lc = chapters[latestKey];
        html += '<div class="continue-reading-card" onclick="openBookChapter(\'' + latestKey + '\')">' +
            '<span class="cr-icon">▶</span>' +
            '<div class="cr-info">' +
                '<div class="cr-label">继续阅读</div>' +
                '<div class="cr-title">' + escHtml(formatChapterTitle(lc.title)) + '</div>' +
            '</div>' +
            '<span class="cr-pct">已读 ' + lp.percent + '%</span>' +
        '</div>';
    }

    html += keys.map(function(k) {
        var c = chapters[k];
        var words = c.wordCount || (c.text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) || []).length;
        var mins = c.readingMinutes || Math.max(1, Math.round(words / 200));
        var prog = progressMap[k];
        var progHtml = prog ? '<span class="chapter-progress">' + prog.percent + '%</span>' : '';
        var readingClass = (k === latestKey) ? ' reading' : '';
        return '<div class="chapter-item' + readingClass + '" onclick="openBookChapter(\'' + k + '\')">' +
            '<span class="chapter-num">' + pad2(c.chapter) + '</span>' +
            '<div class="chapter-info">' +
                '<div class="chapter-title">' + escHtml(formatChapterTitle(c.title)) + '</div>' +
                '<div class="chapter-words">' + formatNum(words) + ' 词 · ' + mins + ' 分钟' + progHtml + '</div>' +
            '</div>' +
            '<span class="chapter-chevron">›</span>' +
        '</div>';
    }).join("");

    listDiv.innerHTML = html;
}

// 打开书内某章：记录返回上下文后进入阅读器
function openBookChapter(key) {
    var a = articles[key];
    if (!a) return;
    libraryNav.book = a.book || null;
    openArticle(key);
}

// 从书内章节视图返回书架
function backToShelf() {
    document.getElementById("bookChaptersView").style.display = "none";
    document.getElementById("shelfView").style.display = "block";
    renderShelf();
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
    hideLibraryPanel();
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
    // 从图书馆进入文章：切换到 read 面板并隐藏图书馆
    var libPanel = document.getElementById("library-panel");
    if (libPanel && libPanel.style.display !== "none") {
        document.getElementById("read-panel").style.display = "block";
        libPanel.style.display = "none";
    }
    document.getElementById("textSettingsGroup").style.display = "block";
    loadArticle(key);
    window.scrollTo(0, 0);
}

// 返回列表
function backToList() {
    ttsStop();
    clearProgressTracking();
    var fromBook = libraryNav.book;
    libraryNav.book = null;
    var detail = document.getElementById("articleDetailView");
    detail.classList.add("slide-out");
    setTimeout(function() {
        if (fromBook) {
            // 从书内章节返回：回到该书章节列表
            document.getElementById("library-panel").style.display = "block";
            document.getElementById("bookChaptersView").style.display = "block";
            document.getElementById("read-panel").style.display = "none";
        } else {
            document.getElementById("articleListView").style.display = "block";
        }
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
    // 点前后都是字母/数字 → 缩写内或小数（e.g. / Ph.D. / 3.14 / U.S. / a.m.），不视为句末
    var before = dotIdx > 0 ? text[dotIdx - 1] : "";
    var after = dotIdx + 1 < text.length ? text[dotIdx + 1] : "";
    if (/[a-zA-Z0-9]/.test(before) && /[a-zA-Z0-9]/.test(after)) return true;
    var core = word.replace(/\./g, "");
    return /^(mr|mrs|ms|dr|st|sr|jr|vs|etc|inc|ltd|co|prof|rev|hon|dept|ave|blvd|apt|no|nos|mt|ft|sec|min|hr|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|us|uk|fig|vol|eds|al|est|approx|east|west|north|south|eg|ie|phd|md|bc|ad)$/i.test(core);
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

// 段落拆分：text 规范为段落间双空格分隔（import.js 数据格式）
function splitParagraphs(text) {
    return String(text).split(/ {2,}/).map(function(p) { return p.trim(); }).filter(Boolean);
}

// 渲染可点词文本：段落 → <p class="para" data-para>，段内句子 → .sentence，词 → .word
function makeWordsClickable(container, text) {
    container.innerHTML = "";
    var knownWords = getWordBank().map(function(item) { return item.word.toLowerCase(); });
    var paragraphs = splitParagraphs(text);
    for (var pi = 0; pi < paragraphs.length; pi++) {
        var paraEl = document.createElement("p");
        paraEl.className = "para";
        paraEl.setAttribute("data-para", pi);
        // 预存段落词数，供防突跃校验（Anti-Fling Guard）按 250wpm 判断进度合法性
        paraEl.setAttribute("data-words", (paragraphs[pi].match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) || []).length);
        container.appendChild(paraEl);
        var sentences = splitSentences(paragraphs[pi]);
        for (var si = 0; si < sentences.length; si++) {
            var sentEl = document.createElement("span");
            sentEl.className = "sentence";
            paraEl.appendChild(sentEl);
            var tokens = sentences[si].split(/(\s+)/);
            tokens.forEach(function(token) {
                if (/^\s+$/.test(token)) { sentEl.appendChild(document.createTextNode(token)); return; }
                // 支持英文缩写作为一个整体词（don't / it's / can't / shouldn't ...）
                var match = token.match(/^([a-zA-Z]+(?:'[a-zA-Z]+)?)([.,;:!?)\]"']*)$/);
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
            if (si < sentences.length - 1) paraEl.appendChild(document.createTextNode(" "));
        }
    }
}

// ==========================================
// 阅读进度记忆（段落级定位 + 继续阅读）
// ==========================================
function getSavedProgress(chapterId) {
    try {
        var raw = localStorage.getItem(PROGRESS_PREFIX + chapterId);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function getParas() {
    return document.querySelectorAll("#articleContent .para");
}

// 两段落之间的累计词数（不含 from 端，含 to 端）
function wordsBetween(fromIdx, toIdx) {
    var paras = getParas();
    if (!paras.length) return 0;
    var lo = Math.min(fromIdx, toIdx), hi = Math.max(fromIdx, toIdx);
    var w = 0;
    for (var i = lo + 1; i <= hi; i++) {
        if (paras[i]) w += parseInt(paras[i].getAttribute("data-words") || "0", 10) || 0;
    }
    return w;
}

// 防突跃校验（Anti-Fling Guard）：相对上次保存位置的新增词数，必须在经过时间内按 250wpm 能读完
function shouldAcceptProgress(newPara) {
    if (readProgress.savedPara < 0 || newPara === readProgress.savedPara) return true;
    var deltaWords = wordsBetween(readProgress.savedPara, newPara);
    var elapsedMin = (Date.now() - readProgress.savedAt) / 60000;
    var canReadWords = elapsedMin * 250;   // 250 wpm 正常阅读速度
    return deltaWords <= canReadWords;
}

function saveProgressNow(chapterId, paraIndex, totalParas) {
    if (!chapterId || !totalParas) return;
    var percent = Math.min(100, Math.round((paraIndex + 1) / totalParas * 100));
    var data = { chapterId: chapterId, paragraphIndex: paraIndex, percent: percent, updatedAt: Date.now() };
    try { localStorage.setItem(PROGRESS_PREFIX + chapterId, JSON.stringify(data)); } catch (e) {}
    readProgress.percent = percent;
    readProgress.savedPara = paraIndex;
    readProgress.savedAt = Date.now();
}

// 驻留时间过滤（Dwell Time）：段落变化后重置计时，停止滚动且在同一段落停留 ≥2.5s 才尝试保存；
// 保存前再过防突跃校验，快速划过（fling）不会错误覆盖真实进度
function scheduleProgressSave() {
    if (readProgress.timer) clearTimeout(readProgress.timer);
    readProgress.timer = setTimeout(function() {
        var paras = getParas();
        if (!paras.length || !currentArticleKey) return;
        if (!shouldAcceptProgress(readProgress.para)) return;  // 快速扫视，禁止更新
        saveProgressNow(currentArticleKey, readProgress.para, paras.length);
    }, 2500);
}

// IntersectionObserver：监听视口顶部可见段落（rootMargin 收窄到顶部 30%），段落变化即防抖保存
function setupProgressObserver() {
    if (readProgress.observer) { readProgress.observer.disconnect(); readProgress.observer = null; }
    var paras = document.querySelectorAll("#articleContent .para");
    if (!paras.length) return;
    readProgress.para = 0;
    var io = new IntersectionObserver(function(entries) {
        var bestTop = Infinity, bestIdx = -1;
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (!entry.isIntersecting) continue;
            var top = entry.boundingClientRect.top;
            if (top >= -16 && top < bestTop) { bestTop = top; bestIdx = parseInt(entry.target.getAttribute("data-para"), 10); }
        }
        if (bestIdx >= 0 && bestIdx !== readProgress.para) {
            readProgress.para = bestIdx;
            scheduleProgressSave();
        }
    }, { rootMargin: "0px 0px -70% 0px", threshold: 0 });
    paras.forEach(function(p) { io.observe(p); });
    readProgress.observer = io;
}

// 进入章节：平滑滚动到上次段落并 Toast 提示
function tryRestoreProgress() {
    var saved = getSavedProgress(currentArticleKey);
    var paras = document.querySelectorAll("#articleContent .para");
    if (!saved || !paras.length || saved.paragraphIndex >= paras.length) return;
    readProgress.para = saved.paragraphIndex;
    // 等布局稳定（图片/字体）后再滚动
    setTimeout(function() {
        var p = document.querySelectorAll("#articleContent .para")[saved.paragraphIndex];
        if (!p) return;
        p.scrollIntoView({ behavior: "smooth", block: "start" });
        showToast("已恢复至上次阅读位置");
    }, 150);
}

// 轻量 Toast：顶部居中，2.2s 自动淡出
function showToast(msg) {
    var t = document.getElementById("gapToast");
    if (!t) {
        t = document.createElement("div");
        t.id = "gapToast";
        t.className = "toast";
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(function() { t.classList.remove("show"); }, 2200);
}

// 退出阅读时停止观察与定时器
function clearProgressTracking() {
    if (readProgress.timer) { clearTimeout(readProgress.timer); readProgress.timer = null; }
    if (readProgress.observer) { readProgress.observer.disconnect(); readProgress.observer = null; }
}

function loadArticle(key) {
    var article = articles[key];
    if (!article) return;
    currentArticleKey = key;
    if (!article.book) currentTopic = key.split("-")[0];
    var detailView = document.getElementById("articleDetailView");
    detailView.classList.remove("show", "slide-out");
    // Force reflow then add show class for animation
    void detailView.offsetWidth;
    detailView.classList.add("show");
    makeWordsClickable(document.getElementById("articleTitle"), formatChapterTitle(article.title));
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
    // 初始化进度基准：有历史记录以历史段落为基准，否则以开头为基准 —— 防快速划过误报
    var _saved = getSavedProgress(key);
    readProgress.para = 0;
    readProgress.savedPara = (_saved && _saved.paragraphIndex !== undefined) ? _saved.paragraphIndex : 0;
    readProgress.savedAt = Date.now();
    setupProgressObserver();
    tryRestoreProgress();
    applyDisplaySettings();
    // 图书馆的书不提供 TTS 朗读（不配音）：隐藏朗读按钮；话题文章不受影响
    var ttsBtn = document.getElementById("ttsArticleBtn");
    if (ttsBtn) ttsBtn.style.display = article.book ? "none" : "";
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
                topic: a.book ? "图书馆" : (TOPIC_NAMES[topicKey] || ""),
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
            '<div class="ali-title">' + formatChapterTitle(r.title) + '</div>' +
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

// 提取查词弹窗里的中文释义（不含英文释义补充部分 .popup-english）
function getPopupChineseMeaning() {
    var popupEl = document.getElementById("popupMeaning");
    if (!popupEl) return "";
    var children = popupEl.children;
    for (var i = 0; i < children.length; i++) {
        var el = children[i];
        // 中文释义是弹窗的直接子元素 <p>；英文释义包在 .popup-english 里，跳过
        if (el.tagName === "P" && el.className.indexOf("popup-english") === -1) {
            var t = el.textContent.trim();
            if (t && t !== "翻译中...") return t;
        }
    }
    return ""; // 无中文释义 → 不保存，避免英文释义入卡
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
    addToWordBank(base, getPopupChineseMeaning(), currentArticleKey, title);
    var btn = document.getElementById("saveWordBtn");
    btn.textContent = "✓ 已在单词库中"; btn.className = "action-btn saved"; btn.onclick = removeSavedWord;
    if (currentWordElement) currentWordElement.classList.add("known");
    updateReviewBadge();
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

// ==========================================
// 单词复习（闪卡）
// ==========================================
var reviewSession = null;

// 剔除释义里混入的英文释义长句（旧数据曾把英文释义一起存入），只保留中文部分
function cleanMeaningForFlashcard(meaning) {
    if (!meaning) return meaning;
    var m = meaning.replace(/\s+/g, " ").trim();
    // 找"连续英文单词"段（英文释义起点）；中文释义很少含 4+ 个连续英文单词
    var match = /(?:[a-zA-Z]+\.?[ ,;:'"-]?){4,}[a-zA-Z]+/.exec(m);
    if (!match) return m;
    if (match.index > 0) return m.slice(0, match.index).trim();
    return ""; // 整段都是英文释义 → 不显示
}

// ==========================================
// 复习会话持久化：中途退出（切走/刷新）可恢复，不丢进度
// ==========================================
var REVIEW_SESSION_KEY = "gap_review_session";
function saveReviewSession() {
    if (!reviewSession) { clearReviewSession(); return; }
    var snap = {
        queue: reviewSession.queue.map(function(c) {
            return {
                word: c.word,
                phonetic: c.phonetic,
                meaning: c.meaning,
                source: c.source,
                status: c.status,
                interval: c.interval,
                lapses: c.lapses,
                addedDate: c.addedDate,
                sessionRetry: c.sessionRetry,
                reviewedOnce: c.reviewedOnce
            };
        }),
        stats: reviewSession.stats,
        againWords: reviewSession.againWords || [],
        total: reviewSession.total
    };
    try { localStorage.setItem(REVIEW_SESSION_KEY, JSON.stringify(snap)); } catch(e) {}
}
function loadReviewSession() {
    try { return JSON.parse(localStorage.getItem(REVIEW_SESSION_KEY)) || null; } catch(e) { return null; }
}
function clearReviewSession() {
    try { localStorage.removeItem(REVIEW_SESSION_KEY); } catch(e) {}
}

// 从来源文章中提取含该词的原文句子，作为闪卡语境例句（R8）
function getExampleSentence(card) {
    if (!card || !card.source || !card.source.articleKey) return "";
    var art = articles[card.source.articleKey];
    if (!art || !art.text) return "";
    var w = card.word;
    var sents = splitSentences(art.text);
    for (var i = 0; i < sents.length; i++) {
        if (sents[i].toLowerCase().indexOf(w) !== -1) return sents[i].replace(/\s+/g, " ").trim();
    }
    return "";
}

// 刷新两处待复习角标：单词库入口按钮 + 菜单项
function updateReviewBadge() {
    var n = getDueCount();
    var startBadge = document.getElementById("reviewStartBadge");
    var menuBadge = document.getElementById("reviewMenuBadge");
    if (startBadge) startBadge.textContent = n > 0 ? "今日 " + n + " 个" : "";
    if (menuBadge) {
        menuBadge.textContent = n > 0 ? String(n) : "";
        menuBadge.style.display = n > 0 ? "inline-block" : "none";
    }
}

function openReview() {
    updateReviewBadge();
    var body = document.getElementById("reviewBody");
    var finish = document.getElementById("reviewFinish");
    var empty = document.getElementById("reviewEmpty");
    var resumeBanner = document.getElementById("reviewResumeBanner");

    // 优先恢复上次未完成的复习会话（防中途退出丢失）
    var saved = loadReviewSession();
    var queue = null;
    var resume = false;
    if (saved && saved.queue && saved.queue.length > 0) {
        var cards = getReviewCards();
        var savedQueue = saved.queue.filter(function(c) { return cards[c.word]; })
            .map(function(c) {
                var latest = normalizeReviewCard(cards[c.word], c.word);
                for (var p in c) latest[p] = c[p];
                return latest;
            });
        if (savedQueue.length > 0) {
            var shouldResume = true;
            if (typeof window.confirm === "function") {
                shouldResume = window.confirm("发现上次未完成的复习。点“确定”继续，点“取消”重新开始今日复习。");
            }
            if (shouldResume) {
                var removed = saved.queue.length - savedQueue.length;
                queue = savedQueue;
                reviewSession = {
                    queue: queue,
                    stats: saved.stats || { good: 0, hard: 0, again: 0 },
                    againWords: saved.againWords || [],
                    total: Math.max(queue.length, (saved.total || queue.length) - removed)
                };
                resume = true;
            } else {
                clearReviewSession();
            }
        } else {
            clearReviewSession();
        }
    }
    if (!queue) queue = getDueQueue();

    if (queue.length === 0) {
        if (body) body.style.display = "none";
        if (finish) finish.style.display = "none";
        if (empty) empty.style.display = "block";
        reviewSession = null;
        clearReviewSession();
        if (resumeBanner) resumeBanner.style.display = "none";
        return;
    }
    if (!reviewSession) reviewSession = { queue: queue, stats: { good: 0, hard: 0, again: 0 }, againWords: [], total: queue.length };
    if (empty) empty.style.display = "none";
    if (finish) finish.style.display = "none";
    if (body) body.style.display = "block";
    if (resumeBanner) resumeBanner.style.display = resume ? "block" : "none";
    renderNextCard();
}

function renderNextCard() {
    if (!reviewSession) return;
    var q = reviewSession.queue;
    if (q.length === 0) { renderReviewFinish(); return; }
    reviewSession.current = q[0];
    reviewSession.locked = false;
    resetReviewRateBtns();
    updateReviewProgress();
    var card = reviewSession.current;
    var cardEl = document.getElementById("flashCard");
    cardEl.classList.remove("flipped");
    document.getElementById("cardWord").textContent = card.word;
    document.getElementById("cardPhonetic").textContent = card.phonetic ? "/" + card.phonetic + "/" : "";
    document.getElementById("cardWordBack").textContent = card.word;
    document.getElementById("cardMeaning").textContent = cleanMeaningForFlashcard(card.meaning) || "暂无释义";
    var srcBtn = document.getElementById("cardSourceBtn");
    srcBtn.style.display = (card.source && card.source.articleKey) ? "" : "none";
    // R3：不再自动朗读（避免先给答案，保留主动回忆）；发音由用户点按钮触发
    // R8：显示来源文章中的原句例句，提供语境
    var ex = document.getElementById("cardExample");
    if (ex) {
        var sent = getExampleSentence(card);
        ex.textContent = sent;
        ex.style.display = sent ? "block" : "none";
    }
    // R10：重考 / 复现确认标识
    var label = document.getElementById("reviewRetryLabel");
    if (label) {
        if (card.reviewedOnce) {
            label.textContent = "🔁 复现确认：再答对一次就记住啦";
            label.style.display = "";
        } else if (card.sessionRetry > 0) {
            label.textContent = "第 " + (card.sessionRetry + 1) + " 次机会";
            label.style.display = "";
        } else {
            label.style.display = "none";
        }
    }
}

function flipCard() {
    // 评分后展示释义的锁定期间，点击卡片不干扰"下一个"流程
    if (reviewSession && reviewSession.locked) return;
    document.getElementById("flashCard").classList.toggle("flipped");
}

function playCardAudio() {
    var card = reviewSession ? reviewSession.current : null;
    if (card) playPronunciation(card.word);
}

// 完成一张卡时累加会话统计（按卡最终结果计，重考不重复计数 → R7）
function countReviewResult(r) {
    if (!reviewSession) return;
    if (r === "good") reviewSession.stats.good++;
    else if (r === "hard") reviewSession.stats.hard++;
    else {
        reviewSession.stats.again++;
        if (!reviewSession.againWords) reviewSession.againWords = [];
        if (reviewSession.againWords.indexOf(reviewSession.current.word) === -1) {
            reviewSession.againWords.push(reviewSession.current.word);
        }
    }
}

function rateCard(rating) {
    if (!reviewSession || !reviewSession.current || reviewSession.locked) return;
    var card = reviewSession.current;
    reviewSession.locked = true;
    reviewSession.queue.shift();

    // R6 新词学习阶段：首次答对先不算掌握，本会话复现一次后再推进间隔
    var isLearningPass = (rating === "good" && card.interval === 0 && !card.reviewedOnce);
    if (isLearningPass) {
        card.reviewedOnce = true;
        var learningCard = rateReviewCard(card.word, rating, false);   // 不推进间隔
        if (learningCard) {
            card.status = learningCard.status;
            card.dueDate = learningCard.dueDate;
            card.ease = learningCard.ease;
        }
        reviewSession.queue.push(card);
    } else if (rating === "good") {
        rateReviewCard(card.word, rating, true);
        countReviewResult("good");
    } else {
        // 模糊/忘了 → 每卡本轮最多 2 次答题机会（含初始那次），重考用尽后按最终结果计数
        card.sessionRetry = (card.sessionRetry || 0) + 1;
        var updatedCard = rateReviewCard(card.word, rating);
        if (updatedCard) {
            card.status = updatedCard.status;
            card.interval = updatedCard.interval;
            card.dueDate = updatedCard.dueDate;
            card.ease = updatedCard.ease;
            card.lapses = updatedCard.lapses;
        }
        if (card.sessionRetry < 2) {
            reviewSession.queue.push(card);
        } else {
            countReviewResult(rating);  // 重考用尽，按最终结果计；间隔已由 rateReviewCard 安排好
        }
    }

    // 卡片保持背面显示释义；禁用评分按钮，显示"下一个"按钮
    document.getElementById("flashCard").classList.add("flipped");
    setRateButtonsEnabled(false);
    var nextBtn = document.getElementById("reviewNextBtn");
    if (nextBtn) nextBtn.style.display = "";
    saveReviewSession();   // 评分后持久化会话，中途退出可恢复
}

// 用户看完释义，点"下一个"进入下一张
function reviewNextCard() {
    if (!reviewSession) return;
    reviewSession.locked = false;
    resetReviewRateBtns();
    renderNextCard();
}

// 复位评分按钮：隐藏"下一个"，恢复三个评分按钮为可点、可见
function resetReviewRateBtns() {
    var nextBtn = document.getElementById("reviewNextBtn");
    if (nextBtn) nextBtn.style.display = "none";
    setRateButtonsEnabled(true);
}
// 评分按钮状态：true=可点可见（正面）；false=淡出消失（评分后，防止误点）
function setRateButtonsEnabled(enabled) {
    var rateBtns = document.querySelectorAll(".review-rate-btn:not(#reviewNextBtn)");
    for (var i = 0; i < rateBtns.length; i++) {
        rateBtns[i].disabled = !enabled;
        rateBtns[i].classList.toggle("rating-fade", !enabled);
        rateBtns[i].style.opacity = "";
        rateBtns[i].style.display = "";
    }
}

function updateReviewProgress() {
    var done = reviewSession.stats.good + reviewSession.stats.hard + reviewSession.stats.again;
    done = Math.min(done, reviewSession.total);
    var el = document.getElementById("reviewProgress");
    if (el) el.textContent = "进度 " + done + "/" + reviewSession.total;
    var bar = document.getElementById("reviewProgressBar");
    if (bar) {
        var pct = reviewSession.total ? Math.round(done / reviewSession.total * 100) : 0;
        bar.style.width = pct + "%";
    }
}

function renderReviewFinish() {
    var body = document.getElementById("reviewBody");
    var finish = document.getElementById("reviewFinish");
    if (body) body.style.display = "none";
    if (!finish) return;
    var s = reviewSession.stats;
    var againWords = (reviewSession.againWords || []).slice();
    document.getElementById("finishTotal").textContent = reviewSession.total + " 个";
    document.getElementById("finishGood").textContent = s.good + " 个";
    document.getElementById("finishHard").textContent = s.hard + " 个";
    document.getElementById("finishAgain").textContent = s.again + " 个";
    document.getElementById("finishRate").textContent = reviewSession.total ? Math.round(s.good / reviewSession.total * 100) + "%" : "—";
    document.getElementById("finishTomorrow").textContent = "明天预计 " + getTomorrowCount() + " 个待复习" +
        (againWords.length ? "，其中 " + againWords.length + " 个需要重点回看" : "");
    var actions = finish.querySelector(".review-result-actions");
    if (actions) {
        var oldAgainBtn = document.getElementById("reviewAgainWordsBtn");
        if (oldAgainBtn) oldAgainBtn.remove();
        if (againWords.length) {
            var againBtn = document.createElement("button");
            againBtn.id = "reviewAgainWordsBtn";
            againBtn.className = "action-btn";
            againBtn.textContent = "复习忘记词";
            againBtn.onclick = function() { reviewAgainWords(againWords); };
            actions.appendChild(againBtn);
        }
    }
    finish.style.display = "block";
    reviewSession = null;
    clearReviewSession();   // 完成即清理持久化会话
    updateReviewBadge();
}

function reviewAgainWords(words) {
    var cards = getReviewCards();
    var queue = [];
    words.forEach(function(word) {
        if (cards[word]) {
            var card = normalizeReviewCard(cards[word], word);
            card.sessionRetry = 0;
            card.reviewedOnce = true;
            queue.push(card);
        }
    });
    if (!queue.length) return;
    reviewSession = { queue: queue, stats: { good: 0, hard: 0, again: 0 }, againWords: [], total: queue.length };
    document.getElementById("reviewFinish").style.display = "none";
    document.getElementById("reviewBody").style.display = "block";
    renderNextCard();
}

// 闪卡"回原文"：跳转到来源文章并滚动高亮该词
function reviewOpenSource() {
    var card = reviewSession ? reviewSession.current : null;
    if (!card || !card.source || !card.source.articleKey) return;
    var key = card.source.articleKey;
    showTab("read");
    openArticle(key);
    setTimeout(function() {
        var els = document.querySelectorAll("#articleContent .word");
        var targetBase = getBaseWord(card.word);
        for (var i = 0; i < els.length; i++) {
            if (getBaseWord(els[i].textContent) === targetBase) {
                var target = els[i].closest(".sentence") || els[i];
                target.classList.add("sentence-highlight");
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(function() { target.classList.remove("sentence-highlight"); }, 4000);
                break;
            }
        }
    }, 300);
}


