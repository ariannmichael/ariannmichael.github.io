// Generates public/cv/Ariann_Michael_CV.pdf from the same content files the website renders,
// so the CV can never drift from the portfolio. Run from web/:  npm run cv
//
// How it works: Node 24 strips TypeScript types natively, so the content .ts files are imported
// directly. The script renders a print-styled, ATS-friendly HTML page (single column, real text)
// and prints it to a US Letter PDF with headless Google Chrome.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { jobs } from "../src/content/jobs.ts";
import { games } from "../src/content/games.ts";
import { skills } from "../src/content/skills.ts";
import { profile } from "../src/content/profile.ts";
import { links } from "../src/content/links.ts";
import { formatRange, formatDate } from "../src/ui/plain/format.ts";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(WEB, "public", "cv", "Ariann_Michael_CV.pdf");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// The CV keeps the full legal name (matches LinkedIn and background checks); the site uses profile.name.
const CV_NAME = "Ariann Michael Farias";

// CV-toned summary (third-person-free, no "I"); the site's profile.summary is more conversational.
const SUMMARY =
  "Senior Software Engineer with 7+ years of experience building reliable web systems for healthcare and B2B platforms. " +
  "Currently Squad Lead of the Core Features team at Afya, owning the shared components (SSO, opt-in, user preferences and profiling) used by every AfyaOne team. " +
  "Strong in React and TypeScript on the frontend and API design on the backend; experienced in HIPAA-regulated environments. " +
  "Reduced billing aggregation runtime to 0.30s for entire practice groups at DrChrono and delivered AI-driven onboarding that contributed to +20% completed profiles and +37% memberships. " +
  "Indie game developer: Speed King launches on Steam on November 10, 2026.";

const SKILL_GROUPS = [
  ["frontend", "Frontend"],
  ["backend", "Backend"],
  ["architecture", "Architecture"],
  ["testing", "Testing & Quality"],
  ["infra", "Infra & DevOps"],
  ["gamedev", "Game Development"],
];

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const bare = (url) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function experienceHtml() {
  return jobs
    .filter((j) => j.kind !== "education")
    .map((j) => {
      const company = j.client ? `${j.company} (client: ${j.client})` : j.company;
      // The card summary repeats the first bullet, so the CV shows only the location here.
      const where = j.location ? `<p class="sub">${esc(j.location)}</p>` : "";
      const bullets = j.highlights.map((h) => `<li>${esc(h)}</li>`).join("");
      const stack = j.stack.length ? `<p class="stack"><span>Stack:</span> ${esc(j.stack.join(", "))}</p>` : "";
      return `<article class="job">
        <div class="row"><h3>${esc(j.role)}, <span class="company">${esc(company)}</span></h3>
        <span class="dates">${esc(formatRange(j.start, j.end))}</span></div>
        ${where}
        <ul>${bullets}</ul>${stack}
      </article>`;
    })
    .join("");
}

function educationHtml() {
  return jobs
    .filter((j) => j.kind === "education")
    .map(
      (j) => `<div class="row"><h3>${esc(j.role)}, <span class="company">${esc(j.company)}</span></h3>
        <span class="dates">${esc(formatRange(j.start, j.end))}</span></div>`,
    )
    .join("");
}

function skillsHtml() {
  return SKILL_GROUPS.map(([cat, label]) => {
    const names = skills.filter((s) => s.category === cat).map((s) => s.name);
    return names.length ? `<p><strong>${label}:</strong> ${esc(names.join(", "))}</p>` : "";
  }).join("");
}

function gamesHtml() {
  const steam = games.filter((g) => g.platform === "steam");
  const itch = games.filter((g) => g.platform === "itch");
  const steamLines = steam
    .map(
      (g) =>
        `<li><strong>${esc(g.title)}</strong> (Steam${g.releaseDate ? `, releases ${esc(formatDate(g.releaseDate))}` : ""}${g.publisher ? `, ${esc(g.publisher)}` : ""}): ${esc(g.tagline)}</li>`,
    )
    .join("");
  const itchLine = itch.length
    ? `<li><strong>itch.io</strong> (${esc(bare(links.itch))}): ${esc(itch.map((g) => g.title).join(", "))}</li>`
    : "";
  return `<ul>${steamLines}${itchLine}</ul>`;
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(CV_NAME)} · CV</title>
<style>
  @page { size: Letter; margin: 0.5in 0.55in; }
  * { box-sizing: border-box; }
  body { font-family: Charter, "Bitstream Charter", Georgia, serif; font-size: 10pt; line-height: 1.32; color: #111; margin: 0; }
  header { text-align: center; margin-bottom: 8pt; }
  h1 { font-size: 21pt; font-weight: 400; margin: 0 0 2pt; letter-spacing: 0.2pt; }
  .headline { margin: 0 0 3pt; font-size: 10.5pt; }
  .contact { margin: 0; font-size: 9pt; color: #333; }
  .contact a { color: #111; text-decoration: none; }
  h2 { font-size: 11pt; margin: 10pt 0 4pt; padding-bottom: 2pt; border-bottom: 0.8pt solid #222; }
  h3 { font-size: 10pt; margin: 0; font-weight: 700; }
  .company { font-weight: 400; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; }
  .dates { white-space: nowrap; font-size: 9.5pt; }
  .sub { margin: 1pt 0 1pt; font-style: italic; color: #333; font-size: 9.5pt; }
  .job { margin-bottom: 6pt; break-inside: avoid; }
  ul { margin: 2pt 0 0; padding-left: 14pt; }
  li { margin: 0 0 1pt; }
  .stack { margin: 1pt 0 0; font-size: 9pt; color: #333; }
  .stack span { font-weight: 700; }
  section p { margin: 0 0 2pt; }
  .summary { margin: 0; }
</style></head>
<body>
  <header>
    <h1>${esc(CV_NAME)}</h1>
    <p class="headline">${esc(profile.headline)} · ${esc(profile.location)}</p>
    <p class="contact">
      <a href="mailto:${esc(links.email)}">${esc(links.email)}</a> |
      <a href="${esc(links.site)}">${esc(bare(links.site))}</a> |
      <a href="${esc(links.linkedin)}">${esc(bare(links.linkedin))}</a> |
      <a href="${esc(links.github)}">${esc(bare(links.github))}</a> |
      <a href="${esc(links.itch)}">${esc(bare(links.itch))}</a>
    </p>
  </header>
  <section><h2>Summary</h2><p class="summary">${esc(SUMMARY)}</p></section>
  <section><h2>Skills</h2>${skillsHtml()}</section>
  <section><h2>Experience</h2>${experienceHtml()}</section>
  <section><h2>Games</h2>${gamesHtml()}</section>
  <section><h2>Education</h2>${educationHtml()}</section>
  <section><h2>Languages</h2><p>${esc(profile.languages.join(" · "))}</p></section>
</body></html>`;

if (!existsSync(CHROME)) {
  console.error(`Google Chrome not found at ${CHROME}`);
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "cv-"));
const htmlPath = join(dir, "cv.html");
writeFileSync(htmlPath, html);
mkdirSync(dirname(OUT), { recursive: true });

execFileSync(
  CHROME,
  [
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--print-to-pdf=${OUT}`,
    pathToFileURL(htmlPath).href,
  ],
  { stdio: "ignore" },
);

console.log(`CV written to ${OUT}`);
if (process.argv.includes("--html")) console.log(`HTML preview: ${htmlPath}`);
