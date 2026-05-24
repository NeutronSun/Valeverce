import { GameApp } from "../../../../src/client/components/GameApp.jsx";

export default async function LobbyPhasePage({ params }) {
  const { code } = await params;
  return <GameApp initialLobbyId={code} />;
}
