"""Reproducible descriptive analysis of the 2026-10-27 IJTO export snapshot.

No raw row deduplication, prediction of business revenue, or causal claims.
Run after inventory_downloads.py. Requires pandas, numpy and matplotlib.
"""
from pathlib import Path
import argparse,json,calendar
import pandas as pd
import numpy as np

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--data-root',type=Path,default=Path(__file__).parent/'data_collection');a=ap.parse_args()
    root=a.data_root;out=root/'analysis_20261027';raw=root/'ijto_raw_20261027'
    inv=json.loads((out/'download_inventory.json').read_text(encoding='utf-8'));checks=[]
    def save(name,data):
        if isinstance(data,pd.DataFrame):data.to_json(out/(name+'.json'),orient='records',force_ascii=False,indent=2)
        else:(out/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    def load(n):
        r=max((r for r in inv if n in r['source_ids']),key=lambda r:(r['period_count'],r['row_count']))
        return pd.read_csv(raw/r['file'],dtype=str,keep_default_na=False)
    def num(d,cols):
        for c in cols:d[c]=pd.to_numeric(d[c].str.replace(',','',regex=False),errors='raise')
    def dates(d,col):
        d['period']=d[col];d['year']=d.period.str[:4].astype(int);d['month']=d.period.str[4:6].astype(int)
    def check(name,ok,**details):
        checks.append({'check':name,'passed':bool(ok),**details})
        if not ok:raise ValueError(name)
    def season(d,value,keys):
        b=d[d.year.between(2023,2025)].copy()
        check('12 months per seasonality group-year: '+value,(b.groupby(keys+['year']).month.nunique()==12).all())
        b['index']=b[value]/b.groupby(keys+['year'])[value].transform('mean')
        b['days']=[calendar.monthrange(y,m)[1] for y,m in zip(b.year,b.month)]
        b['daily']=b[value]/b.days;b['daily_index']=b.daily/b.groupby(keys+['year']).daily.transform('mean')
        return b.groupby(keys+['month'],as_index=False).agg(index_mean=('index','mean'),index_min=('index','min'),index_max=('index','max'),daily_index_mean=('daily_index','mean'))

    v=load(21);dates(v,v.columns[0]);total='총 방문객수 (내국인+외국인)';num(v,[total,'내국인 방문객수','외국인 방문객수'])
    check('Unique region-month visits',not v.duplicated(['읍면동코드','period']).any())
    check('Domestic plus foreign equals total visits',(v[total]==v['내국인 방문객수']+v['외국인 방문객수']).all())
    s=season(v,total,['읍면동명']);save('visits_seasonality',s)
    summaries=[]
    for name,g in s.groupby('읍면동명'):
        low=g.nsmallest(3,'index_mean');daily=g.nsmallest(3,'daily_index_mean')
        summaries.append({'region':name,'low_months':low.month.tolist(),'low_indices':low.index_mean.round(3).tolist(),'day_adjusted_low_months':daily.month.tolist(),'peak_month':int(g.loc[g.index_mean.idxmax(),'month']),'winter_index':round(float(g[g.month.isin([11,12,1])].index_mean.mean()),3)})
    save('region_summary',summaries)
    cur=v[v.year.isin([2025,2026]) & (v.month<=8)].groupby(['읍면동명','year'])[[total,'내국인 방문객수','외국인 방문객수']].sum().unstack('year')
    growth=pd.DataFrame({'region':cur.index,'visits_change_pct':(cur[total][2026]/cur[total][2025]-1).values*100,'foreign_share_2025_pct':(cur['외국인 방문객수'][2025]/cur[total][2025]).values*100,'foreign_share_2026_pct':(cur['외국인 방문객수'][2026]/cur[total][2026]).values*100})
    save('regional_ytd_comparison',growth)
    # Simple out-of-sample benchmark, not a claim of forecast accuracy for 2026.
    prior=v[v.year==2024].set_index(['읍면동명','month'])[total];actual=v[v.year==2025].set_index(['읍면동명','month'])[total]
    errors=(prior-actual).abs();bt=pd.DataFrame({'absolute_error':errors,'actual':actual}).groupby('읍면동명').sum();bt['seasonal_naive_wape_pct']=100*bt.absolute_error/bt.actual;save('baseline_backtest_2025',bt.reset_index())

    c=load(27);num(c,['소비금액(원)','이용건수']);dates(c,c.columns[0]);p=load(25);num(p,['소비금액(원)'])
    grouped=c.groupby(['period','관광객구분','업종명'],as_index=False)['소비금액(원)'].sum()
    published=p.rename(columns={p.columns[0]:'period','소비주체 구분':'관광객구분','소비금액(원)':'published_amount'})
    recon=grouped.merge(published,on=['period','관광객구분','업종명'],how='outer',validate='one_to_one');recon['difference_won']=recon['소비금액(원)']-recon.published_amount;recon['relative_error']=recon.difference_won.abs()/recon.published_amount
    check('Regional card sum matches province publication within 0.001%',recon.notna().all().all() and (recon.relative_error<0.00001).all(),groups=len(recon),max_absolute_difference_won=int(recon.difference_won.abs().max()),max_relative_error=float(recon.relative_error.max()))
    save('card_reconciliation',recon)
    cards=c.groupby(['period','year','month','읍면동코드','읍면동명','관광객구분','업종명'],as_index=False)[['소비금액(원)','이용건수']].sum()
    save('regional_card_monthly',cards)
    restaurant=cards[cards['업종명']=='음식점업'].groupby(['period','year','month','읍면동명'],as_index=False)['소비금액(원)'].sum()
    cs=season(restaurant,'소비금액(원)',['읍면동명']);save('restaurant_seasonality',cs)
    joined=s.merge(cs,on=['읍면동명','month'],suffixes=('_visits','_restaurant'),validate='one_to_one');joined['both_below_annual_mean']=(joined.index_mean_visits<1)&(joined.index_mean_restaurant<1);save('visit_restaurant_seasonality',joined)
    seg=cards[(cards.year==2025)&(cards['업종명']=='음식점업')].groupby(['읍면동명','관광객구분'],as_index=False)['소비금액(원)'].sum();seg['share_pct']=100*seg['소비금액(원)']/seg.groupby('읍면동명')['소비금액(원)'].transform('sum');save('restaurant_customer_mix_2025',seg)
    for region in ['애월읍','구좌읍']:
        print(region,joined[joined['읍면동명']==region][['month','index_mean_visits','index_mean_restaurant','both_below_annual_mean']].round(3).to_dict('records'),flush=True)
    h=load(39);num(h,['카드 매출액(원)','이용건수']);dates(h,h.columns[0]);h['hour']=h['시간대'].astype(int)
    hsum=h.groupby(['period','읍면동명','관광객구분','업종명'],as_index=False)['카드 매출액(원)'].sum();comp=hsum.merge(cards,on=['period','읍면동명','관광객구분','업종명'],how='outer',validate='one_to_one')
    comp['difference']=comp['카드 매출액(원)']-comp['소비금액(원)'];comp['relative_error']=comp.difference.abs()/comp['소비금액(원)']
    # Small suppressed/rounded cells can have larger relative errors; report distribution.
    save('hourly_reconciliation_summary',{'groups':len(comp),'missing_amount_cells':int(comp[['카드 매출액(원)','소비금액(원)']].isna().sum().sum()),'max_absolute_difference_won':float(comp.difference.abs().max()),'sum_absolute_difference_won':float(comp.difference.abs().sum()),'total_card_amount_won':int(cards['소비금액(원)'].sum())})
    hh=h[(h.year.between(2023,2025))&(h['업종명']=='음식점업')].groupby(['읍면동명','month','관광객구분','hour'],as_index=False)[['카드 매출액(원)','이용건수']].sum();hh['sales_share_pct']=100*hh['카드 매출액(원)']/hh.groupby(['읍면동명','month','관광객구분'])['카드 매출액(원)'].transform('sum');save('restaurant_hourly_profile',hh)
    del h,c,comp
    f=load(82);num(f,['소비금액']);dates(f,f.columns[0]);coffee=f[f['세부업종명']=='커피 전문점'].groupby(['period','year','month','관광객 구분'],as_index=False)['소비금액'].sum();save('coffee_observed_population_monthly',coffee)
    save('coffee_scope',{'observed_customer_categories':sorted(f['관광객 구분'].unique()),'geography':'제주 전체','limitation':'Downloaded export contains only residents. It cannot substantiate tourist cafe spending or 읍면동 cafe revenue.'})
    # Codes are joined by validated unique region names, never by numerical slicing.
    codes=v[['읍면동명','읍면동코드']].drop_duplicates().rename(columns={'읍면동코드':'visit_code'}).merge(cards[['읍면동명','읍면동코드']].drop_duplicates().rename(columns={'읍면동코드':'card_code'}),on='읍면동명',validate='one_to_one')
    n=load(48);num(n,['도착건수','관광객 도착 수','도민 도착 수']);dates(n,n.columns[0]);delta=n['도착건수']-n['관광객 도착 수']-n['도민 도착 수']
    checks.append({'check':'Navigation totals reconcile exactly','passed':bool((delta==0).all()),'severity':'source_warning','affected_rows':int((delta!=0).sum()),'max_absolute_difference':int(delta.abs().max()),'handling':'Keep published tourist column separately; do not derive tourist share from total or reconstruct counts.'})
    save('navigation_reconciliation',n.loc[delta!=0].assign(component_difference=delta[delta!=0]).groupby('period',as_index=False).agg(affected_rows=('component_difference','size'),difference_sum=('component_difference','sum'),max_difference=('component_difference','max')))
    codes=codes.merge(n[['읍면동명','읍면동코드']].drop_duplicates().rename(columns={'읍면동코드':'navigation_code'}),on='읍면동명',validate='one_to_one');check('All 43 regions mapped',len(codes)==43 and codes.notna().all().all());save('region_codes',codes)
    top=[]
    for year in [2025,2026]:
        z=n[(n.year==year)&(n.month<=9)&n['읍면동명'].isin(['애월읍','구좌읍'])].groupby(['읍면동명','목적지명','목적지주소','카테고리 3단계'],as_index=False)['관광객 도착 수'].sum()
        z=z.sort_values('관광객 도착 수',ascending=False).groupby('읍면동명').head(30);z['year']=year;z['period_scope']='January through September; ranks within year only';top.append(z)
    save('pilot_top_places',pd.concat(top,ignore_index=True));del n
    age=load(90);num(age,['방문객수']);dates(age,age.columns[0]);ag=age[(age.year==2025)].groupby(['성별','연령'],as_index=False)['방문객수'].sum();ag['share_pct']=100*ag['방문객수']/ag['방문객수'].sum();save('province_age_gender_2025',ag)
    origin=load(23);num(origin,['방문관광객수(명)']);dates(origin,origin.columns[0]);og=origin[origin.year==2025].groupby('방문 지역(시도)',as_index=False)['방문관광객수(명)'].sum();og['share_pct']=100*og['방문관광객수(명)']/og['방문관광객수(명)'].sum();save('province_origins_2025',og.sort_values('share_pct',ascending=False))
    arrivals=load(17);num(arrivals,list(arrivals.columns[1:]));dates(arrivals,arrivals.columns[0]);check('Arrival component totals',(arrivals['내국인 입도 관광객수']+arrivals['외국인 입도 관광객수']==arrivals['전체 입도 관광객수']).all());save('arrivals_monthly',arrivals)
    ytd=arrivals[(arrivals.year.isin([2025,2026]))&(arrivals.month<=8)].groupby('year',as_index=False)[['내국인 입도 관광객수','외국인 입도 관광객수','전체 입도 관광객수']].sum();save('arrivals_ytd',ytd)
    day=load(18);num(day,list(day.columns[1:]));day['date']=pd.to_datetime(day.iloc[:,0],format='%Y%m%d');check('Daily unique dates',not day.date.duplicated().any());day['weekday']=day.date.dt.dayofweek
    daily=day[day.date.dt.year==2025].groupby('weekday',as_index=False)['전체방문객수'].agg(['mean','count']).reset_index();save('daily_weekday_2025',daily)
    price=load(63);num(price,['가격']);latest=price.iloc[:,0].max();previous=str(int(latest)-100);pr=price[price.iloc[:,0]==latest].merge(price[price.iloc[:,0]==previous],on=['지역','메뉴'],suffixes=('_latest','_previous'),validate='one_to_one');pr['change_pct']=100*(pr['가격_latest']/pr['가격_previous']-1);save('food_price_yoy',pr)
    for sn in [83,84,85,86,87,88,93]:save('survey_'+str(sn),load(sn))
    save('validation_checks',checks)
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    plt.rcParams['font.family']='Malgun Gothic';plt.rcParams['axes.unicode_minus']=False
    fig,axs=plt.subplots(1,2,figsize=(12,4),sharey=True)
    for ax,region in zip(axs,['애월읍','구좌읍']):
        z=joined[joined['읍면동명']==region].sort_values('month');ax.plot(z.month,z.index_mean_visits,'o-',label='지역 방문');ax.plot(z.month,z.index_mean_restaurant,'s-',label='음식점 카드 소비');ax.axhline(1,color='gray',linestyle='--');ax.set(title=region,xlabel='월',xticks=range(1,13));ax.grid(alpha=.2);ax.legend()
    axs[0].set_ylabel('해당 연도 월평균 대비 지수');fig.suptitle('2023년부터 2025년까지 월별 계절지수 평균 · 제주관광빅데이터플랫폼');fig.tight_layout();fig.savefig(out/'pilot_seasonality.png',dpi=170);plt.close(fig)
    print('Analysis complete:',sum(x['passed'] for x in checks),'checks passed;',sum(not x['passed'] for x in checks),'source warnings',flush=True)

if __name__=='__main__':main()
