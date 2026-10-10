#!/usr/bin/env python3
"""Create private deployment config; never overwrite credentials or print passwords."""
import argparse, json, os, re, secrets
from pathlib import Path
p = argparse.ArgumentParser()
p.add_argument('--domain')
p.add_argument('--verify', action='store_true')
p.add_argument('--dir')
a = p.parse_args()
root = Path(__file__).resolve().parents[1]
domain = 'localhost' if a.verify else a.domain
if not domain or not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?', domain) or (not a.verify and ('.' not in domain or domain == 'localhost')):
    p.error('Provide --domain example.com, or --verify for local acceptance')
target = Path(a.dir).resolve() if a.dir else root/'.local'/('production-verify' if a.verify else 'production')
if (target/'env').exists():
    raise SystemExit('Config already exists; retained unchanged. Use production.sh up.')
target.mkdir(parents=True, exist_ok=True, mode=0o700)
os.chmod(target,0o700)
secret_dir = target/'secrets';secret_dir.mkdir(mode=0o700)
(target/'backups').mkdir(mode=0o700)
def write(file,value):
    fd=os.open(file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f:f.write(value)
app=secrets.token_hex(32); password=secrets.token_hex(24)
write(secret_dir/'mongo-root-password',secrets.token_hex(32)+'\n')
write(secret_dir/'mongo-app-password',app+'\n')
import base64
write(secret_dir/'mongo-keyfile',base64.b64encode(secrets.token_bytes(756)).decode()+'\n')
write(secret_dir/'admin-password',password+'\n')
values={'COMPOSE_PROJECT_NAME':'xtn-prod-verify' if a.verify else 'xtn-prod','DEPLOY_DIR':str(target),'SITE_ADDRESS':domain,'CORS_ORIGINS':f'https://{domain}'+(':18443' if a.verify else ''),'HTTP_BIND':'127.0.0.1' if a.verify else '0.0.0.0','HTTP_PORT':'18080' if a.verify else '80','HTTPS_PORT':'18443' if a.verify else '443','MONGO_APP_PASSWORD':app,'JWT_SECRET':secrets.token_hex(48),'ADMIN_USERNAME':'admin','DEPLOY_UID':str(os.getuid()),'DEPLOY_GID':str(os.getgid())}
write(target/'env',''.join(f'{k}={v}\n' for k,v in values.items()))
write(target/'admin-credentials.json',json.dumps({'username':'admin','password':password},indent=2)+'\n')
print(f'Private configuration created: {target}/env; administrator credentials: {target}/admin-credentials.json')
