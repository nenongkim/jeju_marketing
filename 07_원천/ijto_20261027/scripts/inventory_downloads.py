"""Archive completed IJTO CSV exports and link them to public page schemas.

Usage: python inventory_downloads.py --downloads PATH --data-root PATH
No authentication information is read or stored. Raw files remain byte-identical.
"""
from pathlib import Path
import argparse,csv,datetime,hashlib,json,re,shutil
import pandas as pd

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--downloads',type=Path,default=Path.home()/'Downloads');ap.add_argument('--data-root',type=Path,default=Path(__file__).parent/'data_collection');a=ap.parse_args()
    root=a.data_root; raw=root/'ijto_raw_20261027'; out=root/'analysis_20261027'
    raw.mkdir(parents=True,exist_ok=True);out.mkdir(parents=True,exist_ok=True)
    pages=[json.loads(p.read_text(encoding='utf-8')) for p in (root/'ijto_public_20261027').glob('*/metadata_preview.json')]
    records={}
    for f in sorted(a.downloads.glob('*.csv')):
        if not re.search(r'_\d{4}[-~]',f.name):continue
        with f.open(encoding='utf-8-sig',newline='') as h:cols=next(csv.reader(h))
        candidates=[p for p in pages if p['tables'] and p['tables'][0][0]==cols]
        if not candidates:continue
        sha=hashlib.file_digest(f.open('rb'),'sha256').hexdigest()
        if sha in records:records[sha]['download_filenames'].append(f.name);continue
        df=pd.read_csv(f,dtype=str,encoding='utf-8-sig',keep_default_na=False)
        # Equal schemas do not prove equal content: survey audience and attraction
        # views export distinct subsets. Match the public preview's category.
        if {p['regSn'] for p in candidates}=={86,87,88}:
            values=set(df[cols[1]])
            candidates=[p for p in candidates if len(p['tables'][0])>1 and p['tables'][0][1][1] in values]
        if {p['regSn'] for p in candidates}=={91,92}:
            values=set(df[cols[1]])
            candidates=[p for p in candidates if any(row[1] in values for row in p['tables'][0][1:])]
        ids=sorted(p['regSn'] for p in candidates)
        name=f'ijto_{"_".join(map(str,ids))}_{sha[:12]}.csv'
        target=raw/name
        if not target.exists():shutil.copyfile(f,target)
        periods=sorted(df[cols[0]].unique())
        rec={'source_ids':ids,'sources':[{'regSn':p['regSn'],'title':p['title'],'url':p['url']} for p in candidates],
             'file':name,'download_filenames':[f.name],'sha256':sha,'bytes':f.stat().st_size,
             'row_count':len(df),'columns':cols,'first_period':periods[0] if periods else None,'last_period':periods[-1] if periods else None,
             'period_count':len(periods),'exact_duplicate_rows':int(df.duplicated().sum()),
             'missing_by_column':{c:int((df[c]=='').sum()) for c in cols},'downloaded_on':'2026-10-27',
             'notes':'Source rows preserved; exact duplicate rows are diagnostic only and were not removed.'}
        for c in cols:
            vals=df[c].unique()
            if len(vals)<=60:rec.setdefault('small_categories',{})[c]=vals.tolist()
        records[sha]=rec
        print(json.dumps({'ids':ids,'rows':len(df),'duplicates':rec['exact_duplicate_rows']},ensure_ascii=False),flush=True)
        del df
    rows=list(records.values());covered={n for r in rows for n in r['source_ids']}
    for r in rows:
        r['selected_for_analysis']=not any(set(x['source_ids'])==set(r['source_ids']) and x['period_count']>r['period_count'] for x in rows)
    (out/'download_inventory.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    selected=[r for r in rows if r['selected_for_analysis']]
    summary={'unique_csv_files':len(rows),'selected_csv_files':len(selected),'selected_rows':sum(r['row_count'] for r in selected),'selected_bytes':sum(r['bytes'] for r in selected),'rows_including_distinct_partial_exports':sum(r['row_count'] for r in rows),'bytes':sum(r['bytes'] for r in rows),'covered_source_ids':sorted(covered),'missing_source_ids':sorted({p['regSn'] for p in pages}-covered),'method':'Exact CSV-header match, with category/preview checks for survey and attraction subsets. Shared exports can support multiple platform views. Counts are exported rows, not independent people or transactions.'}
    (out/'collection_summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8');print(summary,flush=True)

if __name__=='__main__':main()
