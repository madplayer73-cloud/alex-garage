"""End-to-end rules and material skins, including legacy persisted sessions."""
import os
import unittest
from playwright.sync_api import sync_playwright, expect

class MachineBrowserCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p=sync_playwright().start()
        cls.browser=cls.p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.p.stop()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1280,'height':1000},reduced_motion='reduce')
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.add_init_script('''window.draws=[];Object.defineProperty(crypto,'getRandomValues',{value:a=>{a[0]=window.draws.length?window.draws.shift():0;return a;}})''')
        self.page.goto(os.environ.get('OSUD_TEST_URL','http://127.0.0.1:3001'),wait_until='networkidle')
    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])
    def state(self):
        return self.page.evaluate('JSON.parse(localStorage.getItem("osud-v1"))')
    def menu(self):
        self.page.locator('#appearance-toggle').click()
    def spin(self,values):
        self.page.evaluate('v=>window.draws=v',values);self.page.locator('#spin').click()
        expect(self.page.locator('#spin')).to_be_enabled(timeout=6000)

class MachineTests(MachineBrowserCase):
    def test_pure_chance_three_spins_restored_and_mode_lock(self):
        expect(self.page.locator('#mode-label')).to_have_text('ČISTÁ NÁHODA')
        expect(self.page.locator('#hold-controls')).to_be_hidden()
        self.spin([0,1,2]);self.page.reload(wait_until='networkidle')
        self.menu();expect(self.page.locator('[name="game-mode"][value="hold"]')).to_be_enabled()
        self.page.keyboard.press('Escape');self.spin([2,1,0])
        expect(self.page.locator('#spin-label')).to_have_text('Finálové žrebovanie')
        self.spin([1]);expect(self.page.locator('#result strong')).to_have_text('Ísť si zacvičiť')
        self.assertEqual(self.state()['round']['attempts'],3)
        self.page.reload();expect(self.page.locator('#spin-label')).to_have_text('Nová dilema')
        self.page.locator('#spin').click();self.menu()
        expect(self.page.locator('[name="game-mode"][value="hold"]')).to_be_enabled()
    def test_hold_mode_final_completes_held_symbol_and_persists(self):
        self.menu();self.page.locator('[name="game-mode"][value="hold"]').check();self.page.keyboard.press('Escape')
        self.spin([2,0,1]);self.page.locator('[data-hold="0"]').click()
        expect(self.page.locator('[data-hold="1"]')).to_be_disabled()
        self.page.reload();self.spin([0,1])
        expect(self.page.locator('#hold-hint')).to_contain_text('dokončí tvoju podržanú')
        self.spin([]);expect(self.page.locator('#result strong')).to_have_text('Pozrieť si film')
        self.page.locator('#spin').click();self.assertEqual(self.state()['round']['mode'],'hold')
    def test_all_skins_themes_and_mobile_sizes_preserve_game(self):
        self.spin([0,1,2]);before=self.state()
        for width in [320,390,768,1440]:
            self.page.set_viewport_size({'width':width,'height':900})
            for skin in ['studio','retro','minimal','playful']:
                for theme in ['dark','light']:
                    self.menu()
                    self.page.locator(f'[name="skin"][value="{skin}"]').check()
                    self.page.locator(f'[name="theme"][value="{theme}"]').check()
                    self.page.keyboard.press('Escape')
                    self.page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
                    self.assertEqual(self.state(),before)
                    self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
                    expect(self.page.locator('html')).to_have_attribute('data-skin',skin)
                    expect(self.page.locator('html')).to_have_attribute('data-theme',theme)
                    expected=self.page.locator('.reel-item').nth(1).locator('.symbol-emoji' if skin=='playful' else '.symbol-object')
                    expect(expected).to_be_visible()
        self.page.reload();expect(self.page.locator('html')).to_have_attribute('data-skin','playful')
        self.assertEqual(self.state(),before)
    def test_asset_loads_and_skin_switch_during_animation_keeps_target_centered(self):
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.evaluate('window.draws=[2,2,2]');self.page.locator('#spin').click()
        self.menu();self.page.locator('[name="skin"][value="retro"]').check();self.page.keyboard.press('Escape')
        expect(self.page.locator('#spin')).to_be_enabled(timeout=6000)
        expect(self.page.locator('#result strong')).to_have_text('Pozrieť si film')
        for reel in self.page.locator('.reel-window').all():
            target=reel.locator('.reel-item').nth(1)
            expect(target.locator('.reel-label')).to_have_text('Pozrieť si film')
            r=reel.bounding_box();t=target.bounding_box()
            self.assertLess(abs((r['y']+r['height']/2)-(t['y']+t['height']/2)),2)
        url=self.page.locator('.symbol-object').first.evaluate("e=>getComputedStyle(e).backgroundImage.slice(5,-2)")
        response=self.page.request.get(url);self.assertEqual(response.status,200)
        self.assertIn('image/png',response.headers['content-type'])
    def test_reload_mid_animation_keeps_one_history_entry(self):
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.evaluate('window.draws=[1,1,1]');self.page.locator('#spin').click()
        self.page.reload(wait_until='networkidle')
        expect(self.page.locator('#result strong')).to_have_text('Ísť si zacvičiť')
        expect(self.page.locator('.history-card')).to_have_count(1)
        self.assertEqual(self.state()['round']['attempts'],1)
    def test_legacy_hold_game_survives_update(self):
        self.spin([0,1,2])
        self.page.evaluate('''()=>{let s=JSON.parse(localStorage.getItem('osud-v1'));delete s.round.mode;s.round.held=[true,false,false];localStorage.setItem('osud-v1',JSON.stringify(s));}''')
        self.page.reload();expect(self.page.locator('#mode-label')).to_have_text('HRA S PODRŽANÍM')
        expect(self.page.locator('[data-hold="0"]')).to_have_attribute('aria-pressed','true')
        self.spin([2,1]);self.spin([])
        expect(self.page.locator('#result strong')).to_have_text('Dať si víno')
    def test_sound_menu_and_enter_to_add_custom_unknown_option(self):
        self.menu();self.page.locator('#menu-sound').click()
        expect(self.page.locator('#menu-sound')).to_have_text('Zvuk: vypnutý')
        self.page.keyboard.press('Escape');expect(self.page.locator('#sound')).to_have_attribute('aria-pressed','false')
        self.page.locator('[data-choice="2"]').press('Enter')
        expect(self.page.locator('[data-choice="3"]')).to_be_focused()
        self.page.locator('[data-choice="3"]').fill('Moja neznáma činnosť')
        self.assertEqual(self.state()['choices'][3]['emoji'],'✨')
        self.page.reload();expect(self.page.locator('#sound')).to_have_attribute('aria-pressed','false')

if __name__=='__main__':unittest.main(verbosity=2)
