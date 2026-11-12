/* Mars Reader — 书架 / 阅读器 / 词典 */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var WPM = 90;
  var DATA = JSON.parse($('#data').textContent);
  var BUILTIN = DATA.books;
  var DICT_RAW = ($('#dictdata') && $('#dictdata').textContent) || '';
  var PLAN = (function () {
    try { return JSON.parse($('#plandata').textContent); } catch (e) { return null; }
  })();

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function words(t) { return (t.match(/[A-Za-z][A-Za-z'\-]*/g) || []).length; }
  var toastT;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  /* ---------- storage ---------- */
  function openDB() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('marsreader', 1);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  var DB;
  function idb(mode, fn) {
    return openDB().then(function (db) {
      DB = db;
      return new Promise(function (res, rej) {
        var tx = db.transaction('books', mode), st = tx.objectStore('books');
        var rq = fn(st);
        tx.oncomplete = function () { res(rq && rq.result !== undefined ? rq.result : undefined); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function idbAll() { return idb('readonly', function (s) { return s.getAll(); }); }
  function idbGet(id) { return idb('readonly', function (s) { return s.get(id); }); }
  function idbPut(b) { return idb('readwrite', function (s) { return s.put(b); }); }
  function idbDel(id) { return idb('readwrite', function (s) { return s.delete(id); }); }

  function getPos(id) { try { return JSON.parse(localStorage.getItem('pos:' + id) || 'null'); } catch (e) { return null; } }
  function setPos(id, ch, y) { localStorage.setItem('pos:' + id, JSON.stringify({ ch: ch, y: Math.round(y || 0), t: Date.now() })); }

  /* ---------- theme / font ---------- */
  var THEMES = ['light', 'dark'], FSS = [17.5, 19, 20.5, 22, 23.5];
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    $('#themeBtn').textContent = t === 'dark' ? '◑' : '◐';
  }
  function applyFs(v) { document.documentElement.style.setProperty('--fs', v + 'px'); localStorage.setItem('fs', v); }
  function initPrefs() {
    var t = localStorage.getItem('theme');
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(t);
    var fsv = parseFloat(localStorage.getItem('fs'));
    if (fsv) applyFs(fsv);
  }

  /* ---------- dictionary ---------- */
  var DICT = null, DICT_N = 0;
  function dictInit() {
    if (DICT) return DICT;
    DICT = Object.create(null);
    if (!DICT_RAW) return DICT;
    var lines = DICT_RAW.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!l) continue;
      var a = l.indexOf('\t');
      if (a < 0) continue;
      var w = l.slice(0, a), rest = l.slice(a + 1);
      var b = rest.indexOf('\t');
      var ph = b < 0 ? '' : rest.slice(0, b);
      var cn = b < 0 ? rest : rest.slice(b + 1);
      DICT[w] = { ph: ph, cn: cn };
      DICT_N++;
    }
    return DICT;
  }
  function lemma(w) {
    var o = [w], add = function (s) { if (s && s.length > 1 && o.indexOf(s) < 0) o.push(s); };
    if (w.length > 3) {
      if (/ies$/.test(w)) add(w.slice(0, -3) + 'y');
      if (/ied$/.test(w)) add(w.slice(0, -3) + 'y');
      if (/es$/.test(w)) add(w.slice(0, -2));
      if (/s$/.test(w)) add(w.slice(0, -1));
      if (/ing$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e');
        var d = w.slice(0, -3); if (d.length > 2 && d[d.length - 1] === d[d.length - 2]) add(d.slice(0, -1)); }
      if (/ed$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1));
        var e = w.slice(0, -2); if (e.length > 2 && e[e.length - 1] === e[e.length - 2]) add(e.slice(0, -1)); }
      if (/ly$/.test(w)) add(w.slice(0, -2));
      if (/est$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -2)); }
      if (/er$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
    }
    /* 英式拼写 → 美式（词库以美式为主） */
    var sp = [];
    if (/our$/.test(w)) sp.push(w.slice(0, -3) + 'or');
    if (/ise$/.test(w)) sp.push(w.slice(0, -3) + 'ize');
    if (/isation$/.test(w)) sp.push(w.slice(0, -7) + 'ization');
    if (/ll/.test(w)) sp.push(w.replace(/ll/g, 'l'));
    if (/re$/.test(w)) sp.push(w.slice(0, -2) + 'er');
    sp.forEach(function (s) {
      add(s);
      if (/s$/.test(s)) add(s.slice(0, -1));
      if (/ed$/.test(s)) add(s.slice(0, -2));
      if (/ing$/.test(s)) add(s.slice(0, -3));
    });
    return o;
  }
  function lookup(w) {
    var d = dictInit();
    var lw = w.toLowerCase(), c = lemma(lw);
    for (var i = 0; i < c.length; i++) {
      if (d[c[i]]) return { word: c[i], ph: d[c[i]].ph, cn: d[c[i]].cn, hit: c[i] !== lw };
    }
    return null;
  }
  var OCache = {};
  function online(w) {
    if (OCache[w]) return Promise.resolve(OCache[w]);
    return fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j[0]) return null;
        var e = j[0], ph = e.phonetic || '';
        var defs = [];
        (e.meanings || []).slice(0, 3).forEach(function (m) {
          (m.definitions || []).slice(0, 2).forEach(function (d) {
            if (defs.length < 3) defs.push({ pos: m.partOfSpeech, d: d.definition });
          });
        });
        var src = '';
        (e.phonetics || []).forEach(function (p) { if (p.audio && !src) src = p.audio; });
        var out = { ph: ph, src: src, defs: defs };
        OCache[w] = out;
        return out;
      }).catch(function () { return null; });
  }
  function speak(url) { try { new Audio(url).play(); } catch (e) {} }
  function recent(w) {
    var r = [];
    try { r = JSON.parse(localStorage.getItem('dxrecent') || '[]'); } catch (e) {}
    r = r.filter(function (x) { return x !== w; });
    r.unshift(w);
    localStorage.setItem('dxrecent', JSON.stringify(r.slice(0, 14)));
  }

  /* ---------- library ---------- */
  var BOOKS = [];
  function bookMeta(b) {
    var w = b.words || 0;
    return w.toLocaleString() + ' 词 · ' + b.chapters.length + ' 章';
  }
  function renderLib() {
    var g = $('#grid');
    g.innerHTML = '';
    BOOKS.forEach(function (b) {
      var p = getPos(b.id);
      var pct = p && b.chapters.length ? (p.ch / b.chapters.length) * 100 : 0;
      var el = document.createElement('div');
      el.className = 'card';
      var hue = 0;
      for (var ci = 0; ci < b.title.length; ci++) hue = (hue * 31 + b.title.charCodeAt(ci)) % 360;
      var gen = !b.cover;
      el.innerHTML =
        '<div class="art' + (gen ? ' gen" style="background:linear-gradient(155deg,hsl(' + hue + ',20%,25%),hsl(' + ((hue + 45) % 360) + ',16%,43%))' : '') + '">' +
        (b.cover ? '<img src="' + b.cover + '" alt="">'
          : '<div class="ph"><b>' + esc(b.title) + '</b><span>' + esc(b.author || '导入的书') + ' · ' + b.chapters.length + ' 章</span></div>') +
        '<div class="pg"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        (b.built ? '' : '<button class="del" title="删除">×</button>') +
        '</div>' +
        '<div class="nm">' + esc(b.title) + '</div>' +
        '<div class="mt">' + (p ? '读到这里 · ' + (p.ch + 1) + '/' + b.chapters.length : bookMeta(b)) + '</div>';
      el.querySelector('.art').addEventListener('click', function (e) {
        if (e.target.classList.contains('del')) { e.stopPropagation(); delBook(b); return; }
        openBook(b.id);
      });
      g.appendChild(el);
    });
    var add = document.createElement('div');
    add.className = 'card add';
    add.innerHTML = '<div class="art"><div><span class="plus">＋</span>导入书籍<br><span style="font-size:11px;opacity:.8">txt / epub</span></div></div><div class="nm">从本地导入</div><div class="mt">文件只存在这台电脑</div>';
    add.addEventListener('click', function () { $('#file').click(); });
    g.appendChild(add);

    if (PLAN) {
      var st = planDone(), dn = 0;
      for (var kk in st) if (st[kk]) dn++;
      var pc = document.createElement('div');
      pc.className = 'card plancard';
      pc.innerHTML = '<div class="art"><div class="ph"><b>25 天<br>读完三本</b><span>' +
        (PLAN.total_words || 0).toLocaleString() + ' 词 · 已打卡 ' + dn + '/' + PLAN.days + '</span></div>' +
        '<div class="pg"><i style="width:' + Math.round(dn * 100 / PLAN.days) + '%"></i></div></div>' +
        '<div class="nm">25 天阅读计划</div><div class="mt">Call of the Wild → Oz → 39 Steps</div>';
      pc.addEventListener('click', showPlan);
      g.appendChild(pc);
    }

    $('#libN').textContent = BOOKS.length + ' 本';
  }
  function loadLibrary() {
    return idbAll().then(function (rows) {
      BOOKS = BUILTIN.concat((rows || []).sort(function (a, b) { return (b.added || 0) - (a.added || 0); }));
      renderLib();
    }).catch(function (e) {
      console.warn(e); BOOKS = BUILTIN.slice(); renderLib();
    });
  }
  var pendingDel = null, pendingT = 0;
  function delBook(b) {
    if (pendingDel === b.id && Date.now() - pendingT < 3500) {
      pendingDel = null;
      idbDel(b.id).then(function () {
        localStorage.removeItem('pos:' + b.id);
        return loadLibrary();
      }).then(function () { toast('已移除《' + b.title + '》'); });
      return;
    }
    pendingDel = b.id; pendingT = Date.now();
    toast('再点一次 × 就会删除《' + b.title + '》');
  }

  /* ---------- reader ---------- */
  var CUR = null, CH = 0;
  function show(id) {
    ['lib', 'read', 'gloss', 'dict', 'plan'].forEach(function (k) { $('#' + k).style.display = (k === id ? 'block' : 'none'); });
  }
  function openBook(id, ch) {
    var b = null;
    for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].id === id) b = BOOKS[i];
    if (!b) return;
    if (!b.chapters) {                       // imported: chapters live in IDB
      idbGet(id).then(function (full) { if (full) { b.chapters = full.chapters; b.words = full.words; start(b, ch); } });
      return;
    }
    start(b, ch);
  }
  function start(b, ch) {
    CUR = b;
    var p = getPos(b.id);
    var first = (b.chapters[0] && !b.chapters[0].r && b.chapters.length > 1) ? 1 : 0;
    CH = ch != null ? ch : (p ? p.ch : first);
    if (CH >= b.chapters.length) CH = 0;
    buildToc();
    show('read');
    renderChapter(p && ch == null ? p.y : 0);
  }
  function buildToc() {
    var d = $('#tocList');
    d.innerHTML = '';
    CUR.chapters.forEach(function (c, i) {
      var a = document.createElement('a');
      a.href = '#';
      a.innerHTML = '<span class="num">' + esc(c.r || '·') + '</span>' + esc(c.t);
      a.addEventListener('click', function (e) {
        e.preventDefault(); closeDrawer(); renderChapter(0, i);
      });
      if (i === CH) a.className = 'cur';
      d.appendChild(a);
    });
    if (CUR.gloss && CUR.gloss.length) {
      var g = document.createElement('a');
      g.href = '#'; g.className = 'g'; g.textContent = '生词表 · ' + CUR.gloss.reduce(function (n, x) { return n + x.rows.length; }, 0) + ' 词';
      g.addEventListener('click', function (e) { e.preventDefault(); closeDrawer(); showGloss(); });
      d.appendChild(g);
    }
  }
  function renderChapter(y, idx) {
    if (idx != null) CH = idx;
    var c = CUR.chapters[CH];
    var h = '<div class="chapter">' + (c.r ? '<h2>Chapter ' + esc(c.r) + '</h2>' : '') + '<h1>' + esc(c.t) + '</h1>' +
      '<div class="sub">' + words(c.ps.join(' ')).toLocaleString() + ' 词 · 约 ' + Math.round(words(c.ps.join(' ')) / WPM) + ' 分钟</div>';
    c.ps.forEach(function (p) { h += '<p class="para">' + esc(p) + '</p>'; });
    h += '</div><div class="nav">';
    h += CH > 0 ? '<button class="btn prev" data-go="-1"><b>上一章</b>' + esc(CUR.chapters[CH - 1].t) + '</button>' : '<span></span>';
    h += CH < CUR.chapters.length - 1 ? '<button class="btn next" data-go="1"><b>下一章</b>' + esc(CUR.chapters[CH + 1].t) + '</button>' : '<span></span>';
    h += '</div>';
    $('#wrap').innerHTML = h;
    $('#barTitle').textContent = (c.r ? 'Chapter ' + c.r + ' · ' : '') + c.t;
    $('#read').scrollTop = 0;
    window.scrollTo(0, y || 0);
    Array.prototype.forEach.call(document.querySelectorAll('.nav .btn'), function (b) {
      b.addEventListener('click', function () { renderChapter(0, CH + parseInt(b.dataset.go, 10)); });
    });
    document.querySelectorAll('#tocList a').forEach(function (a, i) {
      a.classList.toggle('cur', i === CH && !a.classList.contains('g'));
    });
    savePos();
    updateProgress();
  }
  function savePos() {
    if (!CUR) return;
    setPos(CUR.id, CH, window.scrollY || document.documentElement.scrollTop);
  }
  function updateProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var p = max > 0 ? (window.scrollY / max) : 0;
    $('#progress').style.width = ((CH + p) / Math.max(1, (CUR ? CUR.chapters.length : 1)) * 100).toFixed(2) + '%';
  }

  /* ---------- drawer ---------- */
  function openDrawer() { $('#drawer').classList.add('open'); $('#scrim').classList.add('on'); }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#scrim').classList.remove('on'); }

  /* ---------- reading plan ---------- */
  function planDone() {
    try { return JSON.parse(localStorage.getItem('plan.v1') || '{}'); } catch (e) { return {}; }
  }
  function planSet(d, on) {
    var s = planDone();
    if (on) s[d] = 1; else delete s[d];
    try { localStorage.setItem('plan.v1', JSON.stringify(s)); } catch (e) {}
  }
  function bold(t) {
    return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }
  function showPlan() {
    show('plan');
    renderPlan();
    window.scrollTo(0, 0);
  }
  function renderPlan() {
    var out = $('#planOut');
    if (!PLAN) { out.innerHTML = '<p class="hint">没有找到阅读计划数据。</p>'; return; }
    var st = planDone(), done = 0, total = PLAN.days;
    for (var k in st) if (st[k]) done++;
    var pct = Math.round(done * 100 / total);
    var h = '<div class="planhd"><div class="ptop"><b>25 天 · 3 本书</b>' +
      '<span>' + (PLAN.total_words || 0).toLocaleString() + ' 词</span></div>' +
      '<div class="pbar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="pnote">已完成 <b>' + done + '</b> / ' + total + ' 天</div></div>';
    h += '<p class="hint">读一天就勾一格。勾选记在这台电脑的浏览器里，没读完可以明天补。</p>';
    PLAN.books.forEach(function (b) {
      h += '<div class="pbook"><div class="vhh">' + esc(b.name) + '</div>' +
        '<div class="psub">' + esc(b.sub) + '</div>' +
        '<p class="pintro">' + esc(b.intro) + '</p><div class="ptable">';
      b.rows.forEach(function (r) {
        var d = r[0], on = !!st[d];
        h += '<div class="prow' + (on ? ' on' : '') + '" data-d="' + d + '" role="checkbox" tabindex="0" aria-checked="' + (on ? 'true' : 'false') + '">' +
          '<span class="pd">第 ' + d + ' 天</span>' +
          '<span class="pw">' + esc(r[1]) + '</span>' +
          '<span class="pm">' + Number(r[2]).toLocaleString() + ' 词 · ' + r[3] + ' 分</span>' +
          '</div>';
      });
      h += '</div></div>';
    });
    h += '<div class="vhh" style="margin-top:30px">怎么读</div><ol class="prules">' +
      PLAN.rules.map(function (x) { return '<li>' + bold(x) + '</li>'; }).join('') + '</ol>';
    if (PLAN.tips && PLAN.tips.length) {
      h += '<div class="vhh" style="margin-top:28px">卡住了怎么办</div><ul class="prules tips">' +
        PLAN.tips.map(function (x) { return '<li>' + bold(x) + '</li>'; }).join('') + '</ul>';
    }
    out.innerHTML = h;
    function tick(row) {
      var on = !row.classList.contains('on');
      row.classList.toggle('on', on);
      row.setAttribute('aria-checked', on ? 'true' : 'false');
      planSet(row.getAttribute('data-d'), on);
      var s = planDone(), n = 0;
      for (var k in s) if (s[k]) n++;
      var bar = out.querySelector('.pbar i'), note = out.querySelector('.pnote b');
      if (bar) bar.style.width = Math.round(n * 100 / total) + '%';
      if (note) note.textContent = n;
    }
    Array.prototype.forEach.call(out.querySelectorAll('.prow'), function (row) {
      row.addEventListener('click', function () { tick(row); });
      row.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tick(row); }
      });
    });
  }

  /* ---------- glossary ---------- */
  function showGloss() {
    if (!CUR || !CUR.gloss) return;
    show('gloss');
    $('#glossTitle').textContent = CUR.title + ' · 生词表';
    renderGloss($('#gq').value || '');
  }
  function renderGloss(q) {
    q = (q || '').trim().toLowerCase();
    var out = '', n = 0;
    CUR.gloss.forEach(function (sec) {
      var rows = sec.rows.filter(function (r) {
        return !q || r[0].toLowerCase().indexOf(q) >= 0 || r[2].indexOf(q) >= 0;
      });
      if (!rows.length) return;
      n += rows.length;
      out += '<div class="gh">' + esc(sec.c) + '</div>';
      rows.forEach(function (r) {
        out += '<div class="gi"><span class="h">' + esc(r[0]) + '</span><span class="p">' + esc(r[1]) + '</span> ' + esc(r[2]) +
          (r[3] ? '<span class="e">' + esc(r[3]) + '</span>' : '') + '</div>';
      });
    });
    $('#glossOut').innerHTML = out || '<p class="hint">没有找到这个词。</p>';
  }

  /* ---------- dictionary view ---------- */
  function showDict() { show('dict'); renderDict($('#dq').value || ''); $('#dq').focus(); }
  function cnHTML(e) {
    return '<div class="cn">' + e.cn.split('\n').map(function (l) {
      return '<div class="pos">' + esc(l) + '</div>';
    }).join('') + '</div>';
  }
  function enHTML(o) {
    if (!o || !o.defs || !o.defs.length) return '';
    var h = '<div class="en">';
    o.defs.forEach(function (d) {
      h += '<div class="pos"><i>' + esc(d.pos || '') + '</i>' + esc(d.d) + '</div>';
    });
    h += '</div>';
    if (o.src) h += '<button class="btn spk" data-src="' + esc(o.src) + '" style="margin-top:10px;font-size:12px;padding:6px 12px">▶ 听发音</button>';
    return h;
  }
  function cardHTML(w, off, on) {
    var ph = (on && on.ph) || (off && off.ph) || '';
    var h = '<div class="entry"><span class="w">' + esc(w) + '</span>' + (ph ? '<span class="ph">' + esc(ph) + '</span>' : '');
    if (off) h += cnHTML(off) + (off.hit ? '<div class="en"><b>原形</b> ' + esc(off.word) + '</div>' : '');
    h += enHTML(on);
    if (!off && !on) h += '<div class="hint">没有查到这个词。去掉 -s / -ed / -ing 再试，或检查拼写。</div>';
    h += '</div>';
    return h;
  }
  function bindSpk(root, on) {
    Array.prototype.forEach.call(root.querySelectorAll('.spk'), function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); speak(b.dataset.src || (on && on.src)); });
    });
  }
  function renderDict(q) {
    var out = $('#dictOut');
    q = (q || '').trim();
    var rec = [];
    try { rec = JSON.parse(localStorage.getItem('dxrecent') || '[]'); } catch (e) { }
    if (!q) {
      dictInit();
      var h = '<p class="hint">输入英文单词查释义。离线词库 ' + DICT_N.toLocaleString() + ' 条，未收录的会自动联网查英英释义。<br>读书时直接点正文里的单词也能查。</p>';
      if (rec.length) {
        h += '<div class="vh">最近查过</div>';
        rec.forEach(function (w) { h += '<button class="rec" data-w="' + esc(w) + '">' + esc(w) + '</button>'; });
      }
      out.innerHTML = h;
      bindRec();
      return;
    }
    var off = lookup(q);
    out.innerHTML = cardHTML(q, off, null);
    recent(q.toLowerCase());
    online(q.toLowerCase()).then(function (on) {
      if (!on) return;
      out.innerHTML = cardHTML(q, off, on);
      bindSpk(out, on);
    });
  }
  function bindRec() {
    document.querySelectorAll('#dictOut .rec').forEach(function (b) {
      b.addEventListener('click', function () { $('#dq').value = b.dataset.w; renderDict(b.dataset.w); });
    });
  }

  /* ---------- word popover ---------- */
  function caretWord(x, y) {
    var r = null;
    if (document.caretPositionFromPoint) {
      var p = document.caretPositionFromPoint(x, y);
      if (p && p.offsetNode && p.offsetNode.nodeType === 3) r = { node: p.offsetNode, off: p.offset };
    } else if (document.caretRangeFromPoint) {
      var q = document.caretRangeFromPoint(x, y);
      if (q && q.startContainer.nodeType === 3) r = { node: q.startContainer, off: q.startOffset };
    }
    if (!r) return null;
    var t = r.node.nodeValue, i = r.off, s = i, e = i;
    while (s > 0 && /[A-Za-z'\-]/.test(t[s - 1])) s--;
    while (e < t.length && /[A-Za-z'\-]/.test(t[e])) e++;
    var w = t.slice(s, e).replace(/^[-']+|[-']+$/g, '');
    if (!w || w.length < 2) return null;
    var rg = document.createRange();
    rg.setStart(r.node, s); rg.setEnd(r.node, s + w.length);
    return { w: w, rect: rg.getBoundingClientRect() };
  }
  function placePop(rc) {
    var pop = $('#pop'), pr = pop.getBoundingClientRect();
    var top = rc.top - pr.height - 9;
    if (top < 64) top = rc.bottom + 9;
    var left = rc.left + rc.width / 2 - pr.width / 2;
    left = Math.max(10, Math.min(left, innerWidth - pr.width - 10));
    pop.style.top = top + 'px'; pop.style.left = left + 'px';
  }
  function popHTML(w, off, on) {
    var ph = (on && on.ph) || (off && off.ph) || '';
    var h = '<div class="hw">' + esc(w) + (ph ? '<span class="ph">' + esc(ph) + '</span>' : '') + '</div>';
    if (off) h += '<div class="cn">' + esc(off.cn) + '</div>';
    if (on && on.defs && on.defs.length) {
      h += '<div class="en">';
      on.defs.slice(0, 2).forEach(function (d) {
        h += '<div><b>' + esc(d.pos || '') + '</b> ' + esc(d.d) + '</div>';
      });
      h += '</div>';
      if (on.src) h += '<div style="margin-top:6px"><button class="spk" data-src="' + esc(on.src) + '">▶ 听发音</button></div>';
    }
    if (!off && !on) h += '<div class="ld">词库里没有收录这个词。</div>';
    return h;
  }
  function showPop(hit) {
    var pop = $('#pop'), w = hit.w, off = lookup(w), on = null, done = false;
    pop.style.display = 'block';
    pop.innerHTML = off ? popHTML(w, off, null) : '<div class="hw">' + esc(w) + '</div><div class="ld">查询中…</div>';
    placePop(hit.rect);
    bindSpk(pop, null);
    recent(w.toLowerCase());
    online(w.toLowerCase()).then(function (o) {
      if (done || pop.style.display === 'none' || !o) return;
      pop.innerHTML = popHTML(w, off, o);
      placePop(hit.rect);
      bindSpk(pop, o);
    });
    window.__popDone = function () { done = true; };
  }
  function hidePop() { if (window.__popDone) window.__popDone(); $('#pop').style.display = 'none'; }

/* ---------- import ---------- */
  function decode(buf) {
    var t = new TextDecoder('utf-8').decode(buf);
    var bad = (t.match(/\uFFFD/g) || []).length;
    if (bad > Math.max(3, t.length * 0.002)) {
      try {
        var g = new TextDecoder('gbk').decode(buf);
        if ((g.match(/\uFFFD/g) || []).length < bad) t = g;
      } catch (e) {}
    }
    return t;
  }
  function splitTxt(text, name) {
    text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    var raw = text.split('\n');
    var ne = 0, endP = 0;
    raw.forEach(function (l) {
      var t = l.trim();
      if (!t) return;
      ne++;
      if (/[.!?:"'”’)\]]$/.test(t)) endP++;
    });
    var blockMode = ne > 0 && (endP / ne) < 0.6;         // 折行段落 还是 一行一段
    var paras = [], buf = '';
    raw.forEach(function (line) {
      var t = line.trim();
      if (!t) { if (buf) { paras.push(buf); buf = ''; } return; }
      if (!buf) { buf = t; return; }
      if (blockMode) { buf += ' ' + t; return; }
      // 一行一段：若上一行没收尾且下一行小写开头，说明是折行，接上
      if (!/[.!?:"'\u201d\u2019)\]]$/.test(buf) && /^[a-z,;)]/.test(t)) { buf += ' ' + t; }
      else { paras.push(buf); buf = t; }
    });
    if (buf) paras.push(buf);

    var RE_EN = /^\s*(?:chapter|part|book|section)\s+(?:\d{1,3}|[ivxlcdm]{1,8})\b/i;
    var RE_CN = /^\s*第\s*[0-9一二三四五六七八九十百千零〇]+\s*[章回节卷部篇]/;
    var idx = [];
    paras.forEach(function (p, i) {
      if (p.length <= 90 && (RE_EN.test(p) || RE_CN.test(p))) idx.push(i);
    });
    var chapters = [];
    if (idx.length >= 3) {
      for (var k = 0; k < idx.length; k++) {
        var a = idx[k], b = k + 1 < idx.length ? idx[k + 1] : paras.length;
        var ps = paras.slice(a + 1, b);
        if (ps.length) {
          var ht = paras[a].replace(/\s+/g, ' ').trim();
          var clean = ht.replace(/^(?:chapter|part|book|section)\s+(?:\d{1,3}|[ivxlcdm]{1,8})/i, '')
                        .replace(/^[\s·•.,:;—–-]+/, '').trim();
          chapters.push({ r: String(k + 1), t: (clean || ht).slice(0, 80), ps: ps });
        }
      }
      // 第一章标题之前若有前言，单独成节
      if (idx[0] > 0) chapters.unshift({ r: '', t: '前言', ps: paras.slice(0, idx[0]) });
    }
    if (!chapters.length) {
      var chunk = [], n = 0, cn = 0;
      paras.forEach(function (p) {
        chunk.push(p); n += words(p);
        if (n > 2600) { chapters.push({ r: String(++cn), t: '第 ' + cn + ' 节', ps: chunk }); chunk = []; n = 0; }
      });
      if (chunk.length) chapters.push({ r: String(++cn), t: '第 ' + cn + ' 节', ps: chunk });
    }
    return {
      id: 'imp-' + Date.now().toString(36),
      title: name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || '未命名',
      author: '', built: false, added: Date.now(),
      chapters: chapters,
      words: chapters.reduce(function (s, c) { return s + words(c.ps.join(' ')); }, 0)
    };
  }
  /* --- epub --- */
  function unzip(buf) {
    var dv = new DataView(buf), u8 = new Uint8Array(buf);
    var eocd = -1;
    for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 zip/epub 文件');
    var n = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
    var files = {}, p = cdOff;
    for (var k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      var nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      var lho = dv.getUint32(p + 42, true);
      var nm = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      files[nm] = { method: method, csize: csize, lho: lho };
      p += 46 + nlen + elen + clen;
    }
    function get(name) {
      var f = files[name];
      if (!f) return Promise.resolve(null);
      var lp = f.lho, ln = dv.getUint16(lp + 26, true), le = dv.getUint16(lp + 28, true);
      var start = lp + 30 + ln + le, data = u8.subarray(start, start + f.csize);
      if (f.method === 0) return Promise.resolve(data);
      var st = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(st).arrayBuffer().then(function (b) { return new Uint8Array(b); });
    }
    function text(name) { return get(name).then(function (b) { return b ? new TextDecoder('utf-8').decode(b) : null; }); }
    return { get: get, text: text, names: Object.keys(files) };
  }
  function xmlDoc(s) { return new DOMParser().parseFromString(s, 'application/xml'); }
  function htmlParas(doc) {
    var out = [];
    function walk(node) {
      for (var ch = node.firstElementChild; ch; ch = ch.nextElementSibling) {
        var tag = ch.tagName.toLowerCase();
        if (/^(p|h1|h2|h3|h4|h5|h6|li|blockquote|pre|dd|dt|td)$/.test(tag)) {
          var t = (ch.textContent || '').replace(/\s+/g, ' ').trim();
          if (t) out.push(t);
        } else if (/^(div|section|article|main|header|body|aside|figure|table|tr|tbody|thead|ul|ol|dl)$/.test(tag)) {
          walk(ch);
        } else {
          var t2 = (ch.textContent || '').replace(/\s+/g, ' ').trim();
          if (t2 && t2.length > 1) out.push(t2);
        }
      }
    }
    walk(doc.body || doc.documentElement);
    return out;
  }
  function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); }
  function parseEpub(buf, fname) {
    var z = unzip(buf);
    return z.text('META-INF/container.xml').then(function (c) {
      if (!c) throw new Error('缺少 META-INF/container.xml');
      var opfPath = null;
      var m = c.match(/full-path\s*=\s*"([^"]+)"/i) || c.match(/full-path\s*=\s*'([^']+)'/i);
      if (m) opfPath = m[1];
      if (!opfPath) {
        opfPath = z.names.filter(function (n) { return /\.opf$/i.test(n); })[0];
      }
      return z.text(opfPath).then(function (opf) {
        if (!opf) throw new Error('读不到 OPF');
        var base = dirOf(opfPath);
        var d = xmlDoc(opf);
        var title = '', author = '';
        var tEl = d.querySelector('metadata > title') || d.getElementsByTagName('dc:title')[0];
        if (tEl) title = tEl.textContent.trim();
        var aEl = d.getElementsByTagName('dc:creator')[0];
        if (aEl) author = aEl.textContent.trim();
        var man = {};
        Array.prototype.forEach.call(d.getElementsByTagName('item'), function (it) {
          man[it.getAttribute('id')] = { href: it.getAttribute('href'), type: it.getAttribute('media-type') || '' };
        });
        var ids = [];
        Array.prototype.forEach.call(d.getElementsByTagName('itemref'), function (ir) { ids.push(ir.getAttribute('idref')); });
        var jobs = ids.map(function (id) {
          var it = man[id];
          if (!it || !/html/i.test(it.type)) return Promise.resolve(null);
          var href = decodeURIComponent(it.href);
          return z.text(base + href).then(function (h) {
            if (!h) return null;
            var doc = new DOMParser().parseFromString(h, 'text/html');
            var ps = htmlParas(doc);
            if (!ps.length) return null;
            var txt = ps.join(' ');
            if (txt.length < 40) return null;
            var hd = doc.querySelector('h1, h2, h3, title');
            var t = hd ? hd.textContent.replace(/\s+/g, ' ').trim() : '';
            if (t.length > 80) t = t.slice(0, 80);
            if (/^(contents|table of contents|目录|cover|copyright|title ?page)$/i.test(t)) return null;
            var avg = txt.length / ps.length;
            if (ps.length > 6 && avg < 26) return null;          // 目录页/图片页
            return { t: t, ps: ps };
          });
        });
        return Promise.all(jobs).then(function (list) {
          var chapters = [];
          list.forEach(function (c, i) {
            if (!c) return;
            chapters.push({ r: String(chapters.length + 1), t: c.t || ('第 ' + (chapters.length + 1) + ' 章'), ps: c.ps });
          });
          if (!chapters.length) throw new Error('这本书里没有可读的正文');
          return {
            id: 'imp-' + Date.now().toString(36),
            title: title || fname.replace(/\.epub$/i, ''),
            author: author, built: false, added: Date.now(), chapters: chapters,
            words: chapters.reduce(function (s, c) { return s + words(c.ps.join(' ')); }, 0)
          };
        });
      });
    });
  }
  function importFile(file) {
    if (!file) return;
    var isEpub = /\.epub$/i.test(file.name);
    toast('正在解析 ' + file.name + ' …');
    file.arrayBuffer().then(function (buf) {
      if (!isEpub) {
        var dv = new DataView(buf);
        if (buf.byteLength > 4 && dv.getUint32(0, true) === 0x04034b50) isEpub = true;
      }
      return isEpub ? parseEpub(buf, file.name) : splitTxt(decode(buf), file.name);
    }).then(function (book) {
      if (!book) return;
      book.chapters.forEach(function (c) { c.ps = c.ps.filter(function (p) { return p.trim().length > 1; }); });
      return idbPut(book).then(function () {
        toast('已导入《' + book.title + '》· ' + book.chapters.length + ' 章');
        return loadLibrary().then(function () { openBook(book.id); });
      });
    }).catch(function (e) {
      console.error(e);
      toast('导入失败：' + (e && e.message ? e.message : e));
    });
  }

  window.__mr = { parseEpub: parseEpub, unzip: unzip, splitTxt: splitTxt, lookup: lookup, dict: function () { return dictInit(); } };

  /* ---------- wiring ---------- */
  function bind() {
    $('#mBtn').addEventListener('click', openDrawer);
    $('#closeBtn').addEventListener('click', closeDrawer);
    $('#scrim').addEventListener('click', closeDrawer);
    $('#homeBtn').addEventListener('click', function () { savePos(); show('lib'); renderLib(); $('#barTitle').textContent = ''; window.scrollTo(0,0); });
    $('#fsBtn').addEventListener('click', function () {
      var cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs'));
      var i = FSS.indexOf(cur); i = (i + 1) % FSS.length; applyFs(FSS[i]);
      toast('字号 ' + FSS[i] + 'px');
    });
    $('#themeBtn').addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
    $('#dictBtn').addEventListener('click', showDict);
    $('#planBtn').addEventListener('click', showPlan);
    $('#gq').addEventListener('input', function (e) { renderGloss(e.target.value); });
    $('#dq').addEventListener('input', function (e) {
      clearTimeout(window.__dt); var v = e.target.value;
      window.__dt = setTimeout(function () { renderDict(v); }, 260);
    });
    $('#file').addEventListener('change', function (e) { importFile(e.target.files[0]); e.target.value = ''; });

    $('#wrap').addEventListener('click', function (e) {
      var hit = caretWord(e.clientX, e.clientY);
      if (!hit) { hidePop(); return; }
      e.preventDefault(); showPop(hit);
    });
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && (t.closest('#pop') || t.closest('#wrap'))) return;
      hidePop();
    });
    window.addEventListener('scroll', function () { updateProgress(); savePos(); hidePop(); }, { passive: true });
    window.addEventListener('beforeunload', savePos);
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      var open = $('#read').style.display !== 'none';
      if (e.key === 'Escape') { closeDrawer(); hidePop(); }
      else if (!open) return;
      else if (e.key === 'ArrowRight') { if (CH < CUR.chapters.length - 1) renderChapter(0, CH + 1); }
      else if (e.key === 'ArrowLeft') { if (CH > 0) renderChapter(0, CH - 1); }
      else if (e.key === 't' || e.key === 'T') { openDrawer(); }
    });
    // drag & drop import
    ['dragenter', 'dragover'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { e.preventDefault(); $('#lib').classList.add('drop'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { e.preventDefault(); if (ev === 'drop' || e.target === document.documentElement) $('#lib').classList.remove('drop'); });
    });
    document.addEventListener('drop', function (e) {
      e.preventDefault(); $('#lib').classList.remove('drop');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) importFile(f);
    });
  }

  /* ---------- boot ---------- */
  initPrefs();
  bind();
  /* 先把内置书架上屏：IndexedDB 慢、被禁用或浏览器隐私模式下也能立刻看到书 */
  BOOKS = BUILTIN.slice();
  show('lib');
  renderLib();
  loadLibrary().then(function () {
    show('lib');
    dictInit();
    $('#libN').textContent = BOOKS.length + ' 本';
  }).catch(function (e) {
    console.warn('indexedDB unavailable', e);
  });
})();
