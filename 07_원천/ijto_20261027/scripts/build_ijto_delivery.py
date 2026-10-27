"""Package validated IJTO aggregates for this repository; raw downloads stay local."""
import argparse,hashlib,json,math,shutil
from pathlib import Path

def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--data-root',type=Path,required=True);ap.add_argument('--repo-root',type=Path,required=True);args=ap.parse_args()
    data=args.data_root;repo=args.repo_root;a=data/'analysis_20261027'
    evidence=repo/'06_증빙/ijto_20261027';source=repo/'07_원천/ijto_20261027';demo=repo/'02_제품/데이터/ijto-demo-20261027.json'
    evidence.mkdir(parents=True,exist_ok=True);source.mkdir(parents=True,exist_ok=True)
    inventory=read(a/'download_inventory.json')
    for r in inventory:
        r['selected_for_analysis']=not any(set(x['source_ids'])==set(r['source_ids']) and x['period_count']>r['period_count'] for x in inventory)
        with (data/'ijto_raw_20261027'/r['file']).open('rb') as f:
            assert hashlib.file_digest(f,'sha256').hexdigest()==r['sha256'],r['file']
    selected=[r for r in inventory if r['selected_for_analysis']]
    coverage=sorted({n for r in selected for n in r['source_ids']});assert len(coverage)==49
    summary={'snapshot_date':'2026-10-27','covered_platform_views':len(coverage),'covered_source_ids':coverage,'unique_download_files':len(inventory),'canonical_files':len(selected),'excluded_shorter_range_files':len(inventory)-len(selected),'canonical_export_rows':sum(r['row_count'] for r in selected),'canonical_bytes':sum(r['bytes'] for r in selected),'count_warning':'Exports overlap across views. Rows are not unique people or transactions.'}
    write(source/'download_inventory.json',inventory);write(evidence/'collection_summary.json',summary)
    catalog=[]
    for p in sorted((data/'ijto_public_20261027').glob('*/metadata_preview.json')):
        m=read(p);license_value='미확인'
        for table in m['tables']:
            for row in table:
                if '공공누리 유형' in row:
                    idx=row.index('공공누리 유형');license_value=(row[idx+1] if idx+1<len(row) else '') or '미확인'
        catalog.append({'regSn':m['regSn'],'title':m['title'],'url':m['url'],'page_retrieved_at':m['retrieved_at'],'page_sha256':m['sha256'],'license_display':license_value,'csv_files':[r['file'] for r in selected if m['regSn'] in r['source_ids']]})
        dest=source/'metadata'/p.parent.name;dest.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest/p.name)
    write(source/'source_catalog.json',catalog)
    excluded={'inventory.json','download_inventory.json','collection_summary.json','regional_card_monthly.json','restaurant_hourly_profile.json'}
    for p in a.iterdir():
        if p.suffix in ['.json','.png'] and p.name not in excluded:shutil.copyfile(p,evidence/p.name)
    s=read(a/'visit_restaurant_seasonality.json');codes=read(a/'region_codes.json');growth=read(a/'regional_ytd_comparison.json');mix=read(a/'restaurant_customer_mix_2025.json');hourly=read(a/'restaurant_hourly_profile.json');places=read(a/'pilot_top_places.json')
    regions=[]
    for c in codes:
        name=c['읍면동명'];rows=sorted([r for r in s if r['읍면동명']==name],key=lambda r:r['month']);assert len(rows)==12
        regions.append({'name':name,'codes':{k:v for k,v in c.items() if k!='읍면동명'},'seasonality':[{'month':r['month'],'visits_index':r['index_mean_visits'],'restaurant_spend_index':r['index_mean_restaurant'],'visits_daily_index':r['daily_index_mean_visits'],'restaurant_daily_index':r['daily_index_mean_restaurant'],'visits_year_min':r['index_min_visits'],'visits_year_max':r['index_max_visits'],'both_below_mean':r['both_below_annual_mean']} for r in rows], 'visits_ytd':next(r for r in growth if r['region']==name),'restaurant_customer_mix':[{'customer_type':r['관광객구분'],'share_pct':r['share_pct']} for r in mix if r['읍면동명']==name]})
    bundle={'schema_version':'1.0.0','snapshot_date':'2026-10-27','data_kind':'observed_public_data_aggregates','integration_status':'prepared_not_connected_to_existing_prototype','public_release_status':'source_license_review_required','attribution':'제주관광공사 제주관광빅데이터플랫폼 / 원천 SKT·BC카드·티맵','periods':{'seasonality':'2023-01/2025-12','customer_mix':'2025-01/2025-12','ytd_comparison':['2025-01/2025-08','2026-01/2026-08'],'hourly':'2023-01/2025-12','places':['2025-01/2025-09','2026-01/2026-09']},'method':'For each region and year, divide monthly value by its 12-month mean, then average the three annual indices. Daily indices first divide by days in month. Min/max are between-year ranges, not confidence intervals.','warnings':['지역 방문객은 개별 가게 손님 수가 아니며 지역·월 합계는 중복 없는 고유 인원수가 아님','음식점 소비는 전체 고객구분 합계이며 카페 전용 매출이 아님','비수기 지수는 과거 관측값 요약으로 미래 매출 예측이나 캠페인 성과가 아님','내비게이션 전체 수와 구성 수가 일치하지 않는 행이 있어 관광객 도착 열을 그대로 사용함','내비게이션 2026년 집계 기준 변경에 따라 연도 간 증감률을 계산하지 않음','세부업종 CSV에는 도민만 관측되어 관광객 카페 소비 분석에서 제외','원천별 공개 이용허락 확인 상태는 source_catalog.json 참고'],'source_mapping':{'seasonality':[21,27],'visits_ytd':[21],'restaurant_customer_mix':[27],'hourly_profiles':[39],'place_candidates':[48],'codes':[21,27,48]},'sources':[x for x in catalog if x['regSn'] in [21,27,39,48]],'regions':regions,'pilot_regions':['애월읍','구좌읍'],'hourly_profiles':[{'region':r['읍면동명'],'month':r['month'],'customer_type':r['관광객구분'],'hour':r['hour'],'sales_share_pct':r['sales_share_pct']} for r in hourly if r['읍면동명'] in ['애월읍','구좌읍']],'place_candidates':[{'region':r['읍면동명'],'name':r['목적지명'],'category':r['카테고리 3단계'],'year':r['year'],'tourist_arrivals':r['관광객 도착 수'],'status':'reference_only_source_warning'} for r in places]}
    write(demo,bundle)
    checks=read(a/'validation_checks.json');assert all(c['passed'] or c.get('severity')=='source_warning' for c in checks)
    assert len(regions)==43
    for r in regions:
        assert abs(sum(s['visits_index'] for s in r['seasonality'])/12-1)<1e-8
        assert abs(sum(s['restaurant_spend_index'] for s in r['seasonality'])/12-1)<1e-8
        assert abs(sum(x['share_pct'] for x in r['restaurant_customer_mix'])-100)<1e-6
    sums={}
    for h in bundle['hourly_profiles']:
        key=(h['region'],h['month'],h['customer_type']);sums[key]=sums.get(key,0)+h['sales_share_pct'];assert 0<=h['hour']<=23
    assert all(abs(v-100)<1e-6 for v in sums.values())
    assert len(sums)==72
    write(evidence/'delivery_validation.json',{'raw_sha256_files_verified':len(inventory),'canonical_csv_files':len(selected),'platform_views_covered':49,'demo_regions':43,'seasonality_rows':sum(len(r['seasonality']) for r in regions),'hourly_groups_normalized':len(sums),'hourly_rows':len(bundle['hourly_profiles']),'source_checks_passed':sum(c['passed'] for c in checks),'source_warnings_retained':[c for c in checks if not c['passed']],'demo_sha256':hashlib.sha256(demo.read_bytes()).hexdigest(),'status':'passed_with_documented_source_warning'})
    print(json.dumps(summary,ensure_ascii=False));print('Demo bundle',demo.stat().st_size,'bytes; validated')

if __name__=='__main__':main()
