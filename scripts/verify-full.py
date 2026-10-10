#!/usr/bin/env python3
"""Run real API/browser gates against isolated local test databases, never dev DB."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import socket
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/redesign/evidence/full-check'
OUT.mkdir(parents=True, exist_ok=True)
if (OUT/'verification.json').exists():
    import shutil
    archive=OUT/('attempt-'+str(time.time_ns()))
    archive.mkdir()
    for old in OUT.iterdir():
        if old.is_file():shutil.copy2(old,archive/old.name)
RUN = str(time.time_ns())
TEST_URI = f'mongodb://127.0.0.1:27028/xtn_refactor_test_run{RUN}?directConnection=true'
BROWSER_URI = f'mongodb://127.0.0.1:27028/xtn_refactor_test_browser_{RUN}?directConnection=true'
steps = []

def run(name, args, cwd=ROOT, env=None):
    started = time.monotonic()
    with (OUT / f'{name}.txt').open('w') as log:
        result = subprocess.run(args, cwd=cwd, env={**os.environ, **(env or {})}, stdout=log, stderr=subprocess.STDOUT)
    steps.append({'name': name, 'command': args, 'cwd': str(cwd.relative_to(ROOT)) or '.', 'exitCode': result.returncode, 'seconds': round(time.monotonic()-started, 2), 'log': f'{name}.txt'})
    print(f'{name}: exit {result.returncode}', flush=True)
    if result.returncode:
        raise RuntimeError(f'{name} failed; see {OUT / (name + ".txt")}')

try:
    for port in [5001,5174]:
        with socket.socket() as probe:
            # A stopped preview/API can leave TIME_WAIT sockets between runs.
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            probe.bind(('127.0.0.1',port))
    run('startup', ['node','scripts/verify-startup.cjs'])
    run('indexes', ['node','scripts/migrate-indexes.cjs','--apply'], env={'MIGRATION_MONGO_URI':TEST_URI})
    run('indexes-replay', ['node','scripts/migrate-indexes.cjs','--apply'], env={'MIGRATION_MONGO_URI':TEST_URI})
    run('backend', ['npm', 'test'], ROOT/'backend', {'TEST_MONGO_URI':TEST_URI})
    run('typecheck', ['npm', 'run', 'typecheck'], ROOT/'frontend')
    run('lint', ['npm', 'run', 'lint'], ROOT/'frontend')
    run('build', ['npm', 'run', 'build'], ROOT/'frontend')
    run('backend-audit', ['npm', 'audit', '--json'], ROOT/'backend')
    run('frontend-audit', ['npm', 'audit', '--json'], ROOT/'frontend')
    run('browser-indexes', ['node','scripts/migrate-indexes.cjs','--apply'], env={'MIGRATION_MONGO_URI':BROWSER_URI})
    run('browser-seed', ['node', 'scripts/seed-browser-fixture.js'], ROOT/'backend', {'TEST_MONGO_URI':BROWSER_URI})
    with (OUT/'browser-api.txt').open('w') as log:
        api = subprocess.Popen(['node', 'server.js'],cwd=ROOT/'backend',env={**os.environ,'MONGO_URI':BROWSER_URI,'JWT_SECRET':'test-only-secret-more-than-32-characters','NODE_ENV':'test','PORT':'5001'},stdout=log,stderr=subprocess.STDOUT)
        try:
            ready = False
            for _ in range(100):
                if api.poll() is not None: raise RuntimeError('Test API exited before ready')
                try:
                    with urllib.request.urlopen('http://127.0.0.1:5001/health/ready',timeout=1) as response:
                        ready = json.load(response)['status']=='ready'
                        if ready: break
                except (OSError, ValueError): pass
                time.sleep(.1)
            if not ready: raise RuntimeError('Test API did not become ready')
            run('browser', ['npm','run','test:e2e'],ROOT/'frontend')
        finally:
            api.terminate()
            try: api.wait(timeout=15)
            except subprocess.TimeoutExpired:
                api.kill();api.wait()
    # Election must run after browser requests have completed.
    run('election', ['node','scripts/verify-failover.cjs'],env={'FAILOVER_TEST_DB':f'xtn_refactor_test_run{RUN}'})
    import shutil
    shutil.copy2(ROOT/'frontend/test-results/results.json',OUT/'browser-results.json')
    for file in (ROOT/'frontend/test-results').glob('*dashboard.png'):shutil.copy2(file,OUT/file.name)
    browser=json.loads((OUT/'browser-results.json').read_text())
    if browser['stats']['unexpected'] or browser['stats']['skipped']:raise RuntimeError('Browser report has failed/skipped tests')
    status='passed'
except Exception as error:
    status='failed'
    print(str(error),flush=True)
finally:
    files=[]
    for folder in ['backend/src','backend/test','backend/migrations','frontend/src','frontend/e2e','scripts','infra']:
        files.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
    evidence={'status':status,'verifiedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'testDatabase':TEST_URI.split('/')[3].split('?')[0],'browserDatabase':BROWSER_URI.split('/')[3].split('?')[0],'steps':steps,'scope':'Isolated real local Mongo + real HTTP + Chromium; dev DB is separate. No cloud connection or production migration.','sourceSha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}}
    (OUT/'verification.json').write_text(json.dumps(evidence,indent=2)+'\n')
if status!='passed':raise SystemExit(1)
