// Clavier (ZQSD, WASD, flèches) + souris (glisser pour tourner, molette pour zoomer).
// On lit event.code (position physique de la touche) : la touche "avant" est Z sur AZERTY
// et W sur QWERTY, mais les deux ont le même code "KeyW". Pareil pour Q/A ("KeyA").

export class Input {
  private down = new Set<string>();
  private handlers = new Map<string, () => void>();
  onDrag: (dx: number, dy: number) => void = () => {};
  onWheel: (delta: number) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.handlers.get(e.code)?.();
      this.down.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());

    let dragging = false;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      window.focus();
    });
    canvas.addEventListener('pointerup', () => (dragging = false));
    canvas.addEventListener('pointermove', (e) => {
      if (dragging) this.onDrag(e.movementX, e.movementY);
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

  onKey(code: string, fn: () => void): void {
    this.handlers.set(code, fn);
  }

  private is(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  axes(): { forward: number; right: number } {
    return {
      forward: (this.is('KeyW', 'ArrowUp') ? 1 : 0) - (this.is('KeyS', 'ArrowDown') ? 1 : 0),
      right: (this.is('KeyD', 'ArrowRight') ? 1 : 0) - (this.is('KeyA', 'ArrowLeft') ? 1 : 0),
    };
  }
}
