# airconsole-appengine/static/api

This subtree is the AppEngine-served copy of the public AirConsole JavaScript API bundle.

## Verification Entry Points

- Browser regression harness: serve this subtree statically and open a versioned runner in `tests/`.
- Playwright verification: in `ci/`, use `npm run server` and `npm test`.

## Local Invariants

- Keep versioned root bundles backward compatible.
- Stage upcoming releases in `beta/` before promotion.
- Do not remove `deprecated/` assets.
- Never call `rm`, use `safe-rm` instead (brew install safe-rm).

## Read Next

- `tests/AGENTS.md`
- `ci/AGENTS.md`
