/**
 * Generates the gated pricing-guide PDF from the site's own data modules
 * — the shared rate card, the itemized sample quote, the quote engine's
 * worked examples, and the pre-charter checklist — so the PDF can never
 * disagree with the pages.
 *
 * Run with `pnpm guide:pdf` after each quarterly rate review (bump
 * RATES_UPDATED in src/lib/rates.ts first). Output path comes from
 * src/lib/guide-download.ts; commit the regenerated file.
 */
import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { RATES, RATES_UPDATED, PRICE_STACK, PRICE_STACK_TOTAL } from "@/lib/rates";
import { GUIDE_CHAPTERS } from "@/lib/guides";
import { QUESTIONS } from "@/lib/questions";
import { findAirport, distanceNm } from "@/lib/airports";
import { computeIndicative, formatHours } from "@/lib/quote-pricing";
import { SITE } from "@/lib/constants";
import { GUIDE_PDF_PATH } from "@/lib/guide-download";

const INK = "#0E1014";
const BONE = "#F4F1EA";
const MUTED = "#6B7280";
const ACCENT = "#8A6A28";
const PAGE = { width: 612, height: 792, margin: 64 }; // US Letter
const CONTENT_W = PAGE.width - PAGE.margin * 2;

const SAMPLES = [
  { from: "VNY", to: "ASE", label: "Los Angeles to Aspen", category: "light" as const, catLabel: "Light jet" },
  { from: "LAX", to: "LAS", label: "Los Angeles to Las Vegas", category: "light" as const, catLabel: "Light jet" },
  { from: "JFK", to: "PBI", label: "New York to Palm Beach", category: "midsize" as const, catLabel: "Midsize" },
  { from: "VNY", to: "TEB", label: "Los Angeles to New York", category: "supermid" as const, catLabel: "Super-mid" },
];

const out = join(process.cwd(), "public", GUIDE_PDF_PATH);
mkdirSync(dirname(out), { recursive: true });

const doc = new PDFDocument({ size: "LETTER", margins: { top: 64, bottom: 64, left: 64, right: 64 } });
doc.pipe(createWriteStream(out));

// The built-in AFM fonts are WinAnsi-only — arrows in site strings
// ("KVNY → KASE") render as garbage. Swap them for ASCII.
function clean(s: string): string {
  return s.replace(/\s*[→⇄]\s*/g, " - ");
}

function eyebrow(text: string) {
  doc.font("Courier").fontSize(8).fillColor(ACCENT).text(text.toUpperCase(), { characterSpacing: 1.2 });
  doc.moveDown(0.6);
}
function h1(text: string) {
  doc.font("Times-Roman").fontSize(30).fillColor(INK).text(text);
  doc.moveDown(0.5);
}
function h2(text: string) {
  doc.font("Times-Roman").fontSize(19).fillColor(INK).text(text);
  doc.moveDown(0.4);
}
function body(text: string, opts: object = {}) {
  doc.font("Helvetica").fontSize(10).fillColor("#3A3D42").text(text, { lineGap: 3, ...opts });
  doc.moveDown(0.6);
}
function footerLine() {
  const saved = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font("Courier").fontSize(7.5).fillColor(MUTED).text(
    `JetNine · Part 295 broker · Dispatch ${SITE.dispatchPhone} · jetnine.com · Updated ${RATES_UPDATED}`,
    PAGE.margin,
    PAGE.height - 50,
    { width: CONTENT_W, align: "center" },
  );
  doc.page.margins.bottom = saved;
  doc.x = PAGE.margin;
}
function tableRow(cols: string[], widths: number[], opts: { bold?: boolean; color?: string } = {}) {
  if (doc.y > PAGE.height - 120) {
    doc.addPage();
    doc.y = PAGE.margin;
  }
  const y = doc.y;
  let x = PAGE.margin;
  doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(opts.color ?? "#3A3D42");
  cols.forEach((c, i) => {
    doc.text(clean(c), x, y, { width: widths[i] - 8, lineGap: 1 });
    x += widths[i];
  });
  doc.y = y + 20;
  doc.x = PAGE.margin;
  doc.moveTo(PAGE.margin, doc.y - 5).lineTo(PAGE.width - PAGE.margin, doc.y - 5).strokeColor("#E3DFD4").lineWidth(0.5).stroke();
}

// ── Cover ──
doc.rect(0, 0, PAGE.width, PAGE.height).fill(INK);
doc.font("Courier").fontSize(9).fillColor("#C9C4B8").text("— THE JETNINE DISPATCH DESK", PAGE.margin, 180, { characterSpacing: 1.5 });
doc.font("Times-Roman").fontSize(42).fillColor(BONE).text("The Charter\nPricing Guide.", PAGE.margin, 220, { lineGap: 4 });
doc.font("Helvetica").fontSize(12).fillColor("#C9C4B8").text(
  "Hourly rates by category, a real itemized quote, worked example trips, and the ten questions to ask any broker — with the prices left in.",
  PAGE.margin, 380, { width: 380, lineGap: 4 },
);
doc.font("Courier").fontSize(8.5).fillColor("#7B8290").text(
  `2026 EDITION · UPDATED ${RATES_UPDATED.toUpperCase()} · RATES REVIEWED QUARTERLY`,
  PAGE.margin, 640, { characterSpacing: 1 },
);

// ── Rate card ──
doc.addPage();
eyebrow("— 01 · The rate card");
h1("Hourly rates, published.");
body(
  "Market is what on-demand missions run on our board today; locked is what JetNine Card members pay, fixed for 24 months. Either way the quote you accept is all-in — fuel, crew, landing, repositioning, 7.5% federal excise tax, standard catering, sedan transfer — and it does not move after acceptance.",
);
doc.moveDown(0.4);
const RATE_W = [90, 168, 82, 82, 62];
tableRow(["Category", "Typical mission", "Market hourly", "Card locked", "Sample"], RATE_W, { bold: true, color: INK });
for (const r of RATES) tableRow([r.category, r.mission, r.market, r.locked, r.sample], RATE_W);
doc.moveDown(1);
if (doc.y > PAGE.height - 320) doc.addPage();
doc.x = PAGE.margin;
h2("A real itemized quote");
body(`Midsize round trip, Los Angeles (KVNY) to the New York area and back — about ten hours of block time. Total: ${PRICE_STACK_TOTAL}, locked at acceptance.`);
const STACK_W = [120, 250, 114];
tableRow(["Line", "What it covers", "Amount"], STACK_W, { bold: true, color: INK });
for (const row of PRICE_STACK) tableRow([row.label, row.desc, row.val], STACK_W);
tableRow(["ALL-IN TOTAL", "The invoice number", PRICE_STACK_TOTAL], STACK_W, { bold: true, color: ACCENT });
footerLine();

// ── Worked examples ──
doc.addPage();
eyebrow("— 02 · Worked examples");
h1("Four real lanes, priced.");
body(
  "Indicative one-way ranges for the whole aircraft — not per seat — computed by the same engine that powers the quote wizard at jetnine.com/quote/mission. Your exact number depends on date and airframe availability; a senior dispatcher confirms it within 30 minutes during operating hours.",
);
doc.moveDown(0.4);
const EX_W = [170, 90, 80, 144];
tableRow(["Route", "Category", "Block time", "All-in, one way"], EX_W, { bold: true, color: INK });
for (const s of SAMPLES) {
  const a = findAirport(s.from)!;
  const b = findAirport(s.to)!;
  const ind = computeIndicative({
    category: s.category,
    legs: [{ id: "x", distanceNm: distanceNm(a, b) }],
  })!;
  tableRow([`${s.label} (${s.from} → ${s.to})`, s.catLabel, formatHours(ind.hours), ind.formatted], EX_W);
}
doc.moveDown(1);
doc.x = PAGE.margin;
h2("Three honest discounts");
body("Empty legs — repositioning flights at 30–60% off, date- and route-locked. The live board at jetnine.com/empty-legs updates every fifteen minutes, and the SMS watchlist texts you when your lane lists: one SMS per match, no spam.");
body("Flexibility — repositioning is the biggest avoidable line item. Shifting a departure day toward where aircraft already are, or accepting a region's secondary airport, regularly beats any negotiation.");
body(`Locked rates — the JetNine Card fixes hourly rates from ${RATES[0].locked.toLowerCase()} for 24 months with no peak surcharges. Worth the math at roughly 25+ flight hours a year; below that, stay on-demand and we'll tell you the same.`);
footerLine();

// ── Checklist ──
doc.addPage();
eyebrow("— 03 · Before you book");
h1("The ten-question checklist.");
body(
  "Run any broker — us included — through this list before you book. A desk that answers all ten quickly is telling you something; a desk that stalls on three of them is telling you more.",
);
doc.moveDown(0.4);
const checklist = QUESTIONS.find((q) => q.slug === "private-jet-charter-checklist")?.checklist ?? [];
checklist.forEach((item, i) => {
  const y = doc.y;
  doc.font("Courier").fontSize(9).fillColor(ACCENT).text(String(i + 1).padStart(2, "0"), PAGE.margin, y);
  doc.font("Helvetica").fontSize(10).fillColor("#3A3D42").text(item, PAGE.margin + 30, y, { width: CONTENT_W - 30, lineGap: 2 });
  doc.moveDown(0.7);
});
footerLine();

// ── Guide index + contact ──
doc.addPage();
eyebrow("— 04 · Read deeper");
h1("The full guide, online.");
body("Every chapter is open on the site — no form, no login. This PDF is the compiled convenience; the pages carry the living numbers.");
doc.moveDown(0.3);
for (const c of GUIDE_CHAPTERS) {
  const y = doc.y;
  doc.font("Courier").fontSize(9).fillColor(ACCENT).text(String(c.chapter).padStart(2, "0"), PAGE.margin, y);
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK).text(c.title, PAGE.margin + 30, y, { width: CONTENT_W - 30 });
  doc.font("Courier").fontSize(8).fillColor(MUTED).text(`jetnine.com${c.href}`, PAGE.margin + 30, doc.y + 1);
  doc.moveDown(0.9);
}
doc.moveDown(1.2);
doc.x = PAGE.margin;
h2("When the reading is done");
body(
  `The quote wizard prices any route in about ninety seconds — live indicative pricing, no callback required — and a senior dispatcher confirms exact airframes within 30 minutes during operating hours. Truly time-critical? The dispatch line answers in under twenty seconds, every hour of every day: ${SITE.dispatchPhone}.`,
);
body(
  "Every airframe we quote flies for an ARG/US- or Wyvern-audited operator that passed our written safety floor and an in-person vetting visit — 380 approved of roughly 5,000 US Part 135 certificates. The full standard is published at jetnine.com/safety.",
);
footerLine();

doc.end();
console.log(`wrote ${out}`);
