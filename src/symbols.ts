// One local atlas: no remote requests or AI calls when typing a choice.
const objects: Record<string, number> = {
  '🍷':0, '🏋️':1, '🏋️‍♂️':1, '💪':1, '🍿':2, '🎬':2, '🍝':3,
  '🍛':4, '🥞':5, '🍕':6, '🍣':7, '🍳':8, '🌲':9, '🌳':9,
  '☕':10, '🛋️':11, '🏠':11, '📚':12, '📖':12, '🚲':13, '🚴':13, '🥗':14,
};
export function symbol(emoji: string): string {
  const index=objects[emoji] ?? 15;
  const safe=emoji.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  return `<span class="symbol-emoji">${safe}</span><span class="symbol-object" aria-hidden="true" style="background-position:${(index%4)*100/3}% ${Math.floor(index/4)*100/3}%"></span>`;
}
