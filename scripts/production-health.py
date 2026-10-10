#!/usr/bin/env python3
"""Configured-origin readiness plus backup freshness. No secret values are logged."""
import datetime,json,os,ssl,time,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
dir=Path(os.environ.get('XTN_DEPLOY_DIR',root/'.local/production'))
values=dict(line.split('=',1) for line in (dir/'env').read_text().splitlines() if '=' in line)
origin=values['CORS_ORIGINS'].split(',')[0]
local_ca=dir/'caddy-root.crt'
context=ssl.create_default_context(cafile=str(local_ca) if local_ca.exists() else None)
start=time.monotonic()
try:
 with urllib.request.urlopen(origin+'/health/ready',context=context,timeout=15) as response:
  assert response.status==200 and json.load(response)['status']=='ready'
 manifests=[]
 for path in (dir/'backups').glob('xtn-*.archive.gz.json'):
  item=json.loads(path.read_text())
  if item.get('format')=='quiesced-app-db-v1' and path.with_suffix('').exists():manifests.append(item)
 assert manifests,'No successful application backup'
 latest=max(datetime.datetime.fromisoformat(item['createdAtUTC']) for item in manifests)
 age=(datetime.datetime.now(datetime.timezone.utc)-latest).total_seconds()
 assert age<48*3600,'Backup is older than 48 hours'
 print(json.dumps({'status':'passed','ready':True,'transport':'https' if origin.startswith('https:') else 'http-local','latencyMs':round((time.monotonic()-start)*1000),'backupAgeHours':round(age/3600,2)}))
except Exception as error:
 print(json.dumps({'status':'failed','error':str(error)}))
 raise SystemExit(1)
