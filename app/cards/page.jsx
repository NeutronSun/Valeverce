import cardsData from "../../public/data/cards.json";
import { CardGallery } from "../../src/client/components/CardGallery/CardGallery.jsx";

export default function CardsPage() {
  const cards = Array.isArray(cardsData) ? cardsData : cardsData.cards ?? [];

  return <CardGallery cards={cards} />;
}
