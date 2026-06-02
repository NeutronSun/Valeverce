import { GameApp } from "../src/client/components/GameApp/GameApp.jsx";
import { getInitialAuthSnapshot } from "../src/server/auth/getInitialAuthSnapshot.js";

export default async function Page() {
  const initialAuth = await getInitialAuthSnapshot();
  return <GameApp initialAuth={initialAuth} />;
}
