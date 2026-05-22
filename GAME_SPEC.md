# valeverce Game Spec

Questo file e la fonte di verita per regole e flussi del gioco.

## Costanti

- `R-CONFIG-01` Stat carte: `VALERIO` = `V`, `A`, `L`, `E`, `R`, `I`, `O`.
- `R-CONFIG-02` Label: Vigore, Astuzia, Lucidita, Ego, Rigore, Istinto, Opportunismo.
- `R-CONFIG-03` Player: minimo 2, massimo 4.
- `R-CONFIG-04` PV: start 50, max 50.
- `R-CONFIG-05` Mana: start 3, max 10, +1 a fine round per entrambi i duellanti.
- `R-CONFIG-06` Draft: budget 20, massimo 6 carte.
- `R-CONFIG-07` Pool: attacco max 20, difesa max 20, derivati da `combat.attackPower` e `combat.defensePower`.
- `R-CONFIG-08` Timer azione: 15 secondi per draft e scelta carta.
- `R-CONFIG-09` Cooldown carta: 1 round non disponibile dopo l'uso.

## Lobby

- `R-LOBBY-01` Un player crea una lobby con codice a 6 caratteri.
- `R-LOBBY-02` I player entrano con codice lobby finche la partita e in fase `lobby`.
- `R-LOBBY-03` Solo l'host puo iniziare, avanzare dopo il reveal e resettare.
- `R-LOBBY-04` Se l'host esce, il ruolo passa al primo player rimasto.

## Carte

- `R-CARD-01` Ogni carta usa `card.valerio`, non `card.special`.
- `R-CARD-02` Ogni valore VALERIO e un intero da 1 a 10.
- `R-CARD-03` La somma VALERIO di una carta non supera 40.
- `R-CARD-04` Ogni carta ha `combat.attackPower`, `combat.defensePower`, `combat.draftCost`.
- `R-CARD-05` `attackPool = floor(20 * attackPower / 100)`.
- `R-CARD-06` `defensePool = floor(20 * defensePower / 100)`.
- `R-CARD-07` La passiva e trattata come Tratto: sempre attivo se la condizione e vera, senza mana.

## Draft

- `R-DRAFT-01` A inizio partita tutti partono senza carte e draftano da un pool comune.
- `R-DRAFT-02` Il draft procede a turno seguendo l'ordine di ingresso dei player.
- `R-DRAFT-03` Ogni pick rimuove la carta dal pool per tutti.
- `R-DRAFT-04` Un player non puo superare `draftBudget` o `draftSize`.
- `R-DRAFT-05` Un player che ha 6 carte, budget finito o nessuna carta acquistabile viene saltato.
- `R-DRAFT-06` Se il timer di draft scade, il server assegna automaticamente la prima carta acquistabile.
- `R-DRAFT-07` Quando tutti hanno finito il draft, parte il primo round.

## Round E Turni

- `R-TURN-01` Le fasi sono `draft`, `select`, `plan`, `reveal`, `ended`.
- `R-TURN-02` Con 2 player giocano sempre loro due.
- `R-TURN-03` Con 3 o 4 player si gioca a coppie rotanti: 1 vs 2, 2 vs 3, 3 vs 4, 4 vs 1.
- `R-TURN-04` Solo i due player della coppia attiva scelgono carta e piano; gli altri guardano.
- `R-TURN-05` In `select` la carta avversaria resta coperta.
- `R-TURN-06` Quando entrambi hanno scelto la carta, si passa a `plan` e le carte sono rivelate.
- `R-TURN-07` Se il timer di scelta carta scade, il server seleziona la prima carta non in cooldown.

## Piano

- `R-PLAN-01` In `plan` ogni duellante sceglie esattamente 3 stat di attacco e distribuisce punti entro `attackPool`.
- `R-PLAN-02` Ogni duellante sceglie esattamente 3 stat di difesa e distribuisce punti entro `defensePool`.
- `R-PLAN-03` Attacchi e difese possono sovrapporsi.
- `R-PLAN-04` Attacchi/difese restano nascosti all'avversario fino a `reveal`.
- `R-PLAN-05` L'attiva e opzionale e si puo selezionare solo con mana sufficiente.
- `R-PLAN-06` L'attiva consuma mana al resolve se selezionata e applicabile.

## Breccia E Danno

- `R-BREACH-01` Per ogni stat attaccata: `rawDamage = attackPoints + attackerValerio - defenderValerio - defensePoints`.
- `R-BREACH-02` `lineDamage = max(0, rawDamage)`.
- `R-BREACH-03` `Breccia = somma(lineDamage) + bonus Tratto applicabili`.
- `R-BREACH-04` Vince il fight chi ha Breccia maggiore.
- `R-BREACH-05` In pareggio nessuno perde PV.
- `R-BREACH-06` Solo il vincitore infligge danno ai PV.
- `R-BREACH-07` Danno normale cappato a `floor(totalValerioCarta * 0.5)`.
- `R-BREACH-08` Le attive `damage` e `break-cap` possono superare il cap.
- `R-BREACH-09` Le attive `ignore-defense` modificano il calcolo Breccia prima del confronto.

## Mana, PV E Cooldown

- `R-STATE-01` Ogni player parte con 50 PV e 3 mana.
- `R-STATE-02` A fine round entrambi i duellanti guadagnano +1 mana fino a 10.
- `R-STATE-03` Ogni carta usata va in cooldown.
- `R-STATE-04` Internamente il cooldown viene impostato a `cardCooldownRounds + 1` e decrementato a inizio round.
- `R-STATE-05` Con cooldown 1, una carta usata nel round X non e disponibile nel round X+1 e torna disponibile nel round X+2.
- `R-STATE-06` A 0 PV il player e fuori.
- `R-STATE-07` La partita finisce quando resta un solo player vivo.

## UI

- `R-UI-01` Il top mostra codice lobby, stato connessione, numero player e stats compatte dei player.
- `R-UI-02` Le stats player nel top includono nome, PV, mana, numero carte, stato e preview immagini delle carte possedute.
- `R-UI-03` La rail sinistra e riservata alla chat.
- `R-UI-04` La rail destra mostra riepilogo dettagliato di carta, attiva, tratto, pool e confronto con avversario.
- `R-UI-05` Il timer aggiorna solo il componente timer, non tutta la pagina.
- `R-UI-06` La mano e ordinabile localmente con drag and drop.
- `R-UI-07` Il reveal mostra linee, Breccia, cap, danno finale, PV e mana prima/dopo.

## File E Asset

- `R-DATA-01` Le immagini carte stanno in `public/cards/` e devono essere nominate `<cardId>.png`.
- `R-DATA-02` I dati carte stanno in `public/data/cards.json`.
- `R-DATA-03` Ogni carta deve avere `id`, `name`, `valerio`, `combat`, `active`, `passive`.
