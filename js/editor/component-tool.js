/**
 * UCM Component Tool - Handles creation and manipulation of components
 */

import { graph } from '../core/graph.js';
import { selection } from './selection.js';
import { COMPONENT_TYPES } from '../core/node-types.js';

class ComponentTool {
    constructor() {
        this.active = false;
        this.startPos = null;
        this.currentRect = null;
        this.selectedType = 'team'; // Default type
    }

    setComponentType(type) {
        if (COMPONENT_TYPES[type]) {
            this.selectedType = type;
        }
    }

    handleMouseDown(x, y) {
        this.active = true;
        this.startPos = { x, y };
        this.createGhostRect(x, y);
    }

    handleMouseMove(x, y) {
        if (!this.active || !this.startPos) return;

        const width = x - this.startPos.x;
        const height = y - this.startPos.y; // Allow negative height for dragging up

        this.updateGhostRect(
            this.startPos.x + (width < 0 ? width : 0),
            this.startPos.y + (height < 0 ? height : 0),
            Math.abs(width),
            Math.abs(height)
        );
    }

    handleMouseUp(x, y) {
        if (!this.active || !this.startPos) return;

        const width = Math.abs(x - this.startPos.x);
        const height = Math.abs(y - this.startPos.y);

        // Minimum size check to avoid accidental clicks creating tiny boxes
        if (width > 20 && height > 20) {
            const finalX = Math.min(this.startPos.x, x);
            const finalY = Math.min(this.startPos.y, y);

            this.createFinalComponent(finalX, finalY, width, height);
        }

        this.cancel();
    }

    createGhostRect(x, y) {
        const layer = document.getElementById('layer-selection');
        this.currentRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.currentRect.setAttribute('class', 'ghost-component');
        this.currentRect.setAttribute('x', x);
        this.currentRect.setAttribute('y', y);
        this.currentRect.setAttribute('width', 0);
        this.currentRect.setAttribute('height', 0);
        this.currentRect.setAttribute('fill', 'rgba(0,0,0,0.05)');
        this.currentRect.setAttribute('stroke', 'var(--text-muted)');
        this.currentRect.setAttribute('stroke-dasharray', '4 4');
        layer.appendChild(this.currentRect);
    }

    updateGhostRect(x, y, w, h) {
        if (this.currentRect) {
            this.currentRect.setAttribute('x', x);
            this.currentRect.setAttribute('y', y);
            this.currentRect.setAttribute('width', w);
            this.currentRect.setAttribute('height', h);
        }
    }

    createFinalComponent(x, y, w, h) {
        const component = graph.addComponent(this.selectedType, {
            x, y, width: w, height: h
        });

        // Auto-bind nodes inside
        this.bindContainedNodes(component);

        // Select the new component
        selection.selectComponent(component.id);
        selection.setTool('select'); // Switch back to select tool after creation
    }

    bindContainedNodes(component) {
        const nodes = graph.getAllNodes();
        const bounds = component.bounds;

        nodes.forEach(node => {
            if (this.isNodeInside(node, bounds)) {
                graph.bindNodeToComponent(node.id, component.id);
            }
        });
    }

    isNodeInside(node, bounds) {
        const { x, y } = node.position;
        return x >= bounds.x &&
            x <= bounds.x + bounds.width &&
            y >= bounds.y &&
            y <= bounds.y + bounds.height;
    }

    cancel() {
        this.active = false;
        this.startPos = null;
        if (this.currentRect) {
            this.currentRect.remove();
            this.currentRect = null;
        }
    }
}

export const componentTool = new ComponentTool();
