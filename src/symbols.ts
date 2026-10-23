// Local atlases cover every icon in the suggestion dictionary.
const sheets: ReadonlyArray<readonly string[]> = [
  ['🍷','🏋️','🍿','🍝','🍛','🥞','🍕','🍣','🍳','🌲','☕','🛋️','📚','🚲','🥗','✨'],
  ['🧇','🍔','🌮','🌯','🍜','🍲','🥣','🥟','🥩','🍗','🐟','🍤','🍚','🥔','🍟','🥪'],
  ['🧀','🍞','🍰','🍪','🍦','🍫','🍓','🍎','🍌','🍵','🍺','🍹','🥤','🏃','🧘','🏊'],
  ['⚽','🎾','🥾','🚶','🎮','🎵','💃','🎨','📷','🛍️','🧹','💻','📖','🛌','🎯'],
];
const aliases: Record<string,string> = {'🏋️‍♂️':'🏋️','💪':'🏋️','🎬':'🍿','🌳':'🌲','🏠':'🛋️','🚴':'🚲','🎉':'🎯','👩‍🍳':'🍳','👨‍🍳':'🍳'};
export function symbolLocation(emoji: string): {sheet: number; index: number; known: boolean} {
  const key=aliases[emoji] ?? emoji;
  for(let sheet=0;sheet<sheets.length;sheet++) {
    const index=sheets[sheet].indexOf(key);
    if(index>=0) return {sheet,index,known:true};
  }
  return {sheet:0,index:15,known:false};
}
export function symbol(emoji: string): string {
  const {sheet,index}=symbolLocation(emoji);
  const safe=emoji.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  return `<span class="symbol-emoji">${safe}</span><span class="symbol-object sheet-${sheet}" aria-hidden="true" style="background-position:${(index%4)*100/3}% ${Math.floor(index/4)*100/3}%"></span>`;
}
