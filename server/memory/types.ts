export type MemoryTier = "short" | "long" | "permanent";

export type MemorySegment =
  | "identity"
  | "preference"
  | "relationship"
  | "project"
  | "knowledge"
  | "context";

export interface MemoryRecord {
  memoryId: string;
  content: string;
  tier: MemoryTier;
  segment: MemorySegment;
  importance: number;
  decayRate: number;
  accessCount: number;
  lastAccessedAt: number;
  sourceTurn?: string;
  supersedes?: string[];
}

export const DEFAULT_DECAY: Record<MemoryTier, number> = {
  short: 0.05,
  long: 0.02,
  permanent: 0,
};

export const SEGMENT_PREFERRED_TIER: Record<MemorySegment, MemoryTier> = {
  identity: "permanent",
  preference: "long",
  relationship: "long",
  project: "long",
  knowledge: "long",
  context: "short",
};

export function makeMemoryId(): string {
  return `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
