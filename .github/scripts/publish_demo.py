"""Copy only reviewed prototype assets, never the repository tree."""
from pathlib import Path
import argparse,json,shutil,re

FILES=('index.html','case.css','case.js','workflow.js','recent.js','case-data.json','recent-data.json')
GENERATED=('.nojekyll','README.md','release.json')
def publish(source:Path,destination:Path,revision:str):
    if not re.fullmatch(r'[0-9a-f]{40}',revision):raise ValueError('Expected source commit SHA')
    source=source.resolve();destination=destination.resolve()
    if source==destination or source in destination.parents or destination in source.parents:raise ValueError('Separate staging directories required')
    for name in FILES:
        f=source/name
        if f.is_symlink() or not f.is_file():raise ValueError('Missing or linked allowed asset: '+name)
        if f.stat().st_size>2_000_000:raise ValueError('Unexpected large asset: '+name)
        content=f.read_text(encoding='utf-8')
        if re.search(r'-----BEGIN (?:OPENSSH|RSA|EC|PRIVATE).*KEY-----|github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]+',content):raise ValueError('Credential-like content rejected')
        if name.endswith('.json'):
            data=json.loads(content)
            if data.get('region')!='구좌읍' or data.get('schema_version')!='1.0.0':raise ValueError('Unexpected aggregate data')
    destination.mkdir(parents=True,exist_ok=True)
    for item in destination.iterdir():
        if item.name=='.git':continue
        if item.name not in FILES+GENERATED or item.is_symlink() or not item.is_file():raise ValueError('Unexpected destination entry: '+item.name)
    for name in FILES:shutil.copyfile(source/name,destination/name)
    (destination/'.nojekyll').write_text('',encoding='utf-8')
    (destination/'release.json').write_text(json.dumps({'source_commit':revision,'files':list(FILES)},indent=2)+'\n',encoding='utf-8')
    (destination/'README.md').write_text('# 제주 구좌 음식점 평가용 프로토타입\n\nhttps://nenongkim.github.io/jeju-marketing-demo/\n\n화면과 가공한 지역 집계만 게시합니다. 신청서·원본 데이터·실제 사용자 평가 기록은 포함하지 않습니다.\n계획과 실행 기록은 이용자의 브라우저에만 저장되며 서버에 전송하지 않습니다. 평가자는 내보낸 파일과 별도 평가 양식을 전달해야 합니다.\n\n분석 원천: https://data.ijto.or.kr (regSn 21, 27, 39, 48)\n실제 사업체 효과는 미측정입니다.\n\n검증된 원본 main 변경이 자동 반영됩니다. 게시 버전은 release.json에서 확인합니다.\n',encoding='utf-8')
    return list(FILES+GENERATED)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--destination',type=Path,required=True);p.add_argument('--revision',required=True);a=p.parse_args()
    print('Publishing allowlisted files: '+', '.join(publish(a.source,a.destination,a.revision)))
