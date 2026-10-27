"""Collect public page evidence and explicitly limited previews, never private CSV endpoints."""
from pathlib import Path
from urllib.request import urlopen, Request
from html.parser import HTMLParser
import argparse, json, re, hashlib, datetime, time

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.text=[]; self.links=[]; self.tables=[]; self.table=None; self.row=None; self.cell=None; self.skip=0
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag in ('script','style'): self.skip+=1
        if tag=='a' and a.get('href'): self.links.append(a['href'])
        if tag=='table': self.table=[]
        if tag=='tr': self.row=[]
        if tag in ('th','td'): self.cell=[]
    def handle_data(self,d):
        if not self.skip:
            if d.strip(): self.text.append(d.strip())
            if self.cell is not None: self.cell.append(d)
    def handle_endtag(self,tag):
        if tag in ('script','style'): self.skip=max(0,self.skip-1)
        if tag in ('th','td') and self.cell is not None:
            if self.row is not None: self.row.append(' '.join(''.join(self.cell).split()))
            self.cell=None
        if tag=='tr' and self.row is not None:
            if self.table is not None and self.row: self.table.append(self.row)
            self.row=None
        if tag=='table' and self.table is not None:
            self.tables.append(self.table); self.table=None

def fetch(url):
    with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=40) as r: return r.read()

def main():
    p=argparse.ArgumentParser();p.add_argument('--plan',required=True);p.add_argument('--out',required=True);a=p.parse_args()
    root=Path(a.out); root.mkdir(parents=True,exist_ok=True)
    plan=Path(a.plan).read_text(encoding='utf-8-sig')
    section=plan.split('### 1.2')[1].split('### 1.3')[0]
    ids=list(dict.fromkeys(int(x) for x in re.findall(r'^\|\s*\*{0,2}(\d+)\*{0,2}\s*\|',section,re.M)))
    priority=[21,27,39,82,48,22,17,90,23,60]
    ids=[x for x in priority if x in ids]+[x for x in ids if x not in priority]
    results=[]
    for n in ids:
        url=f'https://data.ijto.or.kr/prog/dataPick/bigdata/sub02/view.do?regSn={n}'
        dest=root/f'regSn_{n}';dest.mkdir(exist_ok=True)
        try:
            raw=fetch(url); html=raw.decode('utf-8'); page=Page();page.feed(html)
            (dest/'page.html').write_bytes(raw)
            (dest/'page_text.txt').write_text('\n'.join(page.text),encoding='utf-8')
            title=re.search(r'<title>(.*?)</title>',html,re.S).group(1).split('|')[0].strip()
            preview=next((t for t in page.tables if t and len(t[0])>2 and any('기준' in v or '주행' in v for v in t[0])),[])
            record={'regSn':n,'title':title,'url':url,'retrieved_at':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(),'sha256':hashlib.sha256(raw).hexdigest(),'status':'public_preview_only','full_csv_acquired':False,'preview_row_count':max(0,len(preview)-1),'tables':page.tables,'links':page.links}
            (dest/'metadata_preview.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
            results.append({k:v for k,v in record.items() if k not in ('tables','links')})
            print(f'{n}: {title} / preview {record["preview_row_count"]}',flush=True)
        except Exception as e:
            results.append({'regSn':n,'url':url,'status':'failed','error':str(e)});print(f'{n}: ERROR {e}',flush=True)
        (root/'manifest.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
        time.sleep(.3)
    print(json.dumps({'requested':len(ids),'collected':sum(x['status']=='public_preview_only' for x in results)},ensure_ascii=False),flush=True)

if __name__=='__main__': main()
