#!/usr/bin/env python3
"""Install user backup/health timers for the actual laptop deployment."""
from pathlib import Path
import os
import subprocess

root = Path(__file__).resolve().parents[1]
assert (root/'.local/production/env').is_file(), 'Prepare laptop deployment first'
# Unit specifier escaping; quote path values for spaces in another checkout.
def quoted(value):
    return '"' + str(value).replace('%','%%').replace('\\','\\\\').replace('"','\\"') + '"'
unit_dir = Path.home()/'.config/systemd/user'
unit_dir.mkdir(parents=True, exist_ok=True)
for name, executable, arguments in [
    ('backup', '/usr/bin/bash', [root/'scripts/production.sh','backup']),
    ('health', '/usr/bin/python3', [root/'scripts/production-health.py']),
]:
    service = f'''[Unit]
Description=XTN laptop {name}
[Service]
Type=oneshot
WorkingDirectory={str(root).replace('%','%%')}
Environment={quoted('XTN_DEPLOY_DIR='+str(root/'.local/production'))}
ExecStart={executable} {' '.join(quoted(argument) for argument in arguments)}
UMask=0077
'''
    timer = '[Unit]\nDescription=XTN laptop '+name+' schedule\n[Timer]\n'
    timer += 'OnCalendar=*-*-* 02:30:00 Asia/Ho_Chi_Minh\nPersistent=true\n' if name == 'backup' else 'OnBootSec=5min\nOnUnitActiveSec=5min\n'
    timer += '[Install]\nWantedBy=timers.target\n'
    (unit_dir/f'xtn-laptop-{name}.service').write_text(service)
    (unit_dir/f'xtn-laptop-{name}.timer').write_text(timer)
subprocess.run(['systemctl','--user','daemon-reload'],check=True)
subprocess.run(['systemd-analyze','--user','verify',str(unit_dir/'xtn-laptop-backup.service'),str(unit_dir/'xtn-laptop-health.service')],check=True)
subprocess.run(['systemctl','--user','enable','--now','xtn-laptop-backup.timer','xtn-laptop-health.timer'],check=True)
subprocess.run(['systemctl','--user','is-active','xtn-laptop-backup.timer','xtn-laptop-health.timer'],check=True)
print('Laptop user timers enabled; check loginctl show-user '+os.environ.get('USER','')+' -p Linger for execution without login.')
