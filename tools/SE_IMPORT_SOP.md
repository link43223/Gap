# Standard Ebooks 导入标准操作程序（SOP）

> **目标**：把《化身博士》（The Strange Case of Dr. Jekyll and Mr. Hyde）的完整处理逻辑固化为可复制的标准流程。此后扩充书库，**必须完全遵循本 SOP**。
>
> **关联文件**：
> - `tools/import.js` —— 唯一导入入口（下载→解压→清洗→Flesch→输出）
> - `tools/books.txt` —— 书单（每行一个 SE 书籍页 URL）
> - `tools/se-titles-zh.json` —— 中文书名 / 原著出版年份映射表
> - `se-books/se-catalog.json` —— 书架索引（前端"图书馆"读它）

---

## 0. 总原则

1. **一本一书包**：`se-books/{slug}/` 目录包含 `data.js` + 各章纯文本 `chapter-N.txt` + `cover.svg`
2. **全程离线优先**：文本与封面全部本地化，不依赖任何外链
3. **前端零改动**：输出格式与现有 `articles` 字典完全兼容，阅读/点词/查义/复习自动复用

---

## 1. 获取来源（反爬规范）

- **严禁**直接脚本抓取 SE 官网的 epub 下载链接 —— 会触发反爬并封 IP 24 小时
- **一律**从官方 GitHub 源仓库下载 zip：
  `https://github.com/standardebooks/{author-slug}_{title-slug}/archive/refs/heads/master.zip`
- **仓库名自动解析（重要）**：SE 部分书带版本后缀（如基督山伯爵的 `alexandre-dumas_the-count-of-monte-cristo_chapman-and-hall`），`author_title` 拼接会 404。import.js 已自动从 SE 书页 HTML 提取真实仓库名，无需手填
- 解压后 epub 源文件位于 `src/epub/`（`content.opf` + `text/*.xhtml` + `images/`）
- 正文与排版一律 CC0 / 公有领域，可自由再分发

---

## 2. 年份规范（必改项）

- **严禁**把 SE 数字化版本年份（`dc:date`）当作展示年份
- 真实原著出版年份必须维护在 `tools/se-titles-zh.json` 的 `originalYear` 字段
- `import.js` 中 `year` 字段 = `originalYear`（原著优先）|| SE 数字化年份（仅兜底）
- 选书时若不清楚原著年，先在 Wikipedia / SE 书籍页确认后写入映射表再导入

---

## 3. 文本清洗规范（import.js 已固化，勿改动规则）

- **过滤 front/end matter**：`titlepage / imprint / colophon / uncopyright / halftitle / copyright / epigraph / dedication / toc / endnotes` 等一律剔除；只保留 body 标记为 `bodymatter` 的正文文件
- **章节保持 `<p>` 段落结构**：段间以双空格连接（与现有 `splitSentences` / 点词查义 / TTS 完全兼容）
- **标点保真**：弯引号（“ ” ‘ ’）与直引号均原样保留；em-dash（—）、省略号（…）保留
- **清洗不可见字符**：去除 U+2060 / ZWSP / ZWJ 等零宽字符；各类宽度空格归一；解码 HTML 实体
- **诗歌块**（`epub:type="poem"` / `class="poem"`）：诗行间以换行符 `\n` 保留
- **章节标题**：取 `<hN epub:type="title">`，缺失时退回文件名

---

## 4. 章节命名与 ID 规范

- 键规则：**`se-{book-slug}-{index}`**，`index` 从 1 起连续递增（`book-slug` = SE 书页 URL 末段）
- **每章必须自动计算并存**：
  - `wordCount`：正则统计英文单词数
  - `readingMinutes`：`max(1, round(wordCount / 200))`（按 200 wpm 英语平均阅读速度）
- 每章另存：`title`（章标题）、`source`（`作者 · 书名 — Chapter N`）、`book`、`chapter`、`difficulty`

---

## 5. 难度分级规范

- 全书统一难度（每章覆盖同一值），用 **Flesch-Kincaid Grade Level**：
  - `≤ 6` → 难度 1（简单）；`≤ 10` → 难度 2（中等）；`> 10` → 难度 3（难）
- 必须与 SE 官方 `schema:educationalLevel` 交叉验证：自算 FRE 偏差应 < 5
- 参考量级：《化身博士》FRE=67.66（SE 官方 66.88）、Grade=9.29 → 难度 2

---

## 6. 输出产物规范

```
se-books/{slug}/
├── data.js          # 书级 meta + 全部章节（浏览器按需加载，自注册到 window.SE_BOOKS）
├── chapter-1.txt …  # 各章清洗后纯文本（供人工校对 / TTS 续跑）
└── cover.svg        # 封面（本地化，禁止外链）

se-books/se-catalog.json  # 书架索引（每书一条，含 slug/title/titleCn/originalYear/author/year/
                          #       description/wordCount/educationalLevel/difficulty/chapters/cover/dataUrl/sourceUrl）
```

`data.js` 结构：

```js
window.SE_BOOKS[slug] = {
  meta: { slug, title, titleCn, originalYear, author, year, chapters, wordCount, ... },
  chapters: {
    "se-{slug}-1": { title, titleCn, source, text, book, chapter, wordCount, readingMinutes, difficulty },
    ...
  }
};
```

---

## 7. UI 呈现规范（前端自动继承，新书无需改样式）

- **章节序号**：衬线体（EB Garamond / Georgia / serif）无背景文本，两位数补零（`01`、`02`），颜色橄榄灰褐 `#6f6d5a`；**禁用蓝色背景圆圈**
- **章节卡片**：右侧淡灰引导箭头 `›`（`#d1d1d6`，夜间模式降暗 `#4a4a50`）
- **卡片布局**：统一圆角卡片、封面本地 SVG、阴影；含 `body.dark` 夜间模式适配
- 章节列表显示 `XX 词 · X 分钟`

---

## 8. 导入后验证清单（Checklist，逐项打勾）

- [ ] 词数 vs SE 官方 `wordCount` 偏差 < 2%
- [ ] 自算 Flesch FRE vs SE `educationalLevel` 偏差 < 5
- [ ] 章节数 = 原著章节数（日志无正文被漏）
- [ ] front/end matter 全部过滤（日志列出跳过项，无正文混入）
- [ ] 抽查 3 处：对话弯引号、em-dash 保真；无残留 HTML 实体 / 零宽字符 / 连续多空格
- [ ] `tools/se-titles-zh.json` 已录中文书名 + 原著年份
- [ ] 浏览器实测：图书馆 → 书架 → 书 → 章节 → 阅读 → 点词查义 全链路正常

---

## 9. 标准操作指令

```bash
# ① 加书单（SE 书页 URL 追加一行）
echo 'https://standardebooks.org/ebooks/{author}/{title}' >> tools/books.txt

# ② 录入中文书名 + 原著年份到 tools/se-titles-zh.json
# ③ 导入（可只导单本，slug = URL 末段书名）
node tools/import.js --book {title-slug}

# ④ 按 §8 清单逐项验证
# ⑤ 浏览器刷新进入「📚 图书馆」确认书架出现新书
```

> 注意：`node tools/import.js` 默认导入 `books.txt` 全部书；`--keep-tmp` 可保留调试用临时文件。
