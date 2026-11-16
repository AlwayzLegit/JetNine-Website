#!/usr/bin/env node
/**
 * Last week's numbers for the Speed check (OPS-50).
 *
 * The score alarm compares each page with last week's run, kept as the workflow
 * artifact speed-check-latest. The old step took only the newest successful run
 * on main. A successful run started by hand with a base_url keeps no numbers, so
 * the next scheduled run found no baseline, said "first run" and the alarm was
 * silent that week. Now the last 10 successful runs on main are tried newest
 * first, and the first one whose artifact exists, has not expired and downloads
 * is the baseline.
 *
 * Fail visible: a baseline that cannot be found is a ::warning:: line, never a
 * silent "first run" (that line is printed only when the workflow has no
 * successful run on main at all). A download error is shown, not hidden. The
 * command always makes the folder `previous` and always exits 0: a missing
 * baseline is a warning, not a red run.
 *
 * Env: GITHUB_REPOSITORY (owner/name), GH_TOKEN (the job's token, for gh).
 * Optional: BASELINE_DIR (default "previous"), BASELINE_WORKFLOW (default
 * "speed-check.yml"), BASELINE_ARTIFACT (default "speed-check-latest").
 * No dependency; gh comes from the runner.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const LOOK_BACK = 10;

/**
 * Pick the baseline. runIds: successful runs on main, newest first.
 * listArtifacts(id) -> [{ name, expired }]; download(id) throws on failure.
 * log(line) gets every line to print. Returns the run id, or null.
 */
export async function resolveBaseline({ runIds, artifactName = "speed-check-latest", listArtifacts, download, log }) {
  if (runIds.length === 0) {
    log("No earlier result: first run");
    return null;
  }
  for (const id of runIds) {
    let artifacts;
    try {
      artifacts = await listArtifacts(id);
    } catch (e) {
      log(`::warning::run ${id}: could not list its artifacts: ${errorText(e)}`);
      continue;
    }
    const found = artifacts.find((a) => a.name === artifactName && !a.expired);
    if (!found) {
      log(`Run ${id} kept no numbers, looking further back`);
      continue;
    }
    try {
      await download(id);
    } catch (e) {
      log(`::warning::run ${id} lists ${artifactName} but the download failed: ${errorText(e)}`);
      continue;
    }
    log(`Compared with run ${id}`);
    return id;
  }
  log(`::warning::no stored numbers in the last ${runIds.length} successful runs on main, the score alarm is off for this run`);
  return null;
}

function errorText(e) {
  const text = String(e?.stderr || e?.message || e || "unknown error").trim();
  return text.split("\n").slice(0, 3).join(" | ").slice(0, 300);
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const dir = process.env.BASELINE_DIR || "previous";
  const workflow = process.env.BASELINE_WORKFLOW || "speed-check.yml";
  const artifactName = process.env.BASELINE_ARTIFACT || "speed-check-latest";
  mkdirSync(dir, { recursive: true });
  if (!repo) {
    console.log("::warning::GITHUB_REPOSITORY is not set, so no baseline was looked for");
    return;
  }
  let runIds;
  try {
    runIds = gh([
      "api",
      `repos/${repo}/actions/workflows/${workflow}/runs?branch=main&status=success&per_page=${LOOK_BACK}`,
      "--jq",
      ".workflow_runs[].id",
    ])
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (e) {
    console.log(`::warning::could not list earlier runs, the score alarm is off for this run: ${errorText(e)}`);
    return;
  }
  await resolveBaseline({
    runIds,
    artifactName,
    log: (line) => console.log(line),
    listArtifacts: async (id) =>
      JSON.parse(
        gh(["api", `repos/${repo}/actions/runs/${id}/artifacts`, "--jq", "[.artifacts[] | {name: .name, expired: .expired}]"]),
      ),
    download: async (id) => {
      gh(["run", "download", String(id), "--repo", repo, "-n", artifactName, "-D", dir]);
    },
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    // A broken baseline step must not turn the weekly check red.
    console.log(`::warning::baseline step failed, the score alarm is off for this run: ${errorText(e)}`);
  });
}
