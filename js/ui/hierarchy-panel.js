/**
 * Hierarchy Panel - Tree view of UCM elements organized by paths and components
 *
 * This is the main orchestrator that:
 * - Manages panel state (expanded groups, selection)
 * - Coordinates tree building (hierarchy-tree-builder.js)
 * - Coordinates rendering (hierarchy-renderer.js)
 * - Handles events and incremental updates
 * 
 * Optimized with incremental updates for better performance with large diagrams.
 */

import { graph } from '../core/graph.js';
import { selection } from '../editor/selection.js';
import { buildPathTree, getPathCount, getComponentCount } from './hierarchy-tree-builder.js';
import {
    renderPathsSection,
    renderComponentsSection,
    renderNodeItem,
    renderComponentItem
} from './hierarchy-renderer.js';

class HierarchyPanel {
    constructor() {
        this.container = null;
        this.expandedGroups = new Set(['paths', 'components']);
    }

    init() {
        this.container = document.getElementById('hierarchy-tree');
        this.subscribeToEvents();
        this.render();
    }

    subscribeToEvents() {
        // Incremental updates for node changes
        graph.on('node:added', (node) => this.handleNodeAdded(node));
        graph.on('node:updated', (node) => this.updateNodeInTree(node));
        graph.on('node:removed', (data) => this.removeNodeFromTree(data.id));

        // Incremental updates for component changes
        graph.on('component:added', (component) => this.addComponentToTree(component));
        graph.on('component:updated', (component) => this.updateComponentInTree(component));
        graph.on('component:removed', (data) => this.removeComponentFromTree(data.id));

        // Edge changes may affect path structure
        graph.on('edge:added', () => this.render());
        graph.on('edge:updated', () => this.render());
        graph.on('edge:removed', () => this.render());

        // Full render on major changes
        graph.on('graph:loaded', () => this.render());
        graph.on('graph:cleared', () => this.render());

        // Component nesting events
        graph.on('component:nested', () => this.render());
        graph.on('component:unnested', () => this.render());

        // Node binding events
        graph.on('node:bound', (data) => this.handleNodeBinding(data));
        graph.on('node:unbound', () => this.render());

        selection.on('selection:changed', () => this.updateSelectionState());
    }

    // ============================================
    // Full Rendering
    // ============================================

    render() {
        if (!this.container) return;

        const pathTrees = buildPathTree();
        const components = graph.getAllComponents();

        let html = '';

        // Paths Section
        html += renderPathsSection(pathTrees, this.expandedGroups);

        // Components Section
        if (components.length > 0) {
            html += renderComponentsSection(components, this.expandedGroups);
        }

        this.container.innerHTML = html;
        this.attachEventListeners();
        this.updateSelectionState();
    }

    // ============================================
    // Incremental Updates
    // ============================================

    handleNodeAdded(node) {
        if (!this.container) return;

        // Start nodes affect path structure - need full re-render
        if (node.type === 'start') {
            this.render();
            return;
        }

        // Update component children if bound
        if (node.parentComponent) {
            this.updateComponentChildren(node.parentComponent);
        }

        this.updatePathsCount();
    }

    updateNodeInTree(node) {
        if (!this.container) return;

        const nodeElement = this.container.querySelector(`[data-node-id="${node.id}"]`);
        if (nodeElement) {
            const newHtml = renderNodeItem(node);
            const temp = document.createElement('div');
            temp.innerHTML = newHtml;
            const newElement = temp.firstElementChild;

            if (nodeElement.classList.contains('selected')) {
                newElement.classList.add('selected');
            }

            nodeElement.replaceWith(newElement);
            this.attachNodeEventListener(newElement, node.id);
        }
    }

    removeNodeFromTree(nodeId) {
        if (!this.container) return;

        const nodeElement = this.container.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeElement) {
            nodeElement.remove();
        }
        this.updatePathsCount();
    }

    addComponentToTree(component) {
        if (!this.container) return;

        const componentsChildren = this.container.querySelector('.component-tree');

        if (!componentsChildren) {
            this.render();
            return;
        }

        if (!component.parentComponent) {
            const componentHtml = renderComponentItem(component, this.expandedGroups);
            const temp = document.createElement('div');
            temp.innerHTML = componentHtml;
            const newElement = temp.firstElementChild;
            componentsChildren.appendChild(newElement);
            this.attachComponentEventListeners(newElement);
        } else {
            this.updateComponentChildren(component.parentComponent);
        }

        this.updateComponentsCount();
    }

    updateComponentInTree(component) {
        if (!this.container) return;

        const compElement = this.container.querySelector(`[data-component-id="${component.id}"]`);
        if (compElement) {
            const treeNode = compElement.closest('.tree-node');
            if (treeNode) {
                const newHtml = renderComponentItem(component, this.expandedGroups);
                const temp = document.createElement('div');
                temp.innerHTML = newHtml;
                const newElement = temp.firstElementChild;

                const wasSelected = compElement.classList.contains('selected');
                treeNode.replaceWith(newElement);

                if (wasSelected) {
                    const newCompItem = newElement.querySelector(`[data-component-id="${component.id}"]`);
                    if (newCompItem) newCompItem.classList.add('selected');
                }

                this.attachComponentEventListeners(newElement);
            }
        }
    }

    removeComponentFromTree(componentId) {
        if (!this.container) return;

        const compElement = this.container.querySelector(`[data-component-id="${componentId}"]`);
        if (compElement) {
            const treeNode = compElement.closest('.tree-node');
            if (treeNode) treeNode.remove();
        }

        this.updateComponentsCount();

        // Remove components section if empty
        if (getComponentCount() === 0) {
            const componentsSection = this.container.querySelector('[data-group="components"]');
            if (componentsSection) {
                const sectionNode = componentsSection.closest('.tree-node');
                if (sectionNode) sectionNode.remove();
            }
        }
    }

    updateComponentChildren(componentId) {
        const component = graph.getComponent(componentId);
        if (component) {
            this.updateComponentInTree(component);
        }
    }

    handleNodeBinding(data) {
        const { nodeId, componentId } = data;
        const node = graph.getNode(nodeId);
        if (node) {
            this.updateNodeInTree(node);
        }
        this.updateComponentChildren(componentId);
    }

    // ============================================
    // Count Updates
    // ============================================

    updatePathsCount() {
        const pathsHeader = this.container?.querySelector('[data-group="paths"] .tree-label');
        if (pathsHeader) {
            pathsHeader.textContent = `Paths (${getPathCount()})`;
        }
    }

    updateComponentsCount() {
        const componentsHeader = this.container?.querySelector('[data-group="components"] .tree-label');
        if (componentsHeader) {
            componentsHeader.textContent = `Components (${getComponentCount()})`;
        }
    }

    // ============================================
    // Event Listeners
    // ============================================

    attachEventListeners() {
        // Toggle groups
        this.container.querySelectorAll('.tree-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = toggle.closest('.tree-item');
                const groupId = item.dataset.group ||
                    (item.dataset.componentId ? `comp_${item.dataset.componentId}` : null);

                if (groupId) {
                    if (this.expandedGroups.has(groupId)) {
                        this.expandedGroups.delete(groupId);
                    } else {
                        this.expandedGroups.add(groupId);
                    }
                    this.render();
                }
            });
        });

        // Select nodes
        this.container.querySelectorAll('.tree-item[data-node-id]').forEach(item => {
            this.attachNodeEventListener(item, item.dataset.nodeId);
        });

        // Select components
        this.container.querySelectorAll('.tree-item[data-component-id]').forEach(item => {
            const compId = item.dataset.componentId;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                selection.selectComponent(compId);
                import('../editor/canvas.js').then(({ canvas }) => {
                    canvas.centerOnComponent(compId);
                });
            });
        });

        // Select edges
        this.container.querySelectorAll('.tree-item[data-edge-id]').forEach(item => {
            this.attachEdgeEventListener(item, item.dataset.edgeId);
        });
    }

    attachEdgeEventListener(element, edgeId) {
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            selection.selectEdge(edgeId);
            // Optionally center on edge midpoint if needed
        });
    }

    attachNodeEventListener(element, nodeId) {
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            selection.selectNode(nodeId);
            import('../editor/canvas.js').then(({ canvas }) => {
                canvas.centerOnNode(nodeId);
            });
        });
    }

    attachComponentEventListeners(element) {
        const toggle = element.querySelector('.tree-toggle');
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = toggle.closest('.tree-item');
                const compId = item?.dataset.componentId;
                if (compId) {
                    const groupId = `comp_${compId}`;
                    if (this.expandedGroups.has(groupId)) {
                        this.expandedGroups.delete(groupId);
                    } else {
                        this.expandedGroups.add(groupId);
                    }
                    this.render();
                }
            });
        }

        const compItem = element.querySelector('[data-component-id]');
        if (compItem) {
            const compId = compItem.dataset.componentId;
            compItem.addEventListener('click', (e) => {
                e.stopPropagation();
                selection.selectComponent(compId);
                import('../editor/canvas.js').then(({ canvas }) => {
                    canvas.centerOnComponent(compId);
                });
            });
        }

        element.querySelectorAll('[data-node-id]').forEach(nodeItem => {
            this.attachNodeEventListener(nodeItem, nodeItem.dataset.nodeId);
        });

        element.querySelectorAll('.tree-node').forEach(nestedNode => {
            if (nestedNode !== element) {
                this.attachComponentEventListeners(nestedNode);
            }
        });
    }

    // ============================================
    // Selection State
    // ============================================

    updateSelectionState() {
        this.container?.querySelectorAll('.tree-item.selected').forEach(item => {
            item.classList.remove('selected');
        });

        let firstSelectedItem = null;

        selection.selectedNodes.forEach(nodeId => {
            const node = graph.getNode(nodeId);
            if (!node) return;

            // Expand parents to reveal node
            this.revealNodeInTree(nodeId);

            const item = this.container?.querySelector(`[data-node-id="${nodeId}"]`);
            if (item) {
                item.classList.add('selected');
                if (!firstSelectedItem) firstSelectedItem = item;
            }
        });

        selection.selectedEdges.forEach(edgeId => {
            const item = this.container?.querySelector(`[data-edge-id="${edgeId}"]`);
            if (item) {
                item.classList.add('selected');
                if (!firstSelectedItem) firstSelectedItem = item;
            }
        });

        selection.selectedComponents.forEach(compId => {
            // Expand parent components
            this.revealComponentInTree(compId);

            const item = this.container?.querySelector(`[data-component-id="${compId}"]`);
            if (item) {
                item.classList.add('selected');
                if (!firstSelectedItem) firstSelectedItem = item;
            }
        });

        // Scroll into view
        if (firstSelectedItem) {
            firstSelectedItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }

    revealNodeInTree(nodeId) {
        if (!this.expandedGroups.has('paths')) {
            this.expandedGroups.add('paths');
            this.render();
        }
    }

    revealComponentInTree(compId) {
        if (!this.expandedGroups.has('components')) {
            this.expandedGroups.add('components');
        }

        let current = graph.getComponent(compId);
        let changed = false;
        while (current) {
            const groupId = `comp_${current.id}`;
            if (!this.expandedGroups.has(groupId)) {
                this.expandedGroups.add(groupId);
                changed = true;
            }
            current = current.parentComponent ? graph.getComponent(current.parentComponent) : null;
        }

        if (changed) this.render();
    }
}

export const hierarchyPanel = new HierarchyPanel();
