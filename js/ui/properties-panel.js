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

        let html = `
            <!-- Type Badge -->
            <div class="property-group">
                <div class="property-row">
                    <span class="type-badge ${node.type}">
                        ${typeInfo?.icon || '•'} ${typeInfo?.name || node.type}
                    </span>
                </div>
            </div>

            <!-- Basic Info -->
            <div class="property-group">
                <div class="property-group-header">Basic</div>
        `;

        // Name field
        if (node.type !== 'empty') {
            html += `
                <div class="property-row">
                    <label class="property-label">Name</label>
                    <div class="property-value">
                        <input type="text" 
                               class="property-input" 
                               id="prop-name" 
                               value="${this.escapeHtml(node.properties.name || '')}"
                               placeholder="Enter name">
                    </div>
                </div>
            `;
        }

        // Description field
        if (editableFields.includes('description')) {
            html += `
                <div class="property-row">
                    <label class="property-label">Description</label>
                    <div class="property-value">
                        <textarea class="property-input property-textarea" 
                                  id="prop-description"
                                  placeholder="Enter description">${this.escapeHtml(node.properties.description || '')}</textarea>
                    </div>
                </div>
            `;
        }

        html += `</div>`;

        // Position
        html += `
            <div class="property-group">
                <div class="property-group-header">Position</div>
                <div class="property-row">
                    <label class="property-label">X</label>
                    <div class="property-value">
                        <input type="number" 
                               class="property-input" 
                               id="prop-x" 
                               value="${Math.round(node.position.x)}">
                    </div>
                </div>
                <div class="property-row">
                    <label class="property-label">Y</label>
                    <div class="property-value">
                        <input type="number" 
                               class="property-input" 
                               id="prop-y" 
                               value="${Math.round(node.position.y)}">
                    </div>
                </div>
            </div>
        `;

        // Type-specific fields
        if (editableFields.includes('precondition')) {
            html += `
                <div class="property-group">
                    <div class="property-group-header">Condition</div>
                    <div class="property-row">
                        <label class="property-label">Precondition</label>
                        <div class="property-value">
                            <input type="text" 
                                   class="property-input" 
                                   id="prop-precondition" 
                                   value="${this.escapeHtml(node.properties.precondition || '')}"
                                   placeholder="true">
                        </div>
                    </div>
                </div>
            `;
        }

        if (editableFields.includes('postcondition')) {
            html += `
                <div class="property-group">
                    <div class="property-group-header">Condition</div>
                    <div class="property-row">
                        <label class="property-label">Postcondition</label>
                        <div class="property-value">
                            <input type="text" 
                                   class="property-input" 
                                   id="prop-postcondition" 
                                   value="${this.escapeHtml(node.properties.postcondition || '')}"
                                   placeholder="true">
                        </div>
                    </div>
                </div>
            `;
        }

        if (editableFields.includes('forkType') || editableFields.includes('joinType')) {
            const forkType = node.properties.forkType || node.properties.joinType || 'or';
            html += `
                <div class="property-group">
                    <div class="property-group-header">Fork/Join Type</div>
                    <div class="property-row">
                        <label class="property-label">Type</label>
                        <div class="property-value">
                            <select class="property-input property-select" id="prop-forkType">
                                <option value="or" ${forkType === 'or' ? 'selected' : ''}>OR (Alternative)</option>
                                <option value="and" ${forkType === 'and' ? 'selected' : ''}>AND (Parallel)</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
        }

        // Hierarchy info (connected nodes)
        const connected = graph.getConnectedNodes(nodeId);
        if (connected.incoming.length > 0 || connected.outgoing.length > 0) {
            html += `
                <div class="property-group">
                    <div class="property-group-header">Connections</div>
            `;

            if (connected.incoming.length > 0) {
                html += `
                    <div class="property-row">
                        <label class="property-label">From</label>
                        <div class="property-value" style="font-size: 12px; color: var(--text-secondary);">
                            ${connected.incoming.map(n => n.properties.name || n.id).join(', ')}
                        </div>
                    </div>
                `;
            }

            if (connected.outgoing.length > 0) {
                html += `
                    <div class="property-row">
                        <label class="property-label">To</label>
                        <div class="property-value" style="font-size: 12px; color: var(--text-secondary);">
                            ${connected.outgoing.map(n => n.properties.name || n.id).join(', ')}
                        </div>
                    </div>
                `;
            }

            html += `</div>`;
        }

        // Convert options for empty nodes
        if (node.type === 'empty') {
            html += `
                <div class="property-group">
                    <div class="property-group-header">Actions</div>
                    <div class="property-row">
                        <button class="property-input" id="btn-convert-responsibility" style="cursor: pointer;">
                            Convert to Responsibility
                        </button>
                    </div>
                </div>
            `;
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
            <div class="property-group">
                <div class="property-row">
                    <span class="type-badge" style="border-color: var(--edge-color); color: var(--edge-color);">
                        → Edge
                    </span>
                </div>
            </div>

            <div class="property-group">
                <div class="property-group-header">Connection</div>
                <div class="property-row">
                    <label class="property-label">From</label>
                    <div class="property-value" style="font-size: 12px;">
                        ${sourceNode?.properties.name || edge.sourceNodeId}
                    </div>
                </div>
                <div class="property-row">
                    <label class="property-label">To</label>
                    <div class="property-value" style="font-size: 12px;">
                        ${targetNode?.properties.name || edge.targetNodeId}
                    </div>
                </div>
            </div>

            <div class="property-group">
                <div class="property-group-header">Condition</div>
                <div class="property-row">
                    <label class="property-label">Condition</label>
                    <div class="property-value">
                        <input type="text" 
                               class="property-input" 
                               id="prop-condition" 
                               value="${this.escapeHtml(edge.condition || '')}"
                               placeholder="true">
                    </div>
                </div>
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

        let html = `
            <div class="property-group">
                <div class="property-row">
                    <span class="type-badge">
                        ${typeInfo.icon} ${typeInfo.name}
                    </span>
                </div>
            </div>

            <div class="property-group">
                <div class="property-group-header">Basic</div>
                <div class="property-row">
                    <label class="property-label">Name</label>
                    <div class="property-value">
                         <input type="text" 
                               class="property-input" 
                               id="prop-comp-name" 
                               value="${this.escapeHtml(comp.properties.name || '')}">
                    </div>
                </div>
                <div class="property-row">
                    <label class="property-label">Type</label>
                    <div class="property-value">
                        <select class="property-input property-select" id="prop-comp-type">
                            ${Object.keys(COMPONENT_TYPES).map(type =>
            `<option value="${type}" ${comp.type === type ? 'selected' : ''}>${COMPONENT_TYPES[type].name}</option>`
        ).join('')}
                        </select>
                    </div>
                </div>
                <div class="property-row">
                    <label class="property-label">Width</label>
                    <div class="property-value">
                        <input type="number" 
                               class="property-input" 
                               id="prop-comp-width" 
                               value="${Math.round(comp.bounds.width)}">
                    </div>
                </div>
                <div class="property-row">
                    <label class="property-label">Height</label>
                    <div class="property-value">
                        <input type="number" 
                               class="property-input" 
                               id="prop-comp-height" 
                               value="${Math.round(comp.bounds.height)}">
                    </div>
                </div>
            </div>
            
            <div class="property-group">
                <div class="property-group-header">Bound Elements</div>
                <div class="property-value" style="font-size: 12px; max-height: 100px; overflow-y: auto;">
                    ${comp.childNodes.size > 0 ?
                [...comp.childNodes].map(nid => {
                    const n = graph.getNode(nid);
                    return `<div>• ${n ? (n.properties.name || n.id) : nid}</div>`;
                }).join('')
                : '<span style="color:var(--text-muted)">No bound elements</span>'}
                </div>
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
    }

    attachEdgePropertyListeners(edgeId) {
        const conditionInput = document.getElementById('prop-condition');
        if (conditionInput) {
            conditionInput.addEventListener('change', () => {
                graph.updateEdge(edgeId, { condition: conditionInput.value });
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
