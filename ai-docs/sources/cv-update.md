# CV Update — bring the CV in line with LinkedIn

**Date:** 2026-10-17
**Current CV:** `~/Library/Mobile Documents/com~apple~CloudDocs/Curriculum/CV___Ariann_Michael.pdf` (made with LaTeX + hyperref, last built 2025-12-12). The `.tex` source isn't on this Mac (probably on Overleaf), so apply these edits there.
**Rule:** LinkedIn is the source of truth (`ai-docs/sources/experience-reconciliation.md`).
**When done:** export the PDF and copy it to `portfolio/web/public/cv/Ariann_Michael_CV.pdf` (plan step 0.5.4). Keep the old PDF in iCloud as an archive.

Each change below is ready to paste. Adapt it to your template's macros (e.g. `\resumeSubheading`, `\item`).

---

## 1. Summary — replace the whole paragraph

> Senior Software Engineer with 7+ years of experience building reliable web systems for healthcare and B2B platforms. Currently Squad Lead of the Core Features team at Afya, owning the shared components (SSO, opt-in, user preferences and profiling) used by every AfyaOne team. Expertise in React and TypeScript on the frontend and API design on the backend. Improved billing reliability at DrChrono, reducing runtime to 0.30s for entire practice groups. Delivered AI-driven onboarding flows that contributed to a 20% increase in user profile completion and 37% growth in memberships. Experienced in HIPAA-regulated environments.

Changes: 6+ → **7+** years, and added the current Afya role.

## 2. Experience — add a new first entry

**Squad Lead | Senior Software Engineer**, Afya – São Paulo, Brazil  **April 2026 – Present**
- Lead the Core Features team, responsible for the shared components used by all AfyaOne teams.
- Own platform-wide capabilities including SSO, opt-in, user preferences and user profiling.
- Build and ship with Next.js, NestJS and MongoDB on AWS, using GitHub Actions and ArgoCD (GitOps) for delivery.

*(Optional third bullet, if true: one about team size, process, or an impact number.)*

## 3. DrChrono — edit the header and add a bullet

- Header: **Senior Software Engineer**, DrChrono by EverHealth – Remote  **May 2025 – March 2026** (was "Present")
- Add this bullet (from LinkedIn) after the "Resolved a critical billing performance issue…" bullet:
  - Helped decompose a Django monolith into Rust microservices for performance-critical workloads, reducing latency and improving system scalability.

## 4. GoFasti — edit the header, swap one bullet

- Header: **Software Engineer**, GoFasti (client: PlanetBids) – Remote  **March 2024 – May 2025** (was April 2024, and the client wasn't named)
- **Replace** the bullet "Contributed to decomposing a Django monolith into Node.js-based services…" with the LinkedIn bullet:
  - Integrated transactional and event data into Snowflake, enabling scalable analytics, reporting, and AI-driven product insights.
  - *(If the Node.js decomposition at GoFasti really happened too, keep it. LinkedIn just doesn't mention it, and both can be true.)*
- Optional: tighten "Delivered AI-driven onboarding flows in React…" to match LinkedIn ("Enhanced onboarding experience with AI-driven flows, directly contributing to a 20% increase in user profiles and 37% growth in memberships.")

## 5. Fullstack Labs — rename, drop the numbers

- Header: **Software Engineer**, FullStack (client: GoDaddy) – Remote  **April 2022 – March 2024**
- Remove the unverified numbers (same decision as the website, C3):
  - "…increasing transaction success rate by 12%" → "…improving transaction reliability and international payment support."
  - "Optimized application performance… reducing latency by 0.2s." → **delete**, or rewrite as "Developed Jest and Cypress test suites integrated with AWS, GitHub Actions and Jenkins, increasing stability and reducing production issues." (from LinkedIn)
  - "Spearheaded migration of legacy systems to microservices, increasing system capacity." LinkedIn doesn't mention this, so keep it only if it's accurate

## 6. Afya (2021) — rename

- Header: **Software Engineer**, Afya Educacional – Remote  **April 2021 – April 2022**
- Optional: the two long paragraph bullets can be cut to two short ones. Your choice, and it saves space for the new Afya entry:
  - Built the live platform and real-time chat from scratch for Brazil's largest medical school platform (React, Node.js, GraphQL, MongoDB, WebSockets).
  - Designed a scalable backend supporting thousands of medical students and professionals across Brazil.

## 7. Stefanini — rename and add the second project

- Header: **Software Engineer**, Stefanini Brasil – Remote  **March 2020 – April 2021**
- Add:
  - Built a contactless ordering web and mobile app for Almanara restaurants using React, React Native, Node.js, and MySQL.
- Note: LinkedIn's mentoring-platform stack includes **React Native**. Add it to the existing bullet.

## 8. Proj4me — title

- Header: **Software Engineer Intern**, Proj4me – Campina Grande, Brazil  **Jan 2019 – March 2020**

## 9. Education — dates and teaching assistant

- **Federal University of Campina Grande** – BS in Computer Science  **2016 – 2021**
- Optional line: *Teaching Assistant (Monitor), Java, OOP and Git, Oct 2016 – Sep 2017*

## 10. Skills — align with LinkedIn

- Add: **NestJS**, **Go**, **Rust**, **Snowflake**, **AWS Redshift**, **React Native**, **HIPAA Compliance**, **ArgoCD**
- Consider a "Game Development" line: **Godot, Unity**, with a link to Speed King on Steam and ariannmichael.itch.io (this matches the new portfolio)

## 11. Header links

- Add **ariannmichael.github.io** (the new portfolio) next to GitHub and LinkedIn.

---

## Checklist

- [ ] 1 Summary
- [ ] 2 Afya 2026 entry
- [ ] 3 DrChrono
- [ ] 4 GoFasti
- [ ] 5 FullStack (numbers removed)
- [ ] 6 Afya Educacional
- [ ] 7 Stefanini
- [ ] 8 Proj4me
- [ ] 9 Education
- [ ] 10 Skills
- [ ] 11 Links
- [ ] Export the PDF, then copy it to `web/public/cv/Ariann_Michael_CV.pdf`
- [ ] Also add the Afya 2026 description to **LinkedIn**, so the source of truth is complete
