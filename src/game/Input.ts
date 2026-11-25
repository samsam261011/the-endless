// Clavier + souris.
// On lit event.code (position physique de la touche) : la touche "avant" est Z sur AZERTY
// et W sur QWERTY, mais les deux ont le même code "KeyW". Pareil pour Q/A ("KeyA").
//
// Souris : un clic "capture" le curseur (comme dans Minecraft), Échap le libère.
// Si le navigateur refuse la capture, on peut toujours tourner en cliquant-glissant.

export class Input {
  private down = new Set<string>();
  private handlers = new Map<string, () => void>();
  onLook: (dx: number, dy: number) => void = () => {};
  onWheel: (delta: number) => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.handlers.get(e.code)?.();
      this.down.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());

    let dragging = false;
    canvas.addEventListener('pointerdown', (e) => {
      window.focus();
      if (!this.locked()) {
        dragging = true;
        canvas.setPointerCapture(e.pointerId);
        try {
          const r = canvas.requestPointerLock?.() as unknown;
          if (r instanceof Promise) r.catch(() => {});
        } catch {
          /* capture refusée : on reste en mode cliquer-glisser */
        }
      }
    });
    canvas.addEventListener('pointerup', () => (dragging = false));
    canvas.addEventListener('pointermove', (e) => {
      if (this.locked() || dragging) this.onLook(e.movementX, e.movementY);
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.onWheel(e.deltaY);
      },
      { passive: false },
    );
  }

  locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  onKey(code: string, fn: () => void): void {
    this.handlers.set(code, fn);
  }

  is(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  /** forward : avancer/reculer. strafe : pas de côté. turn : tourner au clavier (flèches). */
  axes(): { forward: number; strafe: number; turn: number } {
    const v = (pos: string[], neg: string[]) => (this.is(...pos) ? 1 : 0) - (this.is(...neg) ? 1 : 0);
    return {
      forward: v(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
      strafe: v(['KeyD'], ['KeyA']),
      turn: v(['ArrowLeft'], ['ArrowRight']),
    };
  }
}
