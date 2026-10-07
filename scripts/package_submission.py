"""Create a source-only UPAY FLOWCAST archive without local state or secrets."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'artifacts' / 'upay-flowcast-source.zip'
ROOT_FILES = {
    '.gitignore', '.dockerignore', '.env.example', 'Dockerfile', 'README.md',
    'index.html', 'package.json', 'package-lock.json', 'render.yaml', 'requirements.txt',
    'tsconfig.json', 'vite.config.ts',
}
SOURCE_DIRS = {'src', 'public', 'backend', 'tests', 'docs', 'submission', 'scripts'}
SKIP_DIRS = {'node_modules', '.venv', 'dist', '.git', '.pytest_cache', '__pycache__', '__MACOSX', 'artifacts'}
SKIP_NAMES = {'.DS_Store', '.env', 'tsconfig.tsbuildinfo'}


def eligible(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    if path.name in SKIP_NAMES or any(part in SKIP_DIRS for part in relative.parts):
        return False
    if path.suffix in {'.pyc', '.pyo', '.sqlite3'} or '.sqlite3-' in path.name:
        return False
    if path.name.startswith('.env') and path.name != '.env.example':
        return False
    return True


def files_to_package():
    files = [ROOT / name for name in ROOT_FILES if (ROOT / name).is_file()]
    for directory in SOURCE_DIRS:
        base = ROOT / directory
        if base.is_dir():
            files.extend(path for path in base.rglob('*') if path.is_file() and eligible(path))
    return sorted(set(files), key=lambda path: path.relative_to(ROOT).as_posix())


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    files = files_to_package()
    with ZipFile(OUTPUT, 'w', compression=ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(ROOT).as_posix())
    print(f'{OUTPUT} ({len(files)} files)')


if __name__ == '__main__':
    main()
