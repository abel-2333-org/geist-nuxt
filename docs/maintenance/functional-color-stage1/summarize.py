"""Summarize existing browser evidence; never change classifications or ratios."""
import csv
import json
from pathlib import Path

root = Path(__file__).resolve().parents[3]
artifacts = root / '.output/functional-artifacts'
reports = [json.loads((artifacts / f'{mode}-{theme}.json').read_text()) for mode in ['baseline','recommended','amber-solid'] for theme in ['light','dark']]
output = Path(__file__).parent
fields = ['mode','theme','component','id','role','variant','slot','route','surface','state','index','status','ratio','effectiveForeground','effectiveBackground','reason']
with (output/'browser-matrix.csv').open('w',newline='') as handle:
    writer=csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    for report in reports:
        for record in report['records']:
            row={field:record.get(field,'') for field in fields}
            row.update(mode=report['mode'],theme=report['theme'])
            for field in ['effectiveForeground','effectiveBackground']:
                if isinstance(row[field],list): row[field]=json.dumps(row[field])
            writer.writerow(row)
summary=[]
role_rows=[]
f_rows=[]
for report in reports:
    measured=[r for r in report['records'] if 'ratio'in r]
    summary.append({'mode':report['mode'],'theme':report['theme'],**report['summary'],'minimumRatio':min(r['ratio'] for r in measured),'source':report['source'],'infrastructureError':report.get('infrastructureError'),'consoleErrors':report.get('consoleErrors')})
    for role in ['primary','secondary','success','info','warning','error']:
        for variant in ['solid','subtle']:
            matches=[r for r in measured if r.get('role')==role and r.get('component')=='Badge' and r.get('variant')==variant]
            role_rows.append({'mode':report['mode'],'theme':report['theme'],'role':role,'component':'Badge','variant':variant,'surfaces':len(matches),'minimumRatio':min(r['ratio'] for r in matches)})
    for id in ['F1','F2','F3','F4','F5','F6','F7','F8','F9']:
        matches=[r for r in measured if r.get('id')==id and r.get('route','').startswith('/kits/')]
        f_rows.append({'mode':report['mode'],'theme':report['theme'],'id':id,'actualPageSamples':len(matches),'minimumRatio':min((r['ratio'] for r in matches),default=None)})
(output/'summary.json').write_text(json.dumps({'summary':summary,'solidSubtlePairs':role_rows,'F1-F9ActualPages':f_rows},indent=2)+'\n')
print(json.dumps(summary,indent=2))
