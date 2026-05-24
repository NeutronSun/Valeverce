# valeverce

Gioco di carte locale per 2-4 player sulla stessa rete. Il server Node avvia Next.js e Socket.IO, serve la UI React e gestisce lobby in memoria, draft, PV, mana, cooldown e turni.

## Avvio

```bash
PORT=3000 npm run dev
```

Apri `http://localhost:3000` sul computer host. Gli altri player entrano usando uno degli indirizzi `Network` stampati dal server, per esempio `http://192.168.1.20:3000`.

Per deploy su VPS o macchina LAN con Docker:

```bash
docker compose up --build
```

Il client usa Socket.IO same-origin di default. Se serve un endpoint separato, imposta `NEXT_PUBLIC_SOCKET_URL`.

## Regole

- A inizio partita si fa un draft da pool comune con budget 20 e massimo 6 carte.
- Ogni carta ha statistiche VALERIO, potenza attacco, potenza difesa e costo draft.
- Ogni round e un duello 1v1. Con 3/4 player la rotazione e 1 vs 2, 2 vs 3, 3 vs 4, 4 vs 1.
- In `select` i duellanti scelgono una carta coperta; le carte in cooldown non sono selezionabili.
- In `plan` le carte vengono rivelate e ogni duellante sceglie 3 attacchi, 3 difese e la distribuzione punti.
- La Breccia di ogni linea e `attackPoints + attackerValerio - defenderValerio - defensePoints`, mai sotto 0.
- Vince il fight chi ha Breccia maggiore. In pareggio nessuno perde PV.
- Solo il vincitore infligge danno ai PV; il danno normale e cappato, l'attiva puo superare il cap.
- Il Tratto/passiva e sempre attivo se la condizione e vera, senza mana.
- A fine round entrambi i duellanti guadagnano +1 mana, fino a 10.
- La carta usata va in cooldown. Vince chi porta gli avversari a 0 PV.

## Carte

I dati sono in `public/data/cards.json`. Ogni entry usa come `id` il nome del PNG in `public/cards/`.

Struttura minima carta:

```json
{
  "id": "Magister",
  "name": "Il Magister",
  "valerio": { "V": 3, "A": 7, "L": 9, "E": 8, "R": 6, "I": 4, "O": 3 },
  "combat": { "attackPower": 80, "defensePower": 60, "draftCost": 4 },
  "active": { "name": "Attiva", "cost": 2, "text": "...", "effect": { "type": "damage", "value": 4 } },
  "passive": { "name": "Tratto", "text": "...", "effect": { "type": "flat-damage", "value": 2 } }
}
```

Le immagini vanno messe in `public/cards/` usando l'ID della carta:

```text
public/cards/Magister.png
public/cards/Athene.png
```

## Comandi

```bash
npm run check
npm run build
npm run validate:cards
npm run smoke
```
