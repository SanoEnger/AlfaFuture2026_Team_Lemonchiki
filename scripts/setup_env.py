"""Generate local Compose credentials without overwriting an existing .env."""
from pathlib import Path
import secrets


def main():
    target = Path(__file__).resolve().parents[1] / '.env'
    try:
        with target.open('x', encoding='utf-8') as output:
            output.write(f'POSTGRES_PASSWORD={secrets.token_hex(24)}\n'
                         f'APP_SECRET_KEY={secrets.token_urlsafe(48)}\n'
                         'API_PORT=8000\n'
                         'CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173\n')
    except FileExistsError:
        print('Existing .env preserved.')
    else:
        print('Created local .env. Credentials are not printed or committed.')


if __name__ == '__main__':
    main()
