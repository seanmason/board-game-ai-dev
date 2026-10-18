export const EDITION='gen42-classic-2010';
export const TYPES=['Q','B','G','S','A'];
export const NAMES={Q:'Queen',B:'Beetle',G:'Grasshopper',S:'Spider',A:'Soldier Ant'};
export const COUNTS={Q:1,B:2,G:3,S:2,A:3};
export const PIECES=Object.freeze(Object.assign(Object.create(null),Object.fromEntries([0,1].flatMap(player=>TYPES.flatMap(type=>Array.from({length:COUNTS[type]},(_,i)=>{const id=`${player===0?'W':'B'}${type}${i+1}`;return [id,Object.freeze({id,player,type,ordinal:i+1})];}))))));
export const IDS=Object.keys(PIECES);
export const SOURCE={url:'https://www.gen42.com/wp-content/uploads/Hive-rules.pdf',product:'https://www.gen42.com/product/hive/',accessed:'2026-10-18',copyright:2010,pdfPages:12,diagramCertification:'pending-primary-pixel-audit',sha256:null};
export const queenId=player=>`${player===0?'W':'B'}Q1`;
