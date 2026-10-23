"""Appearance menu checks; run with a local server and Python Playwright."""
import os
import unittest
from playwright.sync_api import sync_playwright, expect


class AppearanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
            headless=True, args=['--no-sandbox'],
        )

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1280, 'height': 1000})
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.url = os.environ.get('OSUD_TEST_URL', 'http://127.0.0.1:3000')
        self.page.emulate_media(reduced_motion='reduce')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def open_menu(self):
        self.page.get_by_role('button', name='Otvoriť menu', exact=True).click()
        expect(self.page.locator('#appearance-menu')).to_be_visible()

    def test_theme_persists_without_changing_existing_game_or_history(self):
        self.page.add_init_script('Object.defineProperty(crypto,"getRandomValues",{value:a=>{a[0]=0;return a;}})')
        self.page.goto(self.url, wait_until='networkidle')
        self.page.locator('#spin').click()
        expect(self.page.locator('.winner-kicker')).to_be_visible(timeout=5000)
        before = self.page.evaluate('localStorage.getItem("osud-v1")')
        self.open_menu()
        expect(self.page.get_by_role('radio', name='Dark Tmavý')).to_be_checked()
        self.page.get_by_role('radio', name='Light Svetlý').check()
        expect(self.page.locator('html')).to_have_attribute('data-theme', 'light')
        self.assertEqual(self.page.evaluate('localStorage.getItem("osud-v1")'), before)
        self.page.reload(wait_until='networkidle')
        expect(self.page.locator('html')).to_have_attribute('data-theme', 'light')
        expect(self.page.locator('#result strong')).to_have_text('Dať si víno')
        expect(self.page.locator('.history-card')).to_have_count(1)
        self.page.locator('#spin').click()
        expect(self.page.locator('html')).to_have_attribute('data-theme', 'light')
        self.open_menu()
        self.page.get_by_role('radio', name='Dark Tmavý').check()
        self.page.reload(wait_until='networkidle')
        expect(self.page.locator('html')).to_have_attribute('data-theme', 'dark')

    def test_keyboard_radio_navigation_escape_and_outside_click(self):
        self.page.goto(self.url, wait_until='networkidle')
        self.open_menu()
        expect(self.page.get_by_role('radio', name='Dark Tmavý')).to_be_focused()
        self.page.keyboard.press('ArrowRight')
        expect(self.page.get_by_role('radio', name='Light Svetlý')).to_be_checked()
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#appearance-menu')).to_be_hidden()
        expect(self.page.locator('#appearance-toggle')).to_be_focused()
        expect(self.page.locator('#appearance-toggle')).to_have_attribute('aria-expanded', 'false')
        self.open_menu()
        self.page.locator('h1').click()
        expect(self.page.locator('#appearance-menu')).to_be_hidden()

    def test_help_can_be_opened_from_the_menu_on_mobile(self):
        self.page.set_viewport_size({'width': 375, 'height': 844})
        self.page.goto(self.url, wait_until='networkidle')
        self.open_menu()
        self.page.locator('#appearance-help').click()
        expect(self.page.locator('#appearance-menu')).to_be_hidden()
        expect(self.page.locator('#help-dialog')).to_be_visible()
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#help-dialog')).to_be_hidden()

    def test_both_modes_and_menu_fit_mobile_tablet_and_desktop(self):
        self.page.goto(self.url, wait_until='networkidle')
        for width in [320, 375, 390, 768, 1440]:
            self.page.set_viewport_size({'width': width, 'height': 900})
            for label in ['Light Svetlý', 'Dark Tmavý']:
                self.open_menu()
                self.page.get_by_role('radio', name=label).check()
                self.page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
                rect = self.page.locator('#appearance-menu').bounding_box()
                self.assertGreaterEqual(rect['x'], 0)
                self.assertLessEqual(rect['x'] + rect['width'], width)
                self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
                self.page.keyboard.press('Escape')

    def test_theme_switch_during_animation_does_not_reset_round(self):
        self.page.add_init_script('window.draws=[0,1,0];Object.defineProperty(crypto,"getRandomValues",{value:a=>{a[0]=window.draws.shift();return a;}})')
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.goto(self.url, wait_until='networkidle')
        self.page.locator('#spin').click()
        self.open_menu()
        self.page.get_by_role('radio', name='Light Svetlý').check()
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#app')).not_to_have_class('is-spinning', timeout=6000)
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.getItem("osud-v1")).round.attempts'), 1)
        expect(self.page.locator('#hold-controls')).to_be_hidden()
        expect(self.page.locator('html')).to_have_attribute('data-theme', 'light')

    def test_menu_works_when_browser_storage_is_unavailable(self):
        self.page.add_init_script('''
          Storage.prototype.getItem=function(){throw new Error('Storage unavailable');};
          Storage.prototype.setItem=function(){throw new Error('Storage unavailable');};
        ''')
        self.page.goto(self.url, wait_until='networkidle')
        expect(self.page.locator('html')).to_have_attribute('data-theme', 'dark')
        self.open_menu()
        self.page.get_by_role('radio', name='Light Svetlý').check()
        expect(self.page.locator('html')).to_have_attribute('data-theme', 'light')


if __name__ == '__main__':
    unittest.main(verbosity=2)
