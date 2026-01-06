/**
 * UCM History Manager - Handles Undo/Redo operations
 *
 * P3.4: Event-type-specific debouncing for better UX during rapid operations
 * - Node dragging: 200ms (frequent position updates)
 * - Edge drawing: 100ms (moderate frequency)
 * - Property editing: 300ms (typing in text fields)
 * - Default: 100ms (for other operations)
 */

import { graph } from './graph.js';
import { toolbar } from '../ui/toolbar.js';

// Event-type-specific debounce times (in milliseconds)
// @agent main - 2026-01-06 - P3.4 implementation
const DEBOUNCE_TIMES = {
    'node:updated': 200,      // Dragging nodes - needs responsive feel but not too many snapshots
    'node:added': 100,        // Adding nodes - quick response
    'node:removed': 100,      // Removing nodes - quick response
    'edge:added': 100,        // Drawing paths - moderate frequency
    'edge:updated': 150,      // Updating edge control points
    'edge:removed': 100,      // Removing edges - quick response
    'component:added': 100,   // Adding components
    'component:updated': 200, // Moving/resizing components
    'component:removed': 100, // Removing components
    'node:bound': 100,        // Binding nodes to components
    'node:unbound': 100,      // Unbinding nodes from components
    'property:updated': 300   // Typing in property fields - longer delay for text input
};

// Default debounce time for unrecognized events
const DEFAULT_DEBOUNCE = 100;

class HistoryManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;
        this.isExecuting = false; // Flag to prevent event loops during undo/redo
        this.snapshotTimeout = null;
        this.lastEventType = null; // Track last event type for debugging
    }

    init() {
        // Initial snapshot
        this.saveSnapshot();

        // Listen to graph changes with event-type-specific debouncing
        // @agent main - 2026-01-06 - P3.4: Pass event type to scheduleSnapshot
        const changeEvents = [
            'node:added', 'node:updated', 'node:removed',
            'edge:added', 'edge:updated', 'edge:removed',
            'component:added', 'component:updated', 'component:removed',
            'node:bound', 'node:unbound'
        ];

        changeEvents.forEach(eventType => {
            graph.on(eventType, () => {
                if (!this.isExecuting) {
                    this.scheduleSnapshot(eventType);
                }
            });
        });

        // Listen for full graph loads (e.g. from file loader)
        graph.on('graph:loaded', (data) => {
            if (data && data.clearHistory) {
                this.reset();
                this.saveSnapshot();
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

    /**
     * Schedule a snapshot with event-type-specific debounce timing
     * @param {string} eventType - The type of event that triggered the snapshot
     * @agent main - 2026-01-06 - P3.4: Event-specific debouncing
     */
    scheduleSnapshot(eventType) {
        // Get debounce time for this event type, or use default
        const delay = DEBOUNCE_TIMES[eventType] || DEFAULT_DEBOUNCE;

        // Track last event type for debugging
        this.lastEventType = eventType;

        // Clear any pending snapshot and schedule new one with appropriate delay
        if (this.snapshotTimeout) {
            clearTimeout(this.snapshotTimeout);
        }
        this.snapshotTimeout = setTimeout(() => {
            this.saveSnapshot();
            this.snapshotTimeout = null;
        }, delay);
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
