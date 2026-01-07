/**
 * Properties Panel - Edit selected element properties
 */

import { graph } from '../core/graph.js';
import { selection } from '../editor/selection.js';
import { NODE_TYPES, COMPONENT_TYPES } from '../core/node-types.js';

class PropertiesPanel {
    constructor() {
        this.container = null;
        this.currentElement = null;
        this.currentType = null; // 'node' | 'edge' | 'component'
    }

    init() {
        this.container = document.getElementById('properties-content');
        this.subscribeToEvents();
    }

    subscribeToEvents() {
        selection.on('selection:changed', ({ nodes, edges, components }) => {
            const total = nodes.length + edges.length + (components?.length || 0);

            if (total === 0) {
                this.showPlaceholder();
            } else if (total === 1) {
                if (nodes.length) this.showNodeProperties(nodes[0]);
                else if (edges.length) this.showEdgeProperties(edges[0]);
                else if (components?.length) this.showComponentProperties(components[0]);
            } else {
                this.showMultiSelection(nodes.length, edges.length, components?.length || 0);
            }
        });

        graph.on('node:updated', (node) => {
            if (this.currentType === 'node' && this.currentElement === node.id) {
                this.showNodeProperties(node.id);
            }
        });

        graph.on('component:updated', (comp) => {
            if (this.currentType === 'component' && this.currentElement === comp.id) {
                this.showComponentProperties(comp.id);
            }
        });
    }

    showPlaceholder() {
        this.currentElement = null;
        this.currentType = null;
        this.container.innerHTML = `
            <p class="placeholder-text">Select an element to view properties</p>
        `;
    }

    showMultiSelection(nodeCount, edgeCount, compCount) {
        this.currentElement = null;
        this.currentType = null;

        const parts = [];
        if (nodeCount > 0) parts.push(`${nodeCount} node${nodeCount > 1 ? 's' : ''}`);
        if (edgeCount > 0) parts.push(`${edgeCount} edge${edgeCount > 1 ? 's' : ''}`);
        if (compCount > 0) parts.push(`${compCount} component${compCount > 1 ? 's' : ''}`);

        this.container.innerHTML = `
            <p class="placeholder-text">${parts.join(', ')} selected</p>
        `;
    }

    showNodeProperties(nodeId) {
        const node = graph.getNode(nodeId);
        if (!node) {
            this.showPlaceholder();
            return;
        }

        this.currentElement = nodeId;
        this.currentType = 'node';

        const typeInfo = NODE_TYPES[node.type];
        const editableFields = typeInfo?.editable || [];
        const nameValue = node.properties.name || '';
        const namePlaceholder = nameValue ? '' : (typeInfo?.name || 'Untitled Node');

        let html = `
            <!-- Header: Name & Quick Info -->
            <div style="margin-bottom: 12px;">
                <input type="text" 
                       class="panel-header-input" 
                       id="prop-name" 
                       value="${this.escapeHtml(nameValue)}"
                       placeholder="${namePlaceholder}">
                
                <div class="panel-quick-info">
                    <span class="type-badge ${node.type}">
                        ${typeInfo?.icon || '•'} ${typeInfo?.name || node.type}
                    </span>
                    <span class="id-badge" title="Node ID">${nodeId}</span>
                </div>
            </div>

            <!-- Description (Primary) -->
            ${editableFields.includes('description') ? `
            <div class="property-group">
                <div class="property-row">
                    <textarea class="property-input property-textarea" 
                              id="prop-description"
                              placeholder="Description..."
                              style="min-height: 60px;">${this.escapeHtml(node.properties.description || '')}</textarea>
                </div>
            </div>` : ''}

            <!-- Type Specific Primary Fields -->
            ${node.type === 'empty' ? `
            <div class="property-group">
                <button class="primary-btn" id="btn-convert-responsibility" style="width: 100%;">
                    Convert to Responsibility
                </button>
            </div>` : ''}

            ${(editableFields.includes('forkType') || editableFields.includes('joinType')) ? `
            <div class="property-group">
                <div class="property-group-header">Behavior</div>
                <div class="property-row">
                    <label class="property-label">Type</label>
                    <div class="property-value">
                        <select class="property-input property-select" id="prop-forkType">
                            <option value="or" ${(node.properties.forkType === 'or' || node.properties.joinType === 'or') ? 'selected' : ''}>OR (Alternative)</option>
                            <option value="and" ${(node.properties.forkType === 'and' || node.properties.joinType === 'and') ? 'selected' : ''}>AND (Parallel)</option>
                        </select>
                    </div>
                </div>
            </div>` : ''}

            <!-- Conditions (Advanced) -->
            ${(editableFields.includes('precondition') || editableFields.includes('postcondition')) ? `
            <div class="property-group">
                <div class="property-group-header">Conditions</div>
                ${editableFields.includes('precondition') ? `
                <div class="property-row">
                    <label class="property-label">Pre-condition</label>
                    <div class="property-value">
                        <input type="text" class="property-input" id="prop-precondition" value="${this.escapeHtml(node.properties.precondition || '')}" placeholder="true">
                    </div>
                </div>` : ''}
                ${editableFields.includes('postcondition') ? `
                <div class="property-row">
                    <label class="property-label">Post-condition</label>
                    <div class="property-value">
                        <input type="text" class="property-input" id="prop-postcondition" value="${this.escapeHtml(node.properties.postcondition || '')}" placeholder="true">
                    </div>
                </div>` : ''}
            </div>` : ''}

            <!-- Timer Properties -->
            ${editableFields.includes('timeout') ? `
            <div class="property-group">
                <div class="property-group-header">Timer Settings</div>
                <div class="property-row">
                    <label class="property-label">Timeout</label>
                    <div class="property-value">
                        <input type="text" class="property-input" id="prop-timeout" value="${this.escapeHtml(node.properties.timeout || '')}" placeholder="e.g. 100ms">
                    </div>
                </div>
            </div>` : ''}

            <!-- Position & Layout -->
            <div class="property-group">
                <div class="property-group-header">Layout</div>
                <div class="property-row">
                    <label class="property-label">Position</label>
                    <div class="property-value" style="display: flex; gap: 8px;">
                        <input type="number" class="property-input" id="prop-x" value="${Math.round(node.position.x)}" title="X" style="width: 60px;">
                        <input type="number" class="property-input" id="prop-y" value="${Math.round(node.position.y)}" title="Y" style="width: 60px;">
                    </div>
                </div>
            </div>

            <!-- Danger Zone / Actions -->
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-light);">
                <button class="secondary-btn" id="btn-delete-node" style="width: 100%; color: #dc3545; border-color: rgba(220, 53, 69, 0.2);">
                    Delete Node
                </button>
            </div>
        `;

        // Connections Info (Footer)
        const connected = graph.getConnectedNodes(nodeId);
        if (connected.incoming.length > 0 || connected.outgoing.length > 0) {
            html += `
            <div class="property-group" style="border: none; margin-top: 10px;">
                <div class="property-group-header">Connections</div>
                <div style="font-size: 11px; color: var(--text-secondary);">
                    ${connected.incoming.length ? `<div>← ${connected.incoming.map(n => n.properties.name || n.id).join(', ')}</div>` : ''}
                    ${connected.outgoing.length ? `<div>→ ${connected.outgoing.map(n => n.properties.name || n.id).join(', ')}</div>` : ''}
                </div>
            </div>`;
        }

        this.container.innerHTML = html;
        this.attachPropertyListeners(nodeId);
    }

    showEdgeProperties(edgeId) {
        const edge = graph.getEdge(edgeId);
        if (!edge) {
            this.showPlaceholder();
            return;
        }

        this.currentElement = edgeId;
        this.currentType = 'edge';

        const sourceNode = graph.getNode(edge.sourceNodeId);
        const targetNode = graph.getNode(edge.targetNodeId);

        this.container.innerHTML = `
            <!-- Header -->
            <div style="margin-bottom: 12px; border-bottom: 1px solid var(--border-light); padding-bottom: 12px;">
                <div class="property-group-header" style="font-size: 10px; margin-bottom: 4px;">CONNECTION</div>
                <div style="font-weight: 500; font-size: 13px;">
                    <span style="color: var(--text-primary);">${sourceNode?.properties.name || 'Start'}</span>
                    <span style="color: var(--text-muted); margin: 0 6px;">→</span>
                    <span style="color: var(--text-primary);">${targetNode?.properties.name || 'End'}</span>
                </div>
                <div class="panel-quick-info" style="margin-top: 6px; margin-bottom: 0;">
                     <span class="id-badge" title="Edge ID">${edgeId}</span>
                </div>
            </div>

            <!-- Condition -->
            <div class="property-group">
                <div class="property-group-header">Logic</div>
                <div class="property-row">
                    <label class="property-label">Condition</label>
                    <div class="property-value">
                        <input type="text" 
                               class="property-input panel-header-input" 
                               style="font-size: 14px; font-weight: 400;"
                               id="prop-condition" 
                               value="${this.escapeHtml(edge.condition || '')}"
                               placeholder="true">
                    </div>
                </div>
            </div>

            <!-- Danger Zone / Actions -->
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-light);">
                <button class="secondary-btn" id="btn-delete-edge" style="width: 100%; color: #dc3545; border-color: rgba(220, 53, 69, 0.2);">
                    Delete Connection
                </button>
            </div>
        `;

        this.attachEdgePropertyListeners(edgeId);
    }

    showComponentProperties(compId) {
        const comp = graph.getComponent(compId);
        if (!comp) {
            this.showPlaceholder();
            return;
        }

        this.currentElement = compId;
        this.currentType = 'component';

        const typeInfo = COMPONENT_TYPES[comp.type] || COMPONENT_TYPES.team;
        const nameValue = comp.properties.name || '';
        const namePlaceholder = typeInfo.name;

        let html = `
            <!-- Header -->
            <div style="margin-bottom: 12px;">
                <input type="text" 
                       class="panel-header-input" 
                       id="prop-comp-name" 
                       value="${this.escapeHtml(nameValue)}"
                       placeholder="${namePlaceholder}">
                
                <div class="panel-quick-info">
                    <span class="type-badge">
                        ${typeInfo.icon} ${typeInfo.name}
                    </span>
                    <span class="id-badge" title="Component ID">${compId}</span>
                </div>
            </div>

            <!-- Type Selection -->
            <div class="property-group">
                <div class="property-row">
                    <label class="property-label">Kind</label>
                    <div class="property-value">
                        <select class="property-input property-select" id="prop-comp-type">
                            ${Object.keys(COMPONENT_TYPES).map(type =>
            `<option value="${type}" ${comp.type === type ? 'selected' : ''}>${COMPONENT_TYPES[type].name}</option>`
        ).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <!-- Dimensions -->
            <div class="property-group">
                <div class="property-group-header">Dimensions</div>
                <div class="property-row">
                    <label class="property-label">Size</label>
                    <div class="property-value" style="display: flex; gap: 8px;">
                        <input type="number" class="property-input" id="prop-comp-width" value="${Math.round(comp.bounds.width)}" title="Width" style="width: 60px;">
                        <span style="color:var(--text-muted); line-height: 24px;">×</span>
                        <input type="number" class="property-input" id="prop-comp-height" value="${Math.round(comp.bounds.height)}" title="Height" style="width: 60px;">
                    </div>
                </div>
            </div>
            
            <!-- Bound Elements -->
            <div class="property-group">
                <div class="property-group-header">Contents</div>
                <div class="property-value" style="font-size: 11px; max-height: 120px; overflow-y: auto; background: var(--bg-secondary); padding: 8px; border-radius: 4px;">
                    ${comp.childNodes.size > 0 ?
                [...comp.childNodes].map(nid => {
                    const n = graph.getNode(nid);
                    return `<div style="margin-bottom: 2px; color: var(--text-secondary);">• ${n ? (n.properties.name || n.id) : nid}</div>`;
                }).join('')
                : '<span style="color:var(--text-muted)">Empty</span>'}
                </div>
            </div>

            <!-- Danger Zone / Actions -->
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-light);">
                <button class="secondary-btn" id="btn-delete-comp" style="width: 100%; color: #dc3545; border-color: rgba(220, 53, 69, 0.2);">
                    Delete Component
                </button>
            </div>
        `;

        this.container.innerHTML = html;
        this.attachComponentListeners(compId);
    }

    attachComponentListeners(compId) {
        const nameInput = document.getElementById('prop-comp-name');
        if (nameInput) {
            nameInput.addEventListener('change', () => {
                graph.updateComponent(compId, { properties: { name: nameInput.value } });
            });
        }

        const typeSelect = document.getElementById('prop-comp-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                graph.updateComponent(compId, { type: typeSelect.value });
                // Re-render properties to update icon/badge
                this.showComponentProperties(compId);
                // Also trigger specific graph event for renderer optimization? 
                // renderAll handles it via listener on component:updated
            });
        }

        const widthInput = document.getElementById('prop-comp-width');
        if (widthInput) {
            widthInput.addEventListener('change', () => {
                graph.updateComponent(compId, { bounds: { width: parseFloat(widthInput.value) } });
            });
        }

        const heightInput = document.getElementById('prop-comp-height');
        if (heightInput) {
            heightInput.addEventListener('change', () => {
                graph.updateComponent(compId, { bounds: { height: parseFloat(heightInput.value) } });
            });
        }

        const deleteBtn = document.getElementById('btn-delete-comp');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this component?')) {
                    graph.removeComponent(compId);
                    this.showPlaceholder();
                    selection.clear();
                }
            });
        }
    }

    attachPropertyListeners(nodeId) {
        // Name
        const nameInput = document.getElementById('prop-name');
        if (nameInput) {
            nameInput.addEventListener('change', () => {
                graph.updateNode(nodeId, { properties: { name: nameInput.value } });
            });
        }

        // Description
        const descInput = document.getElementById('prop-description');
        if (descInput) {
            descInput.addEventListener('change', () => {
                graph.updateNode(nodeId, { properties: { description: descInput.value } });
            });
        }

        // Position
        const xInput = document.getElementById('prop-x');
        const yInput = document.getElementById('prop-y');
        if (xInput && yInput) {
            xInput.addEventListener('change', () => {
                graph.moveNode(nodeId, parseFloat(xInput.value), parseFloat(yInput.value));
            });
            yInput.addEventListener('change', () => {
                graph.moveNode(nodeId, parseFloat(xInput.value), parseFloat(yInput.value));
            });
        }

        // Precondition
        const preInput = document.getElementById('prop-precondition');
        if (preInput) {
            preInput.addEventListener('change', () => {
                graph.updateNode(nodeId, { properties: { precondition: preInput.value } });
            });
        }

        // Postcondition
        const postInput = document.getElementById('prop-postcondition');
        if (postInput) {
            postInput.addEventListener('change', () => {
                graph.updateNode(nodeId, { properties: { postcondition: postInput.value } });
            });
        }

        // Timeout
        const timeoutInput = document.getElementById('prop-timeout');
        if (timeoutInput) {
            timeoutInput.addEventListener('change', () => {
                graph.updateNode(nodeId, { properties: { timeout: timeoutInput.value } });
            });
        }

        // Fork type
        const forkTypeSelect = document.getElementById('prop-forkType');
        if (forkTypeSelect) {
            forkTypeSelect.addEventListener('change', () => {
                const node = graph.getNode(nodeId);
                if (node?.type === 'fork') {
                    graph.updateNode(nodeId, { properties: { forkType: forkTypeSelect.value } });
                } else if (node?.type === 'join') {
                    graph.updateNode(nodeId, { properties: { joinType: forkTypeSelect.value } });
                }
            });
        }

        // Convert to responsibility
        const convertBtn = document.getElementById('btn-convert-responsibility');
        if (convertBtn) {
            convertBtn.addEventListener('click', () => {
                graph.updateNode(nodeId, { type: 'responsibility' });
                this.showNodeProperties(nodeId);
            });
        }

        // Delete
        const deleteBtn = document.getElementById('btn-delete-node');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this node?')) {
                    graph.removeNode(nodeId);
                    this.showPlaceholder();
                    selection.clear();
                }
            });
        }
    }

    attachEdgePropertyListeners(edgeId) {
        const conditionInput = document.getElementById('prop-condition');
        if (conditionInput) {
            conditionInput.addEventListener('change', () => {
                graph.updateEdge(edgeId, { condition: conditionInput.value });
            });
        }

        const deleteBtn = document.getElementById('btn-delete-edge');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                graph.removeEdge(edgeId);
                this.showPlaceholder();
                selection.clear();
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export const propertiesPanel = new PropertiesPanel();
