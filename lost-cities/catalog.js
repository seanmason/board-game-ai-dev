export const EDITION='kosmos-691820-02-121114';
export const COLORS=['yellow','blue','white','green','red'];
export const SUITS={yellow:{name:'Yellow · Desert',symbol:'☀'},blue:{name:'Blue · Ocean',symbol:'≈'},white:{name:'White · Mountains',symbol:'△'},green:{name:'Green · Jungle',symbol:'♧'},red:{name:'Red · Volcano',symbol:'◇'}};
export const CARDS=Object.freeze(Object.assign(Object.create(null),Object.fromEntries(COLORS.flatMap(color=>[...Array.from({length:9},(_,i)=>({id:`${color}-${i+2}`,color,value:i+2})),...Array.from({length:3},(_,i)=>({id:`${color}-W${i}`,color,value:0}))].map(c=>[c.id,Object.freeze(c)])))));
export const ALL_IDS=Object.freeze(Object.keys(CARDS));
export const cardType=id=>id===null?null:CARDS[id]?`${CARDS[id].color}-${CARDS[id].value||'W'}`:undefined;
export const label=id=>id===null?'Unknown card':CARDS[id]?`${CARDS[id].color} ${CARDS[id].value||'Wager'}`:'Unknown';
export const SOURCES={accessed:'2026-10-18',directory:'https://support.thamesandkosmos.com/hc/en-us/articles/360046967034-Product-Instruction-Manuals-Downloadable-PDFs',pdf:'https://drive.google.com/file/d/1rq4JVadvrAFGH3M3B4WwTVWOO-mBKNt7/view?usp=drive_link',planSHA256:'f03ef1815e2ef878b69f6e9ae2ea3dc07be5f0bc05d7dea4d8c562cce753822f',status:'Official directory691820 link freshly verified; PDF page/hash evidence inherited from planning record, not freshly downloaded in this implementation.'};
