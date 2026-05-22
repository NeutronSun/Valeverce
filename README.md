# valeverce

Gioco di carte locale per 2-4 player sulla stessa rete. Il server Node serve la pagina e gestisce lobby, WebSocket, mazzi, mana e turni.

## Avvio

```bash
PORT=3000 npm run dev
```

Apri `http://localhost:3000` sul computer host. Gli altri player entrano usando uno degli indirizzi `Network` stampati dal server, per esempio `http://192.168.1.20:3000`.

## Regole

- A inizio partita si fa un draft: ogni player sceglie 6 carte dal pool comune.
- Il draft e a turni: player 1 prende una carta, poi player 2, e cosi via. Le carte gia prese non sono piu disponibili.
- Ogni round e un duello 1v1. Con 3/4 player la rotazione e 1 vs 2, 2 vs 3, 3 vs 4, 4 vs 1.
- All'inizio del duello vedi subito i 3 SPECIAL del round.
- Solo i due duellanti scelgono una carta; gli altri guardano il duello e la chat/event log.
- Nel fight ogni duellante decide se attivare la carta spendendo mana.
- Se usi l'attiva, per quel turno viene calcolata anche la passiva della carta.
- Vince il turno chi ha la somma piu alta sui 3 SPECIAL, inclusi bonus attivi/passivi.
- A inizio duello i duellanti recuperano 1 mana. Chi vince recupera 2 mana, chi perde recupera 1 mana, fino a un massimo di 10.
- Chi perde scarta la carta giocata.
- Chi resta senza carte esce. Vince l'ultimo player rimasto.

In caso di pari sul punteggio, lo spareggio usa Luck della carta, poi mana rimasto.

## Carte

I dati sono in `public/data/cards.json`. Ogni entry usa come `id` il nome del PNG in `public/cards/`.

Le immagini sono opzionali e vanno messe in `public/cards/` usando l'ID della carta:

```text
public/cards/vault-boy.png
public/cards/courier.png
```

Se manca l'immagine, la UI mostra un placeholder.

## Comandi

```bash
npm run check
npm run smoke
npm run validate:cards
```
