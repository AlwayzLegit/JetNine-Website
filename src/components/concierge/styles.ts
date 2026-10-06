// Class strings shared by the concierge / birthday pages (server) and their
// planners (client). Kept out of the "use client" kit so server components
// receive the actual strings, not client references.

export const labelCls = "flex min-w-0 flex-col gap-[5px] text-[12px] font-bold";
export const controlCls =
  "h-10 w-full min-w-0 rounded-[2px] border border-line bg-white px-[10px] font-sans text-[14px] font-normal text-bone outline-none focus:border-bone focus:shadow-[0_0_0_1px_var(--bone)]";
export const areaCls =
  "w-full min-w-0 resize-y rounded-[2px] border border-line bg-white px-[10px] py-2 font-sans text-[14px] font-normal text-bone outline-none focus:border-bone focus:shadow-[0_0_0_1px_var(--bone)]";
export const checkCls = "m-0 h-4 w-4 flex-none accent-[var(--bone)] max-sm:h-6 max-sm:w-6";
export const btnPrimary =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[2px] border-0 bg-bone px-5 text-[14px] font-bold text-white hover:bg-[#1d3646] hover:text-white";
export const btnSecondary =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[2px] border border-bone bg-white px-5 text-[14px] font-bold text-bone hover:bg-surface-2";
export const linkBtn =
  "cursor-pointer border-0 bg-transparent p-0 text-[13px] font-bold text-bone underline underline-offset-[3px] hover:text-gold";
