// Shared page chrome for the simplified JetNine public pages (header + footer).
// Registered as a global so each page mounts it via <x-import component-from-global-scope="JNChrome">.
(function () {
  const S = {
    link: { fontSize: 15, color: '#C9C4B8', textDecoration: 'none' },
    cta: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', borderRadius: 8, background: '#E8E2D2', color: '#07080A', fontWeight: 500, fontSize: 15, whiteSpace: 'nowrap', textDecoration: 'none' },
  };
  const NAV = [['Aircraft', 'Aircraft.dc.html'], ['Programs', 'Memberships.dc.html'], ['How it works', 'How it works.dc.html'], ['About', 'About.dc.html'], ['Blog', 'Blog.dc.html'], ['Contact', 'Contact.dc.html']];
  const COLS = [
    ['Aircraft', [['Turboprop', 'Aircraft.dc.html#turboprop'], ['Light jets', 'Aircraft.dc.html#light'], ['Midsize', 'Aircraft.dc.html#midsize'], ['Super-midsize', 'Aircraft.dc.html#supermid'], ['Heavy', 'Aircraft.dc.html#heavy'], ['Ultra long range', 'Aircraft.dc.html#ultra'], ['All aircraft', 'Aircraft.dc.html']]],
    ['Programs', [['JetNine Card', 'Memberships.dc.html#deposits'], ['On-demand', 'Memberships.dc.html#tiers'], ['Cost calculator', 'Quote.dc.html'], ['Pricing guide', 'Blog.dc.html'], ['Routes', '#'], ['Charter by city', '#'], ['Empty legs', 'Empty legs.dc.html'], ['Safety', 'Safety.dc.html']]],
    ['Company', [['About', 'About.dc.html'], ['Blog', 'Blog.dc.html'], ['Contact', 'Contact.dc.html'], ['FAQ', 'FAQ.dc.html'], ['Good questions', 'FAQ.dc.html'], ['Legal', 'Legal.dc.html'], ['Privacy policy', 'Legal.dc.html#what-we-collect'], ['Terms of service', 'Legal.dc.html#agreement'], ['My account', 'Account.dc.html']]],
  ];
  function Header({ current }) {
    return React.createElement('header', { style: { position: 'sticky', top: 0, zIndex: 50, background: 'rgba(7,8,10,.86)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #161A20' } },
      React.createElement('div', { style: { maxWidth: 1200, margin: '0 auto', padding: '0 40px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 } },
        React.createElement('a', { href: 'Home.dc.html', 'aria-label': 'JetNine — Home', style: { display: 'flex', alignItems: 'center' } }, React.createElement('img', { src: 'public/images/brand/wordmark-bone.webp', alt: 'JetNine', style: { height: 36, width: 'auto', display: 'block' } })),
        React.createElement('nav', { 'aria-label': 'Primary', style: { display: 'flex', gap: 28 } }, NAV.map(([l, h]) => React.createElement('a', { key: l, href: h, 'aria-current': current === l ? 'page' : undefined, style: { ...S.link, color: current === l ? '#F4F1EA' : '#C9C4B8', fontWeight: current === l ? 500 : 400 } }, l))),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 20 } },
          React.createElement('a', { href: 'Account.dc.html', style: S.link }, 'Sign in'),
          React.createElement('a', { href: 'tel:+14244872707', style: { ...S.link, whiteSpace: 'nowrap' } }, '+1 (424) 487-2707'),
          React.createElement('a', { href: 'Quote.dc.html', style: S.cta }, 'Request quote ', React.createElement('span', { 'aria-hidden': 'true' }, '→')))));
  }
  function Footer() {
    return React.createElement('footer', { style: { borderTop: '1px solid #161A20', padding: '64px 0 40px' } },
      React.createElement('div', { style: { maxWidth: 1200, margin: '0 auto', padding: '0 40px', display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 40 } },
        React.createElement('div', null,
          React.createElement('img', { src: 'public/images/brand/wordmark-bone.webp', alt: 'JetNine', style: { height: 36, width: 'auto', display: 'block' } }),
          React.createElement('p', { style: { margin: '16px 0 0', maxWidth: '30ch', fontSize: 15, color: '#C9C4B8' } }, 'On-demand private aviation. One number, one desk, ready when you are.'),
          React.createElement('p', { style: { margin: '20px 0 0', fontSize: 14, color: '#8A9099' } }, 'Operating hours', React.createElement('br'), React.createElement('span', { style: { color: '#C9C4B8' } }, '24 / 7 · always answered'))),
        COLS.map(([h, links]) => React.createElement('div', { key: h },
          React.createElement('div', { style: { fontSize: 14, fontWeight: 600, color: '#8A9099', marginBottom: 14 } }, h),
          React.createElement('ul', { style: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 15 } }, links.map(([l, h]) => React.createElement('li', { key: l }, React.createElement('a', { href: h, style: { color: '#F4F1EA', textDecoration: 'none' } }, l))))))),
      React.createElement('div', { style: { maxWidth: 1200, margin: '48px auto 0', padding: '24px 40px 0', borderTop: '1px solid #161A20', display: 'flex', justifyContent: 'space-between', gap: 24, fontSize: 13, color: '#8A9099' } },
        React.createElement('span', null, '© 2026 JetNine · Part 295 indirect air carrier'),
        React.createElement('span', null, 'Flights operated by FAA Part 135 certificated air carriers')));
  }
  window.JNHeader = Header;
  window.JNFooter = Footer;
})();
