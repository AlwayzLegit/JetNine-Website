// The quote prototype's compact field: a surface-2 box with the 13px
// label inside, above the 16px value. Differs from `.field-jn` (label
// above the box) so the leg grid reads as four even tiles. Keep the
// `<label htmlFor>` wired to the control's id — the production smoke
// test finds the airport inputs by their exact label text.

export const COMPACT_INPUT_CLASS =
  "w-full min-w-0 bg-transparent text-[16px] leading-[1.4] text-bone outline-none placeholder:text-steel [color-scheme:dark]";

type Props = {
  id: string;
  label: React.ReactNode;
  error?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function CompactField({ id, label, error, className = "", children }: Props) {
  return (
    <div
      className={[
        "flex flex-col gap-1 rounded-control bg-surface-2 px-3.5 py-2.5 transition-shadow focus-within:shadow-[0_0_0_1px_var(--clearance)]",
        error ? "shadow-[0_0_0_1px_var(--danger)]" : "",
        className,
      ].join(" ")}
    >
      <label htmlFor={id} className={["text-[13px] leading-[1.4]", error ? "text-danger" : "text-bone-2"].join(" ")}>
        {label}
      </label>
      {children}
    </div>
  );
}
