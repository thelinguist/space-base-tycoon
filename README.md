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

Releases are cut by hand from GitHub; you don't create the tag yourself.

1. Make sure `main` has everything you want to ship and CI is green.
2. Go to **Actions → Release → Run workflow**, keep the branch on `main`,
   and enter the version, e.g. `1.2.3`.

`.github/workflows/release.yml` then:

1. Checks the version looks like `1.2.3` (a leading `v` is fine), that it
   was started from `main`, and that the tag doesn't exist yet.
2. Reruns the CI checks and deploys that exact build to GitHub Pages.
3. Tags the tested commit `v1.2.3` and publishes a GitHub release with notes
   generated from the commits since the previous tag.

The tag is only created once everything else succeeds, so a failed run
leaves nothing behind; fix the problem and run it again with the same
version. Don't create releases with GitHub's **Draft a new release** button,
since the workflow would then find the tag already taken.

Release notes come from commit messages, so write them as
[Conventional Commits](https://www.conventionalcommits.org) (`feat:`,
`fix:`, `refactor:`…); they're grouped by type (see `cliff.toml`). Preview
the notes for the next release with
`bunx git-cliff@2 --unreleased --strip header`.

### One-time GitHub setup

**Settings → Pages → Build and deployment → Source:** GitHub Actions.

Releases deploy from `main`, which the `github-pages` environment allows by
default, so no extra deployment rules are needed.
