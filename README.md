# 英文阅读器 · English Reader

一个**单文件**的英文原著阅读器：书架、点词查中英释义、离线词典、25 天阅读计划，全在一个 `index.html` 里。不用装 App、不用联网读取正文、不上传任何数据，双击就能用，也可以直接挂在 GitHub Pages 上。

![书架](docs/shelf.png)

## 功能

- **书架**：内置 8 本公有领域英文小说，读到哪一页自动记住，下次接着读
- **点词即查**：正文里点任意单词，弹出音标 + 中文 + 英英释义，有音频还能发音
- **离线词典**：18,111 条（COCA 高频词 + CET4 + CET6 + TOEFL），断网也能查中文
- **导入自己的书**：txt / epub 直接拖进页面（无 DRM），文件留在浏览器本地，不上传
- **25 天阅读计划**：逐日表 + 打卡，顶部进度条跟着走
- **分章生词表**：*A Princess of Mars* 附 333 个词，按章分组、带原文例句
- **读起来的样子**：明暗主题、五档字号、目录抽屉、`←/→` 翻章、`T` 开目录

![阅读页与查词](docs/reading.png)

![阅读计划](docs/plan.png)

## 快速开始

### 在线看（GitHub Pages）

仓库 **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`**，保存后等一两分钟，访问：

```
https://<你的用户名>.github.io/<仓库名>/
```

`index.html` 就是入口，不需要构建。

### 本地看

下载 `index.html`，双击用 Chrome / Edge 打开。阅读进度、导入的书都存在浏览器本地（IndexedDB + localStorage）：换浏览器或清缓存会重新开始——内置的 8 本书不受影响，只是进度归零；自己导入的书需要重新导入一次。

## 书架里有什么

| 书名 | 章 | 词数 | 类型 |
|---|---:|---:|---|
| A Princess of Mars | 29 | 67,158 | 科幻冒险，附分章生词表 |
| Tarzan of the Apes | 28 | 86,326 | 逆袭爽文鼻祖 |
| The Call of the Wild | 7 | 31,980 | 最短，狗视角逆袭 |
| The Thirty-Nine Steps | 10 | 41,278 | 追逃悬疑 |
| The Prisoner of Zenda | 22 | 54,558 | 冒充国王 + 剑斗 |
| The Lost World | 16 | 75,665 | 探险 + 恐龙 |
| The Gods of Mars | 22 | 81,584 | 火星公主续集 |
| The Wonderful Wizard of Oz | 24 | 39,311 | 最简单的英文 |

全部来自 [Project Gutenberg](https://www.gutenberg.org/)，属于公有领域。`books/` 里也放了同样内容的独立 txt，可以直接下载，或者拖进书架。

## 目录结构

```
index.html          构建产物：GitHub Pages 入口（约 3.9 MB，书与词典都已内嵌）
books/              7 本小说的清理版 txt
plan/               25 天阅读计划（markdown）
docs/               README 截图
src/
  app/              阅读器前端：template.html / app.css / app.js / plan.json
  novel/            A Princess of Mars 的分章文本、生词表、封面
  build_app.py      打包 index.html
  clean_txt.py      清理 Gutenberg 原文（去头尾、合段、切章、保留诗行）
  make_plan.py      生成 25 天计划（markdown + plan.json）
```

## 重新构建

```bash
pip install pillow
cd src
python clean_txt.py    # 需要先把 Gutenberg 原文放到 src/raw/<id>.txt
python make_plan.py    # 生成 plan/25天阅读计划.md 和 src/app/plan.json
python build_app.py    # 生成 ../index.html
python build_app.py --desktop   # 顺便复制一份到桌面
```

构建时会把词典词表从 jsDelivr 拉到 `src/raw/`（已 gitignore），所以第一次构建需要联网。

## 已知限制

- 数据全在浏览器本地：换浏览器、清缓存，阅读进度和导入的书会丢
- 英英释义和发音走在线接口，离线时只有中文释义
- 内置书的排版是清理过的纯文本，没有插图
- 八本书都是 1900 年前后的作品，个别用词和观念已经过时

## 许可

- **代码**：MIT，见 [LICENSE](LICENSE)
- **书籍文本**：公有领域（Project Gutenberg），已去除其头尾声明；具体版权状态以你所在司法辖区为准

如果这些书帮你读完了第一本英文原著，那这个项目就值了。
