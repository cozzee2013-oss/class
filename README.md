# 법학 교과서 포털 · HTML 교재

- `index.html` — 교과서 포털(헌법 / 행정법 / 기타 → 세부과목 → 15주차)
  - 과목·주차 제목·교재 링크는 파일 아래쪽 `CATS`, `TITLES`, `LINKS`에서 고칩니다.
- `heonbeop-gibongwon.html` — 헌법과 기본권(2026-2) 강의 소개와 주차별 목차
- `ch/01-2-essence.html` — 1주차 ② 기본권의 본질
- `ch/01-1-concept.html` ~ `ch/06-1-equality.html` — 1~6주차 단원(강의 원고를 교재 형식으로 재구성)
- `election/10-disinformation.html` — 선거법과 민주적 선거관리 10주차 「허위정보·가짜뉴스와 미디어 리터러시」 (주소 끝에 `#teacher`를 붙이면 교수자판: 빈칸 정답·해설·원문 대조 표시)
- `slides/*.html` — 단원별 슬라이드 보기(16:9, 「기본권의 개념과 연혁」 강의 슬라이드 형식). 내용은 `tools/decks_a.py`·`tools/decks_b.py`에서 고치고 `python3 tools/build_slides.py`로 다시 만듭니다.
- `assets/textbook.css`, `assets/textbook.js` — 공통 디자인과 도구 막대(편집·인쇄)

## PPT · PPT 저장 버튼 (교재 → 강의 슬라이드)
- **PPT**: 그 교재 본문으로 만든 16:9 슬라이드를 브라우저에서 바로 발표합니다. ←/→·Space로 넘기기, F 전체 화면, N 발표자 노트, Esc 닫기, 휴대폰은 좌우로 밀기.
- **PPT 저장**: 같은 슬라이드를 PowerPoint 파일(.pptx)로 내려받습니다. 두 버튼은 같은 배치 계산을 쓰므로 화면과 파일의 글자 크기·위치가 같습니다.
- 디자인은 「허위정보·가짜뉴스와 미디어 리터러시」 강의 슬라이드를 실측한 값(제목 31.5pt, 본문 12.6pt·줄 간격 0.28in, 카드 제목 15.8pt, 좌우 여백 0.70in, 세로 가운데 정렬 등)을 따릅니다.
- 본문의 서술체(~다/~습니다)는 개조식(~임/~함)으로 바뀌고, 해설은 발표자 노트로 들어갑니다. 교수자판(`#teacher`)에서 누르면 빈칸에 정답이 채워집니다.
- 일러스트: 교재 HTML의 `.titlebar`에 `data-pptx-cover="이미지"`, 절 제목(band·h3·문단)에 `data-pptx-image="이미지"`(좌우는 `data-pptx-side="left|right"`)를 붙이면 그 자리에 표지·분할 화면이 생깁니다(세로 2:3 이미지, `assets/pptx/`).
- 변환 규칙은 `assets/pptx-export.js`, 라이브러리는 `assets/vendor/pptxgen.bundle.js`(PptxGenJS 4.0.1, MIT)입니다.
- 글꼴: 제목 Gelasio, 본문 Lato, 한글 Noto Sans KR. 발표 화면은 Google Fonts에서 불러오고, 저장한 .pptx는 컴퓨터에 세 글꼴이 설치되어 있어야 똑같이 보입니다.

## 보는 법
GitHub Pages(Settings → Pages → Branch: `main` / root)를 켜면
`https://cozzee2013-oss.github.io/class/` 에서 볼 수 있습니다.

## 편집·인쇄
- **✎ 편집**: 본문을 바로 고치고 ‘저장’(Ctrl+S). 저장은 그 브라우저에만 남습니다.
- **⋯ → HTML 내려받기**: 고친 내용이 반영된 파일을 받아 저장소의 같은 위치에 올리면 모두에게 반영됩니다.
- **⋯ → 원본으로**: 그 브라우저의 편집본을 지웁니다.
- **인쇄 / PDF**: A4 학습지 레이아웃으로 인쇄됩니다(인쇄 창에서 ‘PDF로 저장’). 배경 그래픽 옵션을 켜 두세요.
- 학습지 빈칸·체크는 학생 브라우저에 자동 저장됩니다.

## 홈 화면 · 앱 설치
- 목차의 **앱 설치** 버튼을 누르면 지원 브라우저에서 설치창을 엽니다.
- iPhone/iPad는 Safari의 공유 메뉴 → **홈 화면에 추가**를 사용합니다.
- Android는 Chrome/삼성 인터넷의 설치 또는 홈 화면 추가 메뉴를 사용합니다.
- `manifest.webmanifest`와 `assets/icons/`가 앱 이름·아이콘·독립 화면 실행을 설정합니다.
- 서비스 워커는 사이트 경로 안의 교재만 저장하며, 온라인에서는 최신 원본을 먼저 가져옵니다.
- 새 오프라인 기본 교재를 추가할 때는 `sw.js`의 `SHELL`과 캐시 버전도 갱신합니다.
