"""Build a portable, precompiled CasaOS ZIP using Python's standard library."""

from pathlib import Path
import argparse
import hashlib
import shutil
import subprocess
import tempfile
import zipfile


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=root / 'release' / 'osud-casaos.zip')
    args = parser.parse_args()
    output = args.output.resolve()
    subprocess.run(['npm', 'test'], cwd=root, check=True)
    subprocess.run(['npm', 'run', 'build'], cwd=root, check=True)
    output.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix='osud-casaos-') as temporary:
        bundle = Path(temporary) / 'osud'
        bundle.mkdir()
        shutil.copytree(root / 'dist', bundle / 'dist')
        shutil.copytree(root / 'server', bundle / 'server')
        for source, name in [
            ('deploy/Dockerfile.prebuilt', 'Dockerfile'),
            ('deploy/nginx.conf', 'nginx.conf'),
            ('docker-compose.yml', 'docker-compose.yml'),
            ('deploy/CASAOS.md', 'SPUSTENIE.md'),
        ]:
            shutil.copyfile(root / source, bundle / name)
        (bundle / '.env.example').write_text('OSUD_PORT=8099\n')
        checksums = []
        for file in sorted(bundle.rglob('*')):
            if file.is_file():
                checksums.append(f'{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.relative_to(bundle).as_posix()}')
        (bundle / 'SHA256SUMS').write_text('\n'.join(checksums) + '\n')
        for entry in [bundle, *bundle.rglob('*')]:
            entry.chmod(0o755 if entry.is_dir() else 0o644)
        with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for file in sorted(bundle.rglob('*')):
                if file.is_file():
                    archive.write(file, arcname=f'osud/{file.relative_to(bundle).as_posix()}')

    print(f'CasaOS ZIP: {output} ({output.stat().st_size:,} bytes)')
    print(f'SHA256: {hashlib.sha256(output.read_bytes()).hexdigest()}')


if __name__ == '__main__':
    main()
