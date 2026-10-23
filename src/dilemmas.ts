export type SavedChoice = {label:string; emoji:string; manualEmoji?:boolean};
export type Dilemma = {id:string; question:string; choices:SavedChoice[]};
export const MAX_DILEMMAS=30;
export function validateChoices(value:unknown): value is SavedChoice[] {
  return Array.isArray(value) && value.length>=2 && value.length<=5 && value.every(c=>c && typeof c.label==='string' && c.label.trim().length>0 && c.label.length<=40 && typeof c.emoji==='string' && c.emoji.length<=30) && new Set(value.map(c=>c.label.trim().toLocaleLowerCase('sk'))).size===value.length;
}
export function restoreDilemmas(value:unknown):Dilemma[] {
  if(!Array.isArray(value)) return [];
  const seen=new Set<string>();
  return value.filter((d):d is Dilemma=>{
    if(!d || typeof d.id!=='string' || !d.id || d.id.length>100 || seen.has(d.id) || typeof d.question!=='string' || !d.question.trim() || d.question.length>80 || !validateChoices(d.choices)) return false;
    seen.add(d.id);return true;
  }).slice(0,MAX_DILEMMAS).map(d=>({id:d.id,question:d.question,choices:d.choices.map(c=>({label:c.label.trim(),emoji:c.emoji,manualEmoji:c.manualEmoji===true}))}));
}
