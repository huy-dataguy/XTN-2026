#!/usr/bin/env python3
"""Disable only XTN laptop startup/schedules; preserve data and global Docker settings."""
from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parents[1]
config = root/'.local/production/env'
assert config.is_file(), 'Laptop configuration required'
values = dict(line.split('=',1) for line in config.read_text().splitlines() if '=' in line)
assert values['COMPOSE_PROJECT_NAME'] == 'xtn-prod' and values['HTTP_BIND'] == '127.0.0.1', 'Expected laptop installation'
values['CONTAINER_RESTART'] = 'no'
config.write_text(''.join(f'{key}={value}\n' for key,value in values.items()))
config.chmod(0o600)
timers = ['xtn-laptop-backup.timer','xtn-laptop-health.timer']
subprocess.run(['systemctl','--user','disable','--now',*timers],check=True)
subprocess.run(['systemctl','--user','stop','xtn-laptop-backup.service','xtn-laptop-health.service'],check=True)
containers = ['xtn-prod-api-1','xtn-prod-web-1','xtn-prod-mongo-1','xtn-local-mongo-1']
for name in containers:
    probe = subprocess.run(['docker','inspect','--format','{{.Name}}',name],capture_output=True)
    if probe.returncode == 0:
        subprocess.run(['docker','update','--restart=no',name],check=True,stdout=subprocess.DEVNULL)
        assert subprocess.check_output(['docker','inspect','--format','{{.HostConfig.RestartPolicy.Name}}',name],text=True).strip() == 'no'
for timer in timers:
    assert subprocess.run(['systemctl','--user','is-enabled',timer],capture_output=True).returncode != 0
    assert subprocess.run(['systemctl','--user','is-active',timer],capture_output=True).returncode != 0
print(json.dumps({'status':'passed','laptopAutostart':False,'scheduledBackup':False,'scheduledHealth':False,'dataPreserved':True}))
