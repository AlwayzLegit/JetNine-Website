// One-off utility: split the persisted page-specs JSON into per-page MD files
// for easier batched reading. Output to scripts/.specs/ (gitignored).
import fs from "node:fs";
import path from "node:path";

const src = "C:\\Users\\jetni\\.claude\\projects\\C--Users-jetni-Desktop-JetNine-Jetnine-Web\\8c381406-c9d1-42b0-aadc-219daa5b611f\\tool-results\\toolu_015wJizkPoUEbLrpMVu6f38q.json";
const outDir = path.resolve("scripts/.specs");
fs.mkdirSync(outDir, { recursive: true });

const data = JSON.parse(fs.readFileSync(src, "utf8"));
const text = data[0].text;

const pages = ["memberships", "empty-legs", "how-it-works", "safety", "about", "contact", "faq", "legal"];

const indices = pages.map((p, i) => {
  const marker = `## ${i + 1}. ${p}.html`;
  return { page: p, idx: text.indexOf(marker) };
});

for (let i = 0; i < indices.length; i++) {
  const { page, idx } = indices[i];
  if (idx === -1) {
    console.warn(`MISS: ${page}`);
    continue;
  }
  const next = i + 1 < indices.length ? indices[i + 1].idx : text.length;
  const slice = text.slice(idx, next).trim();
  const file = path.join(outDir, `${page}.md`);
  fs.writeFileSync(file, slice + "\n", "utf8");
  console.log(`${page.padEnd(15)} ${(slice.length / 1024).toFixed(1)} KB`);
}
