from browser_machine import MachineBrowserCase
from playwright.sync_api import expect

class InstallTests(MachineBrowserCase):
    def test_manifest_icons_and_offline_saved_dilemma(self):
        manifest=self.page.request.get(self.page.url.rstrip('/')+'/manifest.webmanifest').json()
        self.assertEqual(manifest['display'],'standalone')
        for icon in manifest['icons']:
            r=self.page.request.get(self.page.url.rstrip('/')+icon['src'])
            self.assertEqual(r.status,200);self.assertTrue(r.body().startswith(b'\x89PNG'))
        self.page.locator('#question').fill('Offline večer')
        self.page.locator('#save-dilemma').click();self.page.locator('#save-form button[type="submit"]').click()
        self.page.wait_for_function("navigator.serviceWorker.controller !== null",timeout=15000)
        self.context.set_offline(True);self.page.reload(wait_until='networkidle')
        expect(self.page.locator('#question')).to_have_value('Offline večer')
        expect(self.page.locator('.saved-dilemma')).to_have_count(1)
        self.spin([0,0,0]);expect(self.page.locator('#result strong')).to_have_text('Dať si víno')

    def test_http_instructions_and_supported_install_prompt(self):
        self.page.evaluate("Object.defineProperty(window,'isSecureContext',{value:false,configurable:true})")
        self.menu();self.page.locator('#install-app').click()
        expect(self.page.locator('#install-dialog')).to_be_visible()
        expect(self.page.locator('#install-instructions')).to_contain_text('HTTP')
        expect(self.page.locator('#native-install')).to_be_hidden()
        self.page.locator('#close-install').click()
        self.page.evaluate("""()=>{const e=new Event('beforeinstallprompt');e.prompt=async()=>{window.prompted=true};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e)}""")
        self.menu();self.page.locator('#install-app').click()
        expect(self.page.locator('#native-install')).to_be_visible()
        self.page.locator('#native-install').click()
        expect(self.page.locator('#install-status')).to_contain_text('potvrdená')
        self.assertTrue(self.page.evaluate('window.prompted'))
