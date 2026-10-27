# 제주관광 원천 자료 및 재현 절차

수집일: 2026년 10월 27일. 이 폴더는 출처 목록·CSV 해시·공개 페이지 메타데이터·실행 스크립트를 보관한다. 원본 CSV, PDF, ZIP, 설문 개별 응답은 Git에 포함하지 않는다.

현재 로컬 수집 루트는 `C:/Users/User/OneDrive/문서/ChatGPT/공모전/data_collection`이다. `ijto_raw_20261027`에 원본 CSV, `ijto_public_20261027`에 페이지 증빙, `ijto_reports_20261027`에 공식 첨부파일, `analysis_20261027`에 전체 계산 결과가 있다. 저장소만 복제하면 원본이 자동으로 따라오지 않는다. 다른 컴퓨터에서는 허용된 방법으로 CSV를 다시 받거나 원본 폴더를 별도로 준비해야 한다.

## 재실행

Python 3.12와 pandas, numpy, matplotlib를 사용했다. 한국어 그래프는 Windows의 Malgun Gothic 글꼴을 사용한다. 필요하면 `scripts/requirements.txt`로 의존성을 설치한다. 실행 전 수집 원본을 보존한다.

저장소 최상위 PowerShell에서 다음과 같이 실행한다. `$dataRoot`는 실제 수집 폴더로 바꿀 수 있다.

```powershell
$dataRoot = 'C:/Users/User/OneDrive/문서/ChatGPT/공모전/data_collection'
$scripts = './07_원천/ijto_20261027/scripts'
python "$scripts/inventory_downloads.py" --downloads 'C:/Users/User/Downloads' --data-root $dataRoot
python "$scripts/analyse_ijto.py" --data-root $dataRoot
python "$scripts/build_ijto_delivery.py" --data-root $dataRoot --repo-root .
```

첫 명령은 다운로드 폴더의 완료된 CSV 중 공개 메타데이터와 열 구조가 일치하는 파일을 해시별로 보관한다. 재다운로드 시에는 해당 수집일에 받은 파일만 별도 폴더에 모아 `--downloads`로 지정한다. 이 스크립트는 2026년 10월 27일 스냅샷 재현용이며, 새 날짜 수집은 날짜·출처 버전 관리부터 갱신해야 한다.

공개 페이지 증빙은 `collect_ijto_public.py --plan 계획서경로 --out 수집루트/ijto_public_20261027`로 다시 받을 수 있다. 이 명령은 현재 페이지를 받아 과거 증빙을 바꿀 수 있으므로 과거 증빙 검증에는 재다운로드를 사용하지 않는다. 저장소의 `metadata` 하위 폴더에는 분석에 사용한 당시 페이지의 표와 해시가 있다. 원본 CSV 수집은 로그인한 플랫폼의 정상 다운로드 UI에서 수행했다. 스크립트에 계정·쿠키·토큰은 저장하지 않았다.

`build_ijto_delivery.py`는 원본 45개 해시와 대표 파일 선택, 계절지수·고객 구성비·시간대 구성비를 검증하고 저장소의 증빙과 시연 JSON을 갱신한다. 보고서 문서는 자동 생성되지 않으므로 데이터 변경 시 사람이 함께 갱신해야 한다. 공개 자료실 첨부파일의 해시·출처는 `06_증빙/ijto_20261027/report_inventory.json`, 설문 원자료 구조 검증은 `survey_microdata_inventory.json`에 있다. 첨부파일은 이번 분석의 수치 계산 입력에 포함되지 않았다.

## 보관·검증 정책

- 중복 다운로드는 SHA-256으로 구분한다. CSV 내부의 같은 값 반복 행은 삭제하지 않는다.
- 짧은 기간 재다운로드 2개는 기록에 남기고 대표 분석에서 제외한다.
- 원천별 표시된 공개 이용허락은 `source_catalog.json`에 기록한다. 미확인은 허가로 간주하지 않는다.
- 카드 원자료와 시연 파일에는 개인정보나 인증키를 추가하지 않는다. 응답자 단위 설문은 원본 폴더에서만 다룬다.
- 원천 경고가 남으면 `passed_with_documented_source_warning`으로 보고한다. 경고를 없애기 위해 원본 수치를 보정하지 않는다.

분석 결과: [보고서](../../05_리서치/20261027_실제데이터_수집과_분석.md), [시연용 데이터 안내](../../02_제품/데이터/README.md)


## 대상 월 사례 분석 보완

`strengthen_ijto_case.py --data-root 수집루트 --repo-root 저장소루트`로 43개 지역의 안정성과 구좌의 12개월 고객군·시간대·장소 자료를 생성한다. 원본 21·27·39·48을 사용하며 결측 시간대는 null이다. 이 스크립트가 만드는 `case-data.json`이 실제 사례 화면의 입력이며 초기 범용 `ijto-demo-20261027.json`과 구분한다.

## 추가 동기간 분석

`strengthen_ijto_case.py` 실행 후 `python 07_원천/ijto_20261027/scripts/extend_case_analysis.py --data-root <로컬 data_collection 경로> --repo-root .`로 추가 분석을 재생성한다. 2026-10-27 스냅샷의 공통 기간은 1월부터 8월까지다. `case-data.json`과 `recent-data.json`이 모두 필요하며 로딩·검증 실패 시 예시 자료로 대체하지 않는다.

`node 02_제품/화면시안_Make/evidence/case-data.test.cjs`와 `node 02_제품/화면시안_Make/evidence/recent-data.test.cjs`로 검사한다. 실제 사용자 평가는 `06_증빙/사용자평가`의 절차와 빈 양식을 사용한다.
