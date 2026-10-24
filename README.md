# Space Base Tycoon

A 2.5D pixel-art city builder on an alien planet, built with Bun, Vite and
PixiJS.

## Development

```sh
bun install
bun dev             # game at http://localhost:8080
bun run coverage    # tests, with a 100% coverage gate
bun run lint
bun run format      # or format:check
bun run build       # lint + typecheck + production build into dist/
```

## CI

GitHub Actions runs lint, Prettier, tests with coverage, and the build on
every pull request and every push to `main` (`.github/workflows/ci.yml`).

## Releasing

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
(`feat:`, `fix:`, `refactor:`…). To release, tag `main` and push the tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/release.yml` then reruns the CI checks, deploys that build
to GitHub Pages, and publishes a GitHub release with notes generated from the
commits since the previous tag (grouped by type; see `cliff.toml`). Preview
the notes before tagging with `bunx git-cliff@2 --unreleased --strip header`.

### One-time GitHub setup

1. **Settings → Pages → Build and deployment → Source:** GitHub Actions.
2. **Settings → Environments → github-pages → Deployment branches and
   tags:** add a tag rule for `v*`. By default only `main` may deploy, which
   blocks tag deploys.
