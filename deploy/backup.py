#!/usr/bin/env python3
"""Create and restore-check a private, consistent SQLite backup on the VPS."""
import datetime
from contextlib import closing
import os
from pathlib import Path
import shutil
import sqlite3
import tarfile
import tempfile


def backup(data, destination, config_files=()):
    os.umask(0o077)
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    final = destination / ('taroway-' + stamp + '.tar.gz')
    partial = final.with_suffix('.partial')
    try:
        with tempfile.TemporaryDirectory(dir=destination) as temp:
            staging = Path(temp)
            with closing(sqlite3.connect((data / 'orders.sqlite').as_uri() + '?mode=ro', uri=True)) as source:
                with closing(sqlite3.connect(staging / 'orders.sqlite')) as target:
                    source.backup(target)
                    if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                        raise RuntimeError('Backup integrity check failed')
            shutil.copyfile(data / 'admin.token', staging / 'admin.token')
            with tarfile.open(partial, 'w:gz') as archive:
                archive.add(staging / 'orders.sqlite', arcname='data/orders.sqlite')
                archive.add(staging / 'admin.token', arcname='data/admin.token')
                for path in config_files:
                    archive.add(path, arcname='config/' + str(path).lstrip('/'), recursive=False)
            # Read the archived database back and check it, not only the source copy.
            restored = staging / 'restored.sqlite'
            with tarfile.open(partial, 'r:gz') as archive:
                with archive.extractfile('data/orders.sqlite') as source, restored.open('wb') as target:
                    shutil.copyfileobj(source, target)
            with closing(sqlite3.connect(restored)) as restored_db:
                if restored_db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise RuntimeError('Restore integrity check failed')
            os.replace(partial, final)
    finally:
        partial.unlink(missing_ok=True)
    return final


if __name__ == '__main__':
    result = backup(Path('/var/lib/taroway-site'), Path('/var/backups/taroway'), (
        Path('/etc/nginx/sites-available/taroway'),
        Path('/etc/systemd/system/taroway-api.service'),
    ))
    print('Backup and restore check OK:', result.name)
