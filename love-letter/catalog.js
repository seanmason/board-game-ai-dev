export const EDITION='aeg-classic-2012';
export const CARDS=[null,
 {name:'Guard',count:5,help:'Name a rank 2–8 in an eligible opponent’s hand. A match eliminates them.'},
 {name:'Priest',count:2,help:'Privately look at an eligible opponent’s hand.'},
 {name:'Baron',count:2,help:'Privately compare retained cards. The lower rank is eliminated; equality changes nothing.'},
 {name:'Handmaid',count:2,help:'Other players cannot target you until your next turn begins.'},
 {name:'Prince',count:2,help:'An eligible player, including yourself, discards and replaces their hand. Princess eliminates instead.'},
 {name:'King',count:1,help:'Exchange your retained card with an eligible opponent.'},
 {name:'Countess',count:1,help:'Must be played when your other card is Prince or King. May always be played voluntarily.'},
 {name:'Princess',count:1,help:'Discarding this card for any reason eliminates its holder.'}];
export const RANKS=CARDS.flatMap((c,r)=>c?Array(c.count).fill(r):[]);
export const SOURCES={retrieved:'2026-10-18',classic:'https://alderac.com/wp-content/uploads/2017/11/Love_Letter_Rules_Final.pdf',clarification:'https://alderac.com/wp-content/uploads/2017/11/Love-Letter-Premium_Rulebook.pdf',pages:{setup:'9',turns:'10–12',victory:'13–14',effects:'15–23',sharedTie:'Premium p6, sixteen-card 2–4-player section'}};
export const cardName=r=>r===null?'Unknown card':r+' · '+CARDS[r].name;
