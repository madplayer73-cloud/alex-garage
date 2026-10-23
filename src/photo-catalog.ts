export type Photo={key:string;label:string;url:string};
let catalog:Photo[]=[];
export function photoKey(label:string){return label.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('sk').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
export function setPhotos(value:unknown){
 catalog=Array.isArray(value)?value.filter((p):p is Photo=>p&&typeof p.label==='string'&&typeof p.key==='string'&&p.key===photoKey(p.label)&&typeof p.url==='string'&&/^\/api\/photos\/file\/[a-f0-9]{64}\.(png|jpeg|webp)$/.test(p.url)):[];
}
export const getPhotos=()=>catalog;
export const findPhoto=(label:string)=>catalog.find(p=>p.key===photoKey(label));
export function photoPrompt(labels:string[]){
 return 'Vygeneruj samostatný obrázok pre KAŽDÝ z nasledujúcich výrazov. Každý obrázok odovzdaj zvlášť, nie ako koláž alebo spoločnú mriežku.\n\n'+labels.map((label,i)=>`${i+1}. ${JSON.stringify(label)}`).join('\n')+'\n\nŠtýl: realistická produktová fotografia alebo jasná ilustrácia danej činnosti. Jeden hlavný motív v strede, štvorcový formát, svetlé neutrálne pozadie, bez textu, loga a vodoznaku. Zachovaj význam celého výrazu vrátane slov ako „ne“, „len“ alebo „zostať“. Obrázok má byť rozpoznateľný aj ako malá ikonka. Ku každému súboru uveď, ku ktorému výrazu patrí.';
}
