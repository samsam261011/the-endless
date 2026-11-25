// Le temps du labyrinthe. Tout est une fonction pure du temps écoulé :
// à un instant donné, l'état du monde est toujours le même (c'est une "loi", pas du hasard).

export const DAY_SECONDS = 360; // durée d'un jour complet (jour + nuit), en secondes réelles

// Moments clés, en fraction du jour (0 = aube).
export const GATES_CLOSE_START = 0.6; // les portes commencent à se fermer
export const GATES_CLOSE_END = 0.63;
export const NIGHT_START = 0.66;
export const SHIFT_AT = 0.82; // au cœur de la nuit, le labyrinthe se réorganise
export const GATES_OPEN_START = 0.0; // à l'aube, les portes se rouvrent
export const GATES_OPEN_END = 0.03;

export interface CycleState {
  day: number; // numéro du jour (commence à 1)
  phase: number; // 0..1 dans la journée
  sun: number; // hauteur du soleil -1..1 (négatif = nuit)
  gateOpenness: number; // 0 = fermées, 1 = grandes ouvertes
  shifts: number; // nombre de réorganisations déjà survenues
  hour: number; // heure "dans le jeu", 0..24
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function cycleAt(seconds: number): CycleState {
  const total = seconds / DAY_SECONDS;
  const day = Math.floor(total) + 1;
  const phase = total - Math.floor(total);
  // Le soleil se lève à 0 et se couche vers NIGHT_START ; sinusoïde aplatie.
  const dayPart = phase / NIGHT_START;
  const sun = phase < NIGHT_START ? Math.sin(Math.PI * dayPart) : -Math.sin(Math.PI * (phase - NIGHT_START) / (1 - NIGHT_START));
  const gateOpenness =
    phase < GATES_OPEN_END
      ? smooth(GATES_OPEN_START, GATES_OPEN_END, phase)
      : 1 - smooth(GATES_CLOSE_START, GATES_CLOSE_END, phase);
  const shifts = Math.floor(total + (1 - SHIFT_AT));
  const hour = (6 + phase * 24) % 24;
  return { day, phase, sun, gateOpenness, shifts, hour };
}
