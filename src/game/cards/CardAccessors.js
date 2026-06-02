export function getCardValerio(card) {
  return card?.valerio ?? card?.special ?? {};
}

export function getCardCombat(card) {
  return card?.combat ?? {};
}
