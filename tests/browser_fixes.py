"""Regression checks for mode switching and custom image bugs."""
from browser_machine import MachineBrowserCase
from playwright.sync_api import expect

class ReportedBugsTests(MachineBrowserCase):
    def test_switch_mode_from_active_game_preserves_choices_and_requires_explicit_restart(self):
        self.spin([0,1,2]);before=self.state()
        self.menu();self.page.locator('[name="game-mode"][value="hold"]').check()
        self.assertEqual(self.state()['round'],before['round'])
        expect(self.page.locator('#apply-game-mode')).to_be_visible()
        self.page.reload();self.menu()
        expect(self.page.locator('[name="game-mode"][value="hold"]')).to_be_checked()
        self.assertEqual(self.state()['round'],before['round'])
        self.page.locator('#apply-game-mode').click()
        expect(self.page.locator('#appearance-menu')).to_be_hidden()
        self.assertEqual(self.state()['round']['mode'],'hold')
        self.assertEqual(self.state()['round']['attempts'],0)
        self.assertEqual([(c['label'],c['emoji'],c.get('manualEmoji',False)) for c in self.state()['choices']],[(c['label'],c['emoji'],c.get('manualEmoji',False)) for c in before['choices']])
        self.spin([0,1,2]);self.menu()
        self.page.locator('[name="game-mode"][value="chance"]').check()
        self.page.locator('#apply-game-mode').click()
        expect(self.page.locator('#mode-label')).to_have_text('ČISTÁ NÁHODA')
        expect(self.page.locator('#hold-controls')).to_be_hidden()

    def test_user_words_auto_update_images_and_manual_override_has_visible_reset(self):
        for width in [390,1280]:
            self.page.set_viewport_size({'width':width,'height':900})
            for i,text in enumerate(['PS5','Pracovat','Codovat']):
                field=self.page.locator(f'[data-choice="{i}"]');field.fill(text)
                expect(self.page.locator(f'[data-emoji="{i}"] .sheet-3')).to_be_visible()
                self.assertEqual(self.state()['choices'][i]['emoji'],'🎮' if i==0 else '💻')
            self.page.reload()
            for i in range(3):expect(self.page.locator(f'[data-emoji="{i}"] .sheet-3')).to_be_visible()
        self.page.locator('[data-emoji="0"]').click()
        self.page.get_by_role('button',name='Vybrať 🍷',exact=True).click()
        self.page.locator('[data-choice="0"]').fill('Codovat')
        expect(self.page.locator('[data-auto="0"]')).to_have_text('Ručná')
        self.page.locator('[data-auto="0"]').click()
        self.assertEqual(self.state()['choices'][0]['emoji'],'💻')
        expect(self.page.locator('[data-auto="0"]')).to_have_text('Auto')
        self.page.locator('[data-choice="0"]').fill('PS5')
        self.assertEqual(self.state()['choices'][0]['emoji'],'🎮')

    def test_all_twelve_presets_are_playable_and_use_real_images(self):
        buttons=self.page.locator('[data-preset]')
        self.assertEqual(buttons.count(),12)
        for key in buttons.evaluate_all('(els)=>els.map(e=>e.dataset.preset)'):
            self.page.locator(f'[data-preset="{key}"]').click()
            expect(self.page.locator('.choice-row')).to_have_count(3)
            self.spin([0,0,0])
            self.assertTrue(self.state()['round']['done'])
            expect(self.page.locator('#result .symbol-object')).to_be_visible()
