import type { Skill } from "./types";

// From the LinkedIn skills list plus the CV skill groups (see experience-reconciliation.md).
// Ids are stable kebab-case: other code may reference them.
export const skills: Skill[] = [
  // Frontend
  { id: "typescript", name: "TypeScript", category: "frontend" },
  { id: "javascript", name: "JavaScript", category: "frontend" },
  { id: "react", name: "React", category: "frontend" },
  { id: "nextjs", name: "Next.js", category: "frontend" },
  { id: "react-native", name: "React Native", category: "frontend" },
  { id: "angular", name: "Angular", category: "frontend" },
  { id: "ember", name: "Ember", category: "frontend" },
  { id: "wcag", name: "Accessibility (WCAG)", category: "frontend" },

  // Backend
  { id: "nodejs", name: "Node.js", category: "backend" },
  { id: "nestjs", name: "NestJS", category: "backend" },
  { id: "python", name: "Python", category: "backend" },
  { id: "django", name: "Django", category: "backend" },
  { id: "go", name: "Go", category: "backend" },
  { id: "rust", name: "Rust", category: "backend" },
  { id: "java", name: "Java / Spring", category: "backend" },
  { id: "graphql", name: "GraphQL", category: "backend" },
  { id: "rest-apis", name: "REST APIs", category: "backend" },
  { id: "mongodb", name: "MongoDB", category: "backend" },
  { id: "sql", name: "SQL (MySQL)", category: "backend" },
  { id: "snowflake", name: "Snowflake", category: "backend" },
  { id: "aws-redshift", name: "AWS Redshift", category: "backend" },

  // Architecture
  { id: "microservices", name: "Microservices", category: "architecture" },
  { id: "clean-architecture", name: "Clean Architecture", category: "architecture" },
  { id: "software-reliability", name: "Software Reliability", category: "architecture" },
  { id: "hipaa", name: "HIPAA Compliance", category: "architecture" },
  { id: "medical-billing", name: "Medical Billing", category: "architecture" },
  { id: "websockets", name: "Real-time (WebSockets)", category: "architecture" },

  // Testing
  { id: "jest", name: "Jest", category: "testing" },
  { id: "cypress", name: "Cypress", category: "testing" },
  { id: "pytest", name: "Pytest", category: "testing" },

  // Infra
  { id: "aws", name: "AWS", category: "infra" },
  { id: "github-actions", name: "GitHub Actions", category: "infra" },
  { id: "argocd", name: "ArgoCD", category: "infra" },
  { id: "jenkins", name: "Jenkins", category: "infra" },
  { id: "sentry", name: "Sentry", category: "infra" },
  { id: "prometheus", name: "Prometheus", category: "infra" },

  // Game dev
  { id: "godot", name: "Godot", category: "gamedev" },
  { id: "unity", name: "Unity", category: "gamedev" },
];
