import importlib.util
from contextlib import closing
from pathlib import Path
import sqlite3
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('backup.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BackupTest(unittest.TestCase):
    def test_wal_backup_restores_committed_data_and_token(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / 'data'
            data.mkdir()
            (data / 'admin.token').write_text('isolated-test-token')
            with closing(sqlite3.connect(data / 'orders.sqlite')) as db:
                db.execute('PRAGMA journal_mode=WAL')
                db.execute('CREATE TABLE orders (id INTEGER)')
                db.execute('INSERT INTO orders VALUES (42)')
                db.commit()
                archive_path = module.backup(data, root / 'backups')
            with tarfile.open(archive_path) as archive:
                restored = root / 'restored.sqlite'
                restored.write_bytes(archive.extractfile('data/orders.sqlite').read())
                self.assertEqual(archive.extractfile('data/admin.token').read(), b'isolated-test-token')
            with closing(sqlite3.connect(restored)) as db:
                self.assertEqual(db.execute('SELECT id FROM orders').fetchone(), (42,))
            self.assertEqual(len(list((root / 'backups').iterdir())), 1)


if __name__ == '__main__':
    unittest.main()
