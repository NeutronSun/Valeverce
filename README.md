# Valerio The Game

Gioco di carte locale per 2-4 player sulla stessa rete. Il server Node serve la pagina e gestisce lobby, WebSocket, mazzi, mana e turni.

## Avvio

```bash
npm run dev
```

Apri `http://localhost:3000` sul computer host. Gli altri player entrano usando uno degli indirizzi `Network` stampati dal server, per esempio `http://192.168.1.20:3000`.

## Regole

- Ogni player riceve tutte le carte del set, in ordine casuale.
- Ogni turno ogni player sceglie prima una carta, senza vedere gli SPECIAL.
- Quando tutti hanno scelto, si entra nel fight: il server sceglie 3 SPECIAL casuali e mostra le carte scelte da tutti.
- Nel fight ogni player decide se attivare la carta spendendo mana.
- Se usi l'attiva, per quel turno viene calcolata anche la passiva della carta.
- Vince il turno chi ha la somma piu alta sui 3 SPECIAL, inclusi bonus attivi/passivi.
- Chi vince recupera 2 mana, fino a un massimo di 10.
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
