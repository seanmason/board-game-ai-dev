export const EDITION='space-cowboys-2019-en';
export const AUDIT='physical-entered-v1';
export const DIGITAL_AUDIT='assumed-inventory-2026-10-18-v1';
export const GOODS_TOKENS=Object.freeze([[7,7,5,5,5],[6,6,5,5,5],[5,5,5,5,5],[5,3,3,2,2,1,1],[5,3,3,2,2,1,1],[4,3,2,1,1,1,1,1,1]].map(Object.freeze));
export const BONUS_TOKENS=Object.freeze([[1,1,2,2,2,3,3],[4,4,5,5,6,6],[8,8,9,10,10]].map(Object.freeze));
export const INVENTORY_ASSUMPTION={id:DIGITAL_AUDIT,status:'user-authorized-best-supported-assumption',date:'2026-10-18',secondarySources:['https://homeofmark.com/jaipur-card-game-review/','https://tablegameshub.com/jaipur-goods-token-calculator/','https://info.bb-ai.net/student_projects/project_reports/Games/Jordan-OBrien-Jaipur-project-report.pdf'],primaryCoverage:'Publisher totals/ranges; partial physical goods and 5+ bonus photo corroboration. Complete 3/4 bonus-back audit remains unavailable.'};
export const GOODS=['diamonds','gold','silver','cloth','spice','leather'];
export const CARDS=[...GOODS,'camels'];
export const CARD_TOTALS=[6,6,6,8,8,10,11];
export const PRECIOUS=new Set([0,1,2]);
export const SOURCE={url:'https://cdn.svc.asmodee.net/production-spacecowboys/uploads/2025/11/Rules-JAIPUR-12x17-Version-EN_BD.pdf',accessed:'2026-10-18',sha256:'f831fa5f2764abfdae25cb28af9f52b435d7cbc383753a602731c17efa6cef2c',pages:'2–7',exactTokenVectorsVerified:false};
export const zero=()=>Array(6).fill(0);
export const sum=a=>a.reduce((n,x)=>n+x,0);
export function counts(cards){const c=Array(7).fill(0);for(const k of cards)c[k]++;return c;}
export function integer(n,min=0,max=55){if(!Number.isInteger(n)||n<min||n>max)throw Error('Invalid integer');return n;}
export function vector(v,length=6){if(!Array.isArray(v)||v.length!==length)throw Error('Invalid counts');v.forEach(n=>integer(n));return v;}
