import Link from "next/link";
import { SITE } from "@/lib/constants";
import { CheckDot, Disc, Icon } from "@/components/company/icons";

// Window bodies for /about (jn-about-windows.js). Rendered as children of
// a LightWindow, so they stay server components.

const ROLES = [
  { mark: "JN", title: "JetNine", sub: "Arranges your charter", items: ["Discusses your itinerary", "Presents flight options", "Coordinates booking"] },
  { mark: "✈", title: "Aircraft operator", sub: "Operates your flight", items: ["Provides aircraft and crew", "Retains operational control", "Makes flight safety decisions"] },
];

export function RolesWindow() {
  return (
    <div className="text-center">
      <h2 className="font-serif text-[28px] leading-[1.1]">Who does what on your flight?</h2>
      <p className="mt-[6px] text-[13px] text-steel">Two different roles work together to make your trip happen.</p>
      <div className="mt-[18px] grid gap-5 text-left [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        {ROLES.map((r, i) => (
          <div key={r.title} className={i ? "border-l border-line pl-5 max-[460px]:border-l-0 max-[460px]:pl-0" : ""}>
            <div className="flex items-center gap-3">
              <Disc size={48} className="text-[18px]">{r.mark}</Disc>
              <span>
                <span className="block text-[12px] font-bold uppercase tracking-[0.14em]">{r.title}</span>
                <span className="text-[13px] text-steel">{r.sub}</span>
              </span>
            </div>
            <ul className="mt-[14px] flex list-none flex-col gap-2 p-0">
              {r.items.map((t) => (
                <li key={t} className="flex items-center gap-[10px] text-[13px]">
                  <CheckDot />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-[18px] flex items-center gap-[10px] border border-line bg-surface px-[14px] py-3 text-left text-[13px]">
        <Icon name="info" className="h-[18px] w-[18px]" />
        Before booking, ask for the operating carrier’s identity.
      </div>
      <p className="mt-2 text-left text-[12px] text-steel">{SITE.legal.part295}</p>
      <p className="mt-[14px]">
        <a
          href="https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-295"
          target="_blank"
          rel="noopener noreferrer"
          className="rule-link !font-sans !text-[13px]"
        >
          Read Part 295 on eCFR ↗
        </a>
      </p>
      <p className="mt-[6px] text-[12px] text-steel">Official source opens in a new tab.</p>
    </div>
  );
}

export function ContactWindow({ email }: { email: string }) {
  const rows = [
    { icon: "phone" as const, label: "Call", value: SITE.dispatchPhone, href: `tel:${SITE.dispatchPhoneE164}` },
    { icon: "mail" as const, label: "Email", value: email, href: `mailto:${email}` },
  ];
  return (
    <div>
      <h2 className="text-center font-serif text-[30px] leading-[1.1]">Speak with JetNine</h2>
      <p className="mt-[6px] text-center text-[13px] text-steel">Tell us what you are planning.</p>
      <div className="mt-[18px] flex flex-col gap-3">
        {rows.map((r) => (
          <a
            key={r.label}
            href={r.href}
            className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 border border-line bg-ink px-4 py-[14px] text-bone hover:border-gold"
          >
            <Disc size={46}>
              <Icon name={r.icon} className="h-5 w-5" />
            </Disc>
            <span className="min-w-0">
              <span className="block font-serif text-[18px]">{r.label}</span>
              <span className="block break-words font-serif text-[20px]">{r.value}</span>
            </span>
            <span aria-hidden="true">›</span>
          </a>
        ))}
      </div>
      <p className="mt-[18px] text-center text-[13px] text-steel">Prefer a written request?</p>
      <Link href="/quote/mission" className="btn btn-primary mt-2 w-full">
        Request a quote →
      </Link>
      <p className="mt-[14px] flex items-center justify-center gap-[6px] text-center text-[13px] text-steel">
        <Icon name="pin" className="h-[14px] w-[14px]" />
        {SITE.address.line1}, {SITE.address.cityState}
      </p>
    </div>
  );
}

export function FounderBio({ bio }: { bio: string[] }) {
  return (
    <div className="mt-4 flex flex-col gap-3 font-serif text-[16px] leading-[1.55] text-bone-2">
      {bio.map((p) => (
        <p key={p.slice(0, 24)}>{p}</p>
      ))}
    </div>
  );
}
