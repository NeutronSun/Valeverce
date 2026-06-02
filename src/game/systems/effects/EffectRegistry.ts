import type { EffectHandler } from "./EffectHandler";

export class EffectRegistry {
  private readonly handlers = new Map<string, EffectHandler>();

  register(handler: EffectHandler): void {
    this.handlers.set(handler.type, handler);
  }

  registerAlias(type: string, handler: EffectHandler): void {
    this.handlers.set(type, handler);
  }

  get(type: string): EffectHandler | undefined {
    return this.handlers.get(type);
  }
}
