"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateOperator } from "@/app/admin/operators/[id]/actions";
import type { Operator } from "@/db/schema/operators";

const STATUSES = [
  { id: "active", label: "Active — flying" },
  { id: "audit_due", label: "Audit due — flag to the desk" },
  { id: "hold", label: "On hold — temporary pause" },
  { id: "suspended", label: "Suspended — reason required" },
  { id: "banned", label: "Banned — permanent" },
] as const;

const ARGUS = [
  { id: "platinum", label: "Platinum" },
  { id: "gold", label: "Gold" },
  { id: "silver", label: "Silver" },
  { id: "none", label: "Not rated" },
] as const;

export function OperatorEditForm({ initial }: { initial: Operator }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // Track status locally so the suspended-reason field reveals correctly.
  const [status, setStatus] = useState<Operator["status"]>(initial.status);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const result = await updateOperator(initial.id, data);
      if (result.ok) {
        setMsg({ tone: "ok", text: "Saved." });
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-secondary btn-sm"
        >
          Edit operator
        </button>
      </div>
    );
  }

  return (
    <section className="card card-highlight p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="label-jn text-[13px]">Edit operator</h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMsg(null);
          }}
          className="btn btn-secondary h-9 px-3.5 text-[14px]"
        >
          Close
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {/* Identity */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <div className="field-jn">
            <label htmlFor="op-name">Name</label>
            <input
              id="op-name"
              name="name"
              type="text"
              defaultValue={initial.name}
              required
              maxLength={140}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="op-cert">FAA certificate number</label>
            <input
              id="op-cert"
              name="certNumber"
              type="text"
              defaultValue={initial.certNumber ?? ""}
              placeholder="WXYZ123A"
              maxLength={40}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="op-part">FAA part</label>
            <input
              id="op-part"
              name="faaPart"
              type="text"
              defaultValue={initial.faaPart}
              placeholder="135"
              maxLength={8}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr]">
          <div className="field-jn">
            <label htmlFor="op-home">Home base (ICAO)</label>
            <input
              id="op-home"
              name="homeAirportIcao"
              type="text"
              defaultValue={initial.homeAirportIcao ?? ""}
              placeholder="KTEB"
              maxLength={4}            />
          </div>
          <div className="field-jn">
            <label htmlFor="op-years">Years as a partner</label>
            <input
              id="op-years"
              name="yearsPartner"
              type="number"
              min={0}
              max={100}
              defaultValue={initial.yearsPartner ?? ""}
            />
          </div>
          <label className="flex h-full cursor-pointer items-center gap-3 rounded-control border border-line bg-surface-2 p-4">
            <input
              type="checkbox"
              name="isPreferred"
              defaultChecked={initial.isPreferred}
              className="h-4 w-4 accent-clearance"
            />
            <div>
              <div className="text-[15px] text-bone">Preferred partner</div>
              <div className="mt-1 text-[13px] leading-[1.5] text-steel">
                Sorts first when picking aircraft for a request.
              </div>
            </div>
          </label>
        </div>

        {/* Status block */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="field-jn">
            <label htmlFor="op-status">Status</label>
            <select
              id="op-status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Operator["status"])}
              required
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {status === "suspended" || initial.suspendedReason ? (
            <div className="field-jn">
              <label htmlFor="op-suspended">Reason for suspension</label>
              <input
                id="op-suspended"
                name="suspendedReason"
                type="text"
                defaultValue={initial.suspendedReason ?? ""}
                placeholder="Pending insurance renewal"
                maxLength={200}
                required={status === "suspended"}
              />
            </div>
          ) : (
            <input type="hidden" name="suspendedReason" value="" />
          )}
        </div>

        {/* Vetting */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr]">
          <div className="field-jn">
            <label htmlFor="op-argus">ARG/US rating</label>
            <select
              id="op-argus"
              name="argusRating"
              defaultValue={initial.argusRating}
              required
            >
              {ARGUS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex h-full cursor-pointer items-center gap-3 rounded-control border border-line bg-surface-2 p-4">
            <input
              type="checkbox"
              name="wyvernWingman"
              defaultChecked={initial.wyvernWingman}
              className="h-4 w-4 accent-clearance"
            />
            <div>
              <div className="text-[15px] text-bone">Wyvern Wingman</div>
              <div className="mt-1 text-[13px] leading-[1.5] text-steel">
                Shows the Wingman badge on aircraft options.
              </div>
            </div>
          </label>
          <div className="field-jn">
            <label htmlFor="op-isbao">IS-BAO stage</label>
            <input
              id="op-isbao"
              name="isbaoStage"
              type="number"
              min={1}
              max={3}
              defaultValue={initial.isbaoStage ?? ""}
            />
          </div>
        </div>

        {/* Renewal dates */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_1fr]">
          {[
            ["argusRenewsOn", "ARG/US renews", initial.argusRenewsOn],
            ["wyvernRenewsOn", "Wyvern renews", initial.wyvernRenewsOn],
            ["isbaoRenewsOn", "IS-BAO renews", initial.isbaoRenewsOn],
            ["insuranceRenewsOn", "Insurance renews", initial.insuranceRenewsOn],
            ["nextAuditOn", "Next audit", initial.nextAuditOn],
          ].map(([name, label, val]) => (
            <div key={String(name)} className="field-jn">
              <label htmlFor={`op-${name}`}>{label}</label>
              <input
                id={`op-${name}`}
                name={String(name)}
                type="date"
                defaultValue={val ? String(val) : ""}
              />
            </div>
          ))}
        </div>

        {/* Commercial terms */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr]">
          <div className="field-jn">
            <label htmlFor="op-liability">Liability limit ($)</label>
            <input
              id="op-liability"
              name="liabilityLimitUsd"
              type="number"
              min={0}
              step={1000000}
              defaultValue={initial.liabilityLimitUsd ?? ""}
              placeholder="50000000"
            />
          </div>
          <div className="field-jn">
            <label htmlFor="op-payment">Payment terms</label>
            <input
              id="op-payment"
              name="paymentTerms"
              type="text"
              defaultValue={initial.paymentTerms ?? ""}
              placeholder="Net 7"
              maxLength={60}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="op-discount">Volume discount (%)</label>
            <input
              id="op-discount"
              name="volumeDiscountPct"
              type="number"
              min={0}
              max={50}
              step="0.01"
              defaultValue={initial.volumeDiscountPct ?? ""}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-control border border-line bg-surface-2 p-4">
          <input
            type="checkbox"
            name="rateLock"
            defaultChecked={initial.rateLock}
            className="h-4 w-4 accent-clearance"
          />
          <div>
            <div className="text-[15px] text-bone">Rate lock</div>
            <div className="mt-1 text-[13px] leading-[1.5] text-steel">
              The operator agreed to hold pricing through the current cycle.
            </div>
          </div>
        </label>

        <div className="field-jn">
          <label htmlFor="op-notes">Notes</label>
          <textarea
            id="op-notes"
            name="notes"
            defaultValue={initial.notes ?? ""}
            rows={3}
            placeholder="Ops notes: relationship history, contract quirks, escalation paths."
            maxLength={800}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          {msg ? (
            <span className={`text-[14px] ${msg.tone === "error" ? "text-danger" : "text-success"}`}>
              {msg.text}
            </span>
          ) : (
            <span className="text-[13px] text-steel">Admin only. Every changed field is written to the history log.</span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"} <span className="arrow">→</span>
          </button>
        </div>
      </form>
    </section>
  );
}
