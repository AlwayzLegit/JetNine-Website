# Search results report

A weekly report of what Google shows people for jetnine.com, read from the Search Console API. Added by OPS-36, copied from Weedtip's report (AlwayzLegit/weedtip df9fdbe, OPS-24).

## What it shows

Workflow: `.github/workflows/search-report.yml`, script: `scripts/search-report/report.mjs`. It runs Monday, Wednesday and Friday at 07:31 Pacific, and by hand (GitHub, Actions, Search results report, Run workflow). The result is one job summary:

- site totals for the last 28 days against the 28 before: clicks, impressions, click rate, average position
- top 20 searches and top 20 pages, the biggest gainers and losers
- searches at position 5 to 20 with real impressions (the cheapest wins)
- pages seen often but rarely clicked
- the alarm check

Search Console's final data is about 2 days behind, so the report never says "today". The full report runs on Mondays and on manual runs; the other days run the alarm check only.

## The alarm

One alarm fails the run red with the line `ALARM impressions`: the 2 newest final days are both below 30 percent of their weekday baseline (the same weekday over the 4 weeks before), and that baseline is at least 100 impressions a day. Everything else is a finding in the summary.

## Sign-in without a key (OPS-81)

There is no key and no secret. On main only, the step "Sign in to Google without a key" asks Google for a short-lived read-only token (`webmasters.readonly`, 10 minutes) through workload identity: the workflow's own GitHub sign-in, acting as the Crew's read-only account. That account's address is the repository variable `GSC_SERVICE_ACCOUNT`; it is not written in any file. Google itself refuses every ref but `refs/heads/main`, so a pull request or another branch can never get a token, and no credentials file is written. The report prints `sign-in: workload identity` when it used the token. The pattern is Weedtip's OPS-80 (f03226d).

### Why it waits while the repository is public

GitHub prints the inputs of a `uses:` step in the job log and does not mask a repository variable, so on this public repository the account's address would be readable by anyone, for good. So the sign-in step runs only when the repository is private (the same `private` read the search-terms check already makes), and until then the run is green and prints one line:

`Search results report: waiting (public repository: the keyless sign-in starts once the repository is private, OPS-52)`

Two other fixed waiting lines exist: the variable `GSC_SERVICE_ACCOUNT` is not set (OPS-25), and "no sign-in token: the keyless sign-in runs on main only" (a manual run on another branch). Waiting is not proof the report works. A sign-in that Google refuses, or a token that Search Console refuses (HTTP 401 or 403), is a red run.

When OPS-52 makes the repository private, the next run signs in by itself with no change. If the owner ever says the address may appear in public logs, the condition `steps.terms.outputs.private == 'true'` is one line to drop.

## Property (owner step, OPS-25)

- The read-only account must be added as a user of the Search Console property for jetnine.com (permission Restricted).
- Until it is, the run is green and prints `Search results report: the read-only account cannot read a property for jetnine.com yet (owner step OPS-25)`, and writes no file.
- The property is found by itself: `sc-domain:jetnine.com` if the account can read it, otherwise the address property for jetnine.com or www.jetnine.com with the most rights. To name it by hand, set the repository variable `GSC_SITE_URL` (for example `sc-domain:jetnine.com`); it is used only when the account can read it.

## Public repository: search terms are withheld

This repository is public, so every job summary, log line and stored artifact of this workflow can be read by anyone, for good. A permanent public list of what people typed into Google is the owner's call (OPS-25 asks it), so by default the report keeps search terms out:

- each list of searches (top searches, gainers and losers, position 5 to 20) is replaced by one line, `search terms withheld: public repository (N searches)`
- the alarm line holds numbers only
- the stored JSON holds no `topQueries` and no `cheapWins`
- site totals, the alarm check, and the page lists (the site's own addresses, an address with an "@" or 7 or more digits is dropped) stay

The workflow decides on every run: terms are shown only when the repository is private, or when `SHOW_TERMS_ON_PUBLIC` in `search-report.yml` is `"true"`. It is `"false"` and changes only on the owner's answer in OPS-25. When the check cannot be made, terms stay withheld.

Even when shown, a search is dropped if it has fewer than 20 impressions, an "@" or 7 or more digits. A personal name cannot be detected with certainty, so the impression floor is the control.

## Cost and way back

3 runs a week, each under a minute, no install: about 13 Actions minutes a month. To stop it: GitHub, Actions, Search results report, Disable workflow, or revert the merge. Removing the read-only account from the property in Search Console ends the access at once. To go back to waiting for a key, revert the merge of OPS-81; nothing in Google needs undoing.

## Tests

`node --test scripts/search-report/report.test.mjs` (no install needed). They also run on every pull request that touches these files.
