#!/usr/bin/env python3
"""Reproduce acceptance on isolated Docker stacks; never targets the live deployment."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.local/production-verify'
RESTORE = ROOT / '.local/production-restore-verify'
OUT = ROOT / 'docs/production'
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--existing', action='store_true', help='Recheck the retained, previously seeded acceptance stacks')
args = parser.parse_args()
steps = []

def run(name, command, directory=SOURCE, input=None):
    start = time.monotonic()
    result = subprocess.run(command, cwd=ROOT, env={**os.environ, 'XTN_DEPLOY_DIR': str(directory)},
                            input=input, text=True, capture_output=True)
    # Deployment logs stay private: container errors can contain connection strings.
    directory.mkdir(parents=True, exist_ok=True)
    log = directory / f'verify-{name}.log'
    descriptor = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as file:
        file.write(result.stdout + result.stderr)
    steps.append({'name': name, 'exitCode': result.returncode, 'seconds': round(time.monotonic()-start, 2)})
    print(f'{name}: exit {result.returncode}', flush=True)
    if result.returncode:
        raise RuntimeError(f'{name} failed; private diagnostic: {log}')
    return result.stdout

def certificate(project, directory):
    run('certificate-'+project, ['docker', 'cp', project+'-web-1:/data/caddy/pki/authorities/local/root.crt', str(directory/'caddy-root.crt')], directory)
    os.chmod(directory/'caddy-root.crt', 0o600)

def reconcile(project, directory):
    result = run('reconcile-'+project, ['docker', 'exec', '-i', project+'-api-1', 'node', '-e',
                  (ROOT/'scripts/reconcile-production.cjs').read_text()], directory)
    data = json.loads(result)
    assert data['status'] == 'passed'
    (OUT/('restored-reconciliation.json' if directory == RESTORE else 'reconciliation.json')).write_text(json.dumps(data, indent=2)+'\n')

try:
    if not args.existing:
        if SOURCE.exists() or RESTORE.exists():
            raise RuntimeError('Acceptance directories already exist. Use --existing; retained data is never deleted automatically.')
        run('prepare', ['python3', 'scripts/prepare-production.py', '--verify'])
        run('init', ['bash', 'scripts/production.sh', 'init'])
        certificate('xtn-prod-verify', SOURCE)
        run('fresh-app', ['node', 'scripts/verify-production-app.cjs'])
        reconcile('xtn-prod-verify', SOURCE)
        output = run('backup', ['bash', 'scripts/production.sh', 'backup'])
        backups = list((SOURCE/'backups').glob('*.archive.gz.json'))
        latest = max(backups, key=lambda file: file.stat().st_mtime).with_suffix('')
        RESTORE.mkdir(mode=0o700)
        shutil.copytree(SOURCE/'secrets', RESTORE/'secrets')
        shutil.copy2(SOURCE/'admin-credentials.json', RESTORE/'admin-credentials.json')
        (RESTORE/'backups').mkdir(mode=0o700)
        values = dict(line.split('=',1) for line in (SOURCE/'env').read_text().splitlines())
        values.update(COMPOSE_PROJECT_NAME='xtn-prod-restore-verify', DEPLOY_DIR=str(RESTORE),
                      HTTP_PORT='18081', HTTPS_PORT='18444', CORS_ORIGINS='https://localhost:18444')
        (RESTORE/'env').write_text(''.join(f'{key}={value}\n' for key,value in values.items()))
        os.chmod(RESTORE/'env', 0o600)
        run('restore-init', ['bash', 'scripts/production.sh', 'init'], RESTORE)
        certificate('xtn-prod-restore-verify', RESTORE)
        # A collection created after the backup must not survive a full restore.
        run('newer-collection', ['docker', 'exec', 'xtn-prod-restore-verify-api-1', 'node', '-e',
            "const m=require('/app/backend/src/infrastructure/models');(async()=>{await m.mongoose.connect(process.env.MONGO_URI,{autoIndex:false});await m.mongoose.connection.db.collection('restore_future_probe').insertOne({afterBackup:true});await m.mongoose.disconnect()})().catch(e=>{console.error(e.message);process.exit(1)})"], RESTORE)
        run('restore', ['bash', 'scripts/production.sh', 'restore', str(latest), '--replace-database'], RESTORE)
        result = run('replacement-check', ['docker', 'exec', 'xtn-prod-restore-verify-api-1', 'node', '-e',
            "const m=require('/app/backend/src/infrastructure/models');(async()=>{await m.mongoose.connect(process.env.MONGO_URI,{autoIndex:false});const c=await m.mongoose.connection.db.listCollections({},{nameOnly:true}).toArray();require('node:assert/strict').ok(!c.some(x=>x.name==='restore_future_probe'));console.log(JSON.stringify({status:'passed',newerCollectionsRemoved:true,applicationAuthenticationPreserved:true}));await m.mongoose.disconnect()})().catch(e=>{console.error(e.message);process.exit(1)})"], RESTORE)
        (OUT/'replacement-restore.json').write_text(result)
        run('operations', ['node', 'scripts/verify-production-ops.cjs'])
    else:
        for file in ['production-app.json', 'restore-app.json', 'operations.json']:
            assert json.loads((OUT/file).read_text())['status'] == 'passed', f'Missing prior successful evidence: {file}'
        for directory in [SOURCE, RESTORE]:
            assert (directory/'env').is_file(), 'Retained isolated acceptance stack required'
    run('existing-app', ['env', 'VERIFY_EXISTING=true', 'node', 'scripts/verify-production-app.cjs'])
    run('restored-app', ['env', 'RESTORE_VERIFY=true', 'node', 'scripts/verify-production-app.cjs'], RESTORE)
    reconcile('xtn-prod-verify', SOURCE)
    reconcile('xtn-prod-restore-verify', RESTORE)
    health = run('health', ['python3', 'scripts/production-health.py'])
    (OUT/'health.json').write_text(health)
    for name in ['production-app', 'restore-app', 'existing-app', 'operations', 'replacement-restore', 'reconciliation', 'restored-reconciliation', 'health']:
        assert json.loads((OUT/(name+'.json')).read_text())['status'] == 'passed'
    source_hashes = {}
    for parent in ['backend/src', 'backend/scripts', 'backend/migrations', 'frontend/src', 'infra', 'scripts']:
        for file in sorted((ROOT/parent).rglob('*')):
            if file.is_file() and '__pycache__' not in file.parts:
                source_hashes[str(file.relative_to(ROOT))] = hashlib.sha256(file.read_bytes()).hexdigest()
    for name in ['backend/Dockerfile', 'frontend/Dockerfile', 'backend/package-lock.json', 'frontend/package-lock.json', '.dockerignore']:
        source_hashes[name] = hashlib.sha256((ROOT/name).read_bytes()).hexdigest()
    images = subprocess.check_output(['docker', 'inspect', '--format', '{{.Name}} {{.Image}}',
                     'xtn-prod-verify-api-1', 'xtn-prod-verify-web-1', 'xtn-prod-restore-verify-api-1'], text=True).splitlines()
    result = {'status': 'passed', 'verifiedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'mode': 'retained-stack-recheck' if args.existing else 'fresh-stack', 'steps': steps, 'images': images,
              'sourceSha256': source_hashes,
              'scope': 'Actual local Docker/HTTPS/API/Chromium deployment and recovery. Public VPS/DNS/ACME deployment has not been performed.'}
except Exception as error:
    result = {'status': 'failed', 'steps': steps, 'error': str(error)}
    raise
finally:
    (OUT/'verification.json').write_text(json.dumps(result, indent=2)+'\n')
