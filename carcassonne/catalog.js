/** Base-game factual topology, transcribed from publisher Big Box (2021), p22.
 * Directions N,E,S,W=0..3. Field boundary half-ports clockwise:
 * Nw,Ne,En,Es,Se,Sw,Ws,Wn=0..7. Roads/cities use side ports.
 * Feature IDs survive rotation; fields explicitly list adjacent LOCAL city IDs.
 * Decorative gardens/buildings do not divide fields in the core game. */
const f=(type,ports,extra={})=>({type,ports,...extra});
const city=(ports,shield=0)=>f('city',ports,{shield});
const road=ports=>f('road',ports);
const field=(ports,cities=[])=>f('field',ports,{cities});
const monk=()=>f('monastery',[]);
const all=[0,1,2,3,4,5,6,7];
const rows=[
 ['A',2,'Monastery · road','FFRF',[road([2]),monk(),field(all)]],
 ['B',4,'Monastery · meadow','FFFF',[monk(),field(all)]],
 ['C',1,'Four-sided city · shield','CCCC',[city([0,1,2,3],1)]],
 ['D',4,'City cap · straight road','CRFR',[city([0]),road([1,3]),field([2,7],[0]),field([3,4,5,6])]],
 ['E',5,'City cap','CFFF',[city([0]),field([2,3,4,5,6,7],[0])]],
 ['F',2,'Connected opposite city · shield','CFCF',[city([0,2],1),field([2,3],[0]),field([6,7],[0])]],
 ['G',1,'Connected opposite city','CFCF',[city([0,2]),field([2,3],[0]),field([6,7],[0])]],
 ['H',3,'Separate opposite cities','FCFC',[city([1]),city([3]),field([0,1,4,5],[0,1])]],
 ['I',2,'Separate adjacent cities','CFFC',[city([0]),city([3]),field([2,3,4,5],[0,1])]],
 ['J',3,'City cap · road bends east','CRRF',[city([0]),road([1,2]),field([2,5,6,7],[0]),field([3,4])]],
 ['K',3,'City cap · road bends west','CFRR',[city([0]),road([2,3]),field([2,3,4,7],[0]),field([5,6])]],
 ['L',3,'City cap · three road ends','CRRR',[city([0]),road([1]),road([2]),road([3]),field([2,7],[0]),field([3,4]),field([5,6])]],
 ['M',2,'City corner · shield','CCFF',[city([0,1],1),field([4,5,6,7],[0])]],
 ['N',3,'City corner','CCFF',[city([0,1]),field([4,5,6,7],[0])]],
 ['O',2,'City corner · road bend · shield','CCRR',[city([0,1],1),road([2,3]),field([4,7],[0]),field([5,6])]],
 ['P',3,'City corner · road bend','CCRR',[city([0,1]),road([2,3]),field([4,7],[0]),field([5,6])]],
 ['Q',1,'Three-sided city · shield','CCFC',[city([0,1,3],1),field([4,5],[0])]],
 ['R',3,'Three-sided city','CCFC',[city([0,1,3]),field([4,5],[0])]],
 ['S',2,'Three-sided city · road end · shield','CCRC',[city([0,1,3],1),road([2]),field([4],[0]),field([5],[0])]],
 ['T',1,'Three-sided city · road end','CCRC',[city([0,1,3]),road([2]),field([4],[0]),field([5],[0])]],
 ['U',8,'Straight road','RFRF',[road([0,2]),field([1,2,3,4]),field([0,5,6,7])]],
 ['V',9,'Road bend','FFRR',[road([2,3]),field([0,1,2,3,4,7]),field([5,6])]],
 ['W',4,'Three road ends','FRRR',[road([1]),road([2]),road([3]),field([0,1,2,7]),field([3,4]),field([5,6])]],
 ['X',1,'Four road ends','RRRR',[road([0]),road([1]),road([2]),road([3]),field([0,7]),field([1,2]),field([3,4]),field([5,6])]]
];
export const TILES=Object.fromEntries(rows.map(([id,count,name,edges,features])=>[id,{id,count,name,edges:edges.split(''),features}]));
export const TILE_LIST=Object.values(TILES);
export const START_TILE='D';
const ROTATION_CACHE=new Map();
export function rotated(id,r=0){const t=TILES[id];if(!t)throw Error('Unknown base-game tile');r=((r%4)+4)%4;const cached=ROTATION_CACHE.get(id+r);if(cached)return cached;const result={...t,edges:t.edges.map((_,s)=>t.edges[(s-r+4)%4]),features:t.features.map((a,i)=>({...a,id:i,ports:a.ports.map(p=>(p+(a.type==='field'?2*r:r))%(a.type==='field'?8:4))}))};ROTATION_CACHE.set(id+r,result);return result;}
export function inventory(){return Object.fromEntries(TILE_LIST.map(t=>[t.id,t.count]));}
export const SOURCE_MANIFEST={edition:'Carcassonne core base game; farmers included; River and Abbot excluded',rules:{url:'https://www.hans-im-glueck.de/wp-content/uploads/2024/11/Carcassonne-v3_Rulesheet_EN_web.pdf',sha256:'866dd81e824f6541a560b4c352f86456c7344ebf9edcf4e334775d1942885865'},inventory:{url:'https://www.hans-im-glueck.de/wp-content/uploads/2023/06/Carc-Big-Box_Rulebook_EN-komprimiert.pdf-komprimiert_1.pdf',sha256:'c47f12410d3ab6fdb2aec946b3184ea817ba727ef109b3e85a73a67d4b522ebc',page:22},farmers:{url:'https://www.hans-im-glueck.de/wp-content/uploads/2024/11/Carcassonne-v3_Supplement_EN_web.pdf',sha256:'9a1d518170199d078690c0fe7820409957cbe6a955a2a42290dfee2cc5174cc3',page:1},checked:'2026-10-17'};
