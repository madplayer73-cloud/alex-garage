export function setupAppearance() {
  const toggle = document.querySelector<HTMLButtonElement>('#appearance-toggle')!;
  const panel = document.querySelector<HTMLElement>('#appearance-menu')!;
  const container = document.querySelector<HTMLElement>('.appearance-control')!;
  const choices = [...panel.querySelectorAll<HTMLInputElement>('input[name="theme"]')];

  function close(returnFocus = false) {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Otvoriť menu');
    if (returnFocus) toggle.focus();
  }

  function apply(theme: string) {
    const selected = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = selected;
    document.documentElement.style.colorScheme = selected;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', selected === 'light' ? '#f5f3ed' : '#101014');
    choices.forEach(input => { input.checked = input.value === selected; });
    try { localStorage.setItem('osud-theme', selected); } catch { /* Theme still works when storage is unavailable. */ }
  }

  const skins = [...panel.querySelectorAll<HTMLInputElement>('input[name="skin"]')];
  function applySkin(value: string) {
    const skin = ['studio','retro','minimal','playful'].includes(value) ? value : 'studio';
    document.documentElement.dataset.skin=skin;
    skins.forEach(input=>input.checked=input.value===skin);
    try { localStorage.setItem('osud-skin',skin); } catch { /* Keep session choice. */ }
  }
  applySkin(document.documentElement.dataset.skin || 'studio');
  skins.forEach(input=>input.addEventListener('change',()=>{if(input.checked) applySkin(input.value);}));
  apply(document.documentElement.dataset.theme || 'dark');
  toggle.addEventListener('click', () => {
    if (!panel.hidden) { close(); return; }
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Zavrieť menu');
    choices.find(input => input.checked)?.focus();
  });
  choices.forEach(input => input.addEventListener('change', () => { if (input.checked) apply(input.value); }));
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !container.contains(event.target as Node)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(true); }
  });
  container.addEventListener('focusout', event => {
    if (!container.contains(event.relatedTarget as Node | null)) close();
  });
  document.querySelector('#appearance-help')!.addEventListener('click', () => {
    close();
    document.querySelector<HTMLButtonElement>('#help')!.click();
  });
}
