"""Regression checks for moving to another dilemma after a verdict.

Requires Python Playwright, Chromium and a running app (OSUD_TEST_URL).
Run: python3 tests/browser_navigation.py
"""

import os
import unittest
from playwright.sync_api import sync_playwright, expect


class NavigationTests(unittest.TestCase):
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
        self.page.add_init_script('''
          window.__draws=[];
          Object.defineProperty(crypto,'getRandomValues',{value:array=>{
            array[0]=window.__draws.length?window.__draws.shift():0;
            return array;
          }});
        ''')
        self.page.emulate_media(reduced_motion='reduce')
        self.page.goto(os.environ.get('OSUD_TEST_URL', 'http://127.0.0.1:3000'), wait_until='networkidle')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def spin(self, draws=None):
        if draws is not None:
            self.page.evaluate('(values)=>window.__draws=values', draws)
        self.page.locator('#spin').click()
        expect(self.page.locator('#app')).not_to_have_class('is-spinning', timeout=6000)

    def state(self):
        return self.page.evaluate('JSON.parse(localStorage.getItem("osud-v1"))')

    def test_restored_wine_verdict_has_a_visible_primary_next_action(self):
        self.spin()
        expect(self.page.locator('#result strong')).to_have_text('Dať si víno')
        self.page.reload(wait_until='networkidle')
        button = self.page.locator('#spin')
        expect(button).to_be_enabled()
        expect(button).to_have_text('✳Nová dilema')
        expect(self.page.locator('#lever')).to_be_disabled()
        self.page.locator('[data-preset="evening"]').click()
        self.assertEqual(self.state()['round']['attempts'], 1)
        expect(self.page.locator('#form-error')).to_contain_text('už má verdikt')
        button.click()
        expect(self.page.get_by_role('textbox', name='Možnosť 1')).to_have_value('')
        expect(self.page.get_by_role('textbox', name='Možnosť 1')).to_be_focused()
        expect(self.page.locator('.history-card')).to_have_count(1)
        self.assertEqual(self.state()['round']['attempts'], 0)

    def test_every_other_preset_starts_a_playable_new_dilemma(self):
        self.spin()
        for key, first in [('cooking', 'Špagety'), ('food', 'Pizza'),
                           ('weekend', 'Výlet do prírody'), ('evening', 'Dať si víno')]:
            self.page.locator(f'[data-preset="{key}"]').click()
            expect(self.page.get_by_role('textbox', name='Možnosť 1')).to_have_value(first)
            self.assertEqual(self.state()['round']['attempts'], 0)
            self.spin()
            expect(self.page.locator('#result strong')).to_have_text(first)
            expect(self.page.locator('#spin')).to_be_enabled()
        expect(self.page.locator('.history-card')).to_have_count(5)

    def test_editing_a_finished_choice_starts_a_new_dilemma(self):
        self.spin()
        field = self.page.get_by_role('textbox', name='Možnosť 1')
        expect(field).to_be_enabled()
        field.fill('Palacinky')
        expect(field).to_be_focused()
        expect(self.page.locator('[data-emoji="0"]')).to_have_text('🥞')
        self.assertEqual(self.state()['round']['attempts'], 0)
        self.spin()
        expect(self.page.locator('#result strong')).to_have_text('Palacinky')
        expect(self.page.locator('.history-card')).to_have_count(2)

    def test_cosmetic_icon_change_keeps_verdict_but_add_remove_start_new(self):
        self.spin()
        self.page.locator('[data-emoji="0"]').click()
        self.page.get_by_role('button', name='Vybrať 🥗', exact=True).click()
        self.assertTrue(self.state()['round']['done'])
        self.assertEqual(self.state()['round']['attempts'], 1)
        expect(self.page.locator('#result .result-icon')).to_have_text('🥗')
        self.page.locator('#add').click()
        expect(self.page.locator('.choice-row')).to_have_count(4)
        self.page.get_by_role('textbox', name='Možnosť 4').fill('Čítať knihu')
        self.spin()
        self.page.locator('[data-remove="3"]').click()
        expect(self.page.locator('.choice-row')).to_have_count(3)
        self.assertEqual(self.state()['round']['attempts'], 0)

    def test_active_holds_and_changing_to_another_question(self):
        self.spin([0, 1, 0])
        expect(self.page.get_by_role('textbox', name='Možnosť 1')).to_be_disabled()
        self.page.locator('[data-hold="0"]').click()
        self.page.locator('[data-hold="2"]').click()
        self.spin([1])
        self.assertEqual(self.state()['round']['attempts'], 2)
        self.assertEqual(self.state()['round']['held'], [True, False, True])
        self.page.locator('#edit-dilemma').click()
        expect(self.page.get_by_role('textbox', name='Možnosť 1')).to_be_enabled()
        self.assertEqual(self.state()['round']['attempts'], 0)
        self.spin([0, 1, 2])
        self.page.locator('[data-preset="cooking"]').click()
        self.assertEqual(self.state()['round']['attempts'], 0)
        self.spin()
        expect(self.page.locator('#result strong')).to_have_text('Špagety')

    def test_mobile_next_action_scrolls_to_inputs_and_keeps_history(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.spin()
        self.page.locator('#spin').click()
        field = self.page.get_by_role('textbox', name='Možnosť 1')
        expect(field).to_be_in_viewport()
        expect(field).to_be_focused()
        self.page.reload(wait_until='networkidle')
        expect(field).to_have_value('')
        expect(self.page.locator('.history-card')).to_have_count(1)
        for width in [375, 390, 768]:
            self.page.set_viewport_size({'width': width, 'height': 844})
            self.page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
            self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
