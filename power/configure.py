"""Import a downloaded Google web-client JSON locally; never print credentials."""
import argparse
import base64
import json
import os
import re
import secrets
import stat
from pathlib import Path
from gateway import validated_origin


def prepare(client_file, directory, origin, email):
    origin = validated_origin(origin)
    email = email.strip().lower()
    if not re.fullmatch(r'[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}', email):
        raise ValueError('Zadaj platny konkretny Google email.')
    descriptor = os.open(client_file, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'r', encoding='utf-8') as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_size > 65536:
            raise ValueError('Google JSON musi byt bezny subor do 64 KB s opravneniami 600.')
        try:
            client = json.load(source)['web']
        except (ValueError, KeyError, TypeError):
            raise ValueError('Neplatny JSON weboveho Google klienta.') from None
    if not isinstance(client, dict):
        raise ValueError('Ocakava sa Google klient typu Web application.')
    identity, secret = client.get('client_id', ''), client.get('client_secret', '')
    if (not isinstance(identity, str) or not isinstance(secret, str)
            or not re.fullmatch(r'[A-Za-z0-9._\-]+\.apps\.googleusercontent\.com', identity)
            or not re.fullmatch(r'[A-Za-z0-9._~\-]{10,}', secret)):
        raise ValueError('Google klient nema platne ID alebo secret.')
    if not isinstance(client.get('redirect_uris'), list) or origin + '/oauth2/callback' not in client['redirect_uris']:
        raise ValueError('V Google klientovi chyba presna navratova HTTPS adresa Osudu.')
    cookie = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('ascii')
    files = {
        'settings.env': ('OSUD_POWER_ORIGIN=' + origin + '\n', 0o600),
        'oauth.env': (f'OAUTH2_PROXY_CLIENT_ID={identity}\nOAUTH2_PROXY_CLIENT_SECRET={secret}\nOAUTH2_PROXY_COOKIE_SECRET={cookie}\n', 0o600),
        'allowed-emails.txt': (email + '\n', 0o644),
    }
    directory = Path(directory)
    # Fail rather than replace any existing installation or rotate its cookies.
    directory.mkdir(mode=0o700)
    created = []
    try:
        for name, (text, mode) in files.items():
            path = directory / name
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
            created.append(path)
            with os.fdopen(fd, 'w', encoding='utf-8') as target:
                target.write(text)
                target.flush()
                os.fsync(target.fileno())
            os.chmod(path, mode)
    except Exception:
        for path in created:
            path.unlink()
        directory.rmdir()
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client-file', required=True)
    parser.add_argument('--origin', required=True)
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Spusti cez sudo python3.')
    try:
        email = input('Povoleny Google email pre Osud: ')
        prepare(args.client_file, '/etc/osud-power', args.origin, email)
    except FileExistsError:
        raise SystemExit('Konfiguracia /etc/osud-power uz existuje. Nic neprepisujem.')
    except (OSError, ValueError, EOFError):
        raise SystemExit('Konfiguracia sa neulozila. Over JSON, opravnenia 600, email a Google redirect URI. Tajne udaje nevypisujem.')
    print('OK: samostatna konfiguracia Osudu je ulozena. Sluzby ani HTTPS zatial nespustene.')


if __name__ == '__main__':
    main()
