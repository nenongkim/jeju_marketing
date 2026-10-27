import unittest,tempfile,json
from pathlib import Path
from publish_demo import publish,FILES,GENERATED
class PublishTests(unittest.TestCase):
 def test_allowlist(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);s=root/'source';d=root/'site';s.mkdir()
   for f in FILES:(s/f).write_text(json.dumps({'region':'구좌읍','schema_version':'1.0.0'}) if f.endswith('.json') else 'asset',encoding='utf-8')
   (s/'신청서.pdf').write_text('PRIVATE');(s/'raw.csv').write_text('PRIVATE');(s/'evaluation.json').write_text('PRIVATE');(s/'.env').write_text('PRIVATE')
   publish(s,d,'a'*40);self.assertEqual({p.name for p in d.iterdir()},set(FILES+GENERATED));self.assertFalse(any('PRIVATE' in p.read_text(encoding='utf-8') for p in d.iterdir()))
   (d/'unexpected.txt').write_text('do not delete');self.assertRaises(ValueError,publish,s,d,'a'*40);(d/'unexpected.txt').unlink()
   (s/'case.js').write_text('-----BEGIN OPENSSH PRIVATE KEY-----');self.assertRaises(ValueError,publish,s,d,'a'*40)
 def test_missing(self):
  with tempfile.TemporaryDirectory() as t:self.assertRaises(ValueError,publish,Path(t)/'source',Path(t)/'dest','a'*40)
if __name__=='__main__':unittest.main()
