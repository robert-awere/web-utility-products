import { z } from "zod";

/**
 * SourceBrief — repo intelligence types
 * No DB persistence needed for MVP; all analysis is computed on demand.
 */

export const analyzeRequestSchema = z.object({
  url: z
    .string()
    .min(1, "Enter a GitHub URL or owner/repo")
    .max(500),
});
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

export type TechStackItem = {
  name: string;
  category: "language" | "framework" | "runtime" | "tooling" | "infra" | "data" | "ai";
  confidence: number; // 0..1
  evidence: string; // e.g. "package.json: next@14"
};

export type ArchitectureNode = {
  id: string;
  label: string;
  kind: "entry" | "module" | "service" | "data" | "external" | "ui";
  description?: string;
};

export type ArchitectureEdge = {
  from: string;
  to: string;
  kind?: "data" | "control" | "depends";
  label?: string;
};

export type ComplexityModule = {
  name: string;
  path: string;
  size: number; // arbitrary weight (LOC estimate or file count)
  complexity: "low" | "medium" | "high";
  reason?: string;
};

export type DependencyEdge = {
  from: string;
  to: string;
  weight?: number;
};

export type RiskItem = {
  title: string;
  area: "security" | "maintenance" | "performance" | "scalability" | "docs" | "testing" | "licensing";
  severity: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  rationale: string;
};

export type OpportunityItem = {
  title: string;
  area: "feature" | "refactor" | "monetization" | "growth" | "dx" | "ai";
  upside: 1 | 2 | 3 | 4 | 5;
  effort: 1 | 2 | 3 | 4 | 5;
  rationale: string;
};

export type PromptCard = {
  category: "understand" | "extend" | "refactor" | "test" | "document" | "market" | "monetize";
  title: string;
  prompt: string;
};

export type HowToUseStep = {
  title: string;
  action: string;
  command?: string;
  evidence: string;
  confidence: "verified" | "inferred" | "sample";
};

export type RepoVerdict = {
  recommendation: "study" | "adopt" | "fork" | "avoid" | "investigate";
  label: string;
  confidence: "high" | "medium" | "low";
  bestFor: string[];
  rationale: string;
  watchouts: string[];
  nextAction: string;
};

export type ScorecardItem = {
  label: "Maintenance" | "Documentation" | "Setup clarity" | "Test confidence" | "Adoption signal";
  score: number;
  reason: string;
  confidence: "verified" | "inferred" | "sample";
};

export type EvidenceItem = {
  label: string;
  path: string;
  note: string;
  isReal: boolean;
};

export type RepoAnalysis = {
  source: "github" | "demo";
  owner: string;
  repo: string;
  url: string;
  fetchedAt: string;
  repoMeta: {
    description: string | null;
    stars: number;
    forks: number;
    watchers: number;
    openIssues: number;
    license: string | null;
    primaryLanguage: string | null;
    defaultBranch: string;
    createdAt: string | null;
    updatedAt: string | null;
    pushedAt: string | null;
    topics: string[];
    sizeKB: number;
    homepage: string | null;
  };
  summary: {
    headline: string;
    purpose: string;
    audience: string;
    pitch: string;
  };
  techStack: TechStackItem[];
  architecture: {
    nodes: ArchitectureNode[];
    edges: ArchitectureEdge[];
  };
  complexity: ComplexityModule[];
  dependencies: {
    runtime: { name: string; version?: string }[];
    dev: { name: string; version?: string }[];
    edges: DependencyEdge[];
  };
  risks: RiskItem[];
  opportunities: OpportunityItem[];
  verdict: RepoVerdict;
  scorecard: ScorecardItem[];
  howToUse: HowToUseStep[];
  prompts: PromptCard[];
  evidence: EvidenceItem[];
  notes: string[];
};
