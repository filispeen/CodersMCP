import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

for (const tag of ['script', 'style', 'noscript', 'svg']) {
  turndown.remove(tag);
}

const DEFAULT_TIMEOUT_MS = 10_000;

export async function webFetch({ url, timeout_ms }) {
  const timeoutMs = timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CodersMCP/1.0)',
      },
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`Request timed out for ${url}`);
    }
    throw new Error(`Failed to connect to ${url}: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`HTTP error for ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const content = turndown.turndown(html);
  return { url, content };
}
