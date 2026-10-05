"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { chooseOption } from "@/app/request/[token]/actions";
import { SITE } from "@/lib/constants";

const ERROR_TEXT: Record<string, string> = {
  NOT_OPEN: "This request is no longer open for choices. Call dispatch and we'll sort it out.",
  OPTION_NOT_AVAILABLE: "That option is no longer available. Call dispatch for an alternative.",
  RATE_LIMITED: "Too many tries — wait a minute and try again.",
};

export function ChooseButton({
  token,
  optionId,
  primary,
  label,
}: {
  token: string;
  optionId: string;
  primary: boolean;
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-2 max-sm:w-full">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const r = await chooseOption(token, optionId);
            if (r.ok) router.refresh();
            else setError(ERROR_TEXT[r.error] ?? `Something went wrong. Call ${SITE.dispatchPhone}.`);
          });
        }}
        className={["btn btn-sm", primary ? "btn-primary" : "btn-secondary", "max-sm:w-full"].join(" ")}
      >
        {pending ? "Choosing…" : label}
      </button>
      {error ? (
        <p role="alert" className="max-w-[32ch] text-right text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
