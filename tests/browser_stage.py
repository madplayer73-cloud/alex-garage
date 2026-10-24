"""Focused machine view preserves the game and stays usable across screen sizes."""
from browser_machine import MachineBrowserCase
from playwright.sync_api import expect

class StageTests(MachineBrowserCase):
    def test_enter_back_reload_and_new_dilemma(self):
        self.page.locator('#question').fill('Čo dnes večer?')
        self.page.locator('#stage-ready').click()
        expect(self.page.locator('.choices-panel')).to_be_hidden()
        expect(self.page.locator('#stage-question')).to_have_text('Čo dnes večer?')
        self.assertEqual(self.state()['round']['attempts'],0)
        self.spin([0,1,2]);before=self.state()['round']
        self.page.locator('#stage-back').click()
        expect(self.page.locator('.choices-panel')).to_be_visible()
        self.assertEqual(self.state()['round'],before)
        self.page.locator('#stage-ready').click();self.page.reload(wait_until='networkidle')
        expect(self.page.locator('#stage-back')).to_be_visible()
        self.assertEqual(self.state()['round'],before)
        self.spin([1,1,1]);expect(self.page.locator('#result strong')).to_have_text('Ísť si zacvičiť')
        self.page.locator('#spin').click()
        expect(self.page.locator('.choices-panel')).to_be_visible()
        expect(self.page.locator('[data-choice="0"]')).to_be_focused()
        self.assertEqual(self.state()['round']['attempts'],0)

    def test_validation_escape_and_hold_mode(self):
        self.page.locator('[data-choice="0"]').fill('')
        self.page.locator('#stage-ready').click()
        expect(self.page.locator('.choices-panel')).to_be_visible()
        expect(self.page.locator('#form-error')).to_contain_text('Doplň')
        self.page.locator('[data-choice="0"]').fill('Pozrieť si film')
        self.page.locator('#stage-ready').click()
        expect(self.page.locator('#stage-back')).to_be_hidden()
        self.page.locator('[data-choice="0"]').fill('PS5')
        self.menu();self.page.locator('[name="game-mode"][value="hold"]').check();self.page.keyboard.press('Escape')
        self.page.locator('#stage-ready').click();self.spin([0,1,2])
        self.page.locator('[data-hold="0"]').click();before=self.state()['round']
        self.menu();self.page.keyboard.press('Escape')
        expect(self.page.locator('#stage-back')).to_be_visible()
        self.page.keyboard.press('Escape')
        expect(self.page.locator('.choices-panel')).to_be_visible()
        self.assertEqual(self.state()['round'],before)
        self.page.locator('#stage-open').click();self.spin([1,2]);self.spin([])
        self.assertTrue(self.state()['round']['done'])
        expect(self.page.locator('#result strong')).to_have_text('PS5')

    def test_sizes_skins_and_animation_lock(self):
        self.page.locator('#stage-ready').click()
        for width,height in [(320,740),(390,844),(844,390),(1280,800),(1920,1080)]:
            self.page.set_viewport_size({'width':width,'height':height})
            for skin in ['studio','retro','minimal','playful']:
                for theme in ['dark','light']:
                    self.menu();self.page.locator(f'[name="skin"][value="{skin}"]').check()
                    self.page.locator(f'[name="theme"][value="{theme}"]').check();self.page.keyboard.press('Escape')
                    expect(self.page.locator('#stage-back')).to_be_visible()
                    self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                    for selector in ['#spin','#result','#stage-back']:
                        box=self.page.locator(selector).bounding_box()
                        self.assertGreaterEqual(box['x'],0)
                        self.assertLessEqual(box['x']+box['width'],width+1)
            self.page.locator('#stage-back').scroll_into_view_if_needed()
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.evaluate('window.draws=[0,1,2]');self.page.locator('#spin').click()
        expect(self.page.locator('#stage-back')).to_be_disabled()
        self.page.keyboard.press('Escape');expect(self.page.locator('.choices-panel')).to_be_hidden()
        expect(self.page.locator('#stage-back')).to_be_enabled(timeout=6000)
