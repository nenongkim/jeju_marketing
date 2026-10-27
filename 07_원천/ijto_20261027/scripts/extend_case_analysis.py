"""Temporal rule benchmarks, matched-period trends and spending/count time bands."""
from pathlib import Path
import argparse,json,hashlib
import pandas as pd

def main():
 p=argparse.ArgumentParser();p.add_argument('--data-root',type=Path,required=True);p.add_argument('--repo-root',type=Path,required=True);a=p.parse_args();repo=a.repo_root;ev=repo/'06_증빙/ijto_20261027';ui=repo/'02_제품/화면시안_Make/evidence'
 inv=json.loads((repo/'07_원천/ijto_20261027/download_inventory.json').read_text(encoding='utf-8'));sources=[]
 def load(n):
  r=max((r for r in inv if n in r['source_ids']),key=lambda r:r['period_count']);f=a.data_root/'ijto_raw_20261027'/r['file']
  with f.open('rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==r['sha256']
  sources.append({'regSn':n,'sha256':r['sha256'],'url':f'https://data.ijto.or.kr/prog/dataPick/bigdata/sub02/view.do?regSn={n}'})
  d=pd.read_csv(f);d['year']=d.iloc[:,0].astype(str).str[:4].astype(int);d['month']=d.iloc[:,0].astype(str).str[4:6].astype(int);return d[d['읍면동명']=='구좌읍'].copy()
 def records(d):return json.loads(d.to_json(orient='records',force_ascii=False))
 def save(path,x):path.write_text(json.dumps(x,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
 rows=json.loads((ev/'stability_by_region_month.json').read_text(encoding='utf-8'));d=pd.DataFrame([{'region':r['region'],**y} for r in rows for y in r['annual']]);d['low']=(d.daily_index_visits<1)&(d.daily_index_spend<1)
 truth=d[d.year==2025].set_index(['region','month']).low;previous=d[d.year==2024].set_index(['region','month']);train=d[d.year<2025].groupby(['region','month']).agg(v=('daily_index_visits','mean'),s=('daily_index_spend','mean'),n=('low','sum'))
 rules=[('previous_low','전년도 두 지수 1 미만',previous.low),('previous_095','전년도 두 지수 0.95 이하',(previous.daily_index_visits<=.95)&(previous.daily_index_spend<=.95)),('two_year','2개 연도 반복 + 평균 0.95 이하',(train.v<=.95)&(train.s<=.95)&(train.n==2))]
 benchmarks=[]
 for key,label,pred in rules:
  tp=int((pred&truth).sum());fp=int((pred&~truth).sum());fn=int((~pred&truth).sum());tn=int((~pred&~truth).sum())
  benchmarks.append({'id':key,'label':label,'flagged':tp+fp,'tp':tp,'fp':fp,'fn':fn,'tn':tn,'precision_pct':100*tp/(tp+fp),'recall_pct':100*tp/(tp+fn)})
 v=load(21);c=load(27);c=c[c['업종명']=='음식점업'];h=load(39);h=h[h['업종명']=='음식점업'];h['hour']=h['시간대'].astype(int)
 monthsets=[set(x[x.year==y].month) for x in [v,c,h] for y in [2025,2026]];common=sorted(set.intersection(*monthsets));assert common==list(range(1,max(common)+1));assert len(common)>=1
 # Ensure every customer has every matched month, rather than masking missing months.
 for x in [c,h]:
  for y in [2025,2026]:
   for customer in ['도민','내국인 관광객','외국인 관광객']:assert set(common)<=set(x[(x.year==y)&(x['관광객구분']==customer)].month)
 def change(old,new):return 100*(new/old-1) if old!=0 else None
 def pair(df,col):
  sums=df.groupby('year')[col].sum();old=float(sums.loc[2025]);new=float(sums.loc[2026]);return {'value_2025':old,'value_2026':new,'change_pct':change(old,new)}
 def compare(months):
  vv=v[v.year.isin([2025,2026])&v.month.isin(months)];cc=c[c.year.isin([2025,2026])&c.month.isin(months)]
  return {'months':months,'visits':pair(vv,'총 방문객수 (내국인+외국인)'),'spend':pair(cc,'소비금액(원)'),'transactions':pair(cc,'이용건수'),'segments':[{'customer':name,'spend':pair(g,'소비금액(원)'),'transactions':pair(g,'이용건수')} for name,g in cc.groupby('관광객구분')]}
 bands=[('새벽',0,5),('아침',6,10),('점심',11,14),('오후',15,17),('저녁',18,21),('야간',22,23)]
 def bandrows(df):
  results=[]
  for name,g in df.groupby('관광객구분'):
   total=g['카드 매출액(원)'].sum();count=g['이용건수'].sum()
   for label,start,end in bands:
    b=g[g.hour.between(start,end)];amount=float(b['카드 매출액(원)'].sum()) if len(b) else None;transactions=float(b['이용건수'].sum()) if len(b) else None
    results.append({'customer':name,'band':label,'start':start,'end':end,'amount':amount,'transactions':transactions,'spend_share_pct':100*amount/total if amount is not None and total else None,'count_share_pct':100*transactions/count if transactions is not None and count else None,'observed_year_month_hours':len(b[['year','month','hour']].drop_duplicates()),'expected_year_month_hours':len(g[['year','month']].drop_duplicates())*(end-start+1)})
  return results
 hist=[]
 for month in range(1,13):
  base=h[h.year.between(2023,2025)&(h.month==month)];hist.append({'month':month,'bands':bandrows(base)})
 recentbands=[{'year':y,'months':common,'bands':bandrows(h[(h.year==y)&h.month.isin(common)])} for y in [2025,2026]]
 for entry in hist+recentbands:
  for customer in ['도민','내국인 관광객','외국인 관광객']:
   subset=[r for r in entry['bands'] if r['customer']==customer]
   if not subset:continue
   for col in ['spend_share_pct','count_share_pct']:assert abs(sum(r[col] or 0 for r in subset)-100)<1e-7
 hc=h[h.year.isin([2025,2026])&h.month.isin(common)].groupby(['year','month','관광객구분'])[['카드 매출액(원)','이용건수']].sum();cc=c[c.year.isin([2025,2026])&c.month.isin(common)].groupby(['year','month','관광객구분'])[['소비금액(원)','이용건수']].sum();assert hc.index.equals(cc.index)
 reconcile={'groups':len(hc),'max_amount_difference_won':float((hc['카드 매출액(원)']-cc['소비금액(원)']).abs().max()),'max_count_difference':float((hc['이용건수']-cc['이용건수']).abs().max())}
 result={'schema_version':'1.0.0','snapshot':'2026-10-27','region':'구좌읍','common_months':common,'rule_benchmark':{'reference_years':[2023,2024],'evaluation_year':2025,'population':516,'actual_low':int(truth.sum()),'rules':benchmarks,'note':'현재 개정 자료에 대한 시간순 비교. 당시 자료 제공 지연은 재현하지 않음. 전체 정확도나 캠페인 성과가 아님.'},'ytd':compare(common),'monthly':[dict(month=m,**compare([m])) for m in common],'historical_bands':hist,'recent_bands':recentbands,'reconciliation':reconcile,'sources':sources,'warnings':['2026년 12월 자료는 아직 없으며 1월부터 8월까지 결과를 12월 예측으로 사용하지 않습니다.','카드 이용건수는 고유 고객 수가 아닙니다.','소비금액은 명목금액이며 물가·가격·업종 구성 영향을 분리하지 않았습니다.','시간 구간은 분석용 구분이며 최적 광고·할인 시간의 검증 결과가 아닙니다.','비중 분모는 관측 자료의 합계이며 관측 부재 시간대를 0건으로 추정하지 않습니다.']}
 save(ui/'recent-data.json',result);save(ev/'rule_benchmark_2025.json',result['rule_benchmark']);save(ev/'gujwa_2026_matched_period.json',{'ytd':result['ytd'],'monthly':result['monthly'],'reconciliation':reconcile,'sources':sources});print(json.dumps(result['ytd'],ensure_ascii=False));print(reconcile)

if __name__=='__main__':main()
