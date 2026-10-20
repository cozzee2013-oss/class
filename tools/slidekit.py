"""슬라이드 보기 생성 도구.

decks_a.py · decks_b.py 의 DECK 정의를 읽어 slides/<이름>.html 을 만든다.
사용: python3 tools/build_slides.py

디자인: 「기본권의 개념과 연혁」 강의 슬라이드 형식(16:9, Noto Sans KR)
  - 미색 바탕 + 짙은 남색 슬라이드(표지·질문·사례·마무리)
  - 테라코타 강조, 01·02·03 번호 목록, 하단 출처 줄과 두 자리 쪽번호
"""
import re

COURSE = "헌법과 기본권"


# ---------- 본문 구성 요소 ----------
def pill(label):
    return f'<div class="lbl">{label}</div>'


def chk(items, box=False):
    cls = "nums box" if box else "nums"
    return f'<ol class="{cls}">' + "".join(f"<li><span>{x}</span></li>" for x in items) + "</ol>"


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
    body = "".join(f"<tr><th>{k}</th><td>{v}</td></tr>" for k, v in rows)
    return f'<div class="cite">{cite}</div><table class="t case"><tbody>{body}</tbody></table>'


def law(title, text):
    return f'<div class="law"><div class="lt">{title}</div><div class="lx">{text}</div></div>'


def ask(tag, text):
    return f'<div class="ask"><div class="tag">{tag}</div><div class="aq">{text}</div></div>'


def flow(items):
    return '<ol class="flow">' + "".join(f"<li><b>{a}</b><span>{b}</span></li>" for a, b in items) + "</ol>"


def cols(a, b):
    return f'<div class="cols">{a}{b}</div>'


def card(title, inner, panel=False):
    return f'<div class="card"><h4>{title}</h4><div>{inner}</div></div>'


def p(text, cls=""):
    c = f' class="{cls}"' if cls else ""
    return f"<div{c}>{text}</div>"


def note(text):
    return p(text, "note")


def panel(text):
    return f'<div class="take">{text}</div>'


# ---------- 슬라이드 ----------
FOOT = '<footer class="foot"><span>@@FOOT@@</span><span class="pg"></span></footer>'


def s_cover(kicker, title, sub, two=False):
    return (
        '<section class="slide dark cover">'
        f'<div class="ck">{kicker}</div><h1>{title}</h1><div class="sub">{sub}</div>'
        f'{FOOT}</section>'
    )


def s_index(items):
    lis = "".join(
        f'<li><span class="no">{k:02d}</span><span class="tg">{tag}</span><span class="nm">{name}</span></li>'
        for k, (tag, name) in enumerate(items)
    )
    return (
        '<section class="slide index"><h2>오늘의 순서</h2>'
        f'<ol class="toc" style="grid-template-rows:repeat({(len(items)+1)//2},auto)">{lis}</ol>{FOOT}</section>'
    )


def s_content(kicker, title, body, small=""):
    sm = f" <small>{small}</small>" if small else ""
    # 첫 요소가 질문(ask)이면 짙은 슬라이드로
    dark = body.lstrip().startswith('<div class="ask"')
    cls = "slide dark q" if dark else "slide"
    k = re.sub(r"<small>.*?</small>", "", kicker).strip()
    return (
        f'<section class="{cls}"><div class="kk">{k}</div><h2>{title}{sm}</h2>'
        f'<div class="body">{body}</div>{FOOT}</section>'
    )


def s_end(msg):
    return (
        '<section class="slide dark end"><h2>단원을 마치며</h2>'
        f'<div class="nx">{msg}</div>{FOOT}</section>'
    )


PAGE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} · 슬라이드 · {course}</title>
<meta name="theme-color" content="#202531">
<link rel="manifest" href="../manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="../assets/icons/icon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="../assets/icons/icon-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap">
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
    foot = f'{COURSE}&nbsp;&nbsp;/&nbsp;&nbsp;{deck["title"]}&nbsp;&nbsp;·&nbsp;&nbsp;{deck.get("week", "")}'
    slides = "\n".join(s.replace("@@FOOT@@", foot) for s in deck["slides"])
    return PAGE.format(title=re.sub(r"<[^>]+>", "", deck["title"]), course=COURSE, chapter=deck["chapter"], slides=slides)
