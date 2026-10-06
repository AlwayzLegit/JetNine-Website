"""Read-only production sitemap audit. Python standard library; no credentials."""
import concurrent.futures
import datetime as dt
import json
import re
import sys
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

BASE = 'https://jetnine.com'
NS = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9',
      'i': 'http://www.google.com/schemas/sitemap-image/1.1'}


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'JetNine-Sitemap-Audit/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        assert response.status == 200, f'{url}: HTTP {response.status}'
        assert response.url == url, f'{url}: redirects to {response.url}'
        return response.read(), response.headers


def canonical(url):
    parts = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit(parts._replace(path=parts.path or '/'))


class Metadata(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.canonicals = []
        self.robots = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and 'canonical' in attrs.get('rel', '').lower().split():
            self.canonicals.append(attrs.get('href', ''))
        if tag == 'meta' and attrs.get('name', '').lower() in ('robots', 'googlebot'):
            self.robots.append(attrs.get('content', '').lower())


def audit():
    xml, headers = fetch(BASE + '/sitemap.xml')
    assert 'xml' in headers.get('Content-Type', ''), 'Wrong sitemap Content-Type'
    assert len(xml) <= 50 * 1024 * 1024, 'Sitemap exceeds 50 MB'
    root = ET.fromstring(xml.decode('utf-8'))
    assert root.tag == '{' + NS['s'] + '}urlset', 'Invalid sitemap namespace'
    entries = root.findall('s:url', NS)
    urls = [entry.findtext('s:loc', namespaces=NS) for entry in entries]
    assert 1 <= len(urls) <= 50000 and len(set(urls)) == len(urls), 'Invalid count or duplicates'
    robots = fetch(BASE + '/robots.txt')[0].decode('utf-8')
    assert f'Sitemap: {BASE}/sitemap.xml' in robots, 'Missing robots discovery'
    # Match Googlebot's group when present, otherwise the wildcard group.
    groups, agents, rules = [], [], []
    for line in robots.splitlines() + ['User-agent: __end__']:
        key, sep, value = line.split('#', 1)[0].partition(':')
        if not sep:
            continue
        key, value = key.strip().lower(), value.strip()
        if key == 'user-agent':
            if rules:
                groups.append((agents, rules))
                agents, rules = [], []
            agents.append(value.lower())
        elif key in ('allow', 'disallow') and value:
            rules.append((key, value))
    selected = [rules for agents, rules in groups if 'googlebot' in agents]
    if not selected:
        selected = [rules for agents, rules in groups if '*' in agents]
    crawl_rules = [rule for group in selected for rule in group]
    images = set()
    for entry, url in zip(entries, urls):
        assert url, 'Empty loc'
        parts = urllib.parse.urlsplit(url)
        assert parts.scheme == 'https' and parts.netloc == 'jetnine.com', f'Wrong origin: {url}'
        assert not parts.query and not parts.fragment, f'Noncanonical URL: {url}'
        assert not re.match(r'^/(account|admin|api|auth|sign-in|request|downloads)(/|$)', parts.path), url
        assert not re.match(r'^/quote/(aircraft|contact|review)$', parts.path), url
        assert not re.search(r'/(confirm|unsubscribe)/', parts.path), url
        matches = []
        for directive, pattern in crawl_rules:
            expression = '^' + re.escape(pattern).replace(r'\*', '.*').replace(r'\$', '$')
            if re.search(expression, parts.path):
                matches.append((len(pattern.replace('*', '').rstrip('$')), directive == 'allow'))
        assert not matches or max(matches)[1], f'Blocked by robots: {url}'
        modified = entry.findtext('s:lastmod', namespaces=NS)
        if modified:
            date = dt.datetime.fromisoformat(modified.replace('Z', '+00:00'))
            if date.tzinfo is None:
                date = date.replace(tzinfo=dt.timezone.utc)
            assert date <= dt.datetime.now(dt.timezone.utc), f'Future lastmod: {url}'
        images.update(image.text for image in entry.findall('i:image/i:loc', NS))

    def check_page(url):
        body, headers = fetch(url)
        assert 'text/html' in headers.get('Content-Type', ''), f'Not HTML: {url}'
        meta = Metadata(body.decode('utf-8'))
        assert len(meta.canonicals) == 1 and canonical(urllib.parse.urljoin(url, meta.canonicals[0])) == canonical(url), f'Canonical mismatch: {url}'
        directives = ','.join(meta.robots + [headers.get('X-Robots-Tag', '').lower()])
        assert not re.search(r'\b(noindex|none)\b', directives), f'Not indexable: {url}'

    def check_image(url):
        assert url and urllib.parse.urlsplit(url).scheme == 'https', f'Invalid image URL: {url}'
        _, headers = fetch(url)
        assert headers.get('Content-Type', '').startswith('image/'), f'Not an image: {url}'

    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(check_page, url) for url in urls]
        futures += [pool.submit(check_image, url) for url in sorted(images)]
        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()
            except Exception as error:
                errors.append(str(error))
    return {'checked_at': dt.datetime.now(dt.timezone.utc).isoformat(),
            'site': BASE, 'urls': len(urls), 'blog_articles': sum('/blog/' in u for u in urls),
            'unique_images': len(images), 'bytes': len(xml), 'errors': errors}


if __name__ == '__main__':
    try:
        report = audit()
    except Exception as error:
        report = {'site': BASE, 'errors': [str(error)]}
    Path('sitemap-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    sys.exit(bool(report['errors']))
