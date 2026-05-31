import { SETTINGS } from "../rules/ClassicSettings.js";

export function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function makeDeck(cards) {
  const deck = shuffle(cards.map((card) => card.id));
  return deck.slice(0, SETTINGS.handSize);
}
