# Backcountry Road

A survival-journey game from Charleston to Fort Prince George, South Carolina, 1756. See [SPEC.md](SPEC.md).

- `npm install`, then `npm run dev` to play locally
- `npm test` runs the game-logic tests (Vitest)
- `npm run build` writes a static site to `dist/` (relative paths, works under any sub-path)

**Deploy:** push to `main` on GitHub, and set *Settings → Pages → Source* to **GitHub Actions**. The workflow in `.github/workflows/deploy.yml` tests, builds and publishes the site.
