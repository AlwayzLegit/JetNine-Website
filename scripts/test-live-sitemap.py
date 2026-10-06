"""Fault injection for the production auditor; no network requests."""
import importlib.util
import unittest
from unittest.mock import patch
from pathlib import Path

spec = importlib.util.spec_from_file_location('audit', Path(__file__).with_name('check-live-sitemap.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AuditTests(unittest.TestCase):
    def run_audit(self, *, robots='', meta='', canonical='https://jetnine.com/', date='', broken_image=False):
        xml = f'''<urlset xmlns="{audit.NS['s']}" xmlns:image="{audit.NS['i']}">
        <url><loc>https://jetnine.com/</loc>{date}<image:image>
        <image:loc>https://jetnine.com/image.webp</image:loc></image:image></url></urlset>'''

        def fetch(url):
            if url.endswith('/sitemap.xml'):
                return xml.encode(), {'Content-Type': 'application/xml'}
            if url.endswith('/robots.txt'):
                return ('Sitemap: https://jetnine.com/sitemap.xml\n' + robots).encode(), {}
            if url.endswith('/image.webp'):
                if broken_image:
                    raise RuntimeError('broken image')
                return b'image', {'Content-Type': 'image/webp'}
            return f'<link rel="canonical" href="{canonical}">{meta}'.encode(), {'Content-Type': 'text/html'}

        with patch.object(audit, 'fetch', side_effect=fetch):
            return audit.audit()

    def test_valid_and_longest_robots_rule(self):
        self.assertEqual(self.run_audit(robots='User-agent: *\nDisallow: /\nAllow: /$')['errors'], [])

    def test_bad_canonical(self):
        self.assertTrue(self.run_audit(canonical='https://jetnine.com/wrong')['errors'])

    def test_noindex(self):
        self.assertTrue(self.run_audit(meta='<meta name="robots" content="noindex">')['errors'])

    def test_robots_block(self):
        with self.assertRaisesRegex(AssertionError, 'Blocked by robots'):
            self.run_audit(robots='User-agent: *\nDisallow: /')

    def test_future_date(self):
        with self.assertRaisesRegex(AssertionError, 'Future lastmod'):
            self.run_audit(date='<lastmod>2999-01-01</lastmod>')

    def test_broken_image(self):
        self.assertTrue(self.run_audit(broken_image=True)['errors'])


if __name__ == '__main__':
    unittest.main()
