/**
 * DSL Panel - Live Code Editor for UCM DSL
 */

import { graph } from '../core/graph.js';
import { canvas } from '../editor/canvas.js';
import { serializer } from '../core/serializer.js';
import { parser } from '../core/parser.js';
import { notifications } from './notifications.js';

class DslPanel {
    constructor() {
        this.editor = null;
        this.applyBtn = null;
        this.statusEl = null;
        this.errorListEl = null;
        this.isUpdatingFromGraph = false;
    }

    init() {
        this.editor = document.getElementById('dsl-editor');
        this.applyBtn = document.getElementById('btn-apply-dsl');
        this.statusEl = document.getElementById('editor-status');

        if (!this.editor || !this.applyBtn) return;

        // Create error list container
        this.createErrorList();

        this.applyBtn.addEventListener('click', () => this.applyDsl());

        // Keyboard shortcut: Ctrl+Enter to apply
        this.editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.applyDsl();
            }
        });

        // Update DSL when graph changes
        graph.on('node:added', () => this.updateFromGraph());
        graph.on('node:updated', () => this.updateFromGraph());
        graph.on('node:removed', () => this.updateFromGraph());
        graph.on('component:added', () => this.updateFromGraph());
        graph.on('component:updated', () => this.updateFromGraph());
        graph.on('component:removed', () => this.updateFromGraph());
        graph.on('edge:added', () => this.updateFromGraph());
        graph.on('edge:removed', () => this.updateFromGraph());
        graph.on('graph:loaded', () => this.updateFromGraph());
        graph.on('graph:cleared', () => this.updateFromGraph());

        // Setup drag & drop for .ucm files
        this.setupDragDrop();

        // Initial update
        this.updateFromGraph();
    }

    createErrorList() {
        // Insert error list after the editor
        const container = this.editor.parentElement;
        this.errorListEl = document.createElement('div');
        this.errorListEl.id = 'dsl-errors';
        this.errorListEl.className = 'dsl-error-list';
        container.insertBefore(this.errorListEl, this.editor.nextSibling);
    }

    updateFromGraph() {
        if (this.isUpdatingFromGraph) return;

        const dsl = this.serialize(graph);
        this.editor.value = dsl;
        this.setStatus('Synced', 'synced');
        this.clearErrors();
    }

    async applyDsl() {
        const text = this.editor.value;
        this.setStatus('Applying...', 'pending');

        import('../core/tracing.js').then(({ tracing }) => {
            tracing.startUserAction('user.apply_dsl', { 'text_length': text.length });
        });

        try {
            this.isUpdatingFromGraph = true;
            const result = parser.parse(text, graph);

            if (result.success) {
                this.setStatus('Applied', 'success');
                this.clearErrors();
                notifications.success('DSL applied successfully');

                // Show warnings if any
                if (result.warnings.length > 0) {
                    this.showErrors(result.warnings, 'warning');
                    notifications.warning(`Applied with ${result.warnings.length} warning(s)`);
                }

                canvas.renderAll();
            } else {
                this.setStatus(`${result.errors.length} Error(s)`, 'error');
                this.showErrors(result.errors, 'error');
                notifications.error(`DSL has ${result.errors.length} error(s) - check the editor for details`);
            }
        } catch (e) {
            console.error(e);
            this.setStatus('Error', 'error');
            this.showErrors([{ line: 1, message: e.message }], 'error');
            notifications.error('DSL parse error: ' + e.message);
        } finally {
            this.isUpdatingFromGraph = false;
        }
    }

    setStatus(text, type) {
        this.statusEl.textContent = text;
        this.statusEl.className = `status-${type}`;
    }

    clearErrors() {
        if (this.errorListEl) {
            this.errorListEl.innerHTML = '';
            this.errorListEl.style.display = 'none';
        }
        this.editor.classList.remove('has-errors');
    }

    showErrors(errors, type = 'error') {
        if (!this.errorListEl || errors.length === 0) return;

        this.errorListEl.innerHTML = errors.map(err => `
            <div class="dsl-error-item ${type}" data-line="${err.line}">
                <span class="error-line">Line ${err.line}:</span>
                <span class="error-message">${err.message}</span>
            </div>
        `).join('');

        this.errorListEl.style.display = 'block';
        this.editor.classList.add('has-errors');

        // Click to jump to line
        this.errorListEl.querySelectorAll('.dsl-error-item').forEach(item => {
            item.addEventListener('click', () => {
                const line = parseInt(item.dataset.line, 10);
                this.goToLine(line);
            });
        });
    }

    goToLine(lineNum) {
        const lines = this.editor.value.split('\n');
        let pos = 0;
        for (let i = 0; i < lineNum - 1 && i < lines.length; i++) {
            pos += lines[i].length + 1;
        }
        this.editor.focus();
        this.editor.setSelectionRange(pos, pos + (lines[lineNum - 1]?.length || 0));
    }

    setupDragDrop() {
        const container = document.getElementById('tab-editor');
        if (!container) return;

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            container.classList.add('drag-over');
        });

        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');

            const file = e.dataTransfer.files[0];
            if (file && (file.name.endsWith('.ducm') || file.name.endsWith('.ucm') || file.name.endsWith('.txt'))) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.editor.value = event.target.result;
                    this.setStatus('File Loaded', 'synced');
                    this.clearErrors();
                    notifications.success(`Loaded: ${file.name}`);
                };
                reader.onerror = () => {
                    this.setStatus('Read Error', 'error');
                    notifications.error('Failed to read dropped file');
                };
                reader.readAsText(file);
            } else {
                this.setStatus('Invalid file type', 'error');
                notifications.warning('Invalid file type. Supported: .ducm, .ucm, .txt');
            }
        });
    }

    serialize(graph) {
        return serializer.serialize(graph);
    }

    // Load DSL from text (used by import)
    loadDsl(text) {
        this.editor.value = text;
        this.setStatus('Loaded', 'synced');
        this.clearErrors();
    }
}

export const dslPanel = new DslPanel();
