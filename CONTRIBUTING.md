# Contributing to SurfMind

Submit all repository changes through pull requests. Create a topic branch and open a PR against `main` so the frontend quality checks run. Keep the PR focused and wait for review and passing checks before merging. Direct pushes to `main` are outside this workflow.

## Set up your environment

Use the Node.js version in [`.nvmrc`](.nvmrc), then run `npm ci`. The install runs Husky setup. Keep the [pre-commit hook](.husky/pre-commit) enabled. It formats staged files with Prettier and runs ESLint.

Before changing extension code, read the [Chrome extension skill](.agents/skills/chrome-extensions/SKILL.md) for Manifest V3, permissions, and browser behavior.

## Check your changes

```sh
npm run lint
npm run format:check
npm run typecheck
CI=true npm test -- --watchAll=false
```

For user-facing changes, test the affected flow in an unpacked extension. In your PR, describe what changed, how you verified it, and include screenshots for visual changes. Remove credentials, browser identifiers, and private browsing data from anything you share.
