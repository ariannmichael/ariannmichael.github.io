# Experience Reconciliation: LinkedIn vs CV

**Date:** 2026-10-17
**Rule:** LinkedIn is the source of truth (`ai-docs/sources/linkedin-profile.pdf`, exported 2026-10-17). The CV (`~/Library/Mobile Documents/com~apple~CloudDocs/Curriculum/CV___Ariann_Michael.pdf`) is used only for the items flagged below, and only if Ariann approves.
**Feeds:** `web/src/content/jobs.ts` (plan step 2.2.1)

---

## Profile

| Field | LinkedIn (use this) | CV (differs) |
|---|---|---|
| Name | Ariann Michael Farias | same |
| Headline | Senior Software Engineer · JavaScript · TypeScript · React · Next.js · Node.js · Nest.js · Python · Django | "Senior Full-Stack Engineer" |
| Years of experience | **7+** ("over seven years") | 6+ |
| Location | Campina Grande, Paraíba, Brazil | — |
| Focus | Healthcare and B2B web systems, HIPAA-regulated environments, billing/claims reliability | same idea |
| Skills (LinkedIn list) | Python, Django, JavaScript, TypeScript, React, Next.js, NestJS, Go, HIPAA Compliance, API Development, Software Reliability. Top skills: Software Infrastructure, Medical Billing, Billing Process | CV adds GraphQL, SQL/NoSQL, Jest, Cypress, Pytest, Sentry, Prometheus, AWS, GitHub Actions, Jenkins, WCAG |
| Languages | English (native/bilingual), Portuguese (native/bilingual), Spanish (limited working) | — |
| Certifications | Alura: HTML5 & CSS3 I, TypeScript part 1, API with Django 3, Java I, Python I | — |
| Links | linkedin.com/in/ariann-michael, github.com/ariannmichael, ariannmichael.itch.io, ariannmichael.github.io | same |

## Timeline (LinkedIn order, newest first)

| # | id (for `jobs.ts`) | Company | Role | Dates | Location | Suggested district |
|---|---|---|---|---|---|---|
| 1 | `afya-2026` | **Afya** | **Squad Lead / Senior Software Engineer** | **Apr 2026 – Present** | São Paulo, Brazil | Healthcare ("current job" spotlight) |
| 2 | `drchrono` | DrChrono by EverHealth | Senior Software Engineer | May 2025 – **Mar 2026** | United States (remote) | Healthcare |
| 3 | `gofasti` | GoFasti (**client: PlanetBids**) | Software Engineer | **Mar 2024** – May 2025 | United States (remote) | Engineering (or Financial: B2B procurement) |
| 4 | `fullstack` | FullStack (**client: GoDaddy**) | Software Engineer | Apr 2022 – Mar 2024 | — | Financial |
| 5 | `afya-2021` | Afya Educacional | Software Engineer | Apr 2021 – Apr 2022 | — | Healthcare |
| 6 | `openmined` | OpenMined | Core Developer (open source) | Feb 2021 – Aug 2021 | remote | Open Source Lab |
| 7 | `stefanini` | Stefanini Brasil | Software Engineer | Mar 2020 – Apr 2021 | — | Engineering |
| 8 | `proj4me` | Proj4me | **Software Engineer Internship** | Jan 2019 – Mar 2020 | Campina Grande | Home / Campus |
| 9 | `ufcg-monitor` | UFCG | **Monitor (teaching assistant)** | Oct 2016 – Sep 2017 | Campina Grande | Home / Campus |
| — | `ufcg` (education) | UFCG | BS Computer Science | Jan 2016 – 2021 | Campina Grande | Home / Campus |

**PlanetBids answered:** it isn't a separate employer. It was **GoFasti's client** (the "As a PlanetBids contractor" bullets), just as GoDaddy was FullStack's client. Show it as "GoFasti · for PlanetBids" in the cards.

## Highlights per role (from LinkedIn, lightly trimmed for cards)

### Afya (2026 – present)
Source: Ariann, 2026-10-17 (LinkedIn has no description for this role yet; add this to LinkedIn too).
- Leads the **Core Features team** behind the shared components used by **every AfyaOne team**
- Main areas: **SSO** (single sign-on), **opt-in/consent**, **user preferences** and **user profiling**
- **Metric chips:** `Squad Lead` · `Shared by all AfyaOne teams` · `SSO · Opt-In · Preferences`
- **Card copy:** "Leading the Core Features team: the shared components every AfyaOne team builds on, including SSO, opt-in, user preferences and profiling."
- **Stack:** Next.js, NestJS, MongoDB, ArgoCD, AWS, GitHub Actions (from Ariann, 2026-10-17)

### DrChrono by EverHealth
- Patient-facing features (appointment scheduling, medical record access) in React + TypeScript on a HIPAA-regulated platform
- Accessible, responsive UI components meeting healthcare compliance: **+22% user engagement**
- Billing/claims reliability: optimized backend workflows, idempotent job handling, lower error rates
- Fixed a critical billing performance issue for large practice groups (wrong bulk payer insurance counts, slow initialization scripts)
- **Helped decompose a Django monolith into Rust microservices** for performance-critical workloads, lowering latency and improving scalability
- Redesigned aggregation with query optimization and **AWS Redshift**, moving from per-doctor to practice-group batch processing: **0.30s runtime** for entire practice groups, with no more production timeouts or DevOps intervention
- Clean Architecture and automated testing
- **Metric chips:** `0.30s billing runtime` · `+22% engagement` · `Django → Rust microservices`
- **Stack:** React, TypeScript, Django, Python, Rust, AWS Redshift

### GoFasti (for PlanetBids)
- Modernized legacy platforms by integrating React into an Ember/Django ecosystem
- AI-driven onboarding flows: **+20% user profiles**, **+37% memberships**
- Integrated transactional and event data into **Snowflake** for analytics, reporting and AI product insights
- Optimized Django REST APIs for performance and scalability, with an emphasis on backend/API reliability
- **Metric chips:** `+20% profiles` · `+37% memberships` · `Snowflake analytics`
- **Stack:** React, Ember, Django, Python, Snowflake

### FullStack (for GoDaddy)
- Payment methods, subscriptions, receipts and renewals for GoDaddy's account team, improving transaction reliability and international payment support
- New profile pages and country-specific payment verifications: wider global payment compatibility and fewer failed transactions
- Jest and Cypress test suites integrated with AWS, GitHub Actions and Jenkins
- Scrum/Agile, Kanban, Jira
- **Metric chips:** `International payments` · `Fewer transaction failures` · `Jest + Cypress CI`
- **Stack:** JavaScript, TypeScript, React, Next.js, Node.js, Go, MongoDB

### Afya Educacional (2021–2022)
- Built the **live platform and real-time chat** from scratch for Brazil's largest medical school platform (from entry-level courses to Ph.D. programs)
- Frontend in React. Backend architecture in Node.js, MongoDB, GraphQL, WebSockets and REST
- Supports thousands of medical students and professionals across Brazil
- **Metric chips:** `Real-time chat` · `Live platform` · `Thousands of users`
- **Stack:** React, Node.js, GraphQL, MongoDB, WebSockets

### OpenMined
- **PySyft:** features and bug fixes for data-centric federated learning with differential privacy
- **PyGrid:** UI for granular permissions at the user and tensor level
- **Stack:** Python, PyTorch, Flask, Next.js, GraphQL (stack from the CV)

### Stefanini Brasil
- Employee **mentoring platform** (choose a topic and book a slot by mentor availability): React, React Native, Java, Spring, MySQL
- **Contactless restaurant ordering** web and mobile app for Almanara restaurants: React, React Native, Node.js, MySQL
- Customer support
- **Stack:** React, React Native, Java, Spring, Node.js, MySQL

### Proj4me (internship)
- Project-management pages (milestones, project creation, team management, private projects) in Angular 2+ / AngularJS
- Backend request handling and query optimization in Java, Spring Boot, MySQL
- Scrum/Kanban

### UFCG Monitor
- One-on-one tutoring for students learning Java, OOP and Git

---

## Conflicts that need Ariann's decision

| # | Conflict | LinkedIn says | CV says | Default if no answer |
|---|---|---|---|---|
| C1 | Current job | Afya, Squad Lead, from Apr 2026 | DrChrono "Present" | **LinkedIn.** Also update the CV PDF before it goes in `web/public/cv/` |
| C2 | Monolith decomposition | DrChrono: Django → **Rust** microservices | GoFasti: Django → **Node.js** services | **LinkedIn** (DrChrono, Rust). If both are true, add it back to GoFasti |
| C3 | GoDaddy metrics | No numbers | **+12% transaction success**, **−0.2s latency** | ✅ **Decided 2026-10-17: leave them out.** The ticker shows qualitative text only |
| C4 | GoFasti start date | Mar 2024 | Apr 2024 | **Mar 2024** |
| C5 | Company names | "FullStack", "Afya Educacional", "Stefanini Brasil", "DrChrono by EverHealth" | "Fullstack Labs", "Afya", "Stefanini", "DrChrono" | **LinkedIn names** |
| C6 | Proj4me title | Software Engineer **Internship** | Software Engineer | **LinkedIn** |
| C7 | Afya 2026 highlights | none | n/a | ✅ **Provided by Ariann 2026-10-17** (see the Afya 2026 section) |
| C8 | Years of experience | 7+ | 6+ | **7+** |

## Impact on the plan

- **Afya (current job) lives in the Healthcare District**, which is in Milestone 2. Until then its card goes in the Engineering District (step 6.3.4), with a **"Current role" badge**.
- **Afya appears twice** (2021 Software Engineer, 2026 Squad Lead). Use one Afya campus with two cards, or one card with both periods ("came back as Squad Lead"), which tells a nice story.
- **The factory metaphor** (monolith → microservices conveyor belts) moves from GoFasti to **DrChrono** (Rust microservices), as a factory annex next to the Healthcare District clinic.
- **GoFasti's new visual hook:** Snowflake. A data-warehouse building with a giant snowflake on the roof (Holiday Kit snow pieces), plus an "AI onboarding" kiosk.
- **The GoDaddy ticker** (step 8.2.3) uses the C3 decision.
- **The UFCG Monitor role** becomes a small "Teaching assistant" card on campus.
