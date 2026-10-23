"""Real server integration; run against docker compose with a disposable photo directory."""
import os
import unittest
from pathlib import Path
from browser_machine import MachineBrowserCase
from playwright.sync_api import expect

@unittest.skipUnless(os.environ.get('OSUD_PHOTO_INTEGRATION')=='1','requires disposable photo server')
class PhotoImportTests(MachineBrowserCase):
    def test_prompt_import_and_shared_database(self):
        words=['umyť sa','zostať špinavý','umyť len zuby']
        for i,word in enumerate(words):self.page.locator(f'[data-choice="{i}"]').fill(word)
        expect(self.page.locator('#missing-photos')).to_be_visible()
        self.page.locator('#open-photo-import').click()
        for word in words:self.assertIn(word,self.page.locator('#photo-prompt').input_value())
        self.assertIn('nie ako koláž',self.page.locator('#photo-prompt').input_value())
        self.page.locator('#photo-copy').click()
        expect(self.page.locator('#photo-status')).to_contain_text('skopírovaný')
        for word in words:
            self.page.locator('#photo-missing-list button').filter(has_text=word).click()
            self.page.locator('#photo-file').set_input_files(str(Path('public/icons/icon-192.png').resolve()))
            expect(self.page.locator('#photo-preview')).to_be_visible()
            expect(self.page.locator('#photo-upload')).to_be_enabled()
            self.page.locator('#photo-upload').click()
            expect(self.page.locator('#photo-status')).to_contain_text('uložený na CasaOS')
        self.page.locator('#photo-close').click()
        expect(self.page.locator('#missing-photos')).to_be_hidden()
        expect(self.page.locator('#choices .custom-photo')).to_have_count(3)
        self.spin([0,0,0]);expect(self.page.locator('#result .custom-photo')).to_be_visible()
        before=self.state()['round'];self.menu();self.page.locator('#photo-menu').click()
        self.page.locator('#photo-label').fill('UMYT SA')
        expect(self.page.locator('#photo-replace-note')).to_contain_text('nahradíš')
        self.page.locator('#photo-file').set_input_files(str(Path('public/icons/icon-512.png').resolve()))
        self.page.locator('#photo-upload').click();expect(self.page.locator('#photo-status')).to_contain_text('uložený na CasaOS')
        self.page.locator('#photo-close').click();self.assertEqual(self.state()['round'],before)
        self.page.reload(wait_until='networkidle');expect(self.page.locator('#result .custom-photo')).to_be_visible()
        self.assertTrue(self.page.locator('#result img').evaluate('(img)=>img.complete&&img.naturalWidth>0'))
        self.page.locator('[data-emoji="0"]').click()
        self.page.get_by_role('button',name='Vybrať 🍷',exact=True).click()
        expect(self.page.locator('[data-emoji="0"] .symbol-object')).to_be_visible()
        self.page.locator('[data-auto="0"]').click()
        expect(self.page.locator('[data-emoji="0"] .custom-photo')).to_be_visible()
        for skin in ['studio','retro','minimal','playful']:
            self.menu();self.page.locator(f'[name="skin"][value="{skin}"]').check();self.page.keyboard.press('Escape')
            expect(self.page.locator('#result .custom-photo')).to_be_visible()
        self.assertEqual(self.state()['round'],before)
        other=self.browser.new_context(viewport={'width':390,'height':844})
        try:
            page=other.new_page();page.goto(os.environ['OSUD_TEST_URL'],wait_until='networkidle')
            page.locator('[data-choice="0"]').fill('UMYT SA')
            expect(page.locator('[data-emoji="0"] .custom-photo')).to_be_visible()
            self.assertTrue(page.locator('[data-emoji="0"] img').evaluate('(img)=>img.complete&&img.naturalWidth>0'))
            page.locator('#appearance-toggle').click();page.locator('#photo-menu').click()
            self.assertLessEqual(page.locator('#photo-dialog').bounding_box()['width'],390)
            expect(page.locator('#photo-upload')).to_be_disabled()
        finally:other.close()

    def test_validation_and_server_unavailable(self):
        self.menu();self.page.locator('#photo-menu').click()
        self.page.locator('#photo-file').set_input_files({'name':'bad.svg','mimeType':'image/svg+xml','buffer':b'<svg/>'})
        expect(self.page.locator('#photo-status')).to_contain_text('Použi PNG')
        expect(self.page.locator('#photo-upload')).to_be_disabled()
        self.page.locator('#photo-file').set_input_files({'name':'fake.png','mimeType':'image/png','buffer':b'not a picture'})
        expect(self.page.locator('#photo-status')).to_contain_text('nedá načítať')
        expect(self.page.locator('#photo-upload')).to_be_disabled()
        self.page.locator('#photo-close').click()
        self.page.route('**/api/photos',lambda route:route.fulfill(status=503,body='{}'))
        self.menu();self.page.locator('#photo-menu').click()
        expect(self.page.locator('#photo-status')).to_contain_text('nie je dostupné')
        expect(self.page.locator('#photo-upload')).to_be_disabled()
