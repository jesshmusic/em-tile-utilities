/**
 * Best-effort rollback for creators that build several documents in sequence.
 */

interface RollbackStep {
  /** Human-readable subject, used only in the warning logged on failure. */
  label: string;
  undo: () => Promise<unknown>;
}

/**
 * Tracks documents as a creator produces them so a later failure can undo them.
 */
export interface RollbackTracker {
  /** Register an embedded document of `scene` for deletion. */
  trackEmbedded(collection: string, id: string, label?: string): void;
  /** Register an arbitrary undo step (deleting a world document, clearing a flag...). */
  track(label: string, undo: () => Promise<unknown>): void;
  /** Undo every registered step in reverse order of registration. */
  rollback(): Promise<void>;
}

/**
 * Create a rollback tracker for a scene.
 *
 * Steps are undone in reverse order of registration, and each one is
 * independently try/caught so a failure mid-rollback doesn't mask the original
 * error that triggered it.
 *
 * @param scene - The scene embedded documents were created in
 */
export function createRollbackTracker(scene: Scene): RollbackTracker {
  const steps: RollbackStep[] = [];

  return {
    trackEmbedded(collection: string, id: string, label?: string): void {
      steps.push({
        label: label ?? `${collection} ${id}`,
        // The repo's local Scene type doesn't expose deleteEmbeddedDocuments;
        // cast through any (consistent with the rest of this codebase) since
        // the method exists on every Foundry Document at runtime.
        undo: () => (scene as any).deleteEmbeddedDocuments(collection, [id])
      });
    },

    track(label: string, undo: () => Promise<unknown>): void {
      steps.push({ label, undo });
    },

    async rollback(): Promise<void> {
      for (const step of [...steps].reverse()) {
        try {
          await step.undo();
        } catch (e) {
          console.warn(`🧩 Tile Utilities: Failed to roll back ${step.label}`, e);
        }
      }
    }
  };
}
