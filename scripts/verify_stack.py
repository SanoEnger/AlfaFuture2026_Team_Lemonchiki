"""Build, test and verify persistence of the local synthetic demo."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


def main():
    try:
        subprocess.run(['docker', 'info', '--format', '{{.ServerVersion}}'],
                       cwd=ROOT, check=True, timeout=30, stdout=subprocess.DEVNULL)
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raise SystemExit('Docker Engine недоступен. Запустите исправный Docker Desktop с Linux containers и повторите проверку.')
    run(sys.executable, 'scripts/setup_env.py')
    run('docker', 'compose', 'up', '--build', '-d', '--wait')
    run('docker', 'compose', 'run', '--rm', 'tests')
    state = ROOT / '.local' / 'smoke-state.json'
    smoke = (sys.executable, 'backend/scripts/smoke.py', '--state', str(state))
    # API_PORT is read through Compose so existing shell overrides are respected.
    config = subprocess.check_output(['docker', 'compose', 'config', '--format', 'json'], cwd=ROOT)
    import json
    api = json.loads(config)['services']['api']
    port = api['ports'][0]['published']
    smoke += ('--base-url', f'http://127.0.0.1:{port}')
    run(*smoke)
    run('docker', 'compose', 'restart', 'db', 'api')
    run('docker', 'compose', 'up', '-d', '--wait')
    run(*smoke, '--verify-only')
    print('PASS: stack tests, HTTP scenarios and persistence after restart')


if __name__ == '__main__':
    main()
