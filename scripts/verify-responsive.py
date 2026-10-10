#!/usr/bin/env python3
"""Cross-browser responsive acceptance on the retained isolated browser fixture."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

root = Path(__file__).resolve().parents[1]
evidence = json.loads((root/'docs/redesign/evidence/full-check/verification.json').read_text())
assert evidence['status'] == 'passed', 'Complete verify-full.py first'
database = evidence['browserDatabase']
assert database.startswith('xtn_refactor_test_browser_'), 'Isolated fixture required'
out = root/'docs/production/responsive'
out.mkdir(parents=True, exist_ok=True)
with (out/'api.txt').open('w') as log:
    api = subprocess.Popen(['node','server.js'], cwd=root/'backend',
        env={**os.environ, 'MONGO_URI':f'mongodb://127.0.0.1:27028/{database}?directConnection=true',
             'JWT_SECRET':'test-only-secret-more-than-32-characters', 'NODE_ENV':'test', 'PORT':'5001'},
        stdout=log, stderr=log)
    try:
        for _ in range(100):
            if api.poll() is not None:
                raise RuntimeError('Isolated API exited before ready')
            try:
                with urllib.request.urlopen('http://127.0.0.1:5001/health/ready', timeout=1) as response:
                    if response.status == 200: break
            except OSError: pass
            time.sleep(.1)
        else: raise RuntimeError('Isolated API readiness timeout')
        with (out/'browsers.txt').open('w') as browser_log:
            result = subprocess.run(['npx','playwright','test','responsive.spec.ts','--browser=all'],
                cwd=root/'frontend', stdout=browser_log, stderr=subprocess.STDOUT)
        assert result.returncode == 0, 'Cross-browser responsive checks failed; inspect responsive/browsers.txt'
        report = json.loads((root/'frontend/test-results/results.json').read_text())
        assert report['stats']['expected'] == 3 and not report['stats']['unexpected'] and not report['stats']['skipped']
        shutil.copy2(root/'frontend/test-results/results.json',out/'browser-results.json')
        for image in (root/'frontend/test-results').glob('responsive-*.png'): shutil.copy2(image,out/image.name)
        (out/'verification.json').write_text(json.dumps({'status':'passed','browsers':['Chromium','Firefox','WebKit'],
            'widths':[320,375,390,768,1024,1440,1920], 'roles':['admin','member'], 'pageViewportChecks':231,
            'checks':['login','navigation','no page overflow','mobile touch target minimum 44px','keyboard table scrolling','no JS errors'],
            'scope':'Real browser engines on isolated Mongo fixture; responsive viewport emulation, not every physical device.'},indent=2)+'\n')
        print('Chromium, Firefox, WebKit responsive checks: passed',flush=True)
    finally:
        api.terminate()
        try: api.wait(timeout=15)
        except subprocess.TimeoutExpired:
            api.kill(); api.wait()
