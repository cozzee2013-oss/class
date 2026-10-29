/* 교재 → 강의 슬라이드(PPTX) 파이프라인
   - 교재 본문(main[data-editable])을 읽어 슬라이드 모델로 바꾸고 PptxGenJS로 .pptx를 만든다.
   - 디자인: 「허위정보·가짜뉴스와 미디어 리터러시」 강의 슬라이드(16:9)를 실측한 값으로 맞춘다.
       제목 31.5pt(라틴 Gelasio·한글 Noto Sans KR) / 본문 12.6pt(Lato·Noto Sans KR, 줄 간격 0.28in)
       카드 제목 15.8pt / 출처 10pt 회색 / 좌우 여백 0.70in / 내용 묶음은 세로 가운데 정렬
       표지 제목 43.4pt·부제 25.2pt / 일러스트 5.0×7.5in 분할 화면
   - 문체: 본문의 서술체(~다/~습니다)를 개조식(~임/~함)으로 바꾼다. 인용문(“…”)은 그대로 둔다.
   - 해설(details)은 발표자 노트로 들어간다. 교수자판(#teacher)에서 만들면 빈칸에 정답이 들어간다.
   - 일러스트: 교재 HTML에 data-pptx-cover / data-pptx-image="이미지 경로"를 붙이면 그 자리에 분할 화면을 만든다.
   사용: 교재 화면의 PPT 버튼 (assets/textbook.js가 이 파일과 vendor/pptxgen.bundle.js를 불러온다). */
(function () {
  "use strict";

  // ── 실측 디자인 값(인치·포인트) ─────────────────
  var W = 13.333, H = 7.5, ML = 0.70, CW = 11.93, MINTOP = 0.62;
  var C = { title: "312F2B", text: "272525", black: "000000", muted: "808080", line: "CECEC9", head: "E8E8E3", box: "E6E6E1", call: "EEEEED", card: "FFFFFF", rule: "B3B3B3", link: "7A5C2E" };
  var F = { head: "Gelasio", body: "Lato", ko: "Noto Sans KR" };
  var S = { cover: 43.4, coverSub: 25.2, title: 31.5, sub: 31.5, num: 18.9, card: 15.8, body: 12.6, src: 10 };
  var L = { cover: 0.75, title: 0.55, card: 0.30, body: 0.28, src: 0.20 };   // 줄 간격(in)
  var GAP = { afterTitle: 0.33, block: 0.24, para: 0.19, grid: 0.19 };
  var LS = function (lineIn) { return lineIn * 72; };                         // 줄 간격 → pt

  var SCRIPT = document.currentScript && document.currentScript.src;
  var BASE = SCRIPT ? SCRIPT.replace(/[^/]*$/, "") : "../assets/";

  // ── 문체: 서술체 → 개조식 ─────────────────────
  var H0 = 0xac00;
  function dec(ch) { var k = ch.charCodeAt(0) - H0; if (k < 0 || k > 11171) return null; return { c: Math.floor(k / 588), v: Math.floor((k % 588) / 28), j: k % 28 }; }
  function comp(d) { return String.fromCharCode(H0 + d.c * 588 + d.v * 28 + d.j); }
  function withJong(ch, j) { var d = dec(ch); d.j = j; return comp(d); }
  var B_IRR = "렵쉽깝겁텁럽롭답갑덥춥밉곱".split("");
  var V_STEM = "르니크쁘프트뜨끄쓰치키리기시지하되보오주두추피비미".split("");
  function endWord(stem, x) {
    var d = dec(x); if (!d) return null;
    if (x === "이") return stem + "임";
    if (x === "는") return stem + "음";
    if (d.j === 20) return stem + x + "음";
    if (d.j === 4) return stem + withJong(x, 16);
    if (d.j === 8) return stem + withJong(x, 10);
    if (d.j === 17) return B_IRR.indexOf(x) > -1 ? stem + withJong(x, 0) + "움" : stem + x + "음";
    if (d.j === 0) return V_STEM.indexOf(x) > -1 ? stem + withJong(x, 16) : stem + x + "임";
    return stem + x + "음";
  }
  function eumOne(s) {
    var m;
    if ((m = s.match(/^([\s\S]*?[가-힣])(\s*\([^()]*\))([.!]?)\s*$/))) { var core = eumOne(m[1] + "."); if (core !== m[1] + ".") return core.replace(/\.$/, "") + m[2] + m[3]; return s; }
    if (/[”"’']\s*$/.test(s) || /\?\s*$/.test(s)) return s;
    if ((m = s.match(/^([\s\S]*?)([가-힣])습니다([.!]?)\s*$/))) return m[1] + m[2] + "음" + m[3];
    if ((m = s.match(/^([\s\S]*?)([가-힣])니다([.!]?)\s*$/))) { var d = dec(m[2]); if (d && d.j === 17) return m[1] + withJong(m[2], 16) + m[3]; }
    if ((m = s.match(/^([\s\S]*?)([가-힣])다([.!]?)\s*$/))) { var r = endWord(m[1], m[2]); if (r) return r + m[3]; }
    return s;
  }
  function eum(text) { return text ? text.split(/(?<=[.!?])\s+/).map(eumOne).join(" ") : text; }

  // ── 줄 나누기: 실제 글꼴 폭(1/1000em)으로 직접 계산해 줄바꿈을 넣는다 ─────
  //    한글 Noto Sans KR 0.92em(음절 단위로 끊음), 라틴은 Lato·Gelasio 표(단어 단위로 끊음)
  //    → PowerPoint·Keynote·LibreOffice 어디서 열어도 줄과 높이가 같다.
  var MET = {
    body: "193,343,397,580,580,786,703,230,300,300,400,580,212,347,212,373,580,580,580,580,580,580,580,580,580,580,252,252,580,580,580,398,822,680,647,685,753,581,566,734,756,307,444,681,514,920,756,798,611,798,644,530,590,730,680,1019,643,629,624,300,375,300,580,394,307,507,559,467,559,524,337,511,556,256,254,524,256,821,556,556,552,559,403,434,373,556,512,766,504,512,462,300,300,300,580",
    bold: "193,360,422,580,580,803,714,238,300,300,400,580,225,359,225,387,580,580,580,580,580,580,580,580,580,580,265,265,580,580,580,420,822,710,652,670,748,572,562,723,756,314,437,698,517,930,756,800,625,800,655,536,595,728,710,1046,679,654,617,300,390,300,580,394,319,524,570,477,570,534,350,518,568,271,269,552,271,842,568,568,566,570,408,437,387,568,534,791,540,534,470,300,300,300,580",
    head: "241,331,412,643,610,817,710,215,375,375,472,643,270,374,270,469,614,430,559,552,565,528,566,502,596,566,312,312,643,643,643,479,929,671,654,642,749,653,599,725,815,390,518,694,604,927,767,744,610,744,702,561,619,756,667,976,710,615,602,375,469,375,643,643,500,504,560,454,574,483,325,509,582,293,292,536,286,881,591,539,571,560,410,432,345,575,497,737,505,492,444,430,375,430,643"
  };
  Object.keys(MET).forEach(function (k) { MET[k] = MET[k].split(",").map(Number); });
  var SAFE = (typeof window !== "undefined" && window.TB_PPTX_AUTOSPACE) ? 0.95 : 0.985;                                     // 앱마다 미세한 폭 차이를 흡수하는 여유
  // LibreOffice는 한글과 라틴 문자 사이에 자동 간격(약 0.25em)을 넣는다. 검증용으로만 켠다.
  var AUTOSPACE = (typeof window !== "undefined" && window.TB_PPTX_AUTOSPACE) ? 0.25 : 0;
  function tokW(tk, face, prev) {
    var w = 0, p = prev;
    for (var i = 0; i < tk.length; i++) {
      var ch = tk[i], cur = /[A-Za-z0-9]/.test(ch) ? "L" : (ch.charCodeAt(0) >= 0xac00 && ch.charCodeAt(0) <= 0xd7a3) ? "H" : "O";
      if (AUTOSPACE && ((p === "L" && cur === "H") || (p === "H" && cur === "L"))) w += AUTOSPACE;
      if (cur !== "O" || ch !== " ") p = ch === " " ? "O" : cur;
      w += cw1(ch, face);
    }
    return { w: w, last: p };
  }
  function cw1(c, face) {
    var k = c.charCodeAt(0);
    if (k === 32) return 0.224;                        // 한글 사이 공백은 Noto Sans KR 폭
    if (k >= 32 && k < 127) return MET[face || "body"][k - 32] / 1000;
    if (k >= 0xac00 && k <= 0xd7a3) return 0.92;        // 한글 음절
    if (k === 0x2018 || k === 0x2019) return 0.3;      // ‘ ’
    if (k === 0x201c || k === 0x201d) return 0.5;      // “ ”
    if (k === 0xb7) return 0.6;                        // ·
    if (k >= 0x2000 && k <= 0x206f) return 0.6;
    return 1.0;                                        // 그 밖의 한중일 문자·기호
  }
  var NO_START = /^[.,!?;:)\]}%’”」』·…、。]/;
  function isHangul(ch) { var k = ch.charCodeAt(0); return k >= 0x1100 && (k <= 0x11ff || (k >= 0x3130 && k <= 0x318f) || (k >= 0xac00 && k <= 0xd7a3)); }
  // 토큰: 한글·한자 한 글자씩, 라틴 단어는 통째로, 공백은 따로
  // 여는 괄호·따옴표는 뒤 글자에, 닫는 괄호·문장부호는 앞 글자에 붙여 한 덩어리로 다룬다(줄 머리·끝 금칙).
  var TOK = /[ \t]+|[(\[{“‘「『"']*(?:[A-Za-z0-9@#$&*+\-_=\/\\~^<>|]+|.)[)\]}”’」』"'.,!?;:%·…]*/g;
  function tokens(str) { return str.match(TOK) || []; }
  function wrapLines(str, wIn, pt, face) {
    var out = [], max = wIn * SAFE * 72 / pt;           // em 단위 한 줄 폭
    String(str || "").split("\n").forEach(function (para) {
      var line = "", lw = 0, prev = "O";
      tokens(para).forEach(function (tk) {
        var r = tokW(tk, face, prev), tw = r.w; prev = r.last;
        if (/^[ \t]+$/.test(tk)) { if (line) { line += tk; lw += tw; } return; }
        if (lw + tw <= max || !line.trim()) {
          if (tw > max && !isHangul(tk[0])) { // 너무 긴 라틴 토큰은 글자 단위로
            for (var j = 0; j < tk.length; j++) { var w1 = cw1(tk[j], face); if (lw + w1 > max && line) { out.push(line.replace(/\s+$/, "")); line = ""; lw = 0; } line += tk[j]; lw += w1; }
            return;
          }
          line += tk; lw += tw; return;
        }
        if (NO_START.test(tk) && line) { // 줄 머리 금지 문자는 앞줄에 붙임
          line += tk; lw += tw; return;
        }
        out.push(line.replace(/\s+$/, "")); line = tk; lw = tw;
      });
      out.push(line.replace(/\s+$/, ""));
    });
    return out;
  }
  function textW(s, pt, face) { var w = 0; for (var i = 0; i < s.length; i++) w += cw1(s[i], face); return w * pt / 72; }
  function nLines(s, wIn, pt, face) { return wrapLines(s, wIn, pt, face).length; }
  function hgt(s, wIn, pt, lineIn, face) { return nLines(s, wIn, pt, face) * lineIn; }
  // y는 첫 줄 글자 윗선(레퍼런스 실측 기준). 글상자는 줄 간격 여유만큼 위로 올려 놓는다.
  function off(pt, lineIn) { return Math.max(0, (lineIn * 72 - 0.92 * pt) / 72); }
  // text: 문자열 또는 [{text, options}] 묶음. 미리 계산한 줄바꿈을 넣어 그린다.
  function txtBox(s, text, x, y, w, pt, lineIn, o) {
    o = o || {};
    var face = o.fontFace === F.head ? "head" : o.bold ? "bold" : "body";
    var runs = typeof text === "string" ? [{ text: text, options: {} }] : text;
    var full = runs.map(function (r) { return r.text; }).join("");
    var lines = wrapLines(full, w, pt, face);
    // 줄 경계를 runs에 다시 적용
    var outRuns = [], ri = 0, rpos = 0;
    lines.forEach(function (ln, li) {
      var need = ln.length;
      while (need > 0 && ri < runs.length) {
        var rt = runs[ri].text, take = Math.min(need, rt.length - rpos);
        var piece = rt.substr(rpos, take);
        outRuns.push({ text: piece, options: Object.assign({}, runs[ri].options) });
        need -= take; rpos += take;
        if (rpos >= rt.length) { ri++; rpos = 0; }
      }
      // 원문에서 이 줄 뒤에 버린 공백·줄바꿈 건너뛰기
      while (ri < runs.length) {
        var rest = runs[ri].text.substr(rpos), m = rest.match(/^[ \t\n]+/);
        if (m) { rpos += m[0].length; if (rpos >= runs[ri].text.length) { ri++; rpos = 0; continue; } }
        break;
      }
      if (li < lines.length - 1 && outRuns.length) outRuns[outRuns.length - 1].options.breakLine = true;
    });
    if (!outRuns.length) outRuns = [{ text: "", options: {} }];
    var h = lines.length * lineIn;
    s.addText(outRuns, Object.assign({ x: x, y: y - off(pt, lineIn), w: w + 0.05, h: h + 0.1, fontFace: F.body, fontSize: pt, color: C.text, margin: 0, valign: "top", lineSpacing: LS(lineIn), paraSpaceBefore: 0, paraSpaceAfter: 0, fit: "none", wrap: true }, o));
    return h;
  }

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

  // ── 블록: measure(w) / draw(s,x,y,w) ───────────
  function Para(text, o) {
    o = o || {};
    var src = !!o.src, pt = src ? S.src : S.body, li = src ? L.src : L.body;
    var t = o.raw ? text : eum(text);
    return { kind: "para", src: src, text: t,
      measure: function (w) { return hgt(t, w, pt, li); },
      draw: function (s, x, y, w) { txtBox(s, t, x, y, w, pt, li, { color: src ? C.muted : C.text }); },
      split: function (w, avail) {
        var ss = t.split(/(?<=[.!?])\s+/), a = [], b = [];
        ss.forEach(function (x) { (hgt(a.concat(x).join(" "), w, pt, li) <= avail && !b.length ? a : b).push(x); });
        if (!a.length || !b.length) return null;
        return [Para(a.join(" "), { raw: true, src: src }), Para(b.join(" "), { raw: true, src: src })];
      } };
  }
  function Sub(text) {
    return { kind: "sub",
      measure: function (w) { return hgt(text, w, S.sub, L.title, "head") + GAP.afterTitle - GAP.block; },
      draw: function (s, x, y, w) { txtBox(s, text, x, y, w, S.sub, L.title, { fontFace: F.head, color: C.title }); } };
  }
  function Callout(text, o) {
    o = o || {};
    var t = o.raw ? text : eum(text), padT = 0.26, padB = 0.15, tx = 0.57, padR = 0.2;
    var full = (o.lead ? o.lead + ": " : "") + t;
    return { kind: "callout", sticky: !!o.sticky,
      measure: function (w) { return padT + hgt(full, w - tx - padR, S.body, L.body) + padB; },
      draw: function (s, x, y, w) {
        var h = this.measure(w);
        s.addShape("roundRect", { x: x, y: y, w: w, h: h, rectRadius: 0.07, fill: { color: C.call }, line: { color: C.call, width: 0 } });
        var q = /[?？]\s*$/.test(t);
        if (q) { s.addShape("ellipse", { x: x + 0.21, y: y + padT + 0.0, w: 0.17, h: 0.17, fill: { type: "none" }, line: { color: C.black, width: 1 } }); txtBox(s, "?", x + 0.21, y + padT + 0.04, 0.17, 7.5, 0.12, { align: "center", color: C.black }); }
        else s.addShape("roundRect", { x: x + 0.21, y: y + padT + 0.005, w: 0.16, h: 0.16, rectRadius: 0.03, fill: { type: "none" }, line: { color: C.black, width: 1 } });
        var runs = o.lead ? [{ text: o.lead + ": ", options: { bold: true } }, { text: t }] : [{ text: t }];
        txtBox(s, runs, x + tx, y + padT, w - tx - padR, S.body, L.body, { color: C.black });
      } };
  }
  // 카드(테두리)·상자(회색) 격자
  function Grid(items, o) {
    o = o || {};
    var cols = o.cols || (items.length === 4 ? 2 : items.length >= 3 ? 3 : Math.max(1, items.length));
    var filled = !!o.filled, padX = 0.19, padT = 0.15, padB = 0.16, tgap = 0.14;
    items = items.map(function (it) { return { title: it.title || "", body: it.raw ? it.body || "" : eum(it.body || ""), url: it.url, meta: it.meta }; });
    function cw(w) { return (w - GAP.grid * (cols - 1)) / cols; }
    function ih(it, w) {
      var iw = w - padX * 2, h = padT + padB;
      if (it.title) h += it.url ? hgt(it.title, iw, S.body, L.body) : hgt(it.title, iw, S.card, L.card, "head");
      if (it.meta) h += hgt(it.meta, iw, S.src, L.src) + 0.04;
      if (it.body) h += tgap + hgt(it.body, iw, S.body, L.body);
      return h;
    }
    function rows(w) { var r = [], c = cw(w); for (var i = 0; i < items.length; i += cols) { var row = items.slice(i, i + cols); r.push({ items: row, h: Math.max.apply(null, row.map(function (it) { return ih(it, c); })) }); } return r; }
    return { kind: "grid",
      measure: function (w) { var rs = rows(w); return rs.reduce(function (a, r) { return a + r.h; }, 0) + GAP.grid * (rs.length - 1); },
      split: function (w, avail) {
        var rs = rows(w), used = 0, k = 0;
        while (k < rs.length && used + rs[k].h <= avail) { used += rs[k].h + GAP.grid; k++; }
        if (k === 0 || k === rs.length) return null;
        var raw = function (it) { return { title: it.title, body: it.body, url: it.url, meta: it.meta, raw: true }; };
        return [Grid(items.slice(0, k * cols).map(raw), { cols: cols, filled: filled }), Grid(items.slice(k * cols).map(raw), { cols: cols, filled: filled })];
      },
      draw: function (s, x, y, w) {
        var c = cw(w), yy = y;
        rows(w).forEach(function (r) {
          r.items.forEach(function (it, i) {
            var xx = x + i * (c + GAP.grid), iw = c - padX * 2, ty = yy + padT;
            s.addShape("roundRect", { x: xx, y: yy, w: c, h: r.h, rectRadius: 0.06, fill: { color: filled ? C.box : C.card }, line: filled ? { color: C.box, width: 0 } : { color: C.line, width: 1.4 } });
            if (it.title) {
              if (it.url) ty += txtBox(s, it.title, xx + padX, ty, iw, S.body, L.body, { color: C.link, hyperlink: { url: it.url }, underline: { style: "sng", color: C.link } });
              else ty += txtBox(s, it.title, xx + padX, ty, iw, S.card, L.card, { fontFace: F.head, color: C.text });
            }
            if (it.meta) ty += txtBox(s, it.meta, xx + padX, ty + 0.04, iw, S.src, L.src, { color: C.muted }) + 0.04;
            if (it.body) txtBox(s, it.body, xx + padX, ty + tgap, iw, S.body, L.body);
          });
          yy += r.h + GAP.grid;
        });
      } };
  }
  // 번호 머리띠 상자(1·2·3): 회색 머리띠에 번호, 아래 제목·설명
  function Flow(items) {
    items = items.map(function (it) { return { title: it.title, body: eum(it.body || "") }; });
    var n = items.length, headH = 0.53, padX = 0.19, padT = 0.15, padB = 0.15, tgap = 0.14;
    function bw(w) { return (w - GAP.grid * (n - 1)) / n; }
    function bodyH(w) { var iw = bw(w) - padX * 2; return Math.max.apply(null, items.map(function (it) { return hgt(it.title, iw, S.card, L.card, "head") + (it.body ? tgap + hgt(it.body, iw, S.body, L.body) : 0); })); }
    return { kind: "flow",
      measure: function (w) { return headH + padT + bodyH(w) + padB; },
      draw: function (s, x, y, w) {
        var c = bw(w), h = this.measure(w);
        items.forEach(function (it, i) {
          var xx = x + i * (c + GAP.grid), iw = c - padX * 2;
          s.addShape("roundRect", { x: xx, y: y, w: c, h: h, rectRadius: 0.06, fill: { color: C.card }, line: { color: C.line, width: 1.4 } });
          s.addShape("rect", { x: xx + 0.01, y: y + 0.01, w: c - 0.02, h: headH - 0.01, fill: { color: C.head }, line: { color: C.head, width: 0 } });
          s.addShape("line", { x: xx, y: y + headH, w: c, h: 0, line: { color: "D7D7D2", width: 1 } });
          txtBox(s, String(i + 1), xx, y + (headH - 0.19) / 2, c, S.num, 0.3, { fontFace: F.head, align: "center" });
          var ty = y + headH + padT;
          ty += txtBox(s, it.title, xx + padX, ty, iw, S.card, L.card, { fontFace: F.head });
          if (it.body) txtBox(s, it.body, xx + padX, ty + tgap, iw, S.body, L.body);
        });
      } };
  }
  // 번호 행: 왼쪽 회색 번호 칸 + 제목·설명
  function NumList(items) {
    items = items.map(function (it) { return { title: it.title, body: eum(it.body || "") }; });
    var numW = 0.71, padX = 0.18, padT = 0.14, padB = 0.15, tgap = 0.14, rgap = 0.2;
    function ih(it, w) { var iw = w - numW - padX * 2; return padT + hgt(it.title, iw, S.card, L.card, "head") + (it.body ? tgap + hgt(it.body, iw, S.body, L.body) : 0) + padB; }
    return { kind: "numlist",
      measure: function (w) { return items.reduce(function (a, it) { return a + ih(it, w); }, 0) + rgap * (items.length - 1); },
      split: function (w, avail) {
        var used = 0, k = 0; while (k < items.length && used + ih(items[k], w) <= avail) { used += ih(items[k], w) + rgap; k++; }
        if (k === 0 || k === items.length) return null;
        return [NumList(items.slice(0, k).map(function (x) { return x; })), NumList(items.slice(k))];
      },
      draw: function (s, x, y, w) {
        var yy = y;
        items.forEach(function (it, i) {
          var h = ih(it, w), iw = w - numW - padX * 2;
          s.addShape("roundRect", { x: x, y: yy, w: w, h: h, rectRadius: 0.05, fill: { color: C.card }, line: { color: C.line, width: 1.4 } });
          s.addShape("rect", { x: x + 0.01, y: yy + 0.01, w: numW, h: h - 0.02, fill: { color: C.head }, line: { color: C.head, width: 0 } });
          txtBox(s, String(i + 1), x, yy + h / 2 - 0.1, numW, S.num, 0.32, { fontFace: F.head, align: "center" });
          var ty = yy + padT;
          ty += txtBox(s, it.title, x + numW + padX, ty, iw, S.card, L.card, { fontFace: F.head });
          if (it.body) txtBox(s, it.body, x + numW + padX, ty + tgap, iw, S.body, L.body);
          yy += h + rgap;
        });
      } };
  }
  function Bullets(items) {
    items = items.map(eum);
    var ind = 0.28, sp = 0.06;
    return { kind: "bullets",
      measure: function (w) { return items.reduce(function (a, t) { return a + hgt(t, w - ind, S.body, L.body) + sp; }, 0) - sp; },
      draw: function (s, x, y, w) {
        var yy = y;
        items.forEach(function (t) {
          txtBox(s, "•", x + 0.06, yy, 0.2, S.body, L.body);
          yy += txtBox(s, t, x + ind, yy, w - ind, S.body, L.body) + sp;
        });
      } };
  }
  function Quote(title, text) { // 조문: 왼쪽 세로줄 + 제목 + 본문
    var t = eum(text), ind = 0.3;
    return { kind: "quote",
      measure: function (w) { return (title ? hgt(title, w - ind, S.card, L.card, "head") + 0.1 : 0) + hgt(t, w - ind, S.body, L.body); },
      draw: function (s, x, y, w) {
        var h = this.measure(w);
        s.addShape("line", { x: x + 0.02, y: y, w: 0, h: h, line: { color: C.line, width: 2 } });
        var yy = y;
        if (title) yy += txtBox(s, title, x + ind, yy, w - ind, S.card, L.card, { fontFace: F.head }) + 0.1;
        txtBox(s, t, x + ind, yy, w - ind, S.body, L.body);
      } };
  }
  function Table(head, rows, caption, rawRows) {
    if (!rawRows) rows = rows.map(function (r) { return r.map(function (c) { return eum(c); }); });
    var n = Math.max(head.length, rows[0] ? rows[0].length : 0), padX = 0.18, padY = 0.12;
    function widths(w) {
      var m = []; for (var i = 0; i < n; i++) { var mx = textW(head[i] || "", S.body, "bold") + padX * 2 + 0.15; rows.forEach(function (r) { mx = Math.max(mx, Math.min(textW(r[i] || "", S.body) + padX * 2 + 0.15, 8)); }); m.push(Math.max(mx, 1.0)); }
      var sum = m.reduce(function (a, b) { return a + b; }, 0);
      if (sum <= w) { var extra = w - sum, longest = m.indexOf(Math.max.apply(null, m)); m[longest] += extra; return m; }
      var out = m.map(function (v) { return Math.max(1.1, v / sum * w); }), s2 = out.reduce(function (a, b) { return a + b; }, 0);
      return out.map(function (v) { return v * w / s2; });
    }
    function rowH(r, ws) { return Math.max.apply(null, r.map(function (c, i) { return hgt(c || " ", ws[i] - padX * 2, S.body, L.body, r === head ? "bold" : "body"); })) + padY * 2; }
    var capH = caption ? L.body + 0.08 : 0;
    function tot(w) { var ws = widths(w); return capH + rowH(head, ws) + rows.reduce(function (a, r) { return a + rowH(r, ws); }, 0); }
    return { kind: "table",
      measure: tot,
      draw: function (s, x, y, w) {
        var ws = widths(w), yy = y;
        if (caption) { txtBox(s, caption, x, yy, w, S.body, L.body, { bold: true }); yy += capH; }
        var b = { type: "solid", pt: 0.75, color: C.rule };
        var cell = function (c, i, face) { return wrapLines(c || "", ws[i] - padX * 2, S.body, face).join("\n"); };
        var data = [head.map(function (h, i) { return { text: cell(h, i, "bold"), options: { bold: true } }; })].concat(rows.map(function (r) { return r.map(function (c, i) { return { text: cell(c, i) }; }); }));
        s.addTable(data, { x: x, y: yy, w: w, colW: ws, fontFace: F.body, fontSize: S.body, color: C.text, border: [b, b, b, b], fill: { color: C.card }, margin: [padY * 72, padX * 72, padY * 72, padX * 72], valign: "top", lineSpacing: LS(L.body), rowH: [rowH(head, ws)].concat(rows.map(function (r) { return rowH(r, ws); })), autoPage: false });
      },
      split: function (w, avail) {
        var ws = widths(w), used = capH + rowH(head, ws), k = 0;
        while (k < rows.length && used + rowH(rows[k], ws) <= avail) { used += rowH(rows[k], ws); k++; }
        if (k === 0 || k === rows.length) return null;
        return [Table(head, rows.slice(0, k), caption, true), Table(head, rows.slice(k), caption ? caption + " (계속)" : "", true)];
      } };
  }

  // ── 교재 → 슬라이드 모델 ─────────────────────
  function readMeta() {
    var tb = document.querySelector(".titlebar") || document;
    var meta = txt(tb.querySelector(".meta"));
    return {
      title: txt(tb.querySelector("h1")) || document.title,
      kicker: txt(tb.querySelector(".kicker")),
      question: txt(tb.querySelector(".meta b")),
      date: (meta.match(/기준일[^\n]*/) || [""])[0].replace(/\.\s*$/, ""),
      cover: tb.getAttribute && tb.getAttribute("data-pptx-cover")
    };
  }
  function caseTitle(tag) { return tag.replace(/^심화\s*·\s*(실제 사례\s*·\s*)?/, "심화 · 판례 읽기: ").replace(/^(실제|가상) 사례\s*·\s*/, ""); }

  function build() {
    TEACHER = document.body.classList.contains("teacher");
    var main = document.querySelector("main[data-editable]") || document.querySelector("main");
    var meta = readMeta();
    var slides = [{ type: "cover", meta: meta }];
    var cur = null, band = "", bandNo = "", sub = 0;

    function newSlide(title, o) {
      cur = { type: "content", title: title, blocks: [], notes: [] };
      if (o && o.image) { cur.type = "split"; cur.image = o.image; cur.side = o.side; }
      slides.push(cur); return cur;
    }
    function add(b) { if (!cur) newSlide(meta.title); cur.blocks.push(b); }
    function notes(t) { if (!cur) newSlide(meta.title); cur.notes.push(t); }
    function rows2grid(trs) { return Grid(Array.prototype.map.call(trs, function (r) { return { title: txt(r.querySelector("th")), body: txt(r.querySelector("td")) }; }), { cols: 2, filled: true }); }

    var kids = Array.prototype.slice.call(main.children);
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (cls(el, "teacher-only") || el.tagName === "SCRIPT") continue;
      var img = el.getAttribute("data-pptx-image"), side = el.getAttribute("data-pptx-side");

      if (cls(el, "band")) {
        band = txt(el); bandNo = (band.match(/^(\d+)\./) || [])[1] || "";
        if (/^먼저 생각해요/.test(band)) band = "출발 사례";
        newSlide(band, { image: img, side: side }); continue;
      }
      if (el.tagName === "H3" || el.tagName === "H2") {
        var t = txt(el), m = t.match(/^\((\d+)\)\s*(.*)$/);
        if (m && bandNo) t = bandNo + "." + m[1] + " " + m[2];
        newSlide(t, { image: img, side: side }); continue;
      }
      if (cls(el, "rail")) { newSlide(txt(el), { image: img, side: side }); continue; }
      if (el.tagName === "H4") { if (img) newSlide(txt(el), { image: img, side: side }); else add(Sub(txt(el))); continue; }
      if (cls(el, "card") && cls(el, "goal")) {
        newSlide(txt(el.querySelector("h3,h4")) || "학습목표");
        add(Bullets(Array.prototype.map.call(el.querySelectorAll("li"), txt))); continue;
      }
      if (cls(el, "card")) {
        var h = el.querySelector("h3,h4");
        newSlide(h ? txt(h) : band, { image: img, side: side });
        var checks = el.querySelectorAll("label.check");
        if (checks.length) { add(Bullets(Array.prototype.map.call(checks, txt))); continue; }
        Array.prototype.forEach.call(el.children, function (c) {
          if (c === h) return;
          if (isP(c)) add(cls(c, "see") ? Para(txt(c), { src: true, raw: true }) : paraWithDefs(c));
          else if (c.tagName === "UL" || c.tagName === "OL") add(Bullets(Array.prototype.map.call(c.querySelectorAll("li"), txt)));
        });
        continue;
      }
      if (cls(el, "msgs")) {
        add(Grid(Array.prototype.map.call(el.children, function (c) {
          var tag = txt(c.querySelector(".tag")); return { title: tag, body: txt(c).replace(tag, "").trim(), raw: true };
        }), { cols: 2 })); continue;
      }
      if (cls(el, "case")) {
        var tag2 = txt(el.querySelector(".tag")), trs = el.querySelectorAll("tbody tr");
        if (trs.length && trs[0].querySelector("th") && !el.querySelector("thead")) {
          if (cur && cur.blocks.length) newSlide(caseTitle(tag2)); else if (cur) cur.title = caseTitle(tag2);
          add(rows2grid(trs));
          Array.prototype.forEach.call(el.querySelectorAll(":scope > p"), function (p) { add(Callout(txt(p).replace(/^집필자의 설명\s*/, ""), { lead: "집필자의 설명" })); });
          continue;
        }
        if (el.querySelector("table")) { newSlide(caseTitle(tag2)); readTable(el.querySelector("table")); continue; }
        add(Grid([{ title: tag2, body: txt(el).replace(tag2, "").trim(), raw: true }], { cols: 1 })); continue;
      }
      if (cls(el, "think")) { var tg = txt(el.querySelector(".tag")); add(Callout(txt(el).replace(tg, "").trim(), { lead: tg })); continue; }
      if (cls(el, "law")) { var lt = txt(el.querySelector("b")); add(Quote(lt, txt(el).replace(lt, "").replace(/\(요지\)\s*$/, "").trim())); continue; }
      if (cls(el, "tbl-wrap") || el.tagName === "TABLE") { readTable(el.tagName === "TABLE" ? el : el.querySelector("table")); continue; }
      if (el.tagName === "OL" && cls(el, "steps")) {
        var items = Array.prototype.map.call(el.children, function (li) {
          var b = li.querySelector(".body > b"), bt = txt(b), all = txt(li.querySelector(".body") || li);
          return { title: bt, body: all.replace(bt, "").trim() };
        });
        var longest = Math.max.apply(null, items.map(function (x) { return x.body.length; }));
        add(items.length <= 3 && longest < 70 ? Flow(items) : NumList(items)); continue;
      }
      if (el.tagName === "UL" && cls(el, "media")) {
        add(Grid(Array.prototype.map.call(el.children, function (li) {
          var a = li.querySelector("a"), sm = txt(li.querySelector("small")), parts = sm.split(" · "), k = parts.length > 2 ? 2 : 1;
          return { title: a ? txt(a) : txt(li.querySelector("b")), url: a && a.href, meta: parts.slice(0, k).join(" · "), body: parts.slice(k).join(" · "), raw: true };
        }), { cols: 2 })); continue;
      }
      if (el.tagName === "UL" || el.tagName === "OL") { add(Bullets(Array.prototype.map.call(el.querySelectorAll("li"), txt))); continue; }
      if (cls(el, "mission")) {
        var cards = [];
        while (i < kids.length && (cls(kids[i], "mission") || kids[i].tagName === "TEXTAREA" || cls(kids[i], "sol") || (cls(kids[i], "case") && cards.length))) {
          var k2 = kids[i];
          if (cls(k2, "mission")) cards.push({ title: txt(k2).replace(/^【(.)】/, "$1 · "), body: "", notes: [] });
          else if (k2.tagName === "TEXTAREA") cards[cards.length - 1].body = (k2.getAttribute("placeholder") || "").replace(/\s*\n\s*/g, " ");
          else if (cls(k2, "sol")) cards[cards.length - 1].notes.push(txt(k2).replace(/^해설\s*/, ""));
          else if (cls(k2, "case")) cards[cards.length - 1].extra = k2;
          i++;
        }
        i--;
        add(Grid(cards.map(function (c) { return { title: c.title, body: c.body ? c.body + "  ▸ 해설은 노트" : "", raw: true }; }), { cols: 2 }));
        cards.forEach(function (c) { if (c.notes.length) notes("[" + c.title + "] " + c.notes.join(" ")); });
        if (kids[i + 1] && cls(kids[i + 1], "ans-label")) {
          i++; add(Callout(txt(kids[i]), { raw: true, sticky: true }));
          while (kids[i + 1] && (kids[i + 1].tagName === "TEXTAREA" || cls(kids[i + 1], "teacher-only"))) { i++; if (cls(kids[i], "teacher-only")) notes(txt(kids[i])); }
        }
        cards.forEach(function (c) { if (c.extra) { newSlide(caseTitle(txt(c.extra.querySelector(".tag")))); add(rows2grid(c.extra.querySelectorAll("tbody tr"))); } });
        continue;
      }
      if (cls(el, "ans-label")) { add(Callout(txt(el), { raw: true, sticky: true })); continue; }
      if (el.tagName === "DETAILS") { notes(txt(el).replace(/^[^\n]*해설[^\n]*\n?/, "")); continue; }
      if (el.tagName === "TEXTAREA" || cls(el, "check-row") || el.tagName === "BUTTON") continue;
      if (isP(el)) {
        if (img) { var tt = txt(el); newSlide(tt.replace(/^다음 단원:\s*/, "다음 단원 · ").split(" — ")[0], { image: img, side: side }); add(Para(tt.split(" — ").slice(1).join(" — ") || tt)); continue; }
        if (cls(el, "see")) { add(Para(txt(el), { src: true, raw: true })); continue; }
        var pt = txt(el);
        if (cls(el, "note") && /^\(.*\)$/.test(pt)) { add(Para(pt, { src: true, raw: true })); continue; }
        paraWithDefs(el, true); continue;
      }
      if (el.tagName === "DIV" && el.children.length) { var t3 = txt(el); if (t3) add(Para(t3)); }
    }

    // 문단 + "…을 <b>용어</b>(이)라고 한다" 정의 문장을 회색 박스로
    function paraWithDefs(el, doAdd) {
      var pt = txt(el), defs = [];
      Array.prototype.forEach.call(el.querySelectorAll("b"), function (bEl) {
        var term = txt(bEl); if (!term || term.length > 30) return;
        var sents = pt.split(/(?<=[.!?])\s+/), esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        for (var si = 0; si < sents.length; si++) {
          if (new RegExp(esc + "\\s*(\\([^)]*\\))?\\s*(이)?라고\\s*(한다|부른다|합니다|부릅니다)\\.?$").test(sents[si])) { defs.push({ term: term, text: sents[si] }); sents.splice(si, 1); pt = sents.join(" "); break; }
        }
      });
      var blocks = [];
      if (pt) blocks.push(Para(pt));
      defs.forEach(function (d) { blocks.push(Callout(d.text, { lead: d.term.replace(/\(.*\)$/, "").trim() })); });
      if (doAdd || blocks.length > 1) { blocks.forEach(add); return { kind: "none", measure: function () { return 0; }, draw: function () {} }; }
      return blocks[0];
    }
    function readTable(table) {
      if (!table) return;
      var cap = txt(table.querySelector("caption"));
      var head = Array.prototype.map.call(table.querySelectorAll("thead th"), txt);
      var rows = Array.prototype.map.call(table.querySelectorAll("tbody tr"), function (tr) { return Array.prototype.map.call(tr.children, txt); });
      if (!head.length && rows.length) head = rows.shift();
      add(Table(head, rows, cap));
    }
    slides.forEach(function (s) { if (s.blocks) s.blocks = s.blocks.filter(function (b) { return b.kind !== "none"; }); });
    return { meta: meta, slides: slides.filter(function (s) { return s.type === "cover" || s.blocks.length || s.notes.length || s.type === "split"; }) };
  }

  // ── 쪽 나누기: 제목 + 블록 묶음이 세로 6.26in 안에 들어가게 ─────────
  var AVAIL = H - MINTOP * 2;  // 6.26in
  function blocksH(bs, w) { return bs.reduce(function (a, b, i) { return a + b.measure(w) + (i ? GAP.block : 0); }, 0); }
  function titleH(t, w) { return hgt(t, w, S.title, L.title, "head"); }
  function paginate(model) {
    var out = [];
    model.slides.forEach(function (s) {
      if (s.type === "cover") { out.push(s); return; }
      if (s.type === "split") {
        var sw = SPLIT.textW, room = AVAIL - titleH(s.title, SPLIT.titleW) - GAP.afterTitle, first = [], rest = [];
        s.blocks.forEach(function (b) { var bh = b.measure(sw) + (first.length ? GAP.block : 0); if (!rest.length && /para|bullets|callout/.test(b.kind) && bh <= room) { first.push(b); room -= bh; } else rest.push(b); });
        out.push({ type: "split", title: s.title, image: s.image, side: s.side, blocks: first, notes: s.notes });
        if (!rest.length) return;
        s = { type: "content", title: s.title, blocks: rest, notes: [] };
      }
      var n = 1, page = { type: "content", title: s.title, blocks: [], notes: s.notes.slice() };
      out.push(page);
      var used = titleH(page.title, CW) + GAP.afterTitle;
      var q = s.blocks.slice();
      function next() { n++; page = { type: "content", title: s.title + " (" + n + ")", blocks: [], notes: [] }; out.push(page); used = titleH(page.title, CW) + GAP.afterTitle; }
      while (q.length) {
        var b = q.shift(), h = b.measure(CW) + (page.blocks.length ? GAP.block : 0);
        if (b.src && (page.blocks.length || out.length > 1)) { (page.blocks.length ? page : out[out.length - 2]).blocks.push(b); used += h; continue; }
        if (b.sticky && page.blocks.length && used + h <= AVAIL + 0.4) { page.blocks.push(b); used += h; continue; }
        var keep = b.kind === "sub" && q[0] ? Math.min(q[0].measure(CW), 1.2) + GAP.block : 0;
        if (used + h <= AVAIL + 0.3 && !keep) { page.blocks.push(b); used += h; continue; }   // 0.3in 이내 넘침은 한 장에 둠
        if (used + h + keep > AVAIL && page.blocks.length) {
          var parts = b.split ? b.split(CW, AVAIL - used - GAP.block) : null;
          if (parts && b.kind !== "sub") { page.blocks.push(parts[0]); q.unshift(parts[1]); next(); continue; }
          next(); h = b.measure(CW);
        } else if (used + h > AVAIL && b.split) {
          var p2 = b.split(CW, AVAIL - used); if (p2) { page.blocks.push(p2[0]); q.unshift(p2[1]); next(); continue; }
        }
        page.blocks.push(b); used += h;
      }
    });
    return merge(out);
  }
  // 같은 절의 짧은 쪽(문단 하나뿐인 2.1·2.2 등)은 한 장으로 합침
  function merge(pages) {
    var res = [];
    var sec = function (t) { var m = String(t || "").match(/^(\d+)\.\d+\s/); return m && m[1]; };
    pages.forEach(function (p) {
      var prev = res[res.length - 1];
      if (prev && prev.type === "content" && p.type === "content" && !/\(\d+\)$/.test(p.title) && !/\(\d+\)$/.test(prev.title) && (prev.merged || 0) < 2 &&
          sec(p.title) && sec(p.title) === sec(prev.title)) {
        var sb = Sub(p.title), a = blocksH(prev.blocks, CW), b = blocksH(p.blocks, CW);
        if (a < 2.0 && b < 2.0 && titleH(prev.title, CW) + GAP.afterTitle + a + GAP.block + sb.measure(CW) + GAP.block + b <= AVAIL) {
          prev.blocks.push(sb); prev.blocks = prev.blocks.concat(p.blocks); prev.notes = prev.notes.concat(p.notes || []); prev.merged = (prev.merged || 0) + 1; return;
        }
      }
      res.push(p);
    });
    return res;
  }

  // ── 그리기 ──────────────────────────────
  var SPLIT = { imgW: 5.0, titleW: 5.2, textW: 6.93 };
  function fetchData(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.blob(); }).then(function (b) {
      return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); });
    }).catch(function () { return null; });
  }
  function abs(u) { try { return new URL(u, location.href).href; } catch (e) { return u; } }

  // deck: PptxGenJS(파일 저장) 또는 HtmlDeck(브라우저 발표). 두 경우 모두 같은 그리기 명령을 받는다.
  function render(pages, meta, images, deck) {
    var pptx = deck || new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.title = meta.title; pptx.subject = meta.kicker; pptx.author = "교과서 포털";
    pptx.theme = { headFontFace: F.head, bodyFontFace: F.body };
    var bg = images.bg ? { data: images.bg } : { color: "FCFCFB" };
    var split = 0;

    pages.forEach(function (p) {
      var s = pptx.addSlide();
      s.background = bg;
      if (p.type === "cover") {
        var im = images[p.meta.cover], tw = im ? 5.3 : 9.0;
        var tl = hgt(p.meta.title, tw, S.cover, L.cover, "head");
        var total = tl + 0.28 + (p.meta.question ? 0.78 : 0) + (p.meta.kicker ? 0.47 : 0) + (p.meta.date ? 0.28 : 0);
        var y = Math.max(MINTOP, (H - total) / 2);
        txtBox(s, p.meta.title, ML, y, tw, S.cover, L.cover, { fontFace: F.head, color: C.title }); y += tl + 0.28;
        if (p.meta.question) { txtBox(s, p.meta.question, ML, y, tw + 1.6, S.coverSub, 0.45, { fontFace: F.head, color: C.title }); y += 0.78; }
        if (p.meta.kicker) { txtBox(s, p.meta.kicker, ML, y, tw + 1.6, S.body, L.body); y += 0.47; }
        if (p.meta.date) txtBox(s, p.meta.date, ML, y, tw + 1.6, S.body, L.body);
        if (im) s.addImage({ data: im, x: W - SPLIT.imgW, y: 0, w: SPLIT.imgW, h: H });
        return;
      }
      if (p.type === "split") {
        var data = images[p.image], left = p.side ? p.side === "left" : split % 2 === 1; split++;
        var tx = left ? 5.70 : ML, tw2 = SPLIT.textW;
        if (data) s.addImage({ data: data, x: left ? 0 : W - SPLIT.imgW, y: 0, w: SPLIT.imgW, h: H });
        var total = titleH(p.title, SPLIT.titleW) + (p.blocks.length ? GAP.afterTitle + blocksH(p.blocks, tw2) : 0);
        var y1 = Math.max(MINTOP, (H - total) / 2);
        y1 += txtBox(s, p.title, tx, y1, SPLIT.titleW, S.title, L.title, { fontFace: F.head, color: C.title }) + GAP.afterTitle;
        p.blocks.forEach(function (b, i) { if (i) y1 += GAP.block; b.draw(s, tx, y1, tw2); y1 += b.measure(tw2); });
        if (p.notes && p.notes.length) s.addNotes(p.notes.join("\n\n"));
        return;
      }
      var tot = titleH(p.title, CW) + GAP.afterTitle + blocksH(p.blocks, CW);
      var yy = Math.max(MINTOP, (H - tot) / 2);
      yy += txtBox(s, p.title, ML, yy, CW, S.title, L.title, { fontFace: F.head, color: C.title }) + GAP.afterTitle;
      p.blocks.forEach(function (b, i) { if (i) yy += GAP.block; b.draw(s, ML, yy, CW); yy += b.measure(CW); });
      if (p.notes && p.notes.length) s.addNotes(p.notes.join("\n\n"));
    });
    return pptx;
  }

  // 라틴 글꼴(Gelasio·Lato)과 한글 글꼴(Noto Sans KR)을 나눠 지정
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
    var model = build(), pages = paginate(model);
    var want = { bg: BASE + "pptx/bg.png" };
    pages.forEach(function (p) { if (p.type === "cover" && p.meta.cover) want[p.meta.cover] = abs(p.meta.cover); if (p.image) want[p.image] = abs(p.image); });
    var keys = Object.keys(want);
    return Promise.all(keys.map(function (k) { return fetchData(want[k]); })).then(function (vals) {
      var images = {}; keys.forEach(function (k, i) { images[k] = vals[i]; });
      var name = (model.meta.title || "slides").replace(/[\\/:*?"<>|]/g, "") + ".pptx";
      return fixFonts(render(pages, model.meta, images), name).then(function (r) { r.count = pages.length; return r; });
    });
  }

  // ── HTML 발표: PptxGenJS와 같은 그리기 명령을 DOM으로 옮긴다(1in = 100px 무대) ──────────
  var PX = 100;
  function px(v) { return (v * PX).toFixed(2) + "px"; }
  function ptpx(v) { return (v * PX / 72).toFixed(3) + "px"; }
  function fam(face) { return face === F.head ? "'Gelasio','Noto Sans KR',serif" : "'Lato','Noto Sans KR',sans-serif"; }
  function HtmlDeck() { this.slides = []; }
  HtmlDeck.prototype.addSlide = function () { var sl = new HtmlSlide(); this.slides.push(sl); return sl; };
  function HtmlSlide() {
    var el = document.createElement("div"); el.className = "tbp-slide"; this.el = el; this.notes = "";
    Object.defineProperty(this, "background", { set: function (v) { if (v && v.data) el.style.backgroundImage = "url(" + v.data + ")"; else if (v && v.color) el.style.background = "#" + v.color; } });
  }
  HtmlSlide.prototype.box = function (o, tag) {
    var d = document.createElement(tag || "div");
    d.style.cssText = "position:absolute;left:" + px(o.x) + ";top:" + px(o.y) + ";width:" + px(o.w) + ";height:" + px(o.h || 0) + ";";
    this.el.appendChild(d); return d;
  };
  // 브라우저는 줄 상자 안에서 글자를 PowerPoint보다 위쪽에 그린다. 레퍼런스와 같은 높이가 되도록 보정(실측 회귀식).
  function htmlShift(pt, lsPt) { return (-0.032 * pt + 0.3447 * (lsPt || pt * 1.2)) / 72; }
  HtmlSlide.prototype.addText = function (text, o) {
    var d = this.box(Object.assign({}, o, { y: o.y + htmlShift(o.fontSize || 12, o.lineSpacing) }));
    d.className = "tbp-t";
    d.style.fontFamily = fam(o.fontFace); d.style.fontSize = ptpx(o.fontSize || 12);
    d.style.lineHeight = o.lineSpacing ? ptpx(o.lineSpacing) : "1.2"; d.style.color = "#" + (o.color || "000");
    d.style.textAlign = o.align || "left";
    if (o.bold) d.style.fontWeight = "700";
    var runs = typeof text === "string" ? [{ text: text, options: {} }] : text;
    runs.forEach(function (r) {
      var op = r.options || {}, sp;
      if (op.hyperlink || o.hyperlink) { sp = document.createElement("a"); sp.href = (op.hyperlink || o.hyperlink).url; sp.target = "_blank"; sp.rel = "noopener"; }
      else sp = document.createElement("span");
      sp.textContent = r.text;
      if (op.bold) sp.style.fontWeight = "700";
      if (op.underline || o.underline) sp.style.textDecoration = "underline";
      d.appendChild(sp);
      if (op.breakLine) d.appendChild(document.createElement("br"));
    });
  };
  HtmlSlide.prototype.addShape = function (type, o) {
    if (type === "line") {
      var l = this.box({ x: o.x, y: o.y, w: o.w || 0, h: o.h || 0 }), c = "#" + ((o.line && o.line.color) || "000"), lw = ptpx((o.line && o.line.width) || 1);
      if (o.w) { l.style.borderTop = lw + " solid " + c; l.style.height = "0"; } else { l.style.borderLeft = lw + " solid " + c; l.style.width = "0"; }
      return;
    }
    var d = this.box(o);
    d.style.boxSizing = "border-box";
    if (o.fill && o.fill.color && o.fill.type !== "none") d.style.background = "#" + o.fill.color;
    if (o.line && o.line.width) d.style.border = ptpx(o.line.width) + " solid #" + o.line.color;
    if (type === "roundRect") d.style.borderRadius = px(o.rectRadius || 0.05);
    if (type === "ellipse") d.style.borderRadius = "50%";
  };
  HtmlSlide.prototype.addImage = function (o) {
    var im = this.box(o, "img"); im.src = o.data || o.path; im.alt = ""; im.style.objectFit = "cover";
  };
  HtmlSlide.prototype.addTable = function (data, o) {
    var t = this.box({ x: o.x, y: o.y, w: o.w, h: 0 }, "table");
    t.className = "tbp-tbl"; t.style.height = "auto";
    var m = o.margin || [0, 0, 0, 0], bc = "#" + ((o.border && o.border[0] && o.border[0].color) || "B3B3B3");
    t.style.fontFamily = fam(o.fontFace); t.style.fontSize = ptpx(o.fontSize); t.style.lineHeight = ptpx(o.lineSpacing || o.fontSize * 1.2); t.style.color = "#" + (o.color || "000");
    var cg = document.createElement("colgroup"); (o.colW || []).forEach(function (w) { var c = document.createElement("col"); c.style.width = px(w); cg.appendChild(c); }); t.appendChild(cg);
    data.forEach(function (row, ri) {
      var tr = document.createElement("tr"); tr.style.height = px((o.rowH || [])[ri] || 0.4);
      row.forEach(function (cell) {
        var td = document.createElement("td");
        td.style.cssText = "border:" + ptpx(0.75) + " solid " + bc + ";padding:" + ptpx(m[0]) + " " + ptpx(m[1]) + " " + ptpx(m[2]) + " " + ptpx(m[3]) + ";vertical-align:top;white-space:pre;background:#fff;";
        if (cell.options && cell.options.bold) td.style.fontWeight = "700";
        td.textContent = cell.text; tr.appendChild(td);
      });
      t.appendChild(tr);
    });
  };
  HtmlSlide.prototype.addNotes = function (t) { this.notes = t; };

  var CSS = [
    ".tbp-view{position:fixed;inset:0;z-index:9999;background:#1d1d1b;display:flex;flex-direction:column;color:#eee;font-family:'Lato','Noto Sans KR',sans-serif}",
    ".tbp-stage{flex:1;position:relative;overflow:hidden;touch-action:pan-y}",
    ".tbp-slide{position:absolute;left:50%;top:50%;width:1333.3px;height:750px;transform-origin:0 0;background:#fcfcfb center/cover no-repeat;box-shadow:0 10px 40px rgba(0,0,0,.4);overflow:hidden;color:#272525}",
    ".tbp-slide[hidden]{display:none}",
    ".tbp-t{white-space:pre;overflow:visible;margin:0;padding:0}",
    ".tbp-t a{color:inherit}",
    ".tbp-tbl{border-collapse:collapse;table-layout:fixed}",
    ".tbp-bar{display:flex;align-items:center;gap:10px;padding:8px max(14px,env(safe-area-inset-right,0px)) calc(8px + env(safe-area-inset-bottom,0px)) max(14px,env(safe-area-inset-left,0px));background:#141413;font-size:13px}",
    ".tbp-bar button{font:inherit;background:#2c2c29;color:#eee;border:1px solid #444;border-radius:6px;padding:6px 12px;cursor:pointer}",
    ".tbp-bar button:hover{background:#3a3a36}",
    ".tbp-bar button:focus-visible{outline:2px solid #e8c37a;outline-offset:2px}",
    ".tbp-count{min-width:5em;text-align:center;font-variant-numeric:tabular-nums}",
    ".tbp-title{flex:1;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".tbp-notes{max-height:28vh;overflow:auto;background:#262624;padding:12px 18px;font-size:15px;line-height:1.7;white-space:pre-wrap;border-top:1px solid #333}",
    ".tbp-notes[hidden]{display:none}",
    ".tbp-hit{position:absolute;top:0;bottom:0;width:30%;cursor:pointer}",
    "@media print{.tbp-view{display:none}}"
  ].join("\n");
  function ensureFonts() {
    if (document.getElementById("tbp-fonts")) return;
    var l = document.createElement("link"); l.id = "tbp-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Gelasio:wght@400;700&family=Lato:wght@400;700&family=Noto+Sans+KR:wght@400;700&display=swap";
    document.head.appendChild(l);
    var st = document.createElement("style"); st.id = "tbp-css"; st.textContent = CSS; document.head.appendChild(st);
  }

  function present(startAt) {
    ensureFonts();
    var model = build(), pages = paginate(model);
    var images = { bg: BASE + "pptx/bg.png" };
    pages.forEach(function (p) { if (p.type === "cover" && p.meta.cover) images[p.meta.cover] = abs(p.meta.cover); if (p.image) images[p.image] = abs(p.image); });
    var deck = render(pages, model.meta, images, new HtmlDeck());

    var view = document.createElement("div"); view.className = "tbp-view"; view.setAttribute("role", "dialog"); view.setAttribute("aria-label", model.meta.title + " 슬라이드");
    view.innerHTML = '<div class="tbp-stage"></div><div class="tbp-notes" hidden></div>' +
      '<div class="tbp-bar"><button type="button" data-k="close" title="닫기 (Esc)">✕ 닫기</button><span class="tbp-title"></span>' +
      '<button type="button" data-k="prev" title="이전 (←)">◀</button><span class="tbp-count"></span><button type="button" data-k="next" title="다음 (→, Space)">▶</button>' +
      '<button type="button" data-k="notes" title="발표자 노트 (N)">노트</button><button type="button" data-k="full" title="전체 화면 (F)">전체 화면</button></div>';
    var stage = view.querySelector(".tbp-stage"), notesEl = view.querySelector(".tbp-notes");
    view.querySelector(".tbp-title").textContent = model.meta.title;
    deck.slides.forEach(function (sl) { sl.el.hidden = true; stage.appendChild(sl.el); });
    var hl = document.createElement("div"); hl.className = "tbp-hit"; hl.style.left = "0"; hl.dataset.k = "prev";
    var hr = document.createElement("div"); hr.className = "tbp-hit"; hr.style.right = "0"; hr.dataset.k = "next";
    stage.appendChild(hl); stage.appendChild(hr);
    document.body.appendChild(view);
    var prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = "hidden";

    var i = Math.max(0, Math.min(deck.slides.length - 1, startAt || 0));
    function fit() {
      var r = stage.getBoundingClientRect(), k = Math.min((r.width - 24) / 1333.3, (r.height - 24) / 750);
      deck.slides.forEach(function (sl) { sl.el.style.transform = "translate(" + (-1333.3 * k / 2) + "px," + (-750 * k / 2) + "px) scale(" + k + ")"; });
    }
    function show(n) {
      i = Math.max(0, Math.min(deck.slides.length - 1, n));
      deck.slides.forEach(function (sl, j) { sl.el.hidden = j !== i; });
      view.querySelector(".tbp-count").textContent = (i + 1) + " / " + deck.slides.length;
      notesEl.textContent = deck.slides[i].notes || "이 슬라이드에는 노트가 없습니다.";
    }
    function close() {
      document.removeEventListener("keydown", key); window.removeEventListener("resize", fit);
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      view.remove(); document.documentElement.style.overflow = prevOverflow;
    }
    function act(k) {
      if (k === "next") show(i + 1); else if (k === "prev") show(i - 1); else if (k === "close") close();
      else if (k === "notes") { notesEl.hidden = !notesEl.hidden; fit(); }
      else if (k === "full") { if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); else if (view.requestFullscreen) view.requestFullscreen().catch(function () {}); }
    }
    function key(e) {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      var k = e.key;
      if (k === "ArrowRight" || k === "PageDown" || k === " " || k === "Enter") { e.preventDefault(); act("next"); }
      else if (k === "ArrowLeft" || k === "PageUp" || k === "Backspace") { e.preventDefault(); act("prev"); }
      else if (k === "Home") show(0); else if (k === "End") show(deck.slides.length - 1);
      else if (k === "Escape" && !document.fullscreenElement) close();
      else if (k === "f" || k === "F") act("full"); else if (k === "n" || k === "N") act("notes");
    }
    view.addEventListener("click", function (e) { var t = e.target.closest("[data-k]"); if (t) act(t.dataset.k); });
    var tx = null;
    stage.addEventListener("touchstart", function (e) { tx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", function (e) { if (tx === null) return; var dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) act(dx < 0 ? "next" : "prev"); tx = null; });
    document.addEventListener("keydown", key); window.addEventListener("resize", fit);
    document.addEventListener("fullscreenchange", fit);
    fit(); show(i);
    view.querySelector('[data-k="next"]').focus();
    return { count: deck.slides.length };
  }

  window.TBPptx = { exportPptx: exportPptx, present: present, _build: build, _paginate: paginate, _eum: eum };
})();
