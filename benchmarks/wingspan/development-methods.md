# Development evaluator hypotheses

This new module exports twelve bounded score adjustments. The coordinator adds
one adjustment to unchanged practical-combined. Every adjustment is zero at
terminal states or zero remaining actions. Existing evaluator modules/formulas
were not edited. None is a claim of improved strength or calibrated probability.

The design reflects the earlier screens: practical-combined remains a strong
baseline; point-only/resource-only and a pooled action planner failed; pure row
specialization failed; one-bird investment gave modest results; row-unlocks was
the only qualifying diverse-screen result. These hypotheses mostly add small
visible development opportunities rather than replace the baseline economy.
Results are motivation, not coefficient fitting or independent confirmation.

## Shared arithmetic

T is actual remaining player actions plus later rounds [8,7,6,5]; H=min(6,T/3).
Food/egg outputs use the real forest/wetland [1,1,2,2,3,3] and grassland
[2,2,3,3,4,4] sequences. Column egg payments are [0,1,1,2,2]. Room is unused
bird egg capacity; supply is the public shared egg supply. Lh is birds in row h.

An actor-hand candidate is a card and compatible non-full habitat. Typed deficit
covers matching symbols first, wild symbols from remaining stock second, then
uses two surplus tokens per missing symbol. Either cards require one allowed
symbol or any two tokens; a wild alternative accepts any one token. Candidate
D=1+ceil(typed deficit/forest output)+ceil(missing payment eggs/grassland output).
Feasible candidates require D<=T and missing eggs<=min(room,supply). This is a
favorable-acquisition approximation, not an exact legal-payment/action solver.
M(expression) means maximum of zero and expression over feasible candidates.

Demand F=max(0,total actor-hand food symbols-food stock),
W=max(0,min(open bird slots,T/3)-hand size), G=min(room,supply).
Habitat prices are forest .5, wetland .6, grassland .85. Cap(x,c) clamps to [0,c].
Only actor hand/bonuses, public rows/resources/tray/feeder and static catalogues
are used. Hidden deck order, actual hidden bonus deck and rival hands/bonuses are
never read. All formulas are deterministic and pure.

## Exact adjustments

| Name | Formula and hypothesis |
| --- | --- |
| forest-foundation | Cap(.4*.5*min(F,forest output*H)*(setup+.35*(forest output-1)),3), where setup=.6 at one forest bird, .25 at zero, otherwise zero. Food production gets credit only with visible hand food demand. |
| wetland-foundation | Same foundation equation using price .6, W, wetland output, and its row count. Card-production setup matters with open slots and too few hand cards. |
| grassland-foundation | Same foundation equation using price .85, G, grassland output, baseline output 2. Egg-production setup needs actual free capacity and supply. |
| balanced-development | Cap(.5*min(rh)+.25*(cubeRoot(product(rh+1))-1),2)*min(1,T/10), rh=min(2,Lh). Rewards breadth of developed rows rather than unbounded single-row density. |
| unlock-payback | Cap(.65*M(min(row demand,output jump*min(6,max(0,T-D)/3))*row price/D),4). Output jump is the actual next-column difference; no jump gives zero. |
| conversion-options | Cap(food conversion+egg conversion+card conversion,3), detailed below. Existing odd-column optional payments add flexibility when payment and output have a sink. |
| cheap-bird-tempo | Cap(.5*M(max(0,3-D)*min(1,(T-D)/4)*(printed points+.3*egg capacity-column egg payment)/(2+food symbols)),3). Rewards one inexpensive useful play, not all printed hand points. |
| white-power-payback | Cap(.65*M(white benefit/sqrt(D)),3). Immediate when-played effects have different payoff timing from brown engines; details below. |
| bonus-card-option | Cap(.5*M(expected best-of-two current bonus value/sqrt(D) for code13 only),3). Uses a static uniform catalogue prior, not the hidden bonus deck. |
| tray-opportunity | Cap(.65*max(0,best tray rate-best own-hand rate)*min(1,open slots/3),3). Rate=max(0,printed points-column payment-.5*food symbols)/D; tray D includes one extra draw action. |
| hand-flexibility | Cap(.3*max(0,covered compatible habitats-1)*min(3,number of distinct candidate card ids with D<=2)*min(1,T/8),2). Alternative affordable placements can support future row decisions. |
| slot-scarcity | -min(3,(.55*stranded hand cards+.12*single-remaining-habitat hand cards)*min(1,T/6)). Stranded means every compatible row is full. Full slots eliminate placement options. |

Conversions require an odd current row length (1,3,5), matching core actions.
Forest card->food value is .35*min(disposable hand,F,H), where disposable hand is
max(0,hand size-min(open slots,T/3)). Grassland food->egg value is
.45*min(food stock,max(0,G-base egg output),H). Wetland egg->card value is
.25*min(current eggs,W,H). The separate terms share neither payment stocks nor
future action allocations, so the sum's three-point cap limits overlap rather
than claiming a fully feasible plan.

White benefits are actor immediate gains only. Codes6/29 give .4*min(3,F)
(food from supply); codes8/24 give .55*min(2,W) (card draw). Codes15/58 count
currently visible fish/invertebrate feeder dice (dual counts for invertebrate),
then multiply min(that count,F) by .4. Egg codes12/26/52/65 give .7 times the
minimum of matching nest targets with room (including a matching newly played
bird), room+new capacity+payment, and supply+payment. Wild nests qualify.
The payment terms account for eggs returned to supply/free slots when playing.

Extra-play codes37/38/44/51 receive .8 only under a deliberately narrow test:
the first bird costs zero food symbols and there is a different actor-hand card
in an allowed habitat, already D=1 affordable, with current eggs covering both
column payments (plus the first-to-second column increment when required).
Otherwise this optional effect is zero. Normal food/egg costs are never assumed
waived. The restriction can make these powers receive no credit in ordinary
catalogue positions; it avoids double spending the first bird's food. Code13 is
handled by bonus-card-option, all other unsupported white effects give zero.

For code13, exclude only the actor's already-owned bonuses from the static
catalogue. Score each remaining bonus on the actor's current public board and
hand via actual bonusPoints. Sort values ascending v0..v(n-1); expected maximum
of two independent uniform catalogue draws with replacement is
sum(vi*(2*i+1)/n^2). This approximates drawing two and keeping one without reading
which bonuses remain. It is intentionally a prior, not the exact physical draw
(without replacement), and does not credit future bonus growth.

## Limits and timing

These are bounded additive hypotheses with correlated baseline features. Their
caps control scale but do not remove duplicate credit. Food acquisition assumes
favorable types and ignores feeder reroll contention. Play estimates pool eggs
and ignore source-specific egg consequences. Foundation values use visible sinks
and a capped horizon rather than an allocation search. Brown powers normally
activate right-to-left after the habitat action; this module does not simulate
them or fabricate benefits from same-turn activation ordering. White powers
trigger after placement and receive only immediate approximate benefit. Trait
and threshold bonuses use the real scoring helper, but the option prior ignores
actual remaining bonus composition. Tray cards can be taken by opponents before
acquisition; drawing one card is conservatively charged one full action. Hand
flexibility is optionality credit, not extra terminal hand points. Food likewise
has no direct terminal point value beyond tie-breaking. Full-row penalties can
be pessimistic when a hand card still has tuck/discard value.

Cost is a bounded actor-hand scan over at most three compatible habitats plus
three tray cards, fifteen board slots and, only with a feasible code13 bird, the
26-card bonus catalogue. No tree search, recursive evaluator, deep game clone,
random sampling or hidden-deck query occurs. The helper returns all twelve
adjustments so the runner can select one consistently.

## Verification

`node --test test/wingspan-development-evaluators.test.js` passes ten tests.
Semantic fixtures cover every signal family: resource-specific foundation sinks,
balanced breadth, affordable output jumps and time exhaustion, odd-column
conversion stock, cheap-play runway, white egg supply, bonus choice availability,
public tray competition, flexible habitats, and trapped hand cards. Additional
checks cover all twelve names, finite bounded values, determinism, state
immutability, terminal zero, and invariance to deck order and rival private cards.
Existing baseline validation and benchmark launch belong to the coordinator;
this module does not edit prior formulas or launch matches.
