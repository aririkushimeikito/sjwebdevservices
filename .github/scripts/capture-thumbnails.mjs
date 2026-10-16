// Captures a screenshot of each portfolio site and writes optimised WebP
// thumbnails (400, 800 and 1200 px wide, 8:5) to images/portfolio/.
// Run by .github/workflows/capture-thumbnails.yml; needs playwright + sharp.
//
// Strategy: render with headless Chromium first. If the site answers with a
// bot-check interstitial (Cloudflare etc.), fall back to the WordPress mShots
// screenshot service, which the site previously used for these thumbnails.
import { chromium } from "playwright";
import sharp from "sharp";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const outDir = join(root, "images", "portfolio");
const sites = JSON.parse(readFileSync(join(here, "portfolio-sites.json"), "utf8"));
const only = process.argv.slice(2);
const WIDTHS = [400, 800, 1200];
const VIEWPORT = { width: 1600, height: 1000 };
const CHALLENGE = /security verification|verify you are human|just a moment|checking your browser|attention required|access denied|enable javascript and cookies/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ["--hide-scrollbars"] });
const results = { ok: [], failed: [] };

async function dismissPopups(page) {
  const selectors = [
    "#onetrust-accept-btn-handler", ".cky-btn-accept", ".cc-btn.cc-dismiss", ".cc-allow",
    "button:has-text('Accept all')", "button:has-text('Accept All')", "button:has-text('Accept')",
    "button:has-text('I agree')", "button:has-text('Got it')", "button:has-text('OK')",
    "[aria-label='Close']", "[aria-label='close']", "[aria-label='Close dialog']", "button.close", ".popup-close",
    ".pum-close", ".mfp-close", ".fancybox-close-small", ".sgpb-popup-close-button-1", ".elementor-popup-modal .dialog-close-button",
    ".wp-block-popup-close", "[class*='modal'] [class*='close']", "[class*='popup'] [class*='close']",
    "[class*='Modal'] [class*='close']", "[id*='popup'] [class*='close']", "button:has-text('No thanks')",
    "button:has-text('Close')", "button:has-text('×')", "a:has-text('×')", "span:has-text('×')",
  ];
  try { await page.keyboard.press("Escape"); await sleep(300); } catch {}
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 300 })) { await el.click({ timeout: 1500 }); await sleep(400); }
    } catch {}
  }
}

async function looksChallenged(page) {
  try {
    const title = await page.title();
    const text = await page.evaluate(() => (document.body && document.body.innerText || "").slice(0, 4000));
    return CHALLENGE.test(title) || CHALLENGE.test(text);
  } catch { return false; }
}

async function viaChromium(url) {
  const context = await browser.newContext({
    viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: "reduce", locale: "en-US",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });
  const page = await context.newPage();
  try {
    const res = await page.goto(url, { waitUntil: "load", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await sleep(3000);
    // A JS interstitial may clear on its own; give it up to ~25 s before giving up.
    for (let i = 0; i < 6 && (await looksChallenged(page)); i++) await sleep(4000);
    if ((res && res.status() >= 400) || (await looksChallenged(page))) throw new Error("challenge");
    await dismissPopups(page);
    await page.evaluate(() => window.scrollTo(0, 600));
    await sleep(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(3000); // let hero images / videos finish loading
    await dismissPopups(page);
    return await page.screenshot({ type: "png", clip: { x: 0, y: 0, ...VIEWPORT } });
  } finally {
    await context.close();
  }
}

async function viaMshots(url) {
  const api = `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=${VIEWPORT.width}&h=${VIEWPORT.height}`;
  for (let attempt = 0; attempt < 16; attempt++) {
    const res = await fetch(api, { redirect: "manual" });
    const type = res.headers.get("content-type") || "";
    if (res.status === 200 && type.startsWith("image/") && !type.includes("gif")) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 15000) return buf; // tiny responses are the "rendering" placeholder
    }
    await sleep(6000); // mShots renders on first request; poll until the real image arrives
  }
  throw new Error("mShots did not render in time");
}

async function capture(site) {
  let source = "chromium";
  try {
    let shot;
    try {
      shot = await viaChromium(site.url);
    } catch (err) {
      source = "mshots";
      console.log(`        ${site.slug}: chromium ${err.message}; using mShots`);
      shot = await viaMshots(site.url);
    }
    for (const w of WIDTHS) {
      const buf = await sharp(shot)
        .resize(w, Math.round(w * 5 / 8), { fit: "cover", position: "top" })
        .webp({ quality: 78, effort: 5 })
        .toBuffer();
      writeFileSync(join(outDir, `${site.slug}-${w}.webp`), buf);
    }
    results.ok.push({ slug: site.slug, source });
    console.log(`ok      ${site.slug} (${source})`);
  } catch (err) {
    results.failed.push({ slug: site.slug, url: site.url, error: String(err.message || err).split("\n")[0] });
    console.log(`FAILED  ${site.slug}: ${err.message}`);
  }
}

for (const site of sites) {
  if (only.length && !only.includes(site.slug)) continue;
  await capture(site);
}
await browser.close();
writeFileSync(join(here, "capture-results.json"), JSON.stringify(results, null, 2) + "\n");
console.log(`\n${results.ok.length} captured, ${results.failed.length} failed`);
if (results.failed.length) process.exitCode = 0; // keep partial results; failures are listed above
