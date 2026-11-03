"""Optional gateway activity and cross-origin browser data transfer."""
import json
from pathlib import Path
from browser_machine import MachineBrowserCase
from playwright.sync_api import expect

class PowerBrowserTests(MachineBrowserCase):
 def test_real_interactions_only_no_timer_heartbeat(self):
  calls=[]
  def route(request):
   action=request.request.url.rsplit('/',1)[-1];calls.append(action)
   request.fulfill(status=200,content_type='application/json',body=json.dumps({'idleLimit':900,'running':True}))
  self.page.route('**/_osud_power/*',route)
  self.page.reload(wait_until='networkidle');self.assertEqual(calls,['status','wake'])
  self.page.evaluate("document.dispatchEvent(new Event('pointerdown'))")
  self.assertNotIn('activity',calls)
  self.page.locator('[data-choice="0"]').click()
  self.page.wait_for_timeout(100);self.assertIn('activity',calls)
  self.page.clock.install();before=list(calls);self.page.clock.fast_forward(16*60*1000)
  self.assertEqual(calls,before)

 def test_export_import_preserves_dilemmas_history_and_settings(self):
  self.spin([0,0,0]);expected=self.state()
  self.menu()
  with self.page.expect_download() as download:self.page.get_by_role('button',name='Export dilem a histórie',exact=True).click()
  payload=json.loads(Path(download.value.path()).read_text())
  self.assertEqual(json.loads(payload['values']['osud-v1']),expected)
  self.page.evaluate('localStorage.removeItem("osud-v1")');self.page.reload();self.menu()
  self.page.once('dialog',lambda dialog:dialog.accept())
  self.page.locator('#appearance-menu input[type="file"]').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(payload).encode()})
  self.page.wait_for_load_state('networkidle');expect(self.page.locator('#result strong')).to_have_text('Dať si víno')
  self.assertEqual(self.state(),expected)
