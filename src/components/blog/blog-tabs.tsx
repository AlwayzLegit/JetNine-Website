"use client";

import { useId, useState, type ReactNode } from "react";

// Two tabs under the blog title: the posts and the pricing guide. Both
// panels are server-rendered and passed in; this only holds which one is
// showing. /blog and /guides stay separate URLs — the guide panel is a
// chapter index that links out, not the guide itself.
export function BlogTabs({
  postsLabel,
  guidesLabel,
  posts,
  guides,
}: {
  postsLabel: string;
  guidesLabel: string;
  posts: ReactNode;
  guides: ReactNode;
}) {
  const [tab, setTab] = useState<"posts" | "guides">("posts");
  const id = useId();
  const tabs = [
    { key: "posts" as const, label: postsLabel },
    { key: "guides" as const, label: guidesLabel },
  ];

  return (
    <>
      <div className="container-jn">
        <div
          role="tablist"
          aria-label="Blog and guides"
          className="mt-8 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((t) => {
            const selected = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`${id}-tab-${t.key}`}
                aria-selected={selected}
                aria-controls={`${id}-panel-${t.key}`}
                aria-current={selected ? "true" : undefined}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(t.key)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    setTab(t.key === "posts" ? "guides" : "posts");
                  }
                }}
                className={[
                  "-mb-px min-h-[44px] whitespace-nowrap border-b-2 px-4 py-3 text-[16px] font-medium transition-colors",
                  "focus-visible:rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-clearance",
                  selected
                    ? "border-clearance text-bone"
                    : "border-transparent text-steel hover:text-bone-2",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-posts`}
        aria-labelledby={`${id}-tab-posts`}
        hidden={tab !== "posts"}
      >
        {posts}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-guides`}
        aria-labelledby={`${id}-tab-guides`}
        hidden={tab !== "guides"}
      >
        {guides}
      </div>
    </>
  );
}
