#!/usr/bin/env python3
"""Copy and SHA-256 verify local Laravel assets without following symlinks."""
from pathlib import Path
import hashlib
import json
import shutil

project = Path(__file__).resolve().parents[1]
laravel = project.parent

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def copy_tree(source, target, asset_only=False, overwrite=True):
    summary = {'files': 0, 'bytes': 0, 'verified': 0, 'symlinks_skipped': 0}
    records = []
    if not source.exists():
        return summary, records
    for item in sorted(source.rglob('*')):
        if item.is_symlink():
            summary['symlinks_skipped'] += 1
            continue
        if not item.is_file():
            continue
        relative = item.relative_to(source)
        if asset_only and (any(p.startswith('.') for p in relative.parts) or item.suffix.lower() == '.php' or item.name == 'artisan'):
            continue
        if not asset_only and item.name == '.gitignore':
            continue
        dest = target / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        source_hash = digest(item)
        if not dest.exists() or (overwrite and digest(dest) != source_hash):
            shutil.copy2(item, dest)
        if not overwrite and digest(dest) != source_hash:
            continue
        if digest(dest) != source_hash:
            raise RuntimeError('Checksum mismatch during asset copy')
        size = item.stat().st_size
        summary['files'] += 1
        summary['bytes'] += size
        summary['verified'] += 1
        records.append({'path': str(relative), 'bytes': size, 'sha256': source_hash})
    return summary, records

summary = {}
manifest = {}
for key, source, target, asset_only, overwrite in [
    ('builtin', laravel / 'public', project / 'assets' / 'legacy-public', True, True),
    ('uploads', laravel / 'storage/app/public', project / 'storage/uploads', False, True),
    ('private', laravel / 'storage/app/private', project / 'storage/private', False, True),
    ('cached_public', project / 'public/storage-cache', project / 'storage/uploads', False, False),
]:
    summary[key], manifest[key] = copy_tree(source, target, asset_only, overwrite)
(project / 'storage').mkdir(exist_ok=True)
(project / 'storage/asset-copy-manifest.json').write_text(json.dumps({'summary': summary, 'files': manifest}, indent=2))
print(json.dumps(summary, indent=2))
