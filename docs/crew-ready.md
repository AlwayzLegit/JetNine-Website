# Crew ready (OPS-182)

`.github/workflows/crew-ready.yml` puts the label `crew-ready` on a pull request from a `crew/` branch when the workflow `CI` has finished green on the pull request's current head commit. The label starts the Crew's Merge captain task 3c (a 3 day test, OPS-181).

- It runs from the copy of the file on `main` (a `workflow_run` rule), so it does nothing on its own pull request. The first real run is the first green CI on a `crew/` pull request after it is merged.
- It checks out no code, uses only the run's own token with `pull-requests: write`, and reads the event's values through `env`, never inline in the script. No secret. Nothing on the site changes and nothing deploys.
- A run for a head commit that is no longer the pull request's head labels nothing. The label is removed and added again for each green head, so each head gives one labeled event. A pull request from a fork has no pull request in the event and is ignored.
- The label is created by the first request if it does not exist. If that run fails with 422 on the label, create it by hand: Issues, Labels, New label, name `crew-ready`.
- Undo: revert the merge commit (the labelling stops) and disable task 3c. The label can stay.
