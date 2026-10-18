# 전기와 자기 · 빈칸 학습실

**시험 완벽대비! 개념 점검, 빈칸을 채우자**

공개 학습 주소: https://scienceisjo.github.io/electric-recall/

@science_is_jo · 조승재(과학이조선생) · 해누리중학교

## 제공 기능

- 인스타 가로형 14장, 손글씨 단권화 6쪽을 원래 모양 그대로 학습합니다.
- 빈칸 난이도 하·중·상, 클릭하여 답 확인, 외웠음·다시 보기 표시를 제공합니다.
- 전체화면 보기와 종료를 지원합니다. 지원하지 않는 브라우저에서는 집중모드로 넓혀 봅니다.
- 학습 기록은 사용 중인 브라우저의 localStorage에만 저장합니다.
- 상·중·하 빈칸 PDF 18종, 정답 PDF 2종과 ZIP 묶음을 다운로드합니다.

## 배포와 수정

단일 HTML/JavaScript 앱입니다. 별도의 빌드 없이 `index.html`, `favicon.svg`, `downloads/`를 GitHub Pages에서 제공합니다.
GitHub Pages의 게시 소스는 `main` 브랜치의 `/`입니다. `.nojekyll`을 유지합니다.
로컬 확인: `python -m http.server 7114`를 실행하고 `http://127.0.0.1:7114/`를 엽니다.

## 방문자 집계

GitHub Pages는 정적 호스팅이므로 방문 집계 API만 기존 Cloudflare D1 서버를 사용합니다.
API: `https://science-is-jo-electric-recall.alpaca-teach-4097.chatgpt.site/api/visits`

같은 브라우저는 한국 시간 기준 하루에 한 번 집계합니다. 누적 수는 날짜별 방문 수의 합입니다.
이름·학번·학습 기록은 전송하지 않습니다. 날짜별 중복 방지를 위한 무작위 브라우저 식별자만 전송하고,
서버에는 날짜와 결합한 해시를 저장합니다. 이 저장소에는 접속 기록·DB·인증 정보가 없습니다.

`server/`는 집계 서버 소스의 보관본이며 GitHub Pages에서 실행되지 않습니다.
서버는 원래 사이트와 `https://scienceisjo.github.io` 출처만 허용합니다.
이전 Sites 주소는 새 GitHub Pages 주소로 이동하도록 연결합니다.
이전 주소와 새 주소는 브라우저 저장 공간이 달라 기존 개인 학습 기록은 자동 이전되지 않습니다.

## 저작권

© 2026 조승재(과학이조선생) · 해누리중학교 · All rights reserved.
