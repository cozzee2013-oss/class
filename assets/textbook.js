/* 헌법과 기본권 · HTML 교재 도구 막대
   - 편집: [data-editable] 영역을 바로 고칠 수 있음 (이 브라우저에 저장)
   - HTML 내려받기: 고친 내용을 반영한 파일을 받아 GitHub에 그대로 올리면 교재가 갱신됨
   - 인쇄/PDF: 브라우저 인쇄 창에서 'PDF로 저장' 선택
   - 학습지 칸(입력·체크)은 이 브라우저에 자동 저장 */
(function () {
  var PATH = location.pathname.replace(/index\.html$/, "");
  var K_EDIT = "tb-edit:" + PATH;
  var K_ANS = "tb-ans:" + PATH;

  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  }

  var regions = Array.prototype.slice.call(document.querySelectorAll("[data-editable]"));

  // 1) 저장된 편집본 불러오기
  try {
    var saved = JSON.parse(store(K_EDIT) || "null");
    if (saved && saved.length === regions.length) {
      regions.forEach(function (r, i) { r.innerHTML = saved[i]; });
    }
  } catch (e) {}

  // 2) 학습지 입력값 자동 저장
  function fields() {
    return Array.prototype.slice.call(document.querySelectorAll("textarea.ans, .namerow input, .check input, .quiz input"));
  }
  var bound = typeof WeakSet === "function" ? new WeakSet() : { has: function () { return false; }, add: function () {} };
  function bindAnswers() {
    var data = {};
    try { data = JSON.parse(store(K_ANS) || "{}"); } catch (e) {}
    fields().forEach(function (el, i) {
      var id = el.id || el.name && (el.name + ":" + el.value) || ("f" + i);
      if (el.type === "checkbox" || el.type === "radio") {
        if (data[id]) el.checked = true;
      } else if (data[id] != null) {
        el.value = data[id];
      }
      if (bound.has(el)) return;
      bound.add(el);
      el.addEventListener(el.tagName === "TEXTAREA" || el.type === "text" ? "input" : "change", function () {
        var d = {};
        try { d = JSON.parse(store(K_ANS) || "{}"); } catch (e) {}
        if (el.type === "radio") {
          document.querySelectorAll('input[name="' + el.name + '"]').forEach(function (o) { delete d[o.name + ":" + o.value]; });
          d[id] = true;
        } else if (el.type === "checkbox") {
          d[id] = el.checked;
        } else {
          d[id] = el.value;
        }
        store(K_ANS, JSON.stringify(d));
      });
    });
  }
  bindAnswers();

  // 3) 도구 막대
  var banner = document.createElement("div");
  banner.className = "edit-banner";
  banner.textContent = "편집 모드 — 글을 눌러 바로 고치세요. 다 고쳤으면 ‘저장’을 누르세요. (Ctrl+S)";
  document.body.insertBefore(banner, document.body.firstChild);

  var bar = document.createElement("div");
  bar.className = "toolbar";
  bar.innerHTML =
    '<button type="button" data-act="edit" title="교재 내용 편집">✎ 편집</button>' +
    '<button type="button" data-act="save" class="primary" hidden>저장</button>' +
    '<button type="button" data-act="cancel" hidden>취소</button>' +
    '<button type="button" data-act="more" title="편집본 관리">⋯</button>' +
    '<button type="button" data-act="download" hidden title="편집 내용을 반영한 HTML 파일 받기">HTML 내려받기</button>' +
    '<button type="button" data-act="reset" hidden title="편집 전 원본으로 되돌리기">원본으로</button>' +
    '<button type="button" data-act="print" class="primary" title="인쇄 또는 PDF로 저장">인쇄 / PDF</button>';
  document.body.appendChild(bar);

  var toast = document.createElement("div");
  toast.className = "toast";
  document.body.appendChild(toast);
  function say(msg) {
    toast.textContent = msg; toast.classList.add("show");
    clearTimeout(say.t); say.t = setTimeout(function () { toast.classList.remove("show"); }, 2200);
  }

  var btn = function (a) { return bar.querySelector('[data-act="' + a + '"]'); };
  var before = null;

  function setEditing(on) {
    document.body.classList.toggle("editing", on);
    regions.forEach(function (r) { r.contentEditable = on ? "true" : "false"; if (!on) r.removeAttribute("contenteditable"); });
    btn("edit").hidden = on;
    btn("save").hidden = !on;
    btn("cancel").hidden = !on;
    btn("print").hidden = on;
    btn("more").hidden = on;
    // 편집 중에는 학습지 칸 잠금(내용 편집과 섞이지 않게)
    fields().forEach(function (el) { el.disabled = on; });
  }

  function save() {
    setEditing(false);
    store(K_EDIT, JSON.stringify(regions.map(function (r) { return r.innerHTML; })));
    bindAnswers();
    say("이 브라우저에 저장했어요. GitHub에 반영하려면 ⋯ → HTML 내려받기");
  }

  function download() {
    var doc = document.documentElement.cloneNode(true);
    ["toolbar", "edit-banner", "toast"].forEach(function (c) {
      doc.querySelectorAll("." + c).forEach(function (n) { n.remove(); });
    });
    doc.querySelector("body").classList.remove("editing");
    doc.querySelectorAll("[contenteditable]").forEach(function (n) { n.removeAttribute("contenteditable"); });
    doc.querySelectorAll("[disabled]").forEach(function (n) { n.removeAttribute("disabled"); });
    doc.querySelectorAll("textarea").forEach(function (t) { t.textContent = ""; });
    doc.querySelectorAll("input").forEach(function (i) { i.removeAttribute("value"); i.removeAttribute("checked"); });
    var html = "<!doctype html>\n" + doc.outerHTML;
    var name = decodeURIComponent(location.pathname.split("/").pop() || "index.html");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    say("‘" + name + "’ 파일을 GitHub의 같은 위치에 올리면 교재가 바뀌어요");
  }

  bar.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var act = b.dataset.act;
    if (act === "edit") {
      before = regions.map(function (r) { return r.innerHTML; });
      setEditing(true);
      regions[0] && regions[0].focus();
    } else if (act === "save") {
      save();
    } else if (act === "cancel") {
      if (before) regions.forEach(function (r, i) { r.innerHTML = before[i]; });
      setEditing(false); bindAnswers();
      say("편집을 취소했어요");
    } else if (act === "more") {
      var open = btn("download").hidden;
      btn("download").hidden = !open;
      btn("reset").hidden = !open;
    } else if (act === "download") {
      download();
    } else if (act === "reset") {
      if (store(K_EDIT) == null) { say("저장된 편집본이 없어요"); return; }
      store(K_EDIT, null);
      location.reload();
    } else if (act === "print") {
      window.print();
    }
  });

  // 편집 중 붙여넣기는 서식 없이
  regions.forEach(function (r) {
    r.addEventListener("paste", function (e) {
      if (!document.body.classList.contains("editing")) return;
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, t);
    });
  });

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && document.body.classList.contains("editing")) {
      e.preventDefault(); save();
    }
  });
})();
