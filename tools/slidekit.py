"""슬라이드 보기 생성 도구.

decks/*.py 의 DECK 정의를 읽어 slides/<이름>.html 을 만든다.
사용: python3 tools/build_slides.py
"""

COURSE = "헌법과 기본권"


def esc(s):
    return s  # 본문은 신뢰된 HTML 조각으로 작성한다


# ---------- 본문 구성 요소 ----------
def pill(label):
    return f'<span class="pill">{label}</span>'


def chk(items, box=False):
    cls = "chk box" if box else "chk"
    return f'<ul class="{cls}">' + "".join(f"<li>{x}</li>" for x in items) + "</ul>"


def group(label, items, box=False):
    return f'<div class="group">{pill(label)}{chk(items, box)}</div>'


def table(head, rows, sm=False, rowhead=True):
    h = "".join(f"<th>{x}</th>" for x in head)
    body = ""
    for r in rows:
        first = f"<th>{r[0]}</th>" if rowhead else f"<td>{r[0]}</td>"
        body += "<tr>" + first + "".join(f"<td>{x}</td>" for x in r[1:]) + "</tr>"
    cls = "t sm" if sm else "t"
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{body}</tbody></table>'


def case(cite, rows):
    cells = "".join(f'<div class="k">{k}</div><div>{v}</div>' for k, v in rows)
    return f'<div class="cite">{cite}</div><div class="case">{cells}</div>'


def law(title, text):
    return f'<div class="law"><span class="lt">{title}</span><div>{text}</div></div>'


def ask(tag, text):
    return f'<div class="ask"><span class="tag">{tag}</span><div>{text}</div></div>'


def flow(items):
    return '<div class="flow">' + "".join(f"<div><b>{a}</b>{b}</div>" for a, b in items) + "</div>"


def cols(a, b):
    return f'<div class="cols">{a}{b}</div>'


def card(title, inner, panel=False):
    cls = "panel" if panel else "card"
    return f'<div class="{cls}"><h4>{title}</h4>{inner}</div>'


def p(text, cls=""):
    c = f' class="{cls}"' if cls else ""
    return f"<div{c}>{text}</div>"


def note(text):
    return p(text, "note")


def panel(text):
    return f'<div class="panel">{text}</div>'


# ---------- 슬라이드 ----------
def s_cover(kicker, title, sub, two=False):
    cls = "slide cover two" if two else "slide cover"
    return (
        f'<section class="{cls}">'
        '<div class="band b1"></div><div class="band b2"></div><div class="band b3"></div>'
        '<div class="band b5"></div><div class="band b4"></div>'
        f'<div class="ck">{kicker}</div><h1>{title}</h1><div class="rule"></div><div class="sub">{sub}</div>'
        f'<div class="who">{COURSE} · 2026-2학기</div>'
        '<img class="wide" src="../assets/slide-logo-wide.png" alt="Forward ANU Together A&amp;U 국립안동대학교">'
        "</section>"
    )


def s_index(items):
    n = len(items)
    top0, span = 92, 560
    step = span / max(n - 1, 1)
    out = '<section class="slide index"><div class="slash"></div><div class="ttl">INDEX</div><div class="tl"></div>'
    for k, (tag, name) in enumerate(items):
        side = "r" if k % 2 == 0 else "l"
        top = round(top0 + k * step - 6)
        out += (
            f'<div class="it {side}" style="top:{top}px"><span class="ring"></span>'
            f'<span class="no">{k:02d}</span><div class="tag">{tag}</div><div class="nm">{name}</div></div>'
        )
    return out + '<div class="pg"></div></section>'


def s_content(kicker, title, body, small=""):
    sm = f"<small>{small}</small>" if small else ""
    return (
        '<section class="slide"><div class="slash"></div>'
        '<img class="logo" src="../assets/slide-logo.png" alt="">'
        f'<div class="kicker">{kicker}</div><div class="dot"></div><h2>{title}{sm}</h2>'
        f'<div class="body">{body}</div>'
        '<div class="corner"></div><div class="pg"></div></section>'
    )


def s_end(msg):
    return (
        '<section class="slide end"><div class="slash"></div>'
        f'<div class="box"><img src="../assets/slide-logo.png" alt="Forward ANU Together A&amp;U"><p>{msg}</p></div>'
        '<div class="corner"></div><div class="pg"></div></section>'
    )


PAGE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} · 슬라이드 · {course}</title>
<meta name="theme-color" content="#1f6aa5">
<link rel="manifest" href="../manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="../assets/icons/icon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="../assets/icons/icon-180.png">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css">
<link rel="stylesheet" href="../assets/slides.css">
<script src="../assets/pwa.js" defer></script>
</head>
<body>
<div class="viewer"><div class="deck">
{slides}
</div></div>
<nav class="bar" aria-label="슬라이드 넘기기">
  <a href="../{chapter}">교재로</a>
  <a class="wide-only" href="../heonbeop-gibongwon.html">목차</a>
  <span class="grow"></span>
  <button type="button" id="first" class="wide-only">처음</button>
  <button type="button" id="prev" aria-label="이전 슬라이드">◀</button>
  <span class="count" id="count" aria-live="polite">1 / 1</span>
  <button type="button" id="next" aria-label="다음 슬라이드">▶</button>
  <span class="grow"></span>
  <button type="button" id="fs" class="wide-only">전체화면</button>
</nav>
<script src="../assets/slides.js"></script>
</body>
</html>
"""


def render(deck):
    return PAGE.format(
        title=deck["title"], course=COURSE, chapter=deck["chapter"], slides="\n".join(deck["slides"])
    )
