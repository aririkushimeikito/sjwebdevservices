// Captures a screenshot of each portfolio site and writes optimised WebP
// thumbnails (400, 800 and 1200 px wide, 8:5) to images/portfolio/.
// Run by .github/workflows/capture-thumbnails.yml; needs playwright + sharp.
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

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ["--hide-scrollbars"] });
const results = { ok: [], failed: [] };

async function capture(site) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    await page.goto(site.url, { waitUntil: "load", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    // Nudge lazy-loaded hero content, then settle at the top.
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, ...VIEWPORT } });
    for (const w of WIDTHS) {
      const buf = await sharp(png)
        .resize(w, Math.round(w * 5 / 8), { fit: "cover", position: "top" })
        .webp({ quality: 78, effort: 5 })
        .toBuffer();
      writeFileSync(join(outDir, `${site.slug}-${w}.webp`), buf);
    }
    results.ok.push(site.slug);
    console.log(`ok      ${site.slug}`);
  } catch (err) {
    results.failed.push({ slug: site.slug, url: site.url, error: String(err.message || err).split("\n")[0] });
    console.log(`FAILED  ${site.slug}: ${err.message}`);
  } finally {
    await context.close();
  }
}

for (const site of sites) {
  if (only.length && !only.includes(site.slug)) continue;
  await capture(site);
}
await browser.close();
writeFileSync(join(here, "capture-results.json"), JSON.stringify(results, null, 2) + "\n");
console.log(`\n${results.ok.length} captured, ${results.failed.length} failed`);
