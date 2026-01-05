/**
 * UCM History Manager - Handles Undo/Redo operations
 */

import { graph } from './graph.js';
import { toolbar } from '../ui/toolbar.js';

class HistoryManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;
        this.isExecuting = false; // Flag to prevent event loops during undo/redo
    }

    init() {
        // Initial snapshot
        this.saveSnapshot();

        // Listen to graph changes
        const changeEvents = [
            'node:added', 'node:updated', 'node:removed',
            'edge:added', 'edge:updated', 'edge:removed',
            'component:added', 'component:updated', 'component:removed',
            'node:bound', 'node:unbound'
        ];

        changeEvents.forEach(event => {
            graph.on(event, () => {
                if (!this.isExecuting) {
                    this.scheduleSnapshot();
                }
            });
        });

        // Listen for file load events to reset history
        // @agent main - 2026-01-05 - P2.3 implementation
        graph.on('graph:loaded', ({ clearHistory }) => {
            if (clearHistory) {
                this.reset();
                this.saveSnapshot(); // Save initial state after load
            }
        });
    }

    /**
     * Reset history stacks
     * Used when loading a new file or clearing the graph
     * @agent main - 2026-01-05 - P2.3 implementation
     */
    reset() {
        this.undoStack = [];
        this.redoStack = [];
        if (this.snapshotTimeout) {
            clearTimeout(this.snapshotTimeout);
            this.snapshotTimeout = null;
        }
        this.updateUI();
    }

    scheduleSnapshot() {
        if (this.snapshotTimeout) {
            clearTimeout(this.snapshotTimeout);
        }
        this.snapshotTimeout = setTimeout(() => {
            this.saveSnapshot();
            this.snapshotTimeout = null;
        }, 50); // 50ms debounce to group cascade updates
    }

    saveSnapshot() {
        // Clear pending timeout if forced save (though usually called via timeout)
        if (this.snapshotTimeout) {
            clearTimeout(this.snapshotTimeout);
            this.snapshotTimeout = null;
        }

        const json = JSON.stringify(graph.toJSON());

        // Avoid duplicate snapshots (e.g. if multiple events fire at once)
        if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === json) {
            return;
        }

        this.undoStack.push(json);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }

        // Clear redo stack on new change
        this.redoStack = [];

        this.updateUI();
    }

    undo() {
        if (this.undoStack.length <= 1) return;

        this.isExecuting = true;

        // Pop current state and move to redo
        const current = this.undoStack.pop();
        this.redoStack.push(current);

        // Restore previous state
        const previous = this.undoStack[this.undoStack.length - 1];
        this.restoreState(previous);

        this.isExecuting = false;
        this.updateUI();
    }

    redo() {
        if (this.redoStack.length === 0) return;

        this.isExecuting = true;

        // Pop redo state and push to undo
        const next = this.redoStack.pop();
        this.undoStack.push(next);

        this.restoreState(next);

        this.isExecuting = false;
        this.updateUI();
    }

    restoreState(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            graph.fromJSON(data);
            // graph.fromJSON emits 'graph:loaded', which might trigger re-renders
        } catch (e) {
            console.error('Failed to restore history state:', e);
        }
    }

    updateUI() {
        // We need a way to update toolbar buttons.
        // Direct DOM manipulation or event emission? 
        // Toolbar is a class instance export.

        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');

        if (undoBtn) undoBtn.disabled = this.undoStack.length <= 1;
        if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
    }
}

export const history = new HistoryManager();
