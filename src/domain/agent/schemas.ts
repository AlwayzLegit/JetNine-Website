import { z } from "zod";
import { JOB_CADENCES, MEMORY_KINDS, RUN_ITEM_KINDS } from "@/db/schema/agent";

/** Request bodies for the assistant endpoints (validated by the API handler). */

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Expected a uuid.");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD.");

export const OpenRun = z.object({
  runDate: day.optional().describe("Defaults to today in Los Angeles."),
});

export const RunJobReport = z.object({
  slug: z.string().min(1).max(40),
  did: z.string().min(1).max(2000).describe("What you did, in plain words."),
  worked: z.string().max(2000).optional(),
  didnt: z.string().max(2000).optional().describe("What did not work, and why."),
  next: z.string().max(2000).optional().describe("What to try next time."),
  metrics: z.record(z.string().max(40), z.union([z.number(), z.string().max(200)])).optional(),
});

export const RunReport = z.object({
  jobs: z.array(RunJobReport).max(20),
  errors: z.array(z.string().max(1000)).max(50).default([]),
});

export const CloseRun = z.object({
  summaryMd: z.string().min(1).max(4000).describe("The owner's one-minute read."),
  report: RunReport,
  metrics: z.record(z.string().max(40), z.union([z.number(), z.string().max(200)])).optional(),
});

export const FailRun = z.object({
  reason: z.string().min(1).max(2000),
});

export const RunItemInput = z.object({
  kind: z.enum(RUN_ITEM_KINDS),
  subjectType: z.enum(["quote", "trip", "member", "blog_post", "empty_leg", "invoice"]).optional(),
  subjectId: uuid.optional(),
  subjectCode: z.string().max(60).optional(),
  title: z.string().min(1).max(200),
  bodyMd: z.string().max(8000).optional(),
  url: z
    .string()
    .max(600)
    .regex(/^(https:\/\/|\/(?![/\\]))/, "Must be https:// or a site path.")
    .optional(),
});

export const MemoryInput = z.object({
  kind: z.enum(MEMORY_KINDS),
  body: z.string().min(1).max(600),
  pinned: z.boolean().optional(),
});

export const MemoryPatch = z
  .object({
    body: z.string().min(1).max(600).optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .refine((p) => p.body !== undefined || p.pinned !== undefined || p.archived !== undefined, {
    message: "Nothing to change.",
  });

export const PlaybookJobInput = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(40),
  name: z.string().min(1).max(80),
  enabled: z.boolean(),
  cadence: z.enum(JOB_CADENCES),
  weekday: z.number().int().min(0).max(6).optional(),
  instructionsMd: z.string().min(1).max(12000),
});

export const PlaybookInput = z.object({
  generalMd: z.string().min(1).max(12000),
  jobs: z.array(PlaybookJobInput).max(20),
  note: z.string().max(300).optional(),
});

export const ListRunsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(60).optional(),
});

export const ListMemoryQuery = z.object({
  includeArchived: z.enum(["true", "false"]).optional(),
});
