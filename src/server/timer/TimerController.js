export class TimerController {
  schedule(lobby, phase, delayMs, callback) {
    this.clear(lobby);
    const deadlineAt = Date.now() + delayMs;
    lobby.deadlineAt = deadlineAt;
    lobby.actionTimer = setTimeout(() => callback(deadlineAt), delayMs);
  }

  clear(lobby) {
    if (lobby.actionTimer) {
      clearTimeout(lobby.actionTimer);
    }
    lobby.actionTimer = null;
    lobby.deadlineAt = null;
  }
}
