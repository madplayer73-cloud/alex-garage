"""Preparation, proportional stage layout, lever play and saved rounds."""
from browser_machine import MachineBrowserCase
from playwright.sync_api import expect

class StageTests(MachineBrowserCase):
    def test_preset_preparation_modes_and_return(self):
        for mode in ['chance','hold']:
            self.page.locator('[data-preset="chores"]').click()
            expect(self.page.locator('#start-dialog')).to_be_visible()
            self.page.locator(f'[name="start-mode"][value="{mode}"]').check()
            self.page.locator('#start-confirm').click()
            expect(self.page.locator('#spin')).to_be_hidden()
            self.page.evaluate('window.draws=[0,1,2]');self.page.locator('#lever').click()
            expect(self.page.locator('#lever')).to_be_enabled(timeout=6000)
            before=self.state()['round'];self.assertEqual(before['mode'],mode)
            if mode=='hold':
                self.page.locator('[data-hold="0"]').click();before=self.state()['round']
            self.page.reload(wait_until='networkidle')
            expect(self.page.locator('#stage-back')).to_be_visible()
            self.assertEqual(self.state()['round'],before)
            self.page.locator('#stage-back').click()
            self.assertEqual(self.state()['round'],before)
            self.page.locator('#edit-dilemma').click()

    def test_layout_fits_mobile_and_all_skins_without_stretching(self):
        self.page.locator('[data-preset="chores"]').click()
        self.page.locator('[name="start-mode"][value="hold"]').check()
        self.page.locator('#start-confirm').click()
        for width,height in [(320,680),(390,740),(430,900),(1440,900)]:
            self.page.set_viewport_size({'width':width,'height':height})
            for skin in ['studio','retro','minimal','playful']:
                for theme in ['dark','light']:
                    self.menu();self.page.locator(f'[name="skin"][value="{skin}"]').check()
                    self.page.locator(f'[name="theme"][value="{theme}"]').check();self.page.keyboard.press('Escape')
                    self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                    box=self.page.locator('#result').bounding_box()
                    self.assertLessEqual(box['y']+box['height'],height)
                    expect(self.page.locator('#lever')).to_be_visible()
                    expect(self.page.locator('.build-badge')).to_have_text('TEST · v0.3.0')
