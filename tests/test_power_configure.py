import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'power'))
import configure

class ConfigureTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.root=Path(self.temp.name);self.file=self.root/'client.json';self.dest=self.root/'config'
  self.origin='https://casaos.example.ts.net:8459'
  self.file.write_text(json.dumps({'web':{'client_id':'123-test.apps.googleusercontent.com','client_secret':'example-secret-123','redirect_uris':[self.origin+'/oauth2/callback']}}));self.file.chmod(0o600)
 def prepare(self,email='user@example.com'):configure.prepare(self.file,self.dest,self.origin,email)
 def test_permissions_and_no_overwrite(self):
  self.prepare();before=(self.dest/'oauth.env').read_bytes()
  self.assertEqual(self.dest.stat().st_mode&0o777,0o700)
  for name in ['oauth.env','settings.env']:self.assertEqual((self.dest/name).stat().st_mode&0o777,0o600)
  self.assertEqual((self.dest/'allowed-emails.txt').stat().st_mode&0o777,0o644)
  with self.assertRaises(FileExistsError):self.prepare()
  self.assertEqual((self.dest/'oauth.env').read_bytes(),before)
 def test_public_file_rejected(self):
  self.file.chmod(0o644)
  with self.assertRaises(ValueError):self.prepare()
  self.assertFalse(self.dest.exists())
 def test_wrong_callback_rejected(self):
  self.origin='https://other.example.ts.net:8459'
  with self.assertRaises(ValueError):self.prepare()
  self.assertFalse(self.dest.exists())
 def test_email_injection_rejected(self):
  with self.assertRaises(ValueError):self.prepare('user@example.com\nattacker@example.com')
  self.assertFalse(self.dest.exists())
 def test_symlink_rejected(self):
  link=self.root/'link.json';link.symlink_to(self.file)
  with self.assertRaises(OSError):configure.prepare(link,self.dest,self.origin,'user@example.com')

if __name__=='__main__':unittest.main()
