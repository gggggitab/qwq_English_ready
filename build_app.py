# -*- coding: utf-8 -*-
"""Build the single-file English reader (library + reader + dictionary)."""
import base64
import io
import json
import os
import re
import shutil
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))      # src/
ROOT = os.path.dirname(HERE)                            # repo root
APP = os.path.join(HERE, "app")
NOVEL = os.path.join(HERE, "novel")
RAW = os.path.join(HERE, "raw")                         # dict cache (gitignored)
OUT = os.path.join(ROOT, "index.html")

SOURCES = {
    "coca": "https://cdn.jsdelivr.net/gh/mahavivo/english-wordlists@master/COCA_with_translation.txt",
    "toefl": "https://cdn.jsdelivr.net/gh/mahavivo/english-wordlists@master/TOEFL.txt",
    "cet6": "https://cdn.jsdelivr.net/gh/mahavivo/english-wordlists@master/CET6_edited.txt",
    "cet4": "https://cdn.jsdelivr.net/gh/mahavivo/english-wordlists@master/CET4_edited.txt",
}
SEP = "\u2014" * 16


def fetch(name, url):
    os.makedirs(RAW, exist_ok=True)
    path = os.path.join(RAW, name + ".txt")
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return io.open(path, encoding="utf-8", errors="replace").read()
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=60).read()
    txt = data.decode("utf-8", "replace")
    io.open(path, "w", encoding="utf-8").write(txt)
    print("  fetched %-6s %8d bytes" % (name, len(data)))
    return txt


WORD_OK = re.compile(r"^[A-Za-z][A-Za-z'\-]{1,28}$")
BRACKET = re.compile(r"\[([^\]]{1,40})\]\s*")


def clean_cn(s):
    s = re.sub(r"\s+", " ", s or "").strip(" ;,，。")
    return s[:70]


def parse_coca(txt):
    out = {}
    for block in txt.split(SEP):
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if not lines:
            continue
        w = lines[0].split()[0] if lines[0].split() else ""
        if not WORD_OK.match(w):
            continue
        cn = "；".join(x for x in lines[1:3] if x)
        cn = clean_cn(cn)
        if cn:
            out[w.lower()] = ("", cn)
    return out


def parse_list(txt, out):
    for line in txt.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = BRACKET.search(line)
        ph = m.group(1).strip() if m else ""
        if m:
            head = line[:m.start()].strip()
            trans = line[m.end():].strip()
        else:
            parts = line.split(None, 1)
            if len(parts) < 2:
                continue
            head, trans = parts[0], parts[1]
        head = head.strip(" ,;")
        if not WORD_OK.match(head):
            continue
        key = head.lower()
        if key in out:
            continue
        cn = clean_cn(trans)
        if cn:
            out[key] = (ph, cn)
    return out


def build_dict():
    print("dictionary sources:")
    coca = fetch("coca", SOURCES["coca"])
    d = parse_coca(coca)
    n0 = len(d)
    for name in ("toefl", "cet6", "cet4"):
        before = len(d)
        parse_list(fetch(name, SOURCES[name]), d)
        print("  + %-5s %6d new" % (name, len(d) - before))
    print("  total %d entries (%d from COCA)" % (len(d), n0))
    lines = []
    for w in sorted(d):
        ph, cn = d[w]
        lines.append("%s\t%s\t%s" % (w, ph, cn.replace("\t", " ")))
    return "\n".join(lines)


TITLES = ["On the Arizona Hills", "The Escape of the Dead", "My Advent on Mars",
          "A Prisoner", "I Elude My Watch Dog", "A Fight That Won Friends",
          "Child-Raising on Mars", "A Fair Captive from the Sky", "I Learn the Language",
          "Champion and Chief", "With Dejah Thoris", "A Prisoner with Power",
          "Love-Making on Mars", "A Duel to the Death", "Sola Tells Me Her Story",
          "We Plan Escape", "A Costly Recapture", "Chained in Warhoon",
          "Battling in the Arena", "In the Atmosphere Factory", "An Air Scout for Zodanga",
          "I Find Dejah", "Lost in the Sky", "Tars Tarkas Finds a Friend",
          "The Looting of Zodanga", "Through Carnage to Joy", "From Joy to Death",
          "At the Arizona Cave"]


def read_paras(path):
    raw = io.open(path, encoding="utf-8").read().strip()
    return [re.sub(r"\s+", " ", x).strip() for x in raw.split("\n\n") if x.strip()]


def load_chapters():
    chs = []
    fw = os.path.join(NOVEL, "clean", "foreword.txt")
    if os.path.exists(fw):
        chs.append({"r": "", "t": "Foreword", "ps": read_paras(fw)})
    for i in range(1, 29):
        p = os.path.join(NOVEL, "clean", "ch%02d.txt" % i)
        chs.append({"r": ROMAN[i - 1], "t": TITLES[i - 1], "ps": read_paras(p)})
    return chs


ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
         "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
         "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII"]


def load_gloss():
    md = io.open(os.path.join(NOVEL, "火星公主-生词表.md"), encoding="utf-8").read()
    row_re = re.compile(r"^\| \*\*(.+?)\*\* \| (.+?) \| (.+?) \| (.*) \|$", re.M)
    sections = []
    parts = re.split(r"^## (.+)$", md, flags=re.M)
    for i in range(1, len(parts) - 1, 2):
        title = parts[i].strip()
        body = parts[i + 1]
        rows = []
        for m in row_re.finditer(body):
            ex = m.group(4).strip()
            if ex.startswith("…"):
                pass
            rows.append([m.group(1), m.group(2), m.group(3), ex])
        if rows:
            sections.append({"c": title, "rows": rows})
    return sections


def cover_data():
    from PIL import Image
    im = Image.open(os.path.join(NOVEL, "cover.jpg")).convert("RGB")
    im.thumbnail((760, 1013), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=86, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def build_book():
    chs = load_chapters()
    words = sum(len(re.findall(r"[A-Za-z][A-Za-z'\-]*", " ".join(c["ps"]))) for c in chs)
    return {
        "id": "apom",
        "title": "A Princess of Mars",
        "author": "Edgar Rice Burroughs",
        "year": "1912",
        "built": True,
        "cover": cover_data(),
        "words": words,
        "chapters": chs,
        "gloss": load_gloss(),
    }


CH_LINE = re.compile(r"^(CHAPTER [^\n]*)$", re.M)


def parse_plain_book(path):
    """books/*.txt -> {id,title,author,chapters,...}（和 clean_txt.py 的输出格式一致）"""
    t = io.open(path, encoding="utf-8").read()
    head = t.split("\n\n")[:3]
    title = os.path.splitext(os.path.basename(path))[0]
    author = ""
    for line in head[1:3]:
        if line.lower().startswith("by "):
            author = line[3:].strip()
    parts = CH_LINE.split(t)
    chs = []
    for i in range(1, len(parts), 2):
        label = parts[i].strip()
        body = parts[i + 1] if i + 1 < len(parts) else ""
        num, _, ttl = label.partition(" \u00b7 ")
        ps = [re.sub(r"\s+", " ", x).strip() for x in body.split("\n\n") if x.strip()]
        if not ps:
            continue
        chs.append({"r": num.replace("CHAPTER ", "").strip(),
                    "t": ttl.strip() or ("Chapter %d" % (len(chs) + 1)),
                    "ps": ps})
    slug = os.path.splitext(os.path.basename(path))[0]
    words = sum(len(re.findall(r"[A-Za-z][A-Za-z'\-]*", " ".join(c["ps"]))) for c in chs)
    return {
        "id": "txt-" + re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-"),
        "title": title, "author": author, "built": True, "cover": None,
        "words": words, "chapters": chs,
    }


def build_repo_books():
    d = os.path.join(ROOT, "books")
    out = []
    if not os.path.isdir(d):
        return out
    for name in sorted(os.listdir(d)):
        if name.lower().endswith(".txt"):
            b = parse_plain_book(os.path.join(d, name))
            if b["chapters"]:
                out.append(b)
                print("  + %-28s %2d ch %7d words" % (b["title"], len(b["chapters"]), b["words"]))
    return out


def main():
    css = io.open(os.path.join(APP, "app.css"), encoding="utf-8").read()
    js = io.open(os.path.join(APP, "app.js"), encoding="utf-8").read()
    tpl = io.open(os.path.join(APP, "template.html"), encoding="utf-8").read()

    book = build_book()
    extra = build_repo_books()
    data = json.dumps({"books": [book] + extra}, ensure_ascii=False, separators=(",", ":"))
    data = data.replace("</", "<\\/")
    print("builtin: %d chapters, %d words, %d gloss rows (+%d repo books)"
          % (len(book["chapters"]), book["words"],
             sum(len(s["rows"]) for s in book["gloss"]), len(extra)))

    dic = build_dict()
    dic = dic.replace("</", "<\\/")

    plan_path = os.path.join(APP, "plan.json")
    plan = io.open(plan_path, encoding="utf-8").read() if os.path.exists(plan_path) else "null"
    plan = plan.replace("</", "<\\/")

    html = (tpl.replace("{{CSS}}", css).replace("{{JS}}", js)
               .replace("{{DATA}}", data).replace("{{DICT}}", dic)
               .replace("{{PLAN}}", plan))
    io.open(OUT, "w", encoding="utf-8").write(html)
    print("wrote %s  %.1f KB" % (OUT, os.path.getsize(OUT) / 1024.0))

    if "--desktop" in sys.argv:
        import shutil as _sh
        dst = os.path.join(os.path.expanduser("~"), "Desktop", "英文阅读器.html")
        _sh.copyfile(OUT, dst)
        print("copied to %s  %.1f KB" % (dst, os.path.getsize(dst) / 1024.0))


if __name__ == "__main__":
    main()
