# 실버 AI부트캠프 (Silver AI Bootcamp) — SNS 크로스포스팅 채널

`silver-ai-bootcamp` 카테고리 글이 자동으로 발행되는 모든 채널 정리. 원본은 https://ai119.netlify.app/blog (카테고리: 실버 AI부트캠프).

| 채널 | 주소 | 계정 상태 | 발행 방식 | 주기 |
|---|---|---|---|---|
| Blogger | https://silveraibootcamp.blogspot.com/ | 새 Google 계정/Cloud 프로젝트 (기존 trending/classics 계정은 write-block 상태) | 즉시 발행 없음, 스케줄러 전용 | 1시간 30분당 1개 |
| WordPress.com | https://silverbootcamp.wordpress.com/ | 새 계정/앱 (기존 trending/classics 사이트는 정지됨) | 즉시 발행 없음, 스케줄러 전용 | 1시간 30분당 1개 |
| Facebook Page | https://www.facebook.com/1276645988854694 | 기존 페이지, 5개 권한 보유 토큰 | 새 글은 즉시 발행 + 백로그는 스케줄러 | 신규: 즉시 / 백로그: 1시간 30분당 1개 |
| Tumblr | https://aibootcamp.tumblr.com/ | 새 앱("실버AI부트캠프"), 기존 앱은 401로 차단됨 | 즉시 발행 없음, 스케줄러 전용 | 1시간 30분당 1개 |

## 참고

- 각 채널은 published + 본문 800자 이상인 글만 대상으로 하며, 이미 올라간 글은 각 채널별 Firestore 컬렉션(`blog_blogger_posts`, `blog_wordpress_posts`, `blog_facebook_posts`, `blog_tumblr_posts`)으로 중복 방지.
- 자격증명(Client ID/Secret, Access Token 등)은 전부 `backend/.env` (로컬) / Railway 환경변수에만 존재 — 이 문서에는 포함하지 않음.
- 배포 서비스: Railway 프로젝트 `ai119-bot` (백엔드 NestJS) — 코드 변경 시 `railway up --detach` 수동 배포 필요 (git push만으로는 자동배포 안 됨).
- Tumblr `aibootcamp.tumblr.com`은 OAuth 앱 등록 시 표시되는 이름과 실제 블로그 이름이 달라서(계정 기본 블로그명) 확인 후 확정된 이름 — 앱 등록 화면의 "블로그 주소"가 아니라 `/v2/user/info` API 응답의 실제 blog name을 기준으로 함.
