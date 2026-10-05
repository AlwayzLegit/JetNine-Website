// The Light quote field (Quote.dc): a 13px semibold label above a 40px
// white box with a 1px line border and 3px radius; focus darkens the
// border to navy. The border sits on the wrapper so a control plus an
// adornment (date icon, select chevron) still reads as one box. Keep the
// `<label htmlFor>` wired to the control's id — the production smoke test
// finds the airport and contact inputs by their exact label text.

export const COMPACT_INPUT_CLASS =
  "w-full min-w-0 bg-transparent text-[15px] leading-[1.4] text-bone outline-none placeholder:text-steel-dim [color-scheme:light]";

type Props = {
  id: string;
  label: React.ReactNode;
  error?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function CompactField({ id, label, error, className = "", children }: Props) {
  return (
    <div className={["flex min-w-0 flex-col gap-[5px]", className].join(" ")}>
      <label
        htmlFor={id}
        className={["text-[13px] font-semibold leading-[1.4]", error ? "text-danger" : "text-bone"].join(" ")}
      >
        {label}
      </label>
      <div
        className={[
          "flex min-h-10 items-center rounded-[3px] border bg-surface px-3 transition-[border-color,box-shadow] focus-within:border-bone focus-within:shadow-[0_0_0_1px_var(--bone)]",
          error ? "border-danger shadow-[0_0_0_1px_var(--danger)]" : "border-line",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
