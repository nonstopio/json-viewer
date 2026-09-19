/**
 * Per-domain branding.
 *
 * One Netlify site serves both domains, so the build is identical and the brand
 * is resolved at runtime from the hostname:
 *
 *   json.nonstopio.com  → NonStop io
 *   ajson.netlify.app   → Ajay Kumar's build, with no NonStop marks anywhere
 *
 * The static <head> can't be switched this way — crawlers and social scrapers
 * don't run JS — so netlify/edge-functions/brand.ts rewrites it per Host. Keep
 * the two in step: this file is the source of truth for what a brand *is*.
 */

export type BrandId = "nonstopio" | "ajson";

export interface BrandSocial {
  label: string;
  href: string;
  icon: "github" | "linkedin" | "twitter" | "globe";
}

export interface Brand {
  id: BrandId;
  /** Footer name and og:site_name. */
  siteName: string;
  /** Who the footer credits. */
  ownerName: string;
  ownerHref: string;
  /** Directory holding this brand's icons and og-image; "" is the web root. */
  assetBase: string;
  issuesUrl: string;
  /** Prefix for exported PNG filenames. */
  exportPrefix: string;
  origin: string;
  title: string;
  description: string;
  social: BrandSocial[];
  /** Keep the alternate domain out of search results (duplicate content). */
  noindex: boolean;
  /** Stand-in company record for the "Load Test JSON" sample. */
  sample: {name: string; description: string; website: string; email: string};
}

const NONSTOPIO: Brand = {
  id: "nonstopio",
  siteName: "NonStop io Technologies Pvt. Ltd.",
  ownerName: "NonStop io Technologies Pvt. Ltd.",
  ownerHref: "https://nonstopio.com",
  assetBase: "",
  issuesUrl: "https://github.com/nonstopio/json-viewer/issues",
  exportPrefix: "json-by-nonstopio",
  origin: "https://json.nonstopio.com",
  title: "JSON Viewer Online – Formatter, Validator & Graph Visualizer",
  description:
    "Paste your JSON and view it as a clean, collapsible tree or an interactive node graph. Free online JSON formatter, validator, explorer & visualizer. No signup. Works in browser.",
  social: [
    {label: "GitHub", href: "https://github.com/nonstopio", icon: "github"},
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/company/nonstop-io",
      icon: "linkedin",
    },
    {label: "Twitter", href: "https://twitter.com/nonstopio", icon: "twitter"},
    {label: "Website", href: "https://nonstopio.com", icon: "globe"},
  ],
  noindex: false,
  sample: {
    name: "NonStop io Technologies Pvt. Ltd.",
    description:
      "Our applied AI solutions are designed to seamlessly integrate with your processes, making your business smarter, faster, and more efficient.",
    website: "https://nonstopio.com/",
    email: "ajay.kumar@nonstopio.com",
  },
};

const AJSON: Brand = {
  id: "ajson",
  siteName: "AJSON",
  ownerName: "Ajay Kumar",
  ownerHref: "https://github.com/ProjectAJ14",
  assetBase: "/brand/ajson",
  // Issues still go to the shared repo — it's where the code lives.
  issuesUrl: "https://github.com/nonstopio/json-viewer/issues",
  exportPrefix: "json-by-ajson",
  origin: "https://ajson.netlify.app",
  title: "AJSON – JSON Formatter, Validator & Graph Visualizer",
  description:
    "Paste your JSON and view it as a clean, collapsible tree or an interactive node graph. Free online JSON formatter, validator, explorer & visualizer. No signup. Works in browser.",
  social: [
    {
      label: "GitHub",
      href: "https://github.com/ProjectAJ14",
      icon: "github",
    },
  ],
  noindex: true,
  sample: {
    name: "AJSON",
    description:
      "A fast, private JSON viewer — explore any payload as a tree or an interactive node graph, right in the browser.",
    website: "https://ajson.netlify.app/",
    email: "ajay.kumar@example.com",
  },
};

export const BRANDS: Record<BrandId, Brand> = {
  nonstopio: NONSTOPIO,
  ajson: AJSON,
};

const HOST_BRANDS: Record<string, BrandId> = {
  "json.nonstopio.com": "nonstopio",
  "ajson.netlify.app": "ajson",
};

/**
 * `?brand=` overrides the hostname so both brands can be opened locally and in
 * tests. It only changes presentation, so there is nothing to protect here.
 */
export function resolveBrandId(hostname: string, search = ""): BrandId {
  const override = new URLSearchParams(search).get("brand");
  if (override === "ajson" || override === "nonstopio") return override;

  const exact = HOST_BRANDS[hostname.toLowerCase()];
  if (exact) return exact;

  // Netlify deploy previews: deploy-preview-12--ajson.netlify.app
  if (hostname.toLowerCase().endsWith("--ajson.netlify.app")) return "ajson";

  // Anything else (localhost, unknown aliases) keeps the primary brand.
  return "nonstopio";
}

export const brand: Brand =
  BRANDS[resolveBrandId(window.location.hostname, window.location.search)];

/** Path to one of this brand's assets. */
export function brandAsset(file: string): string {
  return `${brand.assetBase}/${file}`;
}

function setAttr(selector: string, attribute: string, value: string): void {
  document.querySelector(selector)?.setAttribute(attribute, value);
}

/**
 * Bring the static <head> in line with the resolved brand. The edge function
 * already does this for real visitors; this covers local dev, deploy previews,
 * and the `?brand=` override, and costs nothing when the two agree.
 */
export function applyBrandToDocument(): void {
  document.title = brand.title;
  setAttr('meta[name="description"]', "content", brand.description);
  setAttr('meta[name="author"]', "content", brand.ownerName);
  setAttr('link[rel="canonical"]', "href", brand.origin);

  setAttr(
    'link[rel="icon"][sizes="16x16"]',
    "href",
    brandAsset("favicon-16x16.png")
  );
  setAttr(
    'link[rel="icon"][sizes="32x32"]',
    "href",
    brandAsset("favicon-32x32.png")
  );
  setAttr('link[rel="icon"]:not([sizes])', "href", brandAsset("favicon.png"));
  setAttr(
    'link[rel="apple-touch-icon"]',
    "href",
    brandAsset("apple-touch-icon.png")
  );

  setAttr('meta[property="og:title"]', "content", brand.title);
  setAttr('meta[property="og:description"]', "content", brand.description);
  setAttr('meta[property="og:url"]', "content", brand.origin);
  setAttr('meta[property="og:site_name"]', "content", brand.siteName);
  setAttr(
    'meta[property="og:image"]',
    "content",
    `${brand.origin}${brandAsset("og-image.png")}`
  );

  setAttr('meta[name="twitter:title"]', "content", brand.title);
  setAttr('meta[name="twitter:description"]', "content", brand.description);
  setAttr(
    'meta[name="twitter:image"]',
    "content",
    `${brand.origin}${brandAsset("og-image.png")}`
  );
}
