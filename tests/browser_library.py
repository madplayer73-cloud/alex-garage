from browser_machine import MachineBrowserCase
from playwright.sync_api import expect

class LibraryTests(MachineBrowserCase):
    def save(self,name,overwrite=False):
        self.page.locator('#save-dilemma').click()
        self.page.locator('#save-name').fill(name)
        self.page.locator('#update-dilemma' if overwrite else '#save-form button[type="submit"]').click()
        expect(self.page.locator('#save-dialog')).to_be_hidden()

    def test_save_reload_load_edit_update_copy_delete(self):
        self.page.locator('#question').fill('Čomu venujem večer?')
        for i,text in enumerate(['PS5','Kódovať','Fitko']):self.page.locator(f'[data-choice="{i}"]').fill(text)
        self.page.locator('[data-emoji="0"]').click();self.page.get_by_role('button',name='Vybrať 🍷',exact=True).click()
        self.save('Môj večer')
        expect(self.page.locator('.saved-dilemma')).to_have_count(1)
        self.page.reload();expect(self.page.locator('#question')).to_have_value('Čomu venujem večer?')
        self.page.locator('[data-preset="breakfast"]').click()
        self.page.locator('[data-load]').click()
        expect(self.page.locator('#question')).to_have_value('Môj večer')
        expect(self.page.locator('[data-choice="0"]')).to_have_value('PS5')
        expect(self.page.locator('[data-auto="0"]')).to_have_text('Ručná')
        self.spin([0,1,2]);before=self.state()['round']
        self.page.locator('[data-load]').click();self.assertEqual(self.state()['round'],before)
        expect(self.page.locator('#library-status')).to_contain_text('už začala')
        self.page.locator('[data-edit]').click()
        expect(self.page.locator('[data-choice="0"]')).to_be_enabled()
        self.page.locator('[data-choice="2"]').fill('Ísť behať')
        self.save('Môj upravený večer',True)
        expect(self.page.locator('.saved-dilemma')).to_have_count(1)
        expect(self.page.locator('.saved-dilemma strong')).to_have_text('Môj upravený večer')
        self.save('Ďalšia verzia')
        expect(self.page.locator('.saved-dilemma')).to_have_count(2)
        self.page.locator('[data-delete]').first.click()
        self.page.reload();expect(self.page.locator('.saved-dilemma')).to_have_count(1)
        expect(self.page.locator('.saved-dilemma strong')).to_have_text('Ďalšia verzia')

    def test_customize_builtin_without_modifying_builtin_or_saved_original(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.locator('[data-preset="breakfast"]').click()
        expect(self.page.locator('#question')).to_have_value('Raňajky')
        self.page.locator('[data-choice="0"]').fill('Ovocie')
        self.save('Moje raňajky')
        self.page.locator('[data-preset="cooking"]').click()
        self.page.locator('[data-preset="breakfast"]').click()
        expect(self.page.locator('[data-choice="0"]')).to_have_value('Vajíčka')
        self.page.locator('[data-load]').click()
        expect(self.page.locator('[data-choice="0"]')).to_have_value('Ovocie')
        self.page.locator('[data-choice="0"]').fill('Čaj')
        self.page.reload();self.page.locator('[data-load]').click()
        expect(self.page.locator('[data-choice="0"]')).to_have_value('Ovocie')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))

    def test_question_lock_and_save_do_not_consume_or_reset_attempt(self):
        self.page.locator('#question').fill('Čo dnes?');self.spin([0,1,2])
        expect(self.page.locator('#question')).to_be_disabled()
        before=self.state()['round'];self.save('Čo dnes?')
        self.assertEqual(self.state()['round'],before)
        self.page.reload();expect(self.page.locator('#question')).to_have_value('Čo dnes?')
        self.page.locator('#edit-dilemma').click()
        expect(self.page.locator('#question')).to_be_enabled()
        self.page.locator('#question').fill('Iná otázka')
        self.spin([0,0,0]);self.page.locator('#spin').click()
        expect(self.page.locator('#question')).to_have_value('')
        expect(self.page.locator('.saved-dilemma')).to_have_count(1)

    def test_validation_and_failed_storage_do_not_claim_saved(self):
        self.page.locator('[data-choice="0"]').fill('')
        self.page.locator('#save-dilemma').click()
        expect(self.page.locator('#library-status')).to_contain_text('Najprv vyplň')
        self.page.locator('[data-choice="0"]').fill('PS5')
        self.page.evaluate("()=>{Storage.prototype.setItem=function(){throw new Error('quota')}}")
        self.page.locator('#save-dilemma').click()
        self.page.locator('#save-name').fill('Test')
        self.page.locator('#save-form button[type="submit"]').click()
        expect(self.page.locator('#save-error')).to_contain_text('nepodarilo')
        expect(self.page.locator('.saved-dilemma')).to_have_count(0)

    def test_saved_question_is_escaped(self):
        self.save('<img src=x onerror="window.bad=true">')
        expect(self.page.locator('.saved-dilemma img')).to_have_count(0)
        self.page.locator('[data-load]').click()
        expect(self.page.locator('#question')).to_have_value('<img src=x onerror="window.bad=true">')
        self.assertFalse(self.page.evaluate('Boolean(window.bad)'))
