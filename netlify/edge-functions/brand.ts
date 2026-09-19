/**
 * Per-domain branding for the static response.
 *
 * One Netlify site serves both domains, so index.html ships with the primary
 * brand baked in. Crawlers and social scrapers don't run JS, which means the
 * runtime switch in src/brand.ts can't reach them — without this, sharing an
 * ajson.netlify.app link would unfurl as "NonStop io JSON Viewer".
 *
 * Keep the head block below in step with src/brand.ts.
 */
import type {Config, Context} from "@netlify/edge-functions";

const AJSON_HOSTS = /^(ajson\.netlify\.app|.*--ajson\.netlify\.app)$/i;

const AJSON_HEAD = `<title>AJSON – JSON Formatter, Validator &amp; Graph Visualizer</title>
    <meta
      name="description"
      content="Paste your JSON and view it as a clean, collapsible tree or an interactive node graph. Free online JSON formatter, validator, explorer &amp; visualizer. No signup. Works in browser."
    />
    <meta name="author" content="Ajay Kumar" />
    <link rel="canonical" href="https://ajson.netlify.app" />

    <link rel="icon" type="image/png" href="/brand/ajson/favicon.png" />
    <link
      rel="apple-touch-icon"
      sizes="180x180"
      href="/brand/ajson/apple-touch-icon.png"
    />
    <link
      rel="icon"
      type="image/png"
      sizes="32x32"
      href="/brand/ajson/favicon-32x32.png"
    />
    <link
      rel="icon"
      type="image/png"
      sizes="16x16"
      href="/brand/ajson/favicon-16x16.png"
    />
    <link rel="manifest" href="/brand/ajson/manifest.json" />

    <meta
      property="og:title"
      content="AJSON – JSON Formatter, Validator &amp; Graph Visualizer"
    />
    <meta
      property="og:description"
      content="Parse, validate and explore JSON as a tree or an interactive node graph. Search, dark mode, deep links, no signup required."
    />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://ajson.netlify.app" />
    <meta
      property="og:image"
      content="https://ajson.netlify.app/brand/ajson/og-image.png"
    />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="AJSON" />
    <meta property="og:locale" content="en_US" />

    <meta
      name="twitter:title"
      content="AJSON – JSON Formatter, Validator &amp; Graph Visualizer"
    />
    <meta
      name="twitter:description"
      content="Parse, validate and explore JSON as a tree or an interactive node graph. No signup required."
    />
    <meta
      name="twitter:image"
      content="https://ajson.netlify.app/brand/ajson/og-image.png"
    />

    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "AJSON - JSON Formatter, Validator & Graph Visualizer",
        "description": "Free online JSON viewer and formatter with a collapsible tree and an interactive node-graph visualizer. Parse, validate, and explore JSON data up to 5MB.",
        "url": "https://ajson.netlify.app",
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "Any",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "author": {
          "@type": "Person",
          "name": "Ajay Kumar",
          "url": "https://github.com/ProjectAJ14"
        }
      }
    </script>`;

const BRAND_BLOCK = /<!-- brand:start -->[\s\S]*?<!-- brand:end -->/;

// Crawlable, but kept out of the index: both domains serve identical content,
// and json.nonstopio.com is the one that should rank.
const AJSON_ROBOTS = "User-agent: *\nAllow: /\n";

export default async function brandHandler(
  request: Request,
  context: Context
): Promise<Response> {
  const response = await context.next();
  if (!AJSON_HOSTS.test(new URL(request.url).hostname)) return response;

  const {pathname} = new URL(request.url);

  if (pathname === "/robots.txt") {
    return new Response(AJSON_ROBOTS, {
      headers: {"content-type": "text/plain", "x-robots-tag": "noindex"},
    });
  }

  // The sitemap only lists the primary domain; serving it here would both
  // advertise that domain and invite indexing of this one.
  if (pathname === "/sitemap.xml") {
    return new Response("Not Found", {status: 404});
  }

  if (!(response.headers.get("content-type") ?? "").includes("text/html")) {
    return response;
  }

  const html = (await response.text()).replace(
    BRAND_BLOCK,
    `<!-- brand:start -->\n    ${AJSON_HEAD}\n    <!-- brand:end -->`
  );

  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(html, {status: response.status, headers});
}

export const config: Config = {
  path: ["/", "/index.html", "/robots.txt", "/sitemap.xml"],
};
