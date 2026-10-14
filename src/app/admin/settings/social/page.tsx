import { requireAdmin } from "@/lib/auth";
import { socialLinks } from "@/domain/settings/queries";
import { DeskHeader } from "@/components/admin/desk-ui";
import { SOCIAL_META, SOCIAL_PLATFORMS } from "@/lib/social-links";
import { SocialLinksForm } from "./social-links-form";

export const dynamic = "force-dynamic";

// Settings › Social links. Owners only: the page gates, and so does the
// settings.socialLinks op behind its form.

export default async function SocialLinksPage() {
  await requireAdmin();
  const links = await socialLinks();

  return (
    <div>
      <DeskHeader
        size="md"
        title="Social links"
        lead="JetNine's profiles. They show as icons in the site footer and are listed in the site's structured data, so search engines connect them to the business."
      />
      <div className="mt-6">
        <SocialLinksForm
          platforms={SOCIAL_PLATFORMS.map((p) => ({ key: p, label: SOCIAL_META[p].label, placeholder: SOCIAL_META[p].placeholder }))}
          links={links}
        />
      </div>
      <section className="card bg-panel mt-6 px-6 py-5 text-[14px] text-bone-2">
        <h2 className="text-[16px] font-medium text-bone">Good to know</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
          <li>Paste the full profile link, or just the handle (like @jetnine) and the link is built for you.</li>
          <li>Leave a field empty to take that icon out of the footer.</li>
          <li>Changes reach the live site within a few seconds of saving. Each save is recorded in History.</li>
        </ul>
      </section>
    </div>
  );
}
