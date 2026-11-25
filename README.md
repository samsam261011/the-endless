# The Endless

Prototype d'un RPG d'exploration dans un labyrinthe vivant, jouable dans le navigateur.

## Lancer en local
```bash
npm install
npm run dev
```

## Étape 1 (actuelle)
- Labyrinthe infini généré par chunks à partir d'une graine (`?seed=123` dans l'URL pour rejouer le même).
- Vue isométrique, déplacement libre avec collisions.
- `R` : nouveau labyrinthe.

## Architecture
- `src/world/` : les lois du monde (génération déterministe). Ne dépend pas de Phaser.
- `src/render/` : l'affichage isométrique.
- `src/player/` : déplacement et collisions.
- `src/scenes/` : la scène Phaser qui relie le tout.
