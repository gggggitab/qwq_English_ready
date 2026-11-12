# -*- coding: utf-8 -*-
"""Turn Project Gutenberg .txt files into clean, readable novel txts.

Reads books/raw/<id>.txt, writes books/<slug>.txt
"""
import io
import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))     # src/
ROOT = os.path.dirname(BASE)                           # repo root
RAW = os.path.join(BASE, "raw")                        # gutenberg cache (gitignored)
BOOKS = os.path.join(ROOT, "books")
NL = chr(10)

START = re.compile(r"^\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK", re.I | re.M)
END = re.compile(r"^\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK", re.I | re.M)
CHAP = re.compile(
    r"^[ \t]*(?:CHAPTER|Chapter)\s+"
    r"([IVXLCDM]+|\d{1,3}|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN)"
    r"\b\s*[.:\u2014-]?\s*(.*)$")
ILL = re.compile(r"^\s*\[(?:Illustration|Frontispiece|Plate)[^\]]*\]\s*$")
PROMO = re.compile(r"^(FOR THE|FURTHER ADVENTURES|READ THE|THE END|\*\*\*)", re.I)


def dash(p):
    p = p.replace("--", "\u2014")
    p = re.sub(r"\s*\u2014\s*", "\u2014", p)
    p = re.sub(r"\s+([,.;:!?])", r"\1", p)
    return p.strip()


def reflow(block):
    """list of raw lines -> list of paragraphs"""
    paras, cur = [], []
    for ln in block:
        s = ln.rstrip()
        if not s.strip():
            if cur:
                paras.append(cur)
                cur = []
            continue
        if ILL.match(s) or PROMO.match(s.strip()):
            continue
        cur.append(re.sub(r"\s+", " ", s.strip()))
    if cur:
        paras.append(cur)

    out = []
    for blocklines in paras:
        # 诗句：连续多行都以 , ; : 结尾 -> 保留换行
        verse = (len(blocklines) >= 2 and
                 sum(1 for x in blocklines if x.endswith((",", ";", ":"))) >= max(2, len(blocklines) * 0.5))
        p = (NL.join(blocklines) if verse else " ".join(blocklines)).replace("_", "")
        p = dash(p) if not verse else NL.join(dash(x) for x in blocklines)
        if not p:
            continue
        if len(p) < 120 and p.upper() == p and len(p.split()) >= 3:
            continue
        out.append(p)
    return out


def meta(raw, key):
    m = re.search(r"^%s:\s*(.+)$" % key, raw, re.M)
    return m.group(1).strip() if m else ""


def build(idx, slug, title=None, author=None):
    raw = io.open(os.path.join(RAW, "%s.txt" % idx), encoding="utf-8-sig", errors="replace").read()
    raw = raw.replace("\r\n", "\n").replace("\r", "\n")
    ms, me = START.search(raw), END.search(raw)
    if not me:
        raise SystemExit("%s: missing END marker (bad download)" % idx)
    body = raw[ms.end():me.start()] if ms else raw[:me.start()]
    lines = body.split("\n")

    marks = [i for i, ln in enumerate(lines) if CHAP.match(ln)]
    if not marks:
        raise SystemExit("no chapters in %s" % idx)
    # 跳过目录：目录里的标题总是挨在一起，正文标题则相隔很远
    def clustered(k):
        return any(0 < abs(marks[k] - marks[j]) <= 4 for j in range(len(marks)) if j != k)
    start_k = 0
    for k in range(len(marks)):
        if not clustered(k):
            start_k = k
            break
    lines = lines[marks[start_k]:]

    title = title or meta(raw, "Title")
    author = author or meta(raw, "Author")

    chapters, cur = [], None
    for ln in lines:
        if CHAP.match(ln):
            if cur:
                chapters.append(cur)
            m = CHAP.match(ln)
            inline = re.sub(r"\s+", " ", m.group(2) or "").strip().rstrip(".")
            cur = {"head": "CHAPTER %s" % m.group(1), "inline": inline, "lead": [], "body": []}
        elif cur is not None:
            if ln.strip():
                if not cur["body"] and not cur["lead"]:
                    cur["lead"].append(ln)
                else:
                    cur["body"].append(ln)
            elif cur["body"] or cur["lead"]:
                cur["body"].append(ln)
    if cur:
        chapters.append(cur)

    parts, allparas = [], []
    for c in chapters:
        lead = [x for x in c["lead"] if x.strip()]
        title2 = c["inline"]
        if not title2 and lead:
            cand = dash(re.sub(r"\s+", " ", lead[0].strip()))
            if len(cand) < 90 and not cand.endswith("."):
                title2 = cand
                c["body"] = lead[1:] + c["body"]
            else:
                c["body"] = lead + c["body"]
        elif lead:
            c["body"] = lead + c["body"]
        label = c["head"] + (" \u00b7 " + title2 if title2 else "")
        paras = reflow(c["body"])
        parts.append(label + "\n\n" + "\n\n".join(paras) + "\n")
        allparas.extend(paras)

    out = "%s\n\nby %s\n\n" % (title.upper(), author) + "\n\n".join(parts)
    out = re.sub(r"\n{3,}", "\n\n", out)
    io.open(os.path.join(BOOKS, slug + ".txt"), "w", encoding="utf-8", newline="\n").write(out)
    words = len(re.findall(r"[A-Za-z][A-Za-z'\u2019\-]*", "\n".join(allparas)))
    print("%-4s %-32s %2d ch %7d words %8d bytes" % (
        idx, title, len(chapters), words, len(out.encode("utf-8"))))


BOOKS = [
    ("215", "The Call of the Wild", "The Call of the Wild"),
    ("55", "The Wonderful Wizard of Oz", "The Wonderful Wizard of Oz"),
    ("558", "The Thirty-Nine Steps", "The Thirty-Nine Steps"),
]

if __name__ == "__main__":
    for row in BOOKS:
        idx, slug = row[0], row[1]
        t = row[2] if len(row) > 2 else None
        build(idx, slug, title=t)
