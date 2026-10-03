"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { sessionActor } from "@/domain/actor";
import { addMemory, dismissItem, savePlaybook, updateMemory } from "@/domain/agent/commands";
import { MemoryInput, MemoryPatch, PlaybookInput } from "@/domain/agent/schemas";
import { err, issueWords } from "@/domain/result";

// Settings › Assistant. Owner-only Server Actions: the commands check the
// role themselves, so these only sign the caller in, validate the form and
// refresh the page.

const PATH = "/admin/settings/assistant";

export type SavePlaybookResult = { ok: true; version: number } | { ok: false; error: string };
export type MemoryResult = { ok: true; id: string } | { ok: false; error: string };
export type DismissResult = { ok: true } | { ok: false; error: string };

function text(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

/** The first validation problem as a desk sentence. */
function parseWords(error: z.ZodError, fallback: string): string {
  return issueWords(err("invalid", fallback, error.issues)) ?? fallback;
}

export async function savePlaybookAction(formData: FormData): Promise<SavePlaybookResult> {
  const s = await sessionActor();
  if (!s.ok) return { ok: false, error: s.error };

  const note = text(formData.get("note")).trim();
  if (!note) return { ok: false, error: "Say what changed, in one line." };

  let jobs: unknown;
  try {
    jobs = JSON.parse(text(formData.get("jobs")) || "[]");
  } catch {
    return { ok: false, error: "The jobs could not be read. Reload the page and try again." };
  }

  const parsed = PlaybookInput.safeParse({ generalMd: text(formData.get("generalMd")), jobs, note });
  if (!parsed.success) return { ok: false, error: parseWords(parsed.error, "Check the instructions and try again.") };

  const r = await savePlaybook(s.value, parsed.data);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(PATH);
  return { ok: true, version: r.value.version };
}

export async function addMemoryAction(formData: FormData): Promise<MemoryResult> {
  const s = await sessionActor();
  if (!s.ok) return { ok: false, error: s.error };

  const parsed = MemoryInput.safeParse({ kind: text(formData.get("kind")), body: text(formData.get("body")).trim() });
  if (!parsed.success) return { ok: false, error: parseWords(parsed.error, "Write a note first.") };

  const r = await addMemory(s.value, parsed.data);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(PATH);
  return { ok: true, id: r.value.id };
}

export async function updateMemoryAction(id: string, formData: FormData): Promise<MemoryResult> {
  const s = await sessionActor();
  if (!s.ok) return { ok: false, error: s.error };

  const body = formData.get("body");
  const pinned = formData.get("pinned");
  const archived = formData.get("archived");
  const parsed = MemoryPatch.safeParse({
    ...(typeof body === "string" ? { body: body.trim() } : {}),
    ...(typeof pinned === "string" ? { pinned: pinned === "true" } : {}),
    ...(typeof archived === "string" ? { archived: archived === "true" } : {}),
  });
  if (!parsed.success) return { ok: false, error: parseWords(parsed.error, "Nothing to change.") };

  const r = await updateMemory(s.value, id, parsed.data);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(PATH);
  return { ok: true, id: r.value.id };
}

export async function dismissRunItem(id: string): Promise<DismissResult> {
  const s = await sessionActor();
  if (!s.ok) return { ok: false, error: s.error };

  const r = await dismissItem(s.value, id);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(PATH);
  return { ok: true };
}
