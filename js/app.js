/**
 * UCM Editor - Main Application Entry Point
 */

import { graph } from './core/graph.js';
import { canvas } from './editor/canvas.js';
import { selection } from './editor/selection.js';
import { hierarchyPanel } from './ui/hierarchy-panel.js';
import { propertiesPanel } from './ui/properties-panel.js';
import { sidebar } from './ui/sidebar.js';
import { dslPanel } from './ui/dsl-panel.js';
import { toolbar } from './ui/toolbar.js';
import { history } from './core/history.js';
import { tooltip } from './ui/tooltip.js';
import { settingsPanel } from './ui/settings-panel.js';
import { aiChat } from './ui/ai-chat.js';
import { actionsPanel } from './ui/actions-panel.js';
import { scenarioPanel } from './ui/scenario-panel.js';
import { tracing } from './core/tracing.js';
import { fileLoader } from './core/file-loader.js';
import { keyboard } from './ui/keyboard.js';
import { notifications } from './ui/notifications.js';

class UCMEditor {
    constructor() {
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        console.log('🚀 Initializing UCM Editor...');

        // Initialize tracing first
        tracing.init();

        // Initialize notification system
        notifications.init();

        // Initialize all modules
        canvas.init();
        toolbar.init();
        sidebar.init();
        dslPanel.init();
        hierarchyPanel.init();
        propertiesPanel.init();
        actionsPanel.init();
        scenarioPanel.init();
        history.init();
        settingsPanel.init();
        aiChat.init();
        keyboard.init();

        // Set default tool
        selection.init();
        selection.setTool('select');

        // Initialize context menu
        import('./editor/context-menu.js').then(({ contextMenu }) => {
            contextMenu.init();
        });

        // Load default example
        await this.loadDefaultExample();

        this.initialized = true;
        console.log('✅ UCM Editor initialized');
    }

    async loadDefaultExample() {
        try {
            // Load the observability stack as default (shows the app architecture)
            await fileLoader.loadExample('observability-stack');

            // Update dropdown to reflect loaded file
            const dropdown = document.getElementById('file-dropdown');
            if (dropdown) {
                dropdown.value = 'observability-stack';
            }
        } catch (error) {
            console.warn('Failed to load default example, using fallback demo:', error);
            notifications.warning('Failed to load default example, using fallback demo');
            this.createFallbackDemo();
        }
    }

    createFallbackDemo() {
        // Minimal fallback if .ducm files can't be loaded
        const startNode = graph.addNode('start', { x: 100, y: 200, name: 'Start' });
        const endNode = graph.addNode('end', { x: 400, y: 200, name: 'End' });
        graph.addEdge(startNode.id, endNode.id);
        canvas.renderAll();
    }

    // Public API
    getGraph() {
        return graph;
    }

    exportJSON() {
        return JSON.stringify(graph.toJSON(), null, 2);
    }

    importJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            graph.fromJSON(data);
            return true;
        } catch (e) {
            console.error('Failed to import JSON:', e);
            notifications.error('Failed to import JSON: ' + e.message);
            return false;
        }
    }

    clear() {
        graph.clear();
    }
}

// Create and expose the editor instance
const editor = new UCMEditor();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => editor.init());
} else {
    editor.init();
}

// Expose to window for debugging and testing
window.ucmEditor = editor;
window.ucmGraph = graph;
window.ucmCanvas = canvas;
window.ucmSelection = selection;
window.ucmHistory = history;
window.ucmFileLoader = fileLoader;
window.ucmNotifications = notifications;
