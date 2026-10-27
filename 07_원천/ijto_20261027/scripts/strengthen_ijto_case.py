"""Build repeatable stability and month/customer evidence from preserved IJTO CSVs."""
from pathlib import Path
import argparse,json,hashlib,calendar
import pandas as pd

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--data-root',type=Path,required=True);ap.add_argument('--repo-root',type=Path,required=True);a=ap.parse_args()
    root=a.data_root;repo=a.repo_root; inv=json.loads((repo/'07_원천/ijto_20261027/download_inventory.json').read_text(encoding='utf-8'))
    used=[]
    def load(n):
        r=max((r for r in inv if n in r['source_ids']),key=lambda r:r['period_count']);p=root/'ijto_raw_20261027'/r['file']
        with p.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==r['sha256']
        used.append({'regSn':n,'sha256':r['sha256'],'file':r['file'],'url':f'https://data.ijto.or.kr/prog/dataPick/bigdata/sub02/view.do?regSn={n}'})
        d=pd.read_csv(p);d['year']=d.iloc[:,0].astype(str).str[:4].astype(int);d['month']=d.iloc[:,0].astype(str).str[4:6].astype(int)
        return d[d.year.between(2023,2025)].copy()
    def indices(d,value,keys):
        assert (d.groupby(keys+['year']).month.nunique()==12).all()
        d['monthly_index']=d[value]/d.groupby(keys+['year'])[value].transform('mean')
        d['daily_value']=d[value]/pd.Series([calendar.monthrange(y,m)[1] for y,m in zip(d.year,d.month)],index=d.index)
        d['daily_index']=d.daily_value/d.groupby(keys+['year']).daily_value.transform('mean')
        return d
    def records(d):return json.loads(d.to_json(orient='records',force_ascii=False))
    def save(path,data):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    v=load(21);v=indices(v,'총 방문객수 (내국인+외국인)',['읍면동명'])
    c=load(27);c=c[c['업종명']=='음식점업'].groupby(['읍면동명','year','month','관광객구분'],as_index=False)[['소비금액(원)','이용건수']].sum()
    allc=indices(c.groupby(['읍면동명','year','month'],as_index=False)['소비금액(원)'].sum(),'소비금액(원)',['읍면동명'])
    c=indices(c[c['읍면동명']=='구좌읍'].copy(),'소비금액(원)',['읍면동명','관광객구분'])
    both=v[['읍면동명','year','month','monthly_index','daily_index']].merge(allc[['읍면동명','year','month','monthly_index','daily_index']],on=['읍면동명','year','month'],suffixes=('_visits','_spend'),validate='one_to_one')
    stability=[]
    for (region,month),g in both.groupby(['읍면동명','month']):
        assert set(g.year)=={2023,2024,2025}
        count=int(((g.daily_index_visits<1)&(g.daily_index_spend<1)).sum());vi=float(g.daily_index_visits.mean());si=float(g.daily_index_spend.mean())
        stable=count==3 and vi<=.95 and si<=.95
        stability.append({'region':region,'month':int(month),'visits_index':float(g.monthly_index_visits.mean()),'spend_index':float(g.monthly_index_spend.mean()),'visits_daily_index':vi,'spend_daily_index':si,'both_below_mean_years':count,'stable_low':stable,'threshold_sensitivity':{str(t):bool(count==3 and vi<=t and si<=t) for t in [.9,.95,1.]},'annual':records(g.drop(columns='읍면동명').sort_values('year'))})
    save(repo/'06_증빙/ijto_20261027/stability_by_region_month.json',stability)
    # Leave-one-year-out classification diagnostics: two prior/reference years vs
    # excluded year's observed low demand, not a future forecasting experiment.
    lo=[]
    for holdout in [2023,2024,2025]:
        train=both[both.year!=holdout].groupby(['읍면동명','month']).agg(v=('daily_index_visits','mean'),s=('daily_index_spend','mean'))
        counts=both[both.year!=holdout].assign(low=lambda d:(d.daily_index_visits<1)&(d.daily_index_spend<1)).groupby(['읍면동명','month']).low.sum()
        test=both[both.year==holdout].set_index(['읍면동명','month']);pred=(train.v<=.95)&(train.s<=.95)&(counts==2);truth=(test.daily_index_visits<1)&(test.daily_index_spend<1)
        tp=int((pred&truth).sum());n=int(pred.sum());lo.append({'excluded_year':holdout,'flagged':n,'also_low_in_excluded_year':tp,'agreement_among_flagged':tp/n if n else None,'note':'Retrospective robustness check; reference years may include future years relative to excluded year.'})
    save(repo/'06_증빙/ijto_20261027/stability_holdout.json',lo)
    h=load(39);h=h[(h['읍면동명']=='구좌읍')&(h['업종명']=='음식점업')].copy();h['hour']=h['시간대'].astype(int)
    h=h.groupby(['year','month','관광객구분','hour'],as_index=False)['카드 매출액(원)'].sum()
    h['annual_month_share_pct']=100*h['카드 매출액(원)']/h.groupby(['year','month','관광객구분'])['카드 매출액(원)'].transform('sum')
    hp=h.groupby(['month','관광객구분','hour'],as_index=False).agg(amount=('카드 매출액(원)','sum'),min_year_share=('annual_month_share_pct','min'),max_year_share=('annual_month_share_pct','max'),years_observed=('year','nunique'))
    hp['share_pct']=100*hp.amount/hp.groupby(['month','관광객구분']).amount.transform('sum')
    n=load(48);n=n[n['읍면동명']=='구좌읍'].copy();allowed=['해수욕장','자연휴양림','오름','동굴','박물관/기념관','공원','동식물원','테마파크','전시장','관광명소기타','산림욕장','드라이브코스','염전','공연장']
    n=n[n['카테고리 3단계'].isin(allowed)]
    np=n.groupby(['month','목적지명','목적지주소','카테고리 3단계'],as_index=False).agg(tourist_arrivals=('관광객 도착 수','sum'),years_observed=('year','nunique'),component_mismatch_rows=('도착건수','size'))
    # Source mismatch is recorded independently; never use total to infer tourist counts.
    n['mismatch']=n['도착건수']!=n['관광객 도착 수']+n['도민 도착 수']
    mism=n.groupby(['month','목적지명','목적지주소','카테고리 3단계']).mismatch.sum().reset_index(name='mismatch_rows')
    np=np.drop(columns='component_mismatch_rows').merge(mism,validate='one_to_one');np=np[np.years_observed==3]
    months=[]
    for month in range(1,13):
        seg=[]
        for customer,g in c[(c['읍면동명']=='구좌읍')&(c.month==month)].groupby('관광객구분'):
            assert set(g.year)=={2023,2024,2025}
            share=c[(c['읍면동명']=='구좌읍')&(c.month==month)&(c.year==2025)]['소비금액(원)'].sum()
            hours=hp[(hp.month==month)&(hp['관광객구분']==customer)].sort_values('hour')
            assert abs(hours.share_pct.sum()-100)<1e-8
            hours=hours.set_index('hour').reindex(range(24)).rename_axis('hour').reset_index()
            seg.append({'customer':customer,'share_2025_pct':float(g[g.year==2025]['소비금액(원)'].iloc[0]/share*100),'monthly_index':float(g.monthly_index.mean()),'daily_index':float(g.daily_index.mean()),'below_mean_years':int((g.daily_index<1).sum()),'annual':records(g[['year','소비금액(원)','이용건수','monthly_index','daily_index']].sort_values('year')),'hours':records(hours[['hour','share_pct','min_year_share','max_year_share','years_observed']])})
        poi=np[np.month==month].sort_values(['tourist_arrivals','목적지명'],ascending=[False,True]).head(5)
        months.append({'month':month,'stability':next(s for s in stability if s['region']=='구좌읍' and s['month']==month),'segments':seg,'places':records(poi)})
    data={'schema_version':'1.0.0','snapshot':'2026-10-27','region':'구좌읍','industry':'음식점업 전체','business_status':'가상의 사업체 상황에 실제 지역 통계를 적용한 사례','analysis_years':[2023,2024,2025],'target_year':2026,'default_month':12,'stability_rule':'일수 보정 방문·음식점 소비 지수가 3개 연도 모두 1 미만이고 두 평균 지수가 각각 0.95 이하이면 일관된 낮은 수요. 0.95는 운영상 검토 기준이며 통계적 유의수준이 아님.','hour_method':'같은 월의 3개 연도 소비금액을 합산한 시간대 비중. 연도별 비중의 최솟값·최댓값도 제공하며 할인 효과는 측정하지 않음.','place_method':'같은 월의 2023년부터 2025년까지 관광객 차량 도착 합계. 세 해 모두 관측된 구좌 관광지 유형만 추림. 거리·현재 영업·제휴 여부는 미확인.','warnings':['지역 방문 집계는 개별 음식점 손님 수가 아닙니다.','소비 비중은 사람 수가 아닌 카드 소비금액 비중입니다.','내비게이션 원천의 구성 합계 불일치가 있어 관광객 도착 열을 직접 사용합니다.','2026년 해당 월의 미래 실적이나 캠페인 효과를 예측하지 않습니다.','실제 사업체 사용 평가와 매출 효과는 미측정입니다.'],'sources':used,'months':months}
    save(repo/'02_제품/화면시안_Make/evidence/case-data.json',data)
    save(repo/'06_증빙/ijto_20261027/case_validation.json',{'source_hashes_verified':len(used),'region_month_rows':len(stability),'case_months':len(months),'customer_month_groups':sum(len(m['segments']) for m in months),'hour_rows':sum(len(s['hours']) for m in months for s in m['segments']),'december':months[11]['stability'],'holdout':lo})
    print('Verified',len(stability),'region/months;',len(months),'case months; December',months[11]['stability']['stable_low'])

if __name__=='__main__':main()
