/**
 * Toolbar - Tool buttons and zoom controls
 */

import { selection } from '../editor/selection.js';
import { canvas } from '../editor/canvas.js';
import { history } from '../core/history.js';
import { fileLoader } from '../core/file-loader.js';
import { validator } from '../core/validator.js';
import { graph } from '../core/graph.js';
import { notifications } from './notifications.js';

class Toolbar {
    constructor() {
        this.buttons = {};
        this.fileDropdown = null;
    }

    init() {
        this.buttons = {
            select: document.getElementById('tool-select'),
            path: document.getElementById('tool-path'),
            component: document.getElementById('tool-component'),
            delete: document.getElementById('tool-delete'),
            undo: document.getElementById('btn-undo'),
            redo: document.getElementById('btn-redo'),
            zoomIn: document.getElementById('btn-zoom-in'),
            zoomOut: document.getElementById('btn-zoom-out'),
            save: document.getElementById('btn-save'),
            exportDSL: document.getElementById('btn-export-dsl'),
            exportPDF: document.getElementById('btn-export-pdf'),
            exportJUCM: document.getElementById('btn-export-jucm'),
            exportD3: document.getElementById('btn-export-d3'),
            exportCy: document.getElementById('btn-export-cy'),
            exportSVG: document.getElementById('btn-export-svg'),
            exportPNG: document.getElementById('btn-export-png'),
            validate: document.getElementById('btn-validate'),
            importJSON: document.getElementById('btn-import-json'),
            fileInput: document.getElementById('file-input')
        };

        this.fileDropdown = document.getElementById('file-dropdown');

        this.attachEventListeners();
        this.updateToolState();
    }

    async attachEventListeners() {
        const { exporter } = await import('../core/exporter.js');

        // File dropdown for loading examples
        this.fileDropdown?.addEventListener('change', async (e) => {
            const exampleId = e.target.value;
            if (exampleId) {
                try {
                    await fileLoader.loadExample(exampleId);
                } catch (error) {
                    console.error('Failed to load example:', error);
                    notifications.error('Failed to load diagram: ' + error.message);
                }
            }
        });

        // ... existing listeners ...
        this.buttons.select?.addEventListener('click', () => selection.setTool('select'));
        this.buttons.path?.addEventListener('click', () => selection.setTool('path'));
        this.buttons.component?.addEventListener('click', () => selection.setTool('component'));
        this.buttons.delete?.addEventListener('click', () => selection.deleteSelected());
        this.buttons.undo?.addEventListener('click', () => history.undo());
        this.buttons.redo?.addEventListener('click', () => history.redo());
        this.buttons.zoomIn?.addEventListener('click', () => canvas.zoomIn());
        this.buttons.zoomOut?.addEventListener('click', () => canvas.zoomOut());

        // Saving and Exporting
        this.buttons.save?.addEventListener('click', () => exporter.exportJSON());
        this.buttons.exportDSL?.addEventListener('click', () => exporter.exportDSL());
        this.buttons.exportPNG?.addEventListener('click', () => exporter.exportPNG(2)); // New
        this.buttons.exportPDF?.addEventListener('click', () => exporter.exportPDF());
        this.buttons.exportJUCM?.addEventListener('click', () => exporter.exportJUCM());
        this.buttons.exportD3?.addEventListener('click', () => exporter.exportD3());
        this.buttons.exportCy?.addEventListener('click', () => exporter.exportCytoscape());
        this.buttons.exportSVG?.addEventListener('click', () => exporter.exportSVG());

        this.buttons.validate?.addEventListener('click', () => {
            const result = validator.validate(graph);
            const report = validator.generateReport(result);
            alert(report);
        });

        this.buttons.importJSON?.addEventListener('click', () => {
            this.buttons.fileInput?.click();
        });

        this.buttons.fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                exporter.importFile(file).then(() => {
                    canvas.renderAll();
                });
            }
        });

        // Subscribe to tool changes
        selection.on('tool:changed', () => {
            this.updateToolState();
        });

        // Subscribe to selection changes for delete button state
        selection.on('selection:changed', ({ nodes, edges, components }) => {
            if (this.buttons.delete) {
                const hasSelection = nodes.length > 0 || edges.length > 0 || (components && components.length > 0);
                this.buttons.delete.disabled = !hasSelection;
            }
        });
    }

    updateToolState() {
        // Update active tool button
        Object.entries(this.buttons).forEach(([tool, btn]) => {
            if (btn && ['select', 'path', 'component'].includes(tool)) {
                btn.classList.toggle('active', selection.currentTool === tool);
            }
        });
    }
}

export const toolbar = new Toolbar();
