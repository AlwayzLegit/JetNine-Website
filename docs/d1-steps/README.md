# D1 steps

One file per step of the move from Supabase Postgres to Cloudflare D1, named by its Tasks row (`OPS-nnn.md`). Each file holds the note that used to be a bullet in `DEPLOY.md` section 8i: what moved, where the store lives, the proof and how to undo it.

Rules:

- A step adds its own file here and never edits another step's file. That keeps two pull requests from conflicting on a shared list.
- `DEPLOY.md` section 8i links this folder and holds only the rules that apply to every step (binding, switch, code, health, migrations).
- A step's store tests are found by `scripts/ci/store-tests.mjs` from their file names (`store.test.ts`, `store-d1.test.ts`, `*-store.test.ts`, `*-store-d1.test.ts`, and the `src/lib/*-d1.test.ts` files), so a new store adds a test file and no line to `.github/workflows/ci.yml`.
