# Information Systems Capstone Design

2026년 2학기 정보시스템 캡스톤디자인 프로젝트 워크스페이스입니다.

## 사용자 평가용 공개 시연

평가 주소: https://nenongkim.github.io/jeju-marketing-demo/

평가용 공개 저장소: https://github.com/nenongkim/jeju-marketing-demo

현재 비공개 저장소의 Pages는 요금제에서 지원하지 않아, 평가에 필요한 화면 5개와 집계 JSON 2개만 별도 공개 저장소로 배포한다. 신청서·원본 데이터·평가 기록·Git 이력 전체는 게시하지 않는다. 비공개 저장소 푸시가 평가 사이트에 자동 반영되지는 않으며, 검증된 화면 파일만 별도로 갱신해야 한다.

평가자는 같은 브라우저에서 분석 → 계획 작성 → 일정 → 실행 기록 순으로 사용한다. 입력은 평가자 브라우저에만 저장된다. 사용자 평가 결과가 운영자에게 자동 전송되지 않으므로, 평가 종료 후 전체 계획·기록 내보내기와 별도 평가 양식을 전달받아야 한다. 로컬 주소에서 작성한 계획은 공개 주소로 자동 이전되지 않는다.

## 현재 작업본 로컬 실행

PowerShell에서 저장소 폴더로 이동한 뒤 실행합니다.

```powershell
cd C:\Users\User\my-project
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1
```

현재 PC의 `127.0.0.1:8766`에서 실제 데이터 구좌 사례를 엽니다. 서버 창을 열어 두고 사용하며 종료는 Ctrl+C입니다. 같은 사례 서버가 이미 있으면 해당 주소를 재사용합니다. 포트 충돌 시 명령 끝에 `-Port 8767`을 붙입니다. `-NoBrowser`는 브라우저 자동 열기를 생략합니다. 실행 정책 옵션은 이 명령의 프로세스에만 적용됩니다.

GitHub Pages 배포는 `workflow_dispatch` 수동 실행만 남겼습니다. 푸시 시 자동 배포하지 않습니다. 로컬 실행에는 GitHub Pages·로그인·외부 서버가 필요하지 않습니다. 화면 데이터는 저장소의 JSON을 읽으며 계획은 브라우저에 저장합니다. 기존 예시 진입 화면도 실제 구좌 통합본으로 이동합니다. 분석에서 저장한 계획이 일정과 실행 기록으로 연결되며 가상 성과는 표시하지 않습니다.

## 제출 문서

- [프로젝트 정의서](00_제출/Red_PROJECT.md)
- [유스케이스 다이어그램](00_제출/Red_USECASE.md)
- [유스케이스 StarUML 편집 원본](00_제출/Red_USECASE.mdj)
- [화면설계서 PDF 검토본 — 32쪽](00_제출/Red_SCREEN.pdf)
- [화면설계서 원고·32개 Use Case 대응표](00_제출/Red_SCREEN.md)

이승보의 팀 [Figma Design 파일](https://www.figma.com/design/3g5xR8OkcV6sUclyGM5d30)에 주요 화면 8개와 팝업·상태를 포함한 21개 프레임을 옮겼습니다. 연결 144개의 이동 대상을 확인했고, 실제 클릭 재생과 비로그인 열람 권한은 아직 검증하지 못했습니다. [요구사항별 확인 결과](06_증빙/화면설계/검증.md)에 검증 범위를 기록했습니다.

## ERD

- [ERD ERwin 파일 — Logical/Physical 모델](04_아키텍처/ERD/Red_ERD.erwin)
- [ERD 수정 내역](04_아키텍처/ERD/ERD_수정_내역.md)
- [ERD 수정 가이드 — 남은 작업과 팀 확인 질문](04_아키텍처/ERD/ERD_수정_가이드.md)
- [ERD 프로토타입 대조 가이드 — 화면 시안과 다른 컬럼과 고칠 방법](04_아키텍처/ERD/ERD_프로토타입_대조_가이드.md)
- [ERD Oracle SQL — ERwin Schema Generation 결과](04_아키텍처/ERD/Red_ERD_Oracle.sql)
- [ERD 코드 설계서 — 코드값 컬럼 14개](04_아키텍처/ERD/ERD_코드_설계서.md)

## 화면 시안

- [클릭 가능한 제주 마케팅 캘린더](02_제품/화면시안/index.html)
- [시안 실행 방법과 구현 범위](02_제품/화면시안/README.md)
- [Figma Make 게시본 시안 — 실행 방법과 버전](02_제품/화면시안_Make/README.md)
- 현재 작업본은 아래 로컬 실행 방법으로 확인합니다. 원본 프로젝트의 Pages 주소는 이 저장소의 배포 주소가 아닙니다.
- [검증 결과와 화면 캡처](06_증빙/화면시안/검증.md)
- [화면설계 자료와 PDF 재생성 방법](02_제품/화면설계/README.md)
- [Figma Make 활용 경로와 시작 프롬프트](02_제품/화면설계/FIGMA_MAKE.md)

## 폴더 구조

```text
클로드/
.omc/
.st버전/
00_제출/
01_전략/
02_제품/
03_에이전트/
04_아키텍처/
05_리서치/
06_증빙/
07_원천/
```

## Obsidian · 로컬 · GitHub 연결

이 저장소의 최상위 폴더가 Obsidian 보관함입니다. Obsidian에서 수정한 노트는 같은 로컬 파일에 저장됩니다.

- 현재 GitHub 저장소: https://github.com/nenongkim/jeju_marketing
- 원본 프로젝트: https://github.com/LSB-afk/-Information-Systems-Capstone-Design

아래 Mac·Obsidian 자동 동기화 설명은 원본 프로젝트의 환경 기록이며 현재 Windows에서 작동한다고 확인한 설정이 아닙니다.
- 동기화 브랜치: `main` → `origin/main`
- 현재 Mac의 Obsidian Git 플러그인: `2.39.0`
- Obsidian이 열려 있는 동안 5분마다 변경 사항을 커밋하고 GitHub에 푸시합니다.
- 보관함을 열 때와 5분마다 원격 변경 사항을 가져오며, 푸시 전에도 가져오기를 실행합니다.
- 즉시 동기화하려면 명령어 팔레트(`⌘P`)에서 `Git: Commit-and-sync`를 실행합니다.

앱을 닫으면 자동 동기화도 멈춥니다. 동기화 오류나 충돌이 표시되면 먼저 해결한 뒤 다시 동기화합니다.

노트와 공통 Obsidian 설정은 Git으로 관리합니다. 화면 배치, 플러그인 설치 파일·기기별 설정, 휴지통, `.omx/`는 제외합니다. 다른 컴퓨터에서는 이 저장소를 복제한 폴더를 보관함으로 열고, Git 플러그인과 GitHub 인증을 별도로 설정해야 합니다.
