"""Fault injection for the production auditor; no network requests."""
import http.client
import importlib.util
import unittest
import urllib.error
from unittest.mock import patch
from pathlib import Path

spec = importlib.util.spec_from_file_location('audit', Path(__file__).with_name('check-live-sitemap.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AuditTests(unittest.TestCase):
    def run_audit(self, *, robots='', meta='', canonical='https://jetnine.com/', date='', broken_image=False, robots_type='text/plain'):
        xml = f'''<urlset xmlns="{audit.NS['s']}" xmlns:image="{audit.NS['i']}">
        <url><loc>https://jetnine.com/</loc>{date}<image:image>
        <image:loc>https://jetnine.com/image.webp</image:loc></image:image></url></urlset>'''

        def fetch(url):
            if url.endswith('/sitemap.xml'):
                return xml.encode(), {'Content-Type': 'application/xml'}
            if url.endswith('/robots.txt'):
                return ('Sitemap: https://jetnine.com/sitemap.xml\n' + robots).encode(), {'Content-Type': robots_type}
            if url.endswith('/image.webp'):
                if broken_image:
                    raise RuntimeError('broken image')
                return b'image', {'Content-Type': 'image/webp'}
            return f'<link rel="canonical" href="{canonical}">{meta}'.encode(), {'Content-Type': 'text/html'}

        with patch.object(audit, 'fetch', side_effect=fetch):
            return audit.audit()

    def test_valid_and_longest_robots_rule(self):
        self.assertEqual(self.run_audit(robots='User-agent: *\nDisallow: /\nAllow: /$')['errors'], [])

    def test_robots_html_error_page(self):
        with self.assertRaisesRegex(AssertionError, 'Robots must be plain text'):
            self.run_audit(robots_type='text/html')

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


class RetryTests(unittest.TestCase):
    """OPS-104: transport errors are tried once more and reported; wrong answers never are."""

    def setUp(self):
        audit.RETRIES.clear()
        patcher = patch.object(audit.time, 'sleep')
        self.sleep = patcher.start()
        self.addCleanup(patcher.stop)

    def test_cut_off_body_is_retried_once_and_reported(self):
        results = [http.client.IncompleteRead(b'x' * 26647), (b'ok', {})]

        def get(url):
            result = results.pop(0)
            if isinstance(result, Exception):
                raise result
            return result

        with patch.object(audit, 'get', side_effect=get) as mocked:
            self.assertEqual(audit.fetch('https://jetnine.com/blog/x'), (b'ok', {}))
        self.assertEqual(mocked.call_count, 2)
        self.assertEqual(len(audit.RETRIES), 1)
        self.assertIn('https://jetnine.com/blog/x', audit.RETRIES[0])
        self.assertIn('IncompleteRead', audit.RETRIES[0])
        self.sleep.assert_called_once_with(audit.RETRY_DELAY_SECONDS)

    def test_second_failure_fails(self):
        with patch.object(audit, 'get', side_effect=ConnectionResetError('reset')) as mocked:
            with self.assertRaises(ConnectionResetError):
                audit.fetch('https://jetnine.com/')
        self.assertEqual(mocked.call_count, 2)

    def test_wrong_status_is_never_retried(self):
        error = urllib.error.HTTPError('https://jetnine.com/x', 500, 'Server Error', {}, None)
        with patch.object(audit, 'get', side_effect=error) as mocked:
            with self.assertRaises(urllib.error.HTTPError):
                audit.fetch('https://jetnine.com/x')
        self.assertEqual(mocked.call_count, 1)
        self.assertEqual(audit.RETRIES, [])

    def test_failed_assertion_is_never_retried(self):
        with patch.object(audit, 'get', side_effect=AssertionError('redirects to elsewhere')) as mocked:
            with self.assertRaises(AssertionError):
                audit.fetch('https://jetnine.com/x')
        self.assertEqual(mocked.call_count, 1)

    def test_error_line_names_the_url_and_the_exception(self):
        line = audit.describe('https://jetnine.com/blog/x', http.client.IncompleteRead(b'x' * 26647))
        self.assertTrue(line.startswith('https://jetnine.com/blog/x: '))
        self.assertIn('IncompleteRead', line)
        self.assertEqual(audit.describe('https://a/b', AssertionError('https://a/b: HTTP 404')), 'https://a/b: HTTP 404')


if __name__ == '__main__':
    unittest.main()
