import { GameApp } from "../../../../src/client/components/GameApp/GameApp.jsx";
import { getInitialAuthSnapshot } from "../../../../src/server/auth/getInitialAuthSnapshot.js";

export default async function LobbyPhasePage({ params }) {
  const { code } = await params;
  const initialAuth = await getInitialAuthSnapshot();
  return <GameApp initialAuth={initialAuth} initialLobbyId={code} />;
}
