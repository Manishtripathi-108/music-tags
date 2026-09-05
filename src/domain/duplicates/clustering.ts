import { type DuplicateMatchReason } from './types';

export interface DisjointEdgeReason {
    reason: DuplicateMatchReason;
    confidence: number;
    label: string;
}

/**
 * Union-Find data structure for merging duplicate candidate pairs into clusters.
 */
export class DisjointSet {
    parent = new Map<string, string>();
    edgeReasons = new Map<string, DisjointEdgeReason>();

    find(id: string): string {
        if (!this.parent.has(id)) {
            this.parent.set(id, id);
            return id;
        }
        if (this.parent.get(id) !== id) {
            this.parent.set(id, this.find(this.parent.get(id)!));
        }
        return this.parent.get(id)!;
    }

    union(a: string, b: string, reason: DuplicateMatchReason, confidence: number, label: string): void {
        const rootA = this.find(a);
        const rootB = this.find(b);
        if (rootA !== rootB) {
            this.parent.set(rootA, rootB);
            const key = `${rootA}::${rootB}`;
            this.edgeReasons.set(key, { reason, confidence, label });
        }
    }
}
