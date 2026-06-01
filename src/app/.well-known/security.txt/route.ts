// RFC 9116 security.txt at /.well-known/security.txt. Tells security
// researchers where to send vulnerability reports — the modern
// equivalent of the old "contact us" email buried in a footer. Routed
// as a Next.js route handler rather than a public/ file so the Expires
// timestamp can be derived at build time and refreshed by the next
// deploy without anyone editing the file.

export const dynamic = "force-static";

export function GET(): Response {
  // Expires one year out from build. RFC 9116 says <= 1 year; this hits
  // exactly that bound. Operations should re-deploy at least annually
  // anyway, so the timestamp refreshes itself.
  const now = new Date();
  const expires = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();

  const body = [
    "# Security disclosure for JetNine LLC",
    "# https://datatracker.ietf.org/doc/html/rfc9116",
    "",
    "Contact: mailto:dispatch@jetnine.com",
    "Contact: tel:+1-888-847-5669",
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    "Canonical: https://jetnine.com/.well-known/security.txt",
    "Policy: https://jetnine.com/legal",
    "",
    "# Please use 'security' in the subject line when reporting via email.",
    "# We aim to acknowledge reports within one business day.",
    "",
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
