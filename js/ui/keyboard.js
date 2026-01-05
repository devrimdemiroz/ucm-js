/**
 * Keyboard Shortcuts Manager
 * Handles all keyboard shortcuts for the UCM Editor
 */

import { graph } from '../core/graph.js';
import { history } from '../core/history.js';
import { canvas } from '../editor/canvas.js';
import { selection } from '../editor/selection.js';
import { exporter } from '../core/exporter.js';

class KeyboardManager {
    constructor() {
        this.shortcuts = new Map();
        this.enabled = true;
    }

    init() {
        // Register all shortcuts
        this.registerShortcuts();

        // Listen for keydown events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        console.log('⌨️  Keyboard shortcuts initialized');
    }

    registerShortcuts() {
        // Undo/Redo
        this.register('z', { ctrl: true }, () => this.undo(), 'Undo');
        this.register('z', { ctrl: true, shift: true }, () => this.redo(), 'Redo');
        this.register('y', { ctrl: true }, () => this.redo(), 'Redo (Alt)');

        // Save
        this.register('s', { ctrl: true }, () => this.save(), 'Save');

        // Delete
        this.register('Delete', {}, () => this.deleteSelected(), 'Delete Selected');
        this.register('Backspace', {}, () => this.deleteSelected(), 'Delete Selected (Alt)');

        // Select All
        this.register('a', { ctrl: true }, () => this.selectAll(), 'Select All');

        // Deselect
        this.register('Escape', {}, () => this.deselectAll(), 'Deselect All');

        // Tool Selection
        this.register('v', {}, () => this.selectTool('select'), 'Select Tool');
        this.register('p', {}, () => this.selectTool('path'), 'Path Tool');
        this.register('c', {}, () => this.selectTool('component'), 'Component Tool');

        // Arrow Keys (move selected)
        this.register('ArrowUp', {}, (e) => this.moveSelected(0, -1, e.shiftKey), 'Move Up');
        this.register('ArrowDown', {}, (e) => this.moveSelected(0, 1, e.shiftKey), 'Move Down');
        this.register('ArrowLeft', {}, (e) => this.moveSelected(-1, 0, e.shiftKey), 'Move Left');
        this.register('ArrowRight', {}, (e) => this.moveSelected(1, 0, e.shiftKey), 'Move Right');

        // Duplicate (future enhancement)
        this.register('d', { ctrl: true }, () => this.duplicateSelected(), 'Duplicate Selected');
    }

    register(key, modifiers, handler, description) {
        const shortcutKey = this.makeKey(key, modifiers);
        this.shortcuts.set(shortcutKey, { handler, description, key, modifiers });
    }

    makeKey(key, modifiers) {
        const parts = [];
        if (modifiers.ctrl) parts.push('ctrl');
        if (modifiers.shift) parts.push('shift');
        if (modifiers.alt) parts.push('alt');
        parts.push(key.toLowerCase());
        return parts.join('+');
    }

    handleKeyDown(e) {
        if (!this.enabled) return;

        // Ignore if user is typing in input/textarea
        if (e.target.matches('input, textarea, select')) {
            // Exception: Allow Ctrl+Z, Ctrl+Y, Ctrl+S even in text fields
            const isExceptionKey = (e.ctrlKey || e.metaKey) && ['z', 'y', 's'].includes(e.key.toLowerCase());
            if (!isExceptionKey) return;
        }

        // Build the shortcut key from the event
        const modifiers = {
            ctrl: e.ctrlKey || e.metaKey, // metaKey for Mac Cmd
            shift: e.shiftKey,
            alt: e.altKey
        };

        const shortcutKey = this.makeKey(e.key, modifiers);
        const shortcut = this.shortcuts.get(shortcutKey);

        if (shortcut) {
            e.preventDefault();
            e.stopPropagation();
            shortcut.handler(e);
        }
    }

    // ==================== Shortcut Handlers ====================

    undo() {
        if (history.canUndo()) {
            history.undo();
            console.log('⏮️  Undo');
        }
    }

    redo() {
        if (history.canRedo()) {
            history.redo();
            console.log('⏭️  Redo');
        }
    }

    save() {
        // Trigger save (download JSON)
        const data = {
            nodes: graph.getAllNodes(),
            edges: graph.getAllEdges(),
            components: graph.getAllComponents()
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ucm-diagram-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        console.log('💾 Saved diagram');
    }

    deleteSelected() {
        const selected = selection.getSelected();
        if (!selected || selected.length === 0) return;

        selected.forEach(item => {
            if (item.type === 'node') {
                graph.removeNode(item.id);
            } else if (item.type === 'edge') {
                graph.removeEdge(item.id);
            } else if (item.type === 'component') {
                graph.removeComponent(item.id);
            }
        });

        selection.clear();
        console.log(`🗑️  Deleted ${selected.length} item(s)`);
    }

    selectAll() {
        const allNodes = graph.getAllNodes();
        const allComponents = graph.getAllComponents();

        const items = [
            ...allNodes.map(n => ({ type: 'node', id: n.id })),
            ...allComponents.map(c => ({ type: 'component', id: c.id }))
        ];

        selection.setMultiple(items);
        console.log(`✅ Selected ${items.length} item(s)`);
    }

    deselectAll() {
        selection.clear();
        console.log('⬜ Deselected all');
    }

    selectTool(toolName) {
        // Remove active class from all tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to selected tool
        const toolBtn = document.getElementById(`tool-${toolName}`);
        if (toolBtn) {
            toolBtn.classList.add('active');
            toolBtn.click(); // Trigger the tool's click handler
            console.log(`🔧 Tool: ${toolName}`);
        }
    }

    moveSelected(dx, dy, largeStep = false) {
        const selected = selection.getSelected();
        if (!selected || selected.length === 0) return;

        // Use 10px steps if Shift is held, otherwise 1px
        const step = largeStep ? 10 : 1;
        const deltaX = dx * step;
        const deltaY = dy * step;

        selected.forEach(item => {
            if (item.type === 'node') {
                const node = graph.getNode(item.id);
                if (node) {
                    graph.updateNode(item.id, {
                        position: {
                            x: node.position.x + deltaX,
                            y: node.position.y + deltaY
                        }
                    });
                }
            } else if (item.type === 'component') {
                const comp = graph.getComponent(item.id);
                if (comp) {
                    graph.updateComponent(item.id, {
                        bounds: {
                            ...comp.bounds,
                            x: comp.bounds.x + deltaX,
                            y: comp.bounds.y + deltaY
                        }
                    });
                }
            }
        });

        canvas.renderAll();
    }

    duplicateSelected() {
        const selected = selection.getSelected();
        if (!selected || selected.length === 0) return;

        const duplicated = [];
        const OFFSET = 20; // Offset for duplicated items

        selected.forEach(item => {
            if (item.type === 'node') {
                const node = graph.getNode(item.id);
                if (node) {
                    const newNode = graph.addNode(node.type, {
                        name: `${node.properties.name} Copy`,
                        x: node.position.x + OFFSET,
                        y: node.position.y + OFFSET
                    });
                    duplicated.push({ type: 'node', id: newNode.id });
                }
            } else if (item.type === 'component') {
                const comp = graph.getComponent(item.id);
                if (comp) {
                    const newComp = graph.addComponent(comp.type, {
                        name: `${comp.properties.name} Copy`,
                        x: comp.bounds.x + OFFSET,
                        y: comp.bounds.y + OFFSET,
                        width: comp.bounds.width,
                        height: comp.bounds.height
                    });
                    duplicated.push({ type: 'component', id: newComp.id });
                }
            }
        });

        // Select the duplicated items
        if (duplicated.length > 0) {
            selection.setMultiple(duplicated);
            console.log(`📋 Duplicated ${duplicated.length} item(s)`);
        }
    }

    // ==================== Utility Methods ====================

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    getShortcuts() {
        const shortcuts = [];
        this.shortcuts.forEach((value, key) => {
            shortcuts.push({
                key,
                description: value.description,
                display: this.formatShortcut(value.key, value.modifiers)
            });
        });
        return shortcuts;
    }

    formatShortcut(key, modifiers) {
        const parts = [];
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        if (modifiers.ctrl) parts.push(isMac ? '⌘' : 'Ctrl');
        if (modifiers.shift) parts.push(isMac ? '⇧' : 'Shift');
        if (modifiers.alt) parts.push(isMac ? '⌥' : 'Alt');

        // Format key name
        const keyName = key.charAt(0).toUpperCase() + key.slice(1);
        parts.push(keyName);

        return parts.join(isMac ? '' : '+');
    }
}

export const keyboard = new KeyboardManager();
