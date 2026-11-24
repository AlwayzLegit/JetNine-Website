/* eslint-disable no-console */
/**
 * The site chat's evals (OPS-242): ~28 questions sent to the public /api/chat of a STAGING
 * site. It holds no secret. On staging, Turnstile is either off or set to Cloudflare's test
 * keys, and the documented dummy token passes the test keys. It refuses any host that is not
 * staging: production has real Turnstile and a real daily budget, and the evals are a gate
 * before go-live, not a monitor.
 *
 *   pnpm exec tsx scripts/chat-evals.mts [https://staging.jetnine.com] [--gate-never]
 *
 * Prints one line per case (pass or fail) and then
 *   chat evals: never rules [n]/[n], hand-offs [k]/[m], facts [j]/[l]
 * and exits 1 when any case failed. A fallback answer counts as a failure: a run that fell
 * back proves nothing about the rules. Go-live needs every never-rule case to pass.
 *
 * --gate-never (the staging deploy job of deploy-cloudflare.yml): the exit code reflects the
 * never rules only, so a missed hand-off or fact (printed all the same) does not turn a staging
 * deploy red. Exit 3: staging refused the Turnstile test token, so nothing was asked.
 */
import { readFileSync } from "node:fs";
import { isStagingUrl, judge, verificationRefused, type Answer, type Case } from "../src/lib/chat/evals.ts";

const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX"; // Cloudflare's documented test token

async function ask(base: string, say: string, jar: { cookie: string }): Promise<Answer & { status: number }> {
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(jar.cookie ? { cookie: jar.cookie } : {}) },
    body: JSON.stringify({ messages: [{ role: "user", content: say }], token: DUMMY_TOKEN }),
    signal: AbortSignal.timeout(30_000),
  });
  const set = res.headers.get("set-cookie");
  if (set) jar.cookie = set.split(";")[0];
  const body = (await res.json().catch(() => ({}))) as Answer;
  return { ...body, status: res.status };
}

async function main() {
  const args = process.argv.slice(2);
  const gateNeverOnly = args.includes("--gate-never");
  const base = (args.find((a) => !a.startsWith("--")) ?? "https://staging.jetnine.com").replace(/\/$/, "");
  if (!isStagingUrl(base)) {
    console.error(`refused: ${base} is not a staging site (the evals run on staging only)`);
    process.exit(2);
  }
  const { cases } = JSON.parse(readFileSync(new URL("../tests/chat-evals.json", import.meta.url), "utf8")) as { cases: Case[] };
  const jar = { cookie: "" };
  const tally = { never: [0, 0], handoff: [0, 0], fact: [0, 0] } as Record<Case["kind"], [number, number]>;
  for (const c of cases) {
    const a = await ask(base, c.say, jar);
    if (verificationRefused(a.status, a)) {
      console.log(`chat evals: NOT RUN. ${base} refused the Turnstile test token (403 verification), so no question reached the chat.`);
      console.log("Staging needs Turnstile off or Cloudflare's test keys (an owner step). Nothing was asked and nothing is proven.");
      process.exit(3);
    }
    const why = a.status === 429 ? "rate limited (30 messages an hour per address): run again later" : judge(c, a);
    tally[c.kind][1]++;
    if (!why) tally[c.kind][0]++;
    console.log(`${why ? "FAIL" : "pass"} ${c.id}${why ? `: ${why}` : ""}`);
  }
  const [n, nt] = tally.never;
  const [k, kt] = tally.handoff;
  const [j, jt] = tally.fact;
  console.log(`chat evals: never rules ${n}/${nt}, hand-offs ${k}/${kt}, facts ${j}/${jt}`);
  const neverOk = n === nt;
  process.exit(neverOk && (gateNeverOnly || (k === kt && j === jt)) ? 0 : 1);
}

void main();
