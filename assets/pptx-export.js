/* 교재 → 강의 슬라이드(PPTX) 파이프라인
   - 교재 본문(main[data-editable])을 읽어 슬라이드 모델로 바꾸고 PptxGenJS로 .pptx를 만든다.
   - 디자인: 「허위정보·가짜뉴스와 미디어 리터러시」 강의 슬라이드(16:9, 종이 질감 바탕,
     세리프 제목, 연회색 상자, 얇은 테두리 카드·표, 일러스트 분할 화면)를 따른다.
   - 문체: 본문의 서술체(~다/~습니다)를 개조식(~임/~함)으로 바꾼다. 인용문(“…”)은 그대로 둔다.
   - 해설(details)은 발표자 노트로 들어간다. 교수자판(#teacher)에서 만들면 빈칸에 정답이 들어간다.
   - 일러스트: 교재 HTML에 data-pptx-cover / data-pptx-image="이미지 경로"를 붙이면 그 자리에 분할 화면을 만든다.
   사용: 교재 화면의 PPT 버튼 (assets/textbook.js가 이 파일과 vendor/pptxgen.bundle.js를 불러온다). */
(function () {
  "use strict";

  // ── 디자인 토큰 ─────────────────────────────
  var W = 13.333, H = 7.5, ML = 0.73, CW = W - ML * 2, TOP = 2.0, BOTTOM = 7.0;
  var C = { ink: "2B2B2B", text: "333333", muted: "6F6F6A", line: "CFCFCA", box: "E7E7E2", card: "FFFFFF", link: "7A5C2E", rule: "BDBDB7" };
  var F = { head: "Gelasio", body: "Lato", ko: "Noto Sans KR" };
  var PT = { title: 30, sub: 24, cardTitle: 13.5, body: 11.5, small: 10, tiny: 8.5 };

  var SCRIPT = document.currentScript && document.currentScript.src;
  var BASE = SCRIPT ? SCRIPT.replace(/[^/]*$/, "") : "../assets/";

  // ── 문체: 서술체 → 개조식 ─────────────────────
  var H0 = 0xac00;
  function dec(ch) { var k = ch.charCodeAt(0) - H0; if (k < 0 || k > 11171) return null; return { c: Math.floor(k / 588), v: Math.floor((k % 588) / 28), j: k % 28 }; }
  function comp(d) { return String.fromCharCode(H0 + d.c * 588 + d.v * 28 + d.j); }
  function withJong(ch, j) { var d = dec(ch); d.j = j; return comp(d); }
  var B_IRR = "렵쉽깝겁텁럽롭답갑덥춥밉곱".split("");
  var V_STEM = "르니크쁘프트뜨끄쓰치키리기시지하되보오주두추피비미".split("");

  function endWord(stem, x) { // stem: 앞부분, x: '다' 바로 앞 글자
    var d = dec(x); if (!d) return null;
    if (x === "이") return stem + "임";
    if (x === "는") { return stem + "음"; }
    if (d.j === 20) return stem + x + "음";                    // 했다 → 했음
    if (d.j === 4) return stem + withJong(x, 16);              // 한다 → 함
    if (d.j === 8) return stem + withJong(x, 10);              // 만들다 → 만듦
    if (d.j === 17) {
      if (B_IRR.indexOf(x) > -1) return stem + withJong(x, 0) + "움"; // 어렵다 → 어려움
      return stem + x + "음";
    }
    if (d.j === 0) return V_STEM.indexOf(x) > -1 ? stem + withJong(x, 16) : stem + x + "임";
    return stem + x + "음";                                    // 많다 → 많음
  }
  function eumOne(s) {
    var m;
    if ((m = s.match(/^([\s\S]*?[가-힣])(\s*\([^()]*\))([.!]?)\s*$/))) { var core = eumOne(m[1] + "."); if (core !== m[1] + ".") return core.replace(/\.$/, "") + m[2] + m[3]; return s; }
    if (/[”"’']\s*$/.test(s) || /\?\s*$/.test(s)) return s;
    if ((m = s.match(/^([\s\S]*?)([가-힣])습니다([.!]?)\s*$/))) return m[1] + m[2] + "음" + m[3]; // 했습니다 → 했음
    if ((m = s.match(/^([\s\S]*?)([가-힣])니다([.!]?)\s*$/))) { var d = dec(m[2]); if (d && d.j === 17) return m[1] + withJong(m[2], 16) + m[3]; } // 합니다 → 함
    if ((m = s.match(/^([\s\S]*?)([가-힣])다([.!]?)\s*$/))) { var r = endWord(m[1], m[2]); if (r) return r + m[3]; }
    return s;
  }
  function eum(text) {
    if (!text) return text;
    return text.split(/(?<=[.!?])\s+/).map(eumOne).join(" ");
  }

  // ── 글자 높이 추정 ─────────────────────────
  function textW(s, pt) { var w = 0; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); w += (c > 0x2e80 ? 0.92 : c === 32 ? 0.28 : 0.55); } return w * pt / 72; }
  function lines(s, wIn, pt) {
    var n = 0; String(s || "").split("\n").forEach(function (part) { n += Math.max(1, Math.ceil(textW(part, pt) / (wIn * 0.96))); }); return n;
  }
  function th(s, wIn, pt, ls) { return lines(s, wIn, pt) * pt * (ls || 1.5) / 72 + 0.06; }

  // ── DOM 읽기 ─────────────────────────────
  var TEACHER = false;
  function txt(el) {
    if (!el) return "";
    var c = el.cloneNode(true);
    c.querySelectorAll(".verify, script, style, textarea, button, .no-pptx").forEach(function (n) { n.remove(); });
    c.querySelectorAll("input.blank").forEach(function (n) { n.replaceWith(TEACHER ? "" : "______"); });
    c.querySelectorAll(".key").forEach(function (n) { if (!TEACHER) n.remove(); });
    c.querySelectorAll("br").forEach(function (n) { n.replaceWith("\n"); });
    return c.textContent.replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  }
  function cls(el, k) { return el.classList && el.classList.contains(k); }
  function isP(el) { return el.tagName === "P"; }

  // ── 블록 정의: measure(w) / draw(s,x,y,w) ───────────
  function Para(text, o) {
    o = o || {};
    var pt = o.src ? PT.tiny : o.small ? PT.small : PT.body;
    var t = o.raw ? text : eum(text);
    return {
      kind: "para", text: t, pt: pt,
      measure: function (w) { return th(t, w, pt, 1.55) + 0.08; },
      draw: function (s, x, y, w) {
        s.addText(t, { x: x, y: y, w: w, h: th(t, w, pt, 1.55), fontFace: F.body, fontSize: pt, color: o.src ? C.muted : C.text, lineSpacingMultiple: 1.3, valign: "top", margin: 0 });
      },
      split: function (w, avail) { // 문장 단위로 나눔
        var ss = t.split(/(?<=[.!?])\s+/), a = [], b = [];
        ss.forEach(function (x) { (th(a.concat(x).join(" "), w, pt, 1.55) + 0.08 <= avail && !b.length ? a : b).push(x); });
        if (!a.length || !b.length) return null;
        return [Para(a.join(" "), { raw: true, small: o.small, src: o.src }), Para(b.join(" "), { raw: true, small: o.small, src: o.src })];
      }
    };
  }
  function Sub(text) {
    return { kind: "sub", measure: function (w) { return th(text, w, PT.sub, 1.25) + 0.12; },
      draw: function (s, x, y, w) { s.addText(text, { x: x, y: y, w: w, h: th(text, w, PT.sub, 1.25), fontFace: F.head, fontSize: PT.sub, color: C.ink, margin: 0, valign: "top" }); } };
  }
  function noteIcon(s, x, y) {
    s.addShape("roundRect", { x: x, y: y, w: 0.15, h: 0.15, rectRadius: 0.03, fill: { type: "none" }, line: { color: C.ink, width: 0.9 } });
  }
  function Callout(text, o) {
    o = o || {};
    var t = o.raw ? text : eum(text), pt = o.big ? 15 : PT.body, pad = 0.22;
    return { kind: "callout",
      measure: function (w) { return th(t, w - pad * 2 - 0.35, pt, 1.45) + pad * 2 + 0.1; },
      draw: function (s, x, y, w) {
        var h = th(t, w - pad * 2 - 0.35, pt, 1.45) + pad * 2;
        s.addShape("roundRect", { x: x, y: y, w: w, h: h, rectRadius: 0.06, fill: { color: C.box }, line: { color: C.box } });
        if (/[?？]\s*$/.test(t)) { s.addShape("ellipse", { x: x + pad, y: y + pad + 0.03, w: 0.17, h: 0.17, fill: { type: "none" }, line: { color: C.ink, width: 0.9 } }); s.addText("?", { x: x + pad, y: y + pad + 0.03, w: 0.17, h: 0.17, fontFace: F.body, fontSize: 7, color: C.ink, align: "center", valign: "middle", margin: 0 }); }
        else noteIcon(s, x + pad, y + pad + 0.04);
        var runs = o.lead ? [{ text: o.lead + ": ", options: { bold: true } }, { text: t }] : t;
        s.addText(runs, { x: x + pad + 0.35, y: y + pad, w: w - pad * 2 - 0.35, h: h - pad * 2, fontFace: F.body, fontSize: pt, color: C.ink, margin: 0, valign: "top", lineSpacingMultiple: 1.25 });
      } };
  }
  // 카드·상자 격자. items: {title, body, link, url}
  function Grid(items, o) {
    o = o || {};
    var cols = o.cols || (items.length === 4 ? 2 : items.length >= 3 ? 3 : Math.max(1, items.length));
    var gap = 0.2, pad = 0.2, filled = !!o.filled;
    items = items.map(function (it) { return { title: it.title || "", body: it.raw ? it.body || "" : eum(it.body || ""), url: it.url, meta: it.meta, center: it.center }; });
    function cw(w) { return (w - gap * (cols - 1)) / cols; }
    function ih(it, w) {
      var iw = w - pad * 2, h = pad * 2;
      if (it.title) h += th(it.title, iw, PT.cardTitle, 1.3);
      if (it.meta) h += th(it.meta, iw, PT.tiny, 1.4);
      if (it.body) h += th(it.body, iw, PT.small, 1.5) + 0.04;
      return h;
    }
    function rows(w) { var r = [], c = cw(w); for (var i = 0; i < items.length; i += cols) { var row = items.slice(i, i + cols); r.push({ items: row, h: Math.max.apply(null, row.map(function (it) { return ih(it, c); })) }); } return r; }
    return { kind: "grid",
      split: function (w, avail) {
        var rs = rows(w), used = 0, k = 0;
        while (k < rs.length && used + rs[k].h + gap <= avail) { used += rs[k].h + gap; k++; }
        if (k === 0 || k === rs.length) return null;
        var o2 = { cols: cols, filled: filled };
        var raw = function (it) { return { title: it.title, body: it.body, url: it.url, meta: it.meta, center: it.center, raw: true }; };
        return [Grid(items.slice(0, k * cols).map(raw), o2), Grid(items.slice(k * cols).map(raw), o2)];
      },
      measure: function (w) { return rows(w).reduce(function (a, r) { return a + r.h + gap; }, 0) + 0.05; },
      draw: function (s, x, y, w) {
        var c = cw(w), yy = y;
        rows(w).forEach(function (r) {
          r.items.forEach(function (it, i) {
            var xx = x + i * (c + gap), iw = c - pad * 2, ty = yy + pad;
            s.addShape("roundRect", { x: xx, y: yy, w: c, h: r.h, rectRadius: 0.05, fill: { color: filled ? C.box : C.card }, line: { color: filled ? C.box : C.line, width: 1.2 } });
            if (it.title) {
              var hh = th(it.title, iw, PT.cardTitle, 1.3), opt = { x: xx + pad, y: ty, w: iw, h: hh, fontFace: F.head, fontSize: PT.cardTitle, color: it.url ? C.link : C.ink, margin: 0, valign: "top", align: it.center ? "center" : "left" };
              if (it.url) { opt.hyperlink = { url: it.url }; opt.underline = { style: "sng", color: C.link }; opt.fontFace = F.body; opt.fontSize = 12; }
              s.addText(it.title, opt); ty += hh;
            }
            if (it.meta) { var mh = th(it.meta, iw, PT.tiny, 1.4); s.addText(it.meta, { x: xx + pad, y: ty, w: iw, h: mh, fontFace: F.body, fontSize: PT.tiny, color: C.muted, margin: 0, valign: "top" }); ty += mh; }
            if (it.body) s.addText(it.body, { x: xx + pad, y: ty + 0.04, w: iw, h: th(it.body, iw, PT.small, 1.5), fontFace: F.body, fontSize: PT.small, color: C.text, margin: 0, valign: "top", lineSpacingMultiple: 1.3, align: it.center ? "center" : "left" });
          });
          yy += r.h + gap;
        });
      } };
  }
  // 번호 흐름(1-2-3): 가로선 위 번호 칩, 아래 제목·설명
  function Flow(items) {
    items = items.map(function (it) { return { title: it.title, body: eum(it.body || "") }; });
    var n = items.length;
    function colw(w) { return w / n; }
    return { kind: "flow",
      measure: function (w) { var c = colw(w) - 0.3; return 0.5 + Math.max.apply(null, items.map(function (it) { return th(it.title, c, 12.5, 1.3) + (it.body ? th(it.body, c, PT.small, 1.5) : 0); })) + 0.15; },
      draw: function (s, x, y, w) {
        var c = colw(w);
        s.addShape("line", { x: x, y: y + 0.17, w: w, h: 0, line: { color: C.rule, width: 1 } });
        items.forEach(function (it, i) {
          var cx = x + i * c, inner = c - 0.3;
          s.addShape("roundRect", { x: cx + c / 2 - 0.16, y: y, w: 0.32, h: 0.34, rectRadius: 0.05, fill: { color: C.box }, line: { color: C.rule, width: 0.8 } });
          s.addText(String(i + 1), { x: cx + c / 2 - 0.16, y: y, w: 0.32, h: 0.34, fontFace: F.head, fontSize: 11, color: C.ink, align: "center", valign: "middle", margin: 0 });
          var th1 = th(it.title, inner, 12.5, 1.3);
          s.addText(it.title, { x: cx + 0.15, y: y + 0.48, w: inner, h: th1, fontFace: F.head, fontSize: 12.5, color: C.ink, align: "center", margin: 0, valign: "top" });
          if (it.body) s.addText(it.body, { x: cx + 0.15, y: y + 0.48 + th1, w: inner, h: th(it.body, inner, PT.small, 1.5), fontFace: F.body, fontSize: PT.small, color: C.text, align: "center", margin: 0, valign: "top", lineSpacingMultiple: 1.3 });
        });
      } };
  }
  // 번호 목록 행(테두리 상자 + 왼쪽 번호)
  function NumList(items) {
    items = items.map(function (it) { return { title: it.title, body: eum(it.body || "") }; });
    var gap = 0.12, numW = 0.55, pad = 0.16;
    function ih(it, w) { var iw = w - numW - pad * 2; return pad * 2 + th(it.title, iw, 12.5, 1.3) + (it.body ? th(it.body, iw, PT.small, 1.5) : 0); }
    return { kind: "numlist",
      measure: function (w) { return items.reduce(function (a, it) { return a + ih(it, w) + gap; }, 0); },
      draw: function (s, x, y, w) {
        var yy = y;
        items.forEach(function (it, i) {
          var h = ih(it, w), iw = w - numW - pad * 2;
          s.addShape("rect", { x: x, y: yy, w: w, h: h, fill: { color: C.card }, line: { color: C.line, width: 1 } });
          s.addShape("line", { x: x + numW, y: yy, w: 0, h: h, line: { color: C.line, width: 1 } });
          s.addText(String(i + 1), { x: x, y: yy, w: numW, h: h, fontFace: F.head, fontSize: 12, color: C.ink, align: "center", valign: "middle", margin: 0 });
          var t1 = th(it.title, iw, 12.5, 1.3);
          s.addText(it.title, { x: x + numW + pad, y: yy + pad, w: iw, h: t1, fontFace: F.head, fontSize: 12.5, color: C.ink, margin: 0, valign: "top" });
          if (it.body) s.addText(it.body, { x: x + numW + pad, y: yy + pad + t1, w: iw, h: th(it.body, iw, PT.small, 1.5), fontFace: F.body, fontSize: PT.small, color: C.text, margin: 0, valign: "top", lineSpacingMultiple: 1.3 });
          yy += h + gap;
        });
      } };
  }
  function Bullets(items) {
    items = items.map(eum);
    return { kind: "bullets",
      measure: function (w) { return items.reduce(function (a, t) { return a + th(t, w - 0.3, PT.body, 1.5); }, 0) + 0.1; },
      draw: function (s, x, y, w) {
        s.addText(items.map(function (t) { return { text: t, options: { bullet: { indent: 14 }, breakLine: true } }; }),
          { x: x, y: y, w: w, h: this.measure(w), fontFace: F.body, fontSize: PT.body, color: C.text, margin: 0, valign: "top", lineSpacingMultiple: 1.3, paraSpaceAfter: 3 });
      } };
  }
  function Quote(title, text) {
    var t = eum(text);
    return { kind: "quote",
      measure: function (w) { return (title ? 0.32 : 0) + th(t, w - 0.3, PT.small, 1.55) + 0.2; },
      draw: function (s, x, y, w) {
        var h = this.measure(w) - 0.1;
        s.addShape("line", { x: x + 0.05, y: y, w: 0, h: h, line: { color: C.rule, width: 1.5 } });
        var yy = y;
        if (title) { s.addText(title, { x: x + 0.3, y: yy, w: w - 0.3, h: 0.3, fontFace: F.head, fontSize: 12.5, color: C.ink, margin: 0, valign: "top" }); yy += 0.32; }
        s.addText(t, { x: x + 0.3, y: yy, w: w - 0.3, h: th(t, w - 0.3, PT.small, 1.55), fontFace: F.body, fontSize: PT.small, color: C.text, margin: 0, valign: "top", lineSpacingMultiple: 1.3 });
      } };
  }
  function Table(head, rows, caption) {
    rows = rows.map(function (r) { return r.map(function (c) { return eum(c); }); });
    var n = Math.max(head.length, rows[0] ? rows[0].length : 0);
    function widths(w) {
      var m = []; for (var i = 0; i < n; i++) { var mx = textW(head[i] || "", PT.small); rows.forEach(function (r) { mx = Math.max(mx, Math.min(textW(r[i] || "", PT.small), 9)); }); m.push(Math.max(mx, 0.9)); }
      var sum = m.reduce(function (a, b) { return a + b; }, 0), out = m.map(function (v) { return Math.max(1.1, v / sum * w); });
      var s2 = out.reduce(function (a, b) { return a + b; }, 0); return out.map(function (v) { return v * w / s2; });
    }
    function rowH(r, ws) { return Math.max.apply(null, r.map(function (c, i) { return th(c || " ", ws[i] - 0.2, PT.small, 1.5) + 0.16; })); }
    var capH = caption ? 0.32 : 0;
    var blk = { kind: "table", head: head, rows: rows, caption: caption,
      measure: function (w) { var ws = widths(w); return capH + rowH(head, ws) + rows.reduce(function (a, r) { return a + rowH(r, ws); }, 0) + 0.15; },
      draw: function (s, x, y, w) {
        var ws = widths(w), yy = y;
        if (caption) { s.addText(caption, { x: x, y: yy, w: w, h: 0.28, fontFace: F.body, fontSize: PT.tiny + 0.5, bold: true, color: C.ink, margin: 0 }); yy += capH; }
        var b = { type: "solid", pt: 0.75, color: C.line };
        var data = [head.map(function (h) { return { text: h, options: { bold: true, color: C.ink } }; })].concat(rows.map(function (r) { return r.map(function (c) { return { text: c || "" }; }); }));
        s.addTable(data, { x: x, y: yy, w: w, colW: ws, fontFace: F.body, fontSize: PT.small, color: C.text, border: [b, b, b, b], fill: { color: C.card }, margin: [0.07, 0.1, 0.07, 0.1], valign: "top", rowH: [rowH(head, ws)].concat(rows.map(function (r) { return rowH(r, ws); })), autoPage: false });
      },
      split: function (w, avail) {
        var ws = widths(w), used = capH + rowH(head, ws), k = 0;
        while (k < rows.length && used + rowH(rows[k], ws) <= avail - 0.15) { used += rowH(rows[k], ws); k++; }
        if (k === 0 || k === rows.length) return null;
        return [Table(head, rows.slice(0, k).map(raw), caption), Table(head, rows.slice(k).map(raw), caption ? caption + " (계속)" : "")];
      } };
    function raw(r) { return r; }
    return blk;
  }

  // ── 교재 → 슬라이드 모델 ─────────────────────
  function readMeta() {
    var tb = document.querySelector(".titlebar") || document;
    var meta = txt(tb.querySelector(".meta"));
    var date = (meta.match(/기준일[^\n]*/) || [""])[0];
    return {
      title: txt(tb.querySelector("h1")) || document.title,
      kicker: txt(tb.querySelector(".kicker")),
      question: txt(tb.querySelector(".meta b")),
      date: date,
      cover: tb.getAttribute && tb.getAttribute("data-pptx-cover")
    };
  }

  function build() {
    TEACHER = document.body.classList.contains("teacher");
    var main = document.querySelector("main[data-editable]") || document.querySelector("main");
    var meta = readMeta();
    var slides = [{ type: "cover", meta: meta }];
    var cur = null, band = "", bandNo = "", pendingNotes = [];

    function newSlide(title, o) {
      cur = { type: "content", title: title, blocks: [], notes: [] };
      if (o && o.image) { cur.type = "split"; cur.image = o.image; }
      slides.push(cur); return cur;
    }
    function add(b) { if (!cur) newSlide(meta.title); cur.blocks.push(b); }
    function notes(t) { if (!cur) newSlide(meta.title); cur.notes.push(t); }

    var kids = Array.prototype.slice.call(main.children);
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (cls(el, "teacher-only") || el.tagName === "SCRIPT") continue;
      var img = el.getAttribute("data-pptx-image");

      if (cls(el, "band")) {
        band = txt(el); bandNo = (band.match(/^(\d+)\./) || [])[1] || "";
        if (/^먼저 생각해요/.test(band)) { band = "출발 사례"; }
        newSlide(band, { image: img }); continue;
      }
      if (el.tagName === "H3" || el.tagName === "H2") {
        var t = txt(el), m = t.match(/^\((\d+)\)\s*(.*)$/);
        if (m && bandNo) t = bandNo + "." + m[1] + " " + m[2];
        newSlide(t, { image: img }); continue;
      }
      if (el.tagName === "H4" || cls(el, "rail")) {
        if (img) { newSlide(txt(el), { image: img }); continue; }
        add(Sub(txt(el))); continue;
      }
      if (cls(el, "card") && cls(el, "goal")) {
        newSlide(txt(el.querySelector("h3,h4")) || "학습목표");
        add(Bullets(Array.prototype.map.call(el.querySelectorAll("li"), txt))); continue;
      }
      if (cls(el, "card")) { // 심화·체크리스트·최근 입법 등: 제목을 새 슬라이드로, 안쪽을 다시 읽음
        var h = el.querySelector("h3,h4");
        newSlide(h ? txt(h) : band, { image: img });
        var checks = el.querySelectorAll("label.check");
        if (checks.length) { add(Bullets(Array.prototype.map.call(checks, txt))); continue; }
        Array.prototype.forEach.call(el.children, function (c) {
          if (c === h) return;
          if (isP(c)) add(cls(c, "see") ? Para(txt(c), { src: true, raw: true }) : Para(txt(c), { small: cls(c, "note") }));
          else if (c.tagName === "UL" || c.tagName === "OL") add(Bullets(Array.prototype.map.call(c.querySelectorAll("li"), txt)));
        });
        continue;
      }
      if (cls(el, "msgs")) {
        add(Grid(Array.prototype.map.call(el.children, function (c) {
          var tag = txt(c.querySelector(".tag")); var body = txt(c).replace(tag, "").trim();
          return { title: tag, body: body, raw: true };
        }), { cols: 2 })); continue;
      }
      if (cls(el, "case")) {
        var tag2 = txt(el.querySelector(".tag"));
        var trs = el.querySelectorAll("tbody tr");
        if (trs.length && trs[0].querySelector("th") && !el.querySelector("thead")) { // 판례: 사실관계·쟁점·판단·학습할 의미
          if (cur && cur.blocks.length) newSlide(tag2.replace(/^심화\s*·\s*(실제 사례\s*·\s*)?/, "판례 읽기 · "));
          else if (cur) cur.title = tag2.replace(/^심화\s*·\s*(실제 사례\s*·\s*)?/, "판례 읽기 · ");
          add(Grid(Array.prototype.map.call(trs, function (r) { return { title: txt(r.querySelector("th")), body: txt(r.querySelector("td")) }; }), { cols: 2, filled: true }));
          Array.prototype.forEach.call(el.querySelectorAll(":scope > p"), function (p) { add(Callout(txt(p).replace(/^집필자의 설명\s*/, ""), { lead: "집필자의 설명" })); });
          continue;
        }
        if (el.querySelector("table")) { if (tag2) add(Sub(tag2.replace(/^가상 사례\s*·\s*/, ""))); readTable(el.querySelector("table")); continue; }
        add(Grid([{ title: tag2, body: txt(el).replace(tag2, "").trim(), raw: true }], { cols: 1 })); continue;
      }
      if (cls(el, "think")) {
        var tg = txt(el.querySelector(".tag")), body2 = txt(el).replace(tg, "").trim();
        add(Callout(body2, { lead: tg })); continue;
      }
      if (cls(el, "law")) { var lt = txt(el.querySelector("b")); add(Quote(lt, txt(el).replace(lt, "").replace(/\(요지\)\s*$/, "").trim())); continue; }
      if (cls(el, "tbl-wrap") || el.tagName === "TABLE") { readTable(el.tagName === "TABLE" ? el : el.querySelector("table")); continue; }
      if (el.tagName === "OL" && cls(el, "steps")) {
        var items = Array.prototype.map.call(el.children, function (li) {
          var b = li.querySelector(".body > b"), bt = txt(b), all = txt(li.querySelector(".body") || li);
          return { title: bt, body: all.replace(bt, "").trim() };
        });
        var longest = Math.max.apply(null, items.map(function (x) { return x.body.length; }));
        add(items.length <= 4 && longest < 60 ? Flow(items) : NumList(items)); continue;
      }
      if (el.tagName === "UL" && cls(el, "media")) {
        add(Grid(Array.prototype.map.call(el.children, function (li) {
          var a = li.querySelector("a"), sm = txt(li.querySelector("small")), parts = sm.split(" · ");
          return { title: a ? txt(a) : txt(li.querySelector("b")), url: a && a.href, meta: parts.slice(0, parts.length > 2 ? 2 : 1).join(" · "), body: parts.slice(parts.length > 2 ? 2 : 1).join(" · "), raw: true };
        }), { cols: 2 })); continue;
      }
      if (el.tagName === "UL" || el.tagName === "OL") { add(Bullets(Array.prototype.map.call(el.querySelectorAll("li"), txt))); continue; }
      if (cls(el, "mission")) { // 사례 적용: 연속된 mission을 카드 격자로 모으고 해설은 노트로
        var cards = [];
        while (i < kids.length && (cls(kids[i], "mission") || kids[i].tagName === "TEXTAREA" || cls(kids[i], "sol") || (cls(kids[i], "case") && cards.length))) {
          var k = kids[i];
          if (cls(k, "mission")) cards.push({ title: txt(k).replace(/^【(.)】/, "$1 · "), body: "", notes: [] });
          else if (k.tagName === "TEXTAREA") cards[cards.length - 1].body = (k.getAttribute("placeholder") || "").replace(/\s*\n\s*/g, " ");
          else if (cls(k, "sol")) cards[cards.length - 1].notes.push(txt(k).replace(/^해설\s*/, ""));
          else if (cls(k, "case")) { cards[cards.length - 1].extra = k; }
          i++;
        }
        i--;
        add(Grid(cards.map(function (c) { return { title: c.title, body: c.body ? c.body + "  ▸ 해설은 노트" : "", raw: true }; }), { cols: 2 }));
        cards.forEach(function (c) { if (c.notes.length) notes("[" + c.title + "] " + c.notes.join(" ")); });
        if (kids[i + 1] && cls(kids[i + 1], "ans-label")) { i++; add(Callout(txt(kids[i]), { raw: true })); while (kids[i + 1] && (kids[i + 1].tagName === "TEXTAREA" || cls(kids[i + 1], "teacher-only"))) { i++; if (cls(kids[i], "teacher-only")) notes(txt(kids[i])); } }
        cards.forEach(function (c) { if (c.extra) kidsCase(c.extra); });
        continue;
      }
      if (cls(el, "ans-label")) { var pc = Callout(txt(el), { raw: true }); pc.sticky = true; add(pc); continue; }
      if (el.tagName === "DETAILS") { notes(txt(el).replace(/^[^\n]*해설[^\n]*\n?/, "")); continue; }
      if (el.tagName === "TEXTAREA" || cls(el, "check-row") || el.tagName === "BUTTON") continue;
      if (isP(el)) {
        if (img) { newSlide(txt(el).replace(/^다음 단원:\s*/, "다음 단원 · ").split(" — ")[0], { image: img }); add(Para(txt(el).split(" — ").slice(1).join(" — ") || txt(el))); continue; }
        if (cls(el, "see")) { add(Para(txt(el), { src: true, raw: true })); continue; }
        var pt = txt(el);
        if (cls(el, "note") && /^\(.*\)$/.test(pt)) { add(Para(pt, { src: true, raw: true })); continue; }
        var defs = [];
        Array.prototype.forEach.call(el.querySelectorAll("b"), function (bEl) {
          var term = txt(bEl); if (!term || term.length > 30) return;
          var sents = pt.split(/(?<=[.!?])\s+/);
          for (var si = 0; si < sents.length; si++) {
            var esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            if (new RegExp(esc + "\\s*(\\([^)]*\\))?\\s*(이)?라고\\s*(한다|부른다|합니다|부릅니다)\\.?$").test(sents[si])) {
              defs.push({ term: term, text: sents[si] }); sents.splice(si, 1); pt = sents.join(" "); break;
            }
          }
        });
        if (pt) add(Para(pt, { small: cls(el, "note") }));
        defs.forEach(function (d) { add(Callout(d.text, { lead: d.term.replace(/\(.*\)$/, "").trim() })); });
        continue;
      }
      if (el.tagName === "DIV" && el.children.length) { var t3 = txt(el); if (t3) add(Para(t3)); }
    }

    function readTable(table) {
      if (!table) return;
      var cap = txt(table.querySelector("caption"));
      var head = Array.prototype.map.call(table.querySelectorAll("thead th"), txt);
      var rows = Array.prototype.map.call(table.querySelectorAll("tbody tr"), function (tr) { return Array.prototype.map.call(tr.children, txt); });
      if (!head.length && rows.length) { head = rows.shift(); }
      add(Table(head, rows, cap));
    }
    function kidsCase(el) { // 사례 적용 사이에 끼어 있는 판례 상자
      var tag = txt(el.querySelector(".tag"));
      newSlide(tag.replace(/^심화\s*·\s*(실제 사례\s*·\s*)?/, "판례 읽기 · "));
      add(Grid(Array.prototype.map.call(el.querySelectorAll("tbody tr"), function (r) { return { title: txt(r.querySelector("th")), body: txt(r.querySelector("td")) }; }), { cols: 2, filled: true }));
    }
    return { meta: meta, slides: slides.filter(function (s) { return s.type === "cover" || s.blocks.length || s.notes.length || s.type === "split"; }) };
  }

  // ── 쪽 나누기 ─────────────────────────────
  function paginate(model) {
    var out = [];
    model.slides.forEach(function (s) {
      if (s.type === "cover") { out.push(s); return; }
      if (s.type === "split") {
        var sw = 6.6, avail = BOTTOM - 3.2, first = [], rest = [];
        s.blocks.forEach(function (b) { if (!rest.length && (b.kind === "para" || b.kind === "bullets" || b.kind === "callout") && b.measure(sw) <= avail) { first.push(b); avail -= b.measure(sw); } else rest.push(b); });
        out.push({ type: "split", title: s.title, image: s.image, blocks: first, notes: s.notes });
        if (rest.length) s = { type: "content", title: s.title, blocks: rest, notes: [] }; else return;
      }
      var titleH = th(s.title, CW, PT.title, 1.15);
      var top = Math.max(TOP, 0.95 + titleH + 0.3);
      var page = { type: "content", title: s.title, blocks: [], notes: s.notes.slice(), top: top }, y = top, n = 1;
      out.push(page);
      var q = s.blocks.slice();
      while (q.length) {
        var b = q.shift(), h = b.measure(CW);
        if (b.kind === "para" && b.pt === PT.tiny && (page.blocks.length || out.length > 1)) {
          var host = page.blocks.length ? page : out[out.length - 2];
          host.blocks.push(b); if (host === page) y += h + 0.14; continue;
        }
        var nextH = (b.kind === "sub" && q[0]) ? q[0].measure(CW) : 0;
        if (b.sticky && page.blocks.length && y + h <= BOTTOM + 0.6) { page.blocks.push(b); y += h + 0.14; continue; }
        if (y + h + Math.min(nextH, 1.2) > BOTTOM + 0.2 && page.blocks.length) {
          var avail = BOTTOM - y;
          if (b.split && avail > 0.8) { var parts = b.split(CW, avail); if (parts) { page.blocks.push(parts[0]); q.unshift(parts[1]); b = null; } }
          n++; page = { type: "content", title: s.title + " (" + n + ")", blocks: [], notes: [], top: top }; y = top; out.push(page);
          if (!b) continue;
        } else if (y + h > BOTTOM && b.split) {
          var parts2 = b.split(CW, BOTTOM - y); if (parts2) { page.blocks.push(parts2[0]); q.unshift(parts2[1]); n++; page = { type: "content", title: s.title + " (" + n + ")", blocks: [], notes: [], top: top }; y = top; out.push(page); continue; }
        }
        page.blocks.push(b); y += h + 0.14;
      }
    });
    return merge(out);
  }
  // 같은 절의 짧은 쪽(문단 하나뿐인 2.1·2.2 등)은 한 장으로 합침: 뒤쪽 제목은 소제목이 됨
  function pageH(p) { return p.blocks.reduce(function (a, b) { return a + b.measure(CW) + 0.14; }, 0); }
  function merge(pages) {
    var res = [];
    pages.forEach(function (p) {
      var prev = res[res.length - 1];
      var sec = function (t) { var m = String(t || "").match(/^(\d+)\.\d+\s/); return m && m[1]; };
      if (prev && prev.type === "content" && p.type === "content" && !/\(\d+\)$/.test(p.title) && !prev.merged2 &&
          sec(p.title) && sec(p.title) === sec(prev.title) && !/\(\d+\)$/.test(prev.title)) {
        var sub = Sub(p.title), need = sub.measure(CW) + pageH(p) + 0.14;
        if (pageH(prev) < 2.4 && pageH(p) < 2.4 && (prev.top || TOP) + pageH(prev) + need <= BOTTOM) {
          prev.blocks.push(sub); prev.blocks = prev.blocks.concat(p.blocks); prev.notes = prev.notes.concat(p.notes || []);
          if (prev.merged) prev.merged2 = true; prev.merged = true; return;
        }
      }
      res.push(p);
    });
    return res;
  }

  // ── 그리기 ──────────────────────────────
  function fetchData(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.blob(); }).then(function (b) {
      return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); });
    }).catch(function () { return null; });
  }
  function abs(u) { try { return new URL(u, location.href).href; } catch (e) { return u; } }

  function render(pages, meta, images) {
    var pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.title = meta.title; pptx.subject = meta.kicker; pptx.author = "교과서 포털";
    pptx.theme = { headFontFace: F.head, bodyFontFace: F.body };
    var bg = images.bg ? { data: images.bg } : { color: "F4F4F0" };
    var split = 0;

    pages.forEach(function (p) {
      var s = pptx.addSlide();
      s.background = bg;
      if (p.type === "cover") {
        var im = images[p.meta.cover];
        var tw = im ? 5.6 : 9.5;
        var tH = th(p.meta.title, tw, 34, 1.15);
        var y0 = Math.max(1.6, (H - (tH + 1.8)) / 2);
        s.addText(p.meta.title, { x: ML, y: y0, w: tw, h: tH, fontFace: F.head, fontSize: 34, color: C.ink, margin: 0, valign: "top", lineSpacingMultiple: 1.05 });
        var yy = y0 + tH + 0.25;
        if (p.meta.question) { s.addText(p.meta.question, { x: ML, y: yy, w: tw, h: 0.45, fontFace: F.head, fontSize: 16, color: C.ink, margin: 0 }); yy += 0.7; }
        if (p.meta.kicker) { s.addText(p.meta.kicker, { x: ML, y: yy, w: tw, h: 0.3, fontFace: F.body, fontSize: 9.5, color: C.text, margin: 0 }); yy += 0.38; }
        if (p.meta.date) s.addText(p.meta.date, { x: ML, y: yy, w: tw, h: 0.3, fontFace: F.body, fontSize: 9.5, color: C.text, margin: 0 });
        if (im) s.addImage({ data: im, x: W - 5.0, y: 0, w: 5.0, h: 7.5 });
        return;
      }
      if (p.type === "split") {
        var data = images[p.image], left = split % 2 === 1; split++;
        var ix = left ? 0 : W - 5.0, tx = left ? 5.75 : ML, tw2 = 6.6;
        if (data) s.addImage({ data: data, x: ix, y: 0, w: 5.0, h: 7.5 });
        var h1 = th(p.title, tw2, 26, 1.15), body = p.blocks.reduce(function (a, b) { return a + b.measure(tw2) + 0.12; }, 0);
        var y1 = Math.max(1.2, (H - h1 - 0.35 - body) / 2);
        s.addText(p.title, { x: tx, y: y1, w: tw2, h: h1, fontFace: F.head, fontSize: 26, color: C.ink, margin: 0, valign: "top", lineSpacingMultiple: 1.05 });
        var yb = y1 + h1 + 0.35;
        p.blocks.forEach(function (b) { b.draw(s, tx, yb, tw2); yb += b.measure(tw2) + 0.12; });
        if (p.notes && p.notes.length) s.addNotes(p.notes.join("\n\n"));
        return;
      }
      s.addText(p.title, { x: ML, y: 0.95, w: CW, h: th(p.title, CW, PT.title, 1.15), fontFace: F.head, fontSize: PT.title, color: C.ink, margin: 0, valign: "top" });
      var y = p.top || TOP;
      p.blocks.forEach(function (b) { var bh = b.measure(CW); if (b.kind === "para" && b.pt === PT.tiny) y = Math.min(y, H - 0.2 - bh); b.draw(s, ML, y, CW); y += bh + 0.14; });
      if (p.notes && p.notes.length) s.addNotes(p.notes.join("\n\n"));
    });
    return pptx;
  }

  // 제목 글꼴(라틴 Gelasio·Lato)과 한글 글꼴(Noto Sans KR)을 나눠 지정
  function fixFonts(pptx, name) {
    return pptx.write({ outputType: "arraybuffer" }).then(function (buf) { return JSZip.loadAsync(buf); }).then(function (zip) {
      var jobs = [];
      zip.forEach(function (path, file) {
        if (!/^ppt\/(slides\/slide\d+|theme\/theme\d+|notesSlides\/notesSlide\d+)\.xml$/.test(path)) return;
        jobs.push(file.async("string").then(function (x) {
          x = x.replace(/<a:ea typeface="(Gelasio|Lato)"/g, '<a:ea typeface="' + F.ko + '"').replace(/<a:cs typeface="(Gelasio|Lato)"/g, '<a:cs typeface="' + F.ko + '"')
               .replace(/<a:font script="Hang" typeface="[^"]*"/g, '<a:font script="Hang" typeface="' + F.ko + '"');
          zip.file(path, x);
        }));
      });
      return Promise.all(jobs).then(function () { return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }); });
    }).then(function (blob) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { a.remove(); URL.revokeObjectURL(a.href); }, 4000);
      return { name: name };
    });
  }

  function exportPptx() {
    var model = build();
    var pages = paginate(model);
    var want = { bg: BASE + "pptx/bg.png" };
    pages.forEach(function (p) { if (p.type === "cover" && p.meta.cover) want[p.meta.cover] = abs(p.meta.cover); if (p.image) want[p.image] = abs(p.image); });
    var keys = Object.keys(want);
    return Promise.all(keys.map(function (k) { return fetchData(want[k]); })).then(function (vals) {
      var images = {}; keys.forEach(function (k, i) { images[k] = vals[i]; });
      var pptx = render(pages, model.meta, images);
      var name = (model.meta.title || "slides").replace(/[\\/:*?"<>|]/g, "") + ".pptx";
      return fixFonts(pptx, name).then(function (r) { r.count = pages.length; return r; });
    });
  }

  window.TBPptx = { exportPptx: exportPptx, _build: build, _paginate: paginate, _eum: eum };
})();
