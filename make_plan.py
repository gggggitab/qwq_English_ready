# -*- coding: utf-8 -*-
"""Generate books/25澶╅槄璇昏鍒?md from the cleaned txt files."""
import io
import math
import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))     # src/
ROOT = os.path.dirname(BASE)                           # repo root
BOOKS = os.path.join(ROOT, "books")
WPM = 90


def load(name):
    t = io.open(os.path.join(BOOKS, name + ".txt"), encoding="utf-8").read()
    parts = re.split(r"^(CHAPTER [^\n]*)$", t, flags=re.M)
    out = []
    for i in range(1, len(parts), 2):
        label = parts[i]
        body = parts[i + 1] if i + 1 < len(parts) else ""
        num, _, title = label.partition(" \u00b7 ")
        words = len(re.findall(r"[A-Za-z][A-Za-z'\u2019\-]*", body))
        out.append({"num": num.replace("CHAPTER ", "").strip(),
                    "title": title.strip(), "words": words})
    return out


def mins(w):
    return int(round(w / WPM))


def label(ch):
    return ("绗?%s 绔? % ch["num"]) + (" 路 " + ch["title"] if ch["title"] else "")


def per_chapter(chs, start):
    return [(start + i, label(c), c["words"]) for i, c in enumerate(chs)]


def balanced(chs, start, ndays):
    total = sum(c["words"] for c in chs)
    cum = [0]
    for c in chs:
        cum.append(cum[-1] + c["words"])
    bnds = [0]
    for k in range(1, ndays):
        target = total * k / float(ndays)
        lo = bnds[-1] + 1
        hi = len(chs) - (ndays - k)
        best = min(range(lo, hi + 1), key=lambda i: abs(cum[i] - target))
        bnds.append(best)
    bnds.append(len(chs))
    out = []
    for k in range(ndays):
        grp = chs[bnds[k]:bnds[k + 1]]
        if not grp:
            continue
        w = sum(c["words"] for c in grp)
        if len(grp) == 1:
            t = label(grp[0])
        else:
            t = ("绗?%s鈥?s 绔? % (grp[0]["num"], grp[-1]["num"])) + \
                " 路 " + grp[0]["title"] + " 绛?%d 绔? % len(grp)
        out.append((start + len(out), t, w))
    return out


def wc(chs):
    return sum(c["words"] for c in chs)


def table(rows):
    s = "| 澶?| 璇讳粈涔?| 璇嶆暟 | 绾?|\n|---:|---|---:|---:|\n"
    for d, what, w in rows:
        s += "| 绗?%d 澶?| %s | %s | %d 鍒嗛挓 |\n" % (d, what, format(w, ","), mins(w))
    return s


call = load("The Call of the Wild")
oz = load("The Wonderful Wizard of Oz")
steps = load("The Thirty-Nine Steps")

N_OZ = 8
r1 = per_chapter(call, 1)
r2 = balanced(oz, 1 + len(r1), N_OZ)
r3 = per_chapter(steps, 1 + len(r1) + len(r2))
total_days = len(r1) + len(r2) + len(r3)

md = """# {days} 澶╋紝璇诲畬涓夋湰鑻辨枃灏忚

浠庣畝鍗曞埌绋嶉毦锛屼竴鏈瘮涓€鏈暱涓€鐐广€備笁鏈兘鏄叕鏈夐鍩熶綔鍝侊紝鍏嶈垂銆佹棤 DRM锛屽凡娓呯悊鎺掔増锛堝幓鎺夌綉绔欏ご灏俱€佸悎骞剁‖鎶樿锛夛紝鐩存帴鎷栬繘闃呰鍣ㄥ氨鑳借銆?
## 鎬庝箞璇伙紙涓夋湰閫氱敤锛?
1. **涓€绔犱竴鍙ｆ皵璇诲畬锛屼腑閫斾笉鏌ヨ瘝銆?* 璇绘噦涓冩垚灏辩畻杩囷紝鍓╀笅鐨勯潬涓婁笅鏂囪ˉ銆傚仠涓嬫潵鏌ヤ笁娆★紝鑺傚灏辨柇浜嗏€斺€斿鏁颁汉灏辨槸杩欐牱鏀惧純鐨勩€?2. **鍙煡涓ょ璇?*锛氬悓涓€椤靛嚭鐜颁袱閬嶄互涓婄殑锛涗笉鏌ュ氨璇讳笉鎳傝繖鍙ヨ瘽鐨勩€傞槄璇诲櫒閲岀偣涓€涓嬭瘝灏卞嚭涓枃銆?3. **璇诲畬涓€绔犲厛鍚堜笂锛屽洖鎯炽€岃繖涓€绔犲彂鐢熶簡浠€涔堛€?*锛屾兂涓嶈捣鏉ュ啀鍥炲ご鎵竴鐪笺€傝姳 30 绉掞紝姣斿璇讳竴绔犳湁鐢ㄣ€?
## 鎬昏

| 椤哄簭 | 涔?| 绔犳暟 | 璇嶆暟 | 姣忓ぉ | 澶╂暟 |
|---|---|---:|---:|---|---:|
| 1 | The Call of the Wild | {c1} | {w1} | 1 绔?| {d1} |
| 2 | The Wonderful Wizard of Oz | {c2} | {w2} | 绾?{wp} 璇?| {d2} |
| 3 | The Thirty-Nine Steps | {c3} | {w3} | 1 绔?| {d3} |
| | **鍚堣** | **{ct}** | **{wt}** | | **{dt} 澶?* |

> 璇嶆暟鎸夋鏂囪锛涖€岀害澶氬皯鍒嗛挓銆嶆寜姣忓垎閽?90 璇嶄及锛屾瘮鐪熷疄闃呰閫熷害鐣ヤ繚瀹堛€?
## 绗竴鏈細The Call of the Wild锛堢 1鈥搟d1} 澶╋級

鏉板厠路浼︽暒鍐欑嫍涓嶅啓蹇冪悊锛氬挰銆佽窇銆佹墦銆佺潯銆傚彞瀛愮煭锛孋ET-4 鐨勮瘝姹囬噺澶熺敤锛屽墿涓嬬殑鐢熻瘝澶у鏄洩姗囨湳璇紝璺宠繃涓嶅奖鍝嶃€傜粨鏋勫氨鏄綉鏂囬偅涓€濂椻€斺€斿簞鍥噷鐨勮吹鏃忕嫍琚伔鍗栥€佹尐鎵撱€佸鎷夐洩姗囥€佹墦璧㈤澶寸嫍銆佹垚涓烘渶寮虹殑鐙椼€佸洖鍒拌崚閲庣О鐜嬨€?*绗?3 绔犲紑濮嬩竴璺悜涓?*锛涚 1銆? 绔犲亸鍘嬫姂锛屽繊杩囧幓銆?
{t1}
**鍗＄偣**锛氬墠涓ょ珷鏈変竴鎵圭嫍鍜岄洩姗囩殑涓撻棬璇嶏紙husky, traces, gee, haw, harness锛夛紝鍑虹幇寰堝瘑浣嗕笉褰卞搷鎯呰妭锛岀湅鍒板氨璺炽€?
## 绗簩鏈細The Wonderful Wizard of Oz锛堢 {s2}鈥搟e2} 澶╋級

浣滆€呮槸鏄庣‘鍐欑粰灏忓鐪嬬殑锛屾槸杩欎笁鏈噷鑻辨枃鏈€绠€鍗曠殑銆傛瘡绔犱竴鍗冨璇嶏紝鍍忚拷鍓э紝涓嶉渶瑕佹剰蹇楀姏锛屾濂藉綋绗竴鏈瀹岀殑缂撳啿銆傚畠涓嶆槸閫嗚鐖芥枃锛岀埥鐐瑰湪浜庛€屽張閬囧埌涓€涓鎬殑瑙掕壊銆佸張杩囦簡涓€鍏炽€嶃€?
{t2}
## 绗笁鏈細The Thirty-Nine Steps锛堢 {s3}鈥搟e3} 澶╋級

涓夋湰閲屾渶鎺ヨ繎鐖芥枃鐨勪竴鏈細涓昏鍦ㄨ嚜瀹舵矙鍙戜笂鍙戠幇涓€鍏峰案浣擄紝鐒跺悗琚粦鐧戒袱閬撳悓鏃惰拷鏉€锛屽崄绔犲叏鍦ㄩ€冿紝姣忕珷缁撳熬閮芥妸浠栭€艰繘姝昏矾銆傚彞瀛愪笉绠楅毦锛岄夯鐑︾殑鏄嫃鏍煎叞鏂硅█鍜?1915 骞寸殑鏀挎不鑳屾櫙鈥斺€斿惉涓嶆噦涔熺収鏍疯兘璺熶笂锛屼富绾垮氨鏄窇鍜岃翰銆?
{t3}
## 鍗′綇浜嗘€庝箞鍔?
- **涓€鏁撮〉娌＄湅鎳?*锛氬埆鍥炲ご銆傝烦鍒颁笅涓€涓嚜鐒舵锛屼竴绔犵殑鍏垚淇℃伅闈犲璇濆拰鍔ㄤ綔灏辫兘鎷垮埌銆?- **鍚屼竴涓瘝鍙嶅鎸¤矾**锛氱偣涓€涓嬫煡锛岃鍦ㄦ墜鏈哄蹇樺綍閲岋紝涓€绔犵粨鏉熷啀鐪嬩竴鐪笺€?- **鏌愬ぉ娌℃椂闂?*锛氬畞鍙皯璇讳竴绔狅紝涔熷埆璺宠繃鏁存湰涔︺€傛柇浜嗕笁澶╀互涓婏紝灏变粠涓婃璇诲埌鐨勭珷鑺傜殑寮€澶撮噸璇讳竴绔狅紝鎵炬墜鎰熴€?- **瀹炲湪璇讳笉涓嬪幓**锛氭崲涔︿笉涓汉銆傝兘璇诲畬涓€鏈?3 涓囪瘝鐨勮嫳鏂囦功锛屽凡缁忚秴杩囩粷澶у鏁拌儗瀹屽洓绾ц瘝姹囩殑浜恒€?
## 璇诲畬杩欎笁鏈箣鍚?
椤虹潃鍚屼竴鏉＄嚎寰€涓嬶細**The Return of Tarzan**锛堟嘲灞辩画闆嗭級銆?*The Warlord of Mars**锛堢伀鏄熺郴鍒楃涓夋湰锛夈€?*Scaramouche**锛堝悓涓€涓綔鑰呯殑澶嶄粐鐖芥枃锛屽墤鏈?+ 韬唤鍙嶈浆锛夈€傞兘涓嶉暱锛屼篃閮藉湪鍏湁棰嗗煙銆?""".format(
    days=total_days,
    c1=len(call), w1=format(wc(call), ","), d1=len(r1),
    c2=len(oz), w2=format(wc(oz), ","), wp=format(int(round(wc(oz) / float(N_OZ) / 50) * 50), ","), d2=len(r2),
    c3=len(steps), w3=format(wc(steps), ","), d3=len(r3),
    ct=len(call) + len(oz) + len(steps), wt=format(wc(call) + wc(oz) + wc(steps), ","), dt=total_days,
    t1=table(r1), s2=r2[0][0], e2=r2[-1][0], t2=table(r2),
    s3=r3[0][0], e3=r3[-1][0], t3=table(r3))

io.open(os.path.join(ROOT, "plan", "25澶╅槄璇昏鍒?md"), "w", encoding="utf-8", newline="\n").write(md)

# ---- 鍚屾椂缁欓槄璇诲櫒 App 鐢熸垚缁撴瀯鍖栨暟鎹?----
import json

plan = {
    "days": total_days,
    "total_words": wc(call) + wc(oz) + wc(steps),
    "books": [
        {"name": "The Call of the Wild", "sub": "绗?1鈥?d 澶?路 7 绔?路 %s 璇? % (len(r1), format(wc(call), ",")),
         "intro": "鏉板厠路浼︽暒鍐欑嫍涓嶅啓蹇冪悊锛氬挰銆佽窇銆佹墦銆佺潯銆傜 3 绔犲紑濮嬩竴璺悜涓婏紝鍓嶄袱绔犲亸鍘嬫姂锛屽繊杩囧幓銆?,
         "rows": [[d, what, w, mins(w)] for d, what, w in r1]},
        {"name": "The Wonderful Wizard of Oz", "sub": "绗?%d鈥?d 澶?路 24 绔?路 %s 璇? % (r2[0][0], r2[-1][0], format(wc(oz), ",")),
         "intro": "鑻辨枃鏈€绠€鍗曠殑涓€鏈紝姣忕珷涓€鍗冨璇嶏紝鍍忚拷鍓э紝涓嶉渶瑕佹剰蹇楀姏锛屽綋绗竴鏈瀹岀殑缂撳啿銆?,
         "rows": [[d, what, w, mins(w)] for d, what, w in r2]},
        {"name": "The Thirty-Nine Steps", "sub": "绗?%d鈥?d 澶?路 10 绔?路 %s 璇? % (r3[0][0], r3[-1][0], format(wc(steps), ",")),
         "intro": "鏈€鎺ヨ繎鐖芥枃鐨勪竴鏈細琚粦鐧戒袱閬撳悓鏃惰拷鏉€锛屽崄绔犲叏鍦ㄩ€冿紝姣忕珷缁撳熬閮芥妸浠栭€艰繘姝昏矾銆?,
         "rows": [[d, what, w, mins(w)] for d, what, w in r3]},
    ],
    "rules": [
        "**涓€绔犱竴鍙ｆ皵璇诲畬锛屼腑閫斾笉鏌ヨ瘝銆?* 璇绘噦涓冩垚灏辩畻杩囷紝鍓╀笅鐨勯潬涓婁笅鏂囪ˉ銆?,
        "**鍙煡涓ょ璇?*锛氬悓涓€椤靛嚭鐜颁袱閬嶄互涓婄殑锛涗笉鏌ュ氨璇讳笉鎳傝繖鍙ヨ瘽鐨勩€傜偣涓€涓嬭瘝灏卞嚭涓枃銆?,
        "**璇诲畬涓€绔犲厛鍚堜笂锛屽洖鎯炽€岃繖涓€绔犲彂鐢熶簡浠€涔堛€?*锛屾兂涓嶈捣鏉ュ啀鍥炲ご鎵竴鐪笺€傝姳 30 绉掞紝姣斿璇讳竴绔犳湁鐢ㄣ€?,
    ],
    "tips": [
        "**涓€鏁撮〉娌＄湅鎳?*锛氬埆鍥炲ご锛岃烦鍒颁笅涓€涓嚜鐒舵銆備竴绔犵殑鍏垚淇℃伅闈犲璇濆拰鍔ㄤ綔灏辫兘鎷垮埌銆?,
        "**鍚屼竴涓瘝鍙嶅鎸¤矾**锛氱偣涓€涓嬫煡锛岃鍦ㄦ墜鏈哄蹇樺綍锛屼竴绔犵粨鏉熷啀鐪嬩竴鐪笺€?,
        "**鏌愬ぉ娌℃椂闂?*锛氬畞鍙皯璇讳竴绔狅紝涔熷埆璺宠繃鏁存湰涔︺€傛柇浜嗕笁澶╀互涓婏紝浠庝笂娆￠偅绔犵殑寮€澶撮噸璇讳竴绔犮€?,
        "**瀹炲湪璇讳笉涓嬪幓**锛氭崲涔︿笉涓汉銆傝瀹屼竴鏈?3 涓囪瘝鐨勮嫳鏂囦功锛屽凡缁忚秴杩囩粷澶у鏁拌儗瀹屽洓绾ц瘝姹囩殑浜恒€?,
    ],
}
app_dir = os.path.join(BASE, "app")
if os.path.isdir(app_dir):
    io.open(os.path.join(app_dir, "plan.json"), "w", encoding="utf-8", newline="\n").write(
        json.dumps(plan, ensure_ascii=False, separators=(",", ":")))
    print("wrote", os.path.join(app_dir, "plan.json"))

print("days:", total_days, "| call", len(r1), "oz", len(r2), "steps", len(r3))
