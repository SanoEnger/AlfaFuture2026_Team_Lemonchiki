"""Verify the application stack without creating working accounts or applications."""
from pathlib import Path
import json
import subprocess
import sys
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


def main():
    run(sys.executable, 'scripts/setup_env.py')
    run('docker', 'compose', 'up', '--build', '-d', '--wait')
    run('docker', 'compose', '--profile', 'test', 'run', '--rm', 'tests')
    config = json.loads(subprocess.check_output(
        ['docker', 'compose', 'config', '--format', 'json'], cwd=ROOT))
    for service, path in (('api', '/health'), ('frontend', '/')):
        port = config['services'][service]['ports'][0]['published']
        with urlopen(f'http://127.0.0.1:{port}{path}', timeout=10) as reply:
            if reply.status != 200:
                raise RuntimeError(f'{service} is not ready')
    print('PASS: build, isolated tests and service health')


if __name__ == '__main__':
    main()
