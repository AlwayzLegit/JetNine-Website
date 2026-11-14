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

## Not configured

Until the secret exists the run stays green and prints one line: `Search results report: not configured (secret GSC_SERVICE_ACCOUNT_JSON is missing)`. That is not proof the report works.

## Secret and property (owner step, OPS-25)

- Repo secret `GSC_SERVICE_ACCOUNT_JSON`: the service account key, the same one Weedtip uses. The scope is read only (`webmasters.readonly`). The key is set in the env of the one step that calls Google and is never printed. Every step after the unit tests is skipped for a pull request.
- The service account's address must be added as a user of the Search Console property for jetnine.com.
- The property is found by itself: `sc-domain:jetnine.com` if the account can read it, otherwise the address property for jetnine.com or www.jetnine.com with the most rights. To name it by hand, set the repository variable `GSC_SITE_URL` (for example `sc-domain:jetnine.com`).

## Public repository: search terms are withheld

This repository is public, so every job summary, log line and stored artifact of this workflow can be read by anyone, for good. A permanent public list of what people typed into Google is the owner's call (OPS-25 asks it), so by default the report keeps search terms out:

- each list of searches (top searches, gainers and losers, position 5 to 20) is replaced by one line, `search terms withheld: public repository (N searches)`
- the alarm line holds numbers only
- the stored JSON holds no `topQueries` and no `cheapWins`
- site totals, the alarm check, and the page lists (the site's own addresses, an address with an "@" or 7 or more digits is dropped) stay

The workflow decides on every run: terms are shown only when the repository is private, or when `SHOW_TERMS_ON_PUBLIC` in `search-report.yml` is `"true"`. It is `"false"` and changes only on the owner's answer in OPS-25. When the check cannot be made, terms stay withheld.

Even when shown, a search is dropped if it has fewer than 20 impressions, an "@" or 7 or more digits. A personal name cannot be detected with certainty, so the impression floor is the control.

## Cost and way back

3 runs a week, each under a minute, no install: about 13 Actions minutes a month. To stop it: GitHub, Actions, Search results report, Disable workflow, or revert the merge. Removing the service account from the property in Search Console ends the access at once.

## Tests

`node --test scripts/search-report/report.test.mjs` (no install needed). They also run on every pull request that touches these files.
