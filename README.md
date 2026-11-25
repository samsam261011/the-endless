# The Endless

Prototype d'un RPG d'exploration dans un labyrinthe vivant, jouable dans le navigateur.

## Lancer en local
```bash
npm install
npm run dev
```

## Étape 1 (actuelle)
- Labyrinthe infini généré par chunks à partir d'une graine (`?seed=123` dans l'URL pour rejouer le même).
- Vue 3D à la troisième personne (caméra derrière le personnage), déplacement libre avec collisions.
- Glisser la souris : tourner la caméra. Molette : zoom.
- `R` : nouveau labyrinthe.

## Architecture
- `src/world/` : les lois du monde (génération déterministe). Ne dépend pas de Phaser.
- `src/render/` : l'affichage 3D (Three.js) : chunks, personnage, caméra.
- `src/game/` : boucle de jeu et contrôles.
- `src/player/` : déplacement et collisions.
