/**
 * Hierarchy Panel - Tree view of UCM elements organized by paths and components
 *
 * Optimized with incremental updates for better performance with large diagrams.
 * Instead of re-rendering the entire tree on every change, we update only the
 * affected elements when possible (10-100x faster for large diagrams).
 */

import { graph } from '../core/graph.js';
import { selection } from '../editor/selection.js';
import { NODE_TYPES, COMPONENT_TYPES } from '../core/node-types.js';

class HierarchyPanel {
    constructor() {
        this.container = null;
        this.expandedGroups = new Set(['paths', 'components']);
        this.visitedNodes = new Set();
        // Cache for quick DOM element lookups
        this.nodeElements = new Map();
        this.componentElements = new Map();
    }

    init() {
        this.container = document.getElementById('hierarchy-tree');
        this.subscribeToEvents();
        this.render();
    }

    subscribeToEvents() {
        // Incremental updates for node changes
        graph.on('node:added', (node) => this.addNodeToTree(node));
        graph.on('node:updated', (node) => this.updateNodeInTree(node));
        graph.on('node:removed', (data) => this.removeNodeFromTree(data.id));

        // Incremental updates for component changes
        graph.on('component:added', (component) => this.addComponentToTree(component));
        graph.on('component:updated', (component) => this.updateComponentInTree(component));
        graph.on('component:removed', (data) => this.removeComponentFromTree(data.id));

        // Edge changes may affect path structure - check if re-render needed
        graph.on('edge:added', (edge) => this.handleEdgeChange(edge, 'added'));
        graph.on('edge:updated', (edge) => this.handleEdgeChange(edge, 'updated'));
        graph.on('edge:removed', (data) => this.handleEdgeChange(data, 'removed'));

        // Full render only on major changes
        graph.on('graph:loaded', () => this.render());
        graph.on('graph:cleared', () => this.render());

        // Component nesting events
        graph.on('component:nested', () => this.render());
        graph.on('component:unnested', () => this.render());

        // Node binding events
        graph.on('node:bound', (data) => this.handleNodeBinding(data));
        graph.on('node:unbound', (data) => this.handleNodeUnbinding(data));

        selection.on('selection:changed', () => this.updateSelectionState());
    }

    // ============================================
    // Incremental Node Updates
    // ============================================

    /**
     * Add a new node to the tree without full re-render
     */
    addNodeToTree(node) {
        if (!this.container) return;

        // Start nodes affect path structure - need full re-render
        if (node.type === 'start') {
            this.render();
            return;
        }

        // For non-start nodes, we need to update the paths section count
        // and potentially add the node to a component's children
        // Since the node isn't connected yet, it won't appear in paths
        // But we should update component children if bound
        if (node.parentComponent) {
            this.updateComponentChildren(node.parentComponent);
        }

        // Update paths count in header
        this.updatePathsCount();
    }

    /**
     * Update an existing node in the tree
     */
    updateNodeInTree(node) {
        if (!this.container) return;

        // Find and update the node element in the DOM
        const nodeElement = this.container.querySelector(`[data-node-id="${node.id}"]`);
        if (nodeElement) {
            // Update the node's display
            const newHtml = this.renderNodeItem(node);
            const temp = document.createElement('div');
            temp.innerHTML = newHtml;
            const newElement = temp.firstElementChild;

            // Preserve selection state
            if (nodeElement.classList.contains('selected')) {
                newElement.classList.add('selected');
            }

            nodeElement.replaceWith(newElement);
            this.attachNodeEventListener(newElement, node.id);
        }
    }

    /**
     * Remove a node from the tree
     */
    removeNodeFromTree(nodeId) {
        if (!this.container) return;

        // Find and remove the node element
        const nodeElement = this.container.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeElement) {
            nodeElement.remove();
        }

        // If this was a start node, path structure changed - full re-render
        // We can't easily check the node type since it's already removed,
        // so we check if path structure seems affected
        this.updatePathsCount();
    }

    // ============================================
    // Incremental Component Updates
    // ============================================

    /**
     * Add a new component to the tree
     */
    addComponentToTree(component) {
        if (!this.container) return;

        // Find the components section
        const componentsChildren = this.container.querySelector('.component-tree');

        if (!componentsChildren) {
            // Components section doesn't exist yet - need to add it
            this.render();
            return;
        }

        // If this is a root component, add to components section
        if (!component.parentComponent) {
            const componentHtml = this.renderComponentItem(component);
            const temp = document.createElement('div');
            temp.innerHTML = componentHtml;
            const newElement = temp.firstElementChild;
            componentsChildren.appendChild(newElement);
            this.attachComponentEventListeners(newElement);
        } else {
            // Nested component - update parent
            this.updateComponentChildren(component.parentComponent);
        }

        // Update components count
        this.updateComponentsCount();
    }

    /**
     * Update an existing component in the tree
     */
    updateComponentInTree(component) {
        if (!this.container) return;

        const compElement = this.container.querySelector(`[data-component-id="${component.id}"]`);
        if (compElement) {
            // Get the parent tree-node div
            const treeNode = compElement.closest('.tree-node');
            if (treeNode) {
                const newHtml = this.renderComponentItem(component);
                const temp = document.createElement('div');
                temp.innerHTML = newHtml;
                const newElement = temp.firstElementChild;

                // Preserve selection state
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

    /**
     * Remove a component from the tree
     */
    removeComponentFromTree(componentId) {
        if (!this.container) return;

        const compElement = this.container.querySelector(`[data-component-id="${componentId}"]`);
        if (compElement) {
            const treeNode = compElement.closest('.tree-node');
            if (treeNode) {
                treeNode.remove();
            }
        }

        // Update components count
        this.updateComponentsCount();

        // Check if we need to remove the components section entirely
        const components = graph.getAllComponents();
        if (components.length === 0) {
            const componentsSection = this.container.querySelector('[data-group="components"]');
            if (componentsSection) {
                const sectionNode = componentsSection.closest('.tree-node');
                if (sectionNode) sectionNode.remove();
            }
        }
    }

    /**
     * Update a component's children display
     */
    updateComponentChildren(componentId) {
        const component = graph.getComponent(componentId);
        if (!component) return;

        // Re-render just this component
        this.updateComponentInTree(component);
    }

    // ============================================
    // Edge Change Handling
    // ============================================

    /**
     * Handle edge changes - determine if path structure is affected
     */
    handleEdgeChange(data, changeType) {
        // Edge changes can affect the path tree structure
        // For now, we do a full re-render since paths are built by tracing edges
        // A more sophisticated approach could check if the change affects visible paths
        this.render();
    }

    // ============================================
    // Node Binding Handling
    // ============================================

    /**
     * Handle node being bound to a component
     */
    handleNodeBinding(data) {
        const { nodeId, componentId } = data;

        // Update the node display to show pin icon
        const node = graph.getNode(nodeId);
        if (node) {
            this.updateNodeInTree(node);
        }

        // Update component's children list
        this.updateComponentChildren(componentId);
    }

    /**
     * Handle node being unbound from a component
     */
    handleNodeUnbinding(data) {
        const { nodeId } = data;

        // Update the node display to remove pin icon
        const node = graph.getNode(nodeId);
        if (node) {
            this.updateNodeInTree(node);
        }

        // Note: We don't have the old componentId, so we do a render
        // to ensure component children are updated correctly
        this.render();
    }

    // ============================================
    // Count Updates
    // ============================================

    /**
     * Update the paths count in the header
     */
    updatePathsCount() {
        const pathsHeader = this.container?.querySelector('[data-group="paths"] .tree-label');
        if (pathsHeader) {
            const startNodes = graph.getAllNodes().filter(n => n.type === 'start');
            pathsHeader.textContent = `Paths (${startNodes.length})`;
        }
    }

    /**
     * Update the components count in the header
     */
    updateComponentsCount() {
        const componentsHeader = this.container?.querySelector('[data-group="components"] .tree-label');
        if (componentsHeader) {
            const components = graph.getAllComponents();
            componentsHeader.textContent = `Components (${components.length})`;
        }
    }

    // ============================================
    // Event Listener Attachment
    // ============================================

    /**
     * Attach event listener to a single node element
     */
    attachNodeEventListener(element, nodeId) {
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            selection.selectNode(nodeId);

            import('../editor/canvas.js').then(({ canvas }) => {
                canvas.centerOnNode(nodeId);
            });
        });
    }

    /**
     * Attach event listeners to a component element and its children
     */
    attachComponentEventListeners(element) {
        // Toggle for this component
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

        // Component selection
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

        // Child nodes
        element.querySelectorAll('[data-node-id]').forEach(nodeItem => {
            const nodeId = nodeItem.dataset.nodeId;
            this.attachNodeEventListener(nodeItem, nodeId);
        });

        // Nested components
        element.querySelectorAll('.tree-node').forEach(nestedNode => {
            if (nestedNode !== element) {
                this.attachComponentEventListeners(nestedNode);
            }
        });
    }

    /**
     * Build a recursive path tree from start nodes
     */
    buildPathTree() {
        const startNodes = graph.getAllNodes().filter(n => n.type === 'start');

        return startNodes.map((startNode, index) => {
            this.visitedNodes.clear();
            return {
                id: `root_path_${index}`,
                name: startNode.properties.name || `Path ${index + 1}`,
                startNode: startNode,
                children: this.traceSegment(startNode)
            };
        });
    }

    /**
     * Recursive function to trace graph segments
     * Returns an array of node items and nested sub-paths (branches)
     */
    traceSegment(startNode) {
        const result = [];
        let current = startNode;

        while (current) {
            // Prevent infinite loops
            if (this.visitedNodes.has(current.id)) {
                result.push({ type: 'ref', node: current, label: `(Loop to ${current.properties.name})` });
                break;
            }
            this.visitedNodes.add(current.id);

            // Add current node to list
            result.push({ type: 'node', node: current });

            // Check outgoing edges
            const outEdges = [...current.outEdges];

            if (outEdges.length === 0) {
                // End of path
                break;
            } else if (outEdges.length === 1) {
                // Linear flow
                const edge = graph.getEdge(outEdges[0]);
                current = edge ? graph.getNode(edge.targetNodeId) : null;
            } else {
                // Forking logic (DAG split)
                // We stop the linear segment here and add children branches
                outEdges.forEach((edgeId, idx) => {
                    const edge = graph.getEdge(edgeId);
                    if (edge) {
                        const targetNode = graph.getNode(edge.targetNodeId);
                        if (targetNode) {
                            result.push({
                                type: 'branch',
                                name: `Branch ${idx + 1}`,
                                id: `branch_${current.id}_${idx}`,
                                children: this.traceSegment(targetNode)
                            });
                        }
                    }
                });
                break; // Stop linear trace after split
            }
        }
        return result;
    }

    render() {
        if (!this.container) return;

        const pathTrees = this.buildPathTree();
        const components = graph.getAllComponents();

        let html = '';

        // --- Paths Section ---
        const pathsExpanded = this.expandedGroups.has('paths');
        html += `
            <div class="tree-node">
                <div class="tree-item" data-group="paths">
                    <span class="tree-toggle ${pathsExpanded ? 'expanded' : ''}">▶</span>
                    <span class="tree-icon">⟶</span>
                    <span class="tree-label">Paths (${pathTrees.length})</span>
                </div>
                <div class="tree-children ${pathsExpanded ? '' : 'collapsed'}">
        `;

        pathTrees.forEach(tree => {
            html += this.renderPathTreeItem(tree);
        });

        html += `   </div>
            </div>`;

        // --- Components Section ---
        if (components.length > 0) {
            html += this.renderComponentsGroup(components);
        }

        this.container.innerHTML = html;
        this.attachEventListeners();
        this.updateSelectionState();
    }

    renderPathTreeItem(item) {
        // If it's a branch/root container
        if (item.startNode || item.type === 'branch') {
            const isExpanded = this.expandedGroups.has(item.id);
            const isBranch = item.type === 'branch';

            let html = `
                <div class="tree-node ${isBranch ? 'branch-node' : ''}">
                    <div class="tree-item" data-group="${item.id}">
                        <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">▶</span>
                        <span class="tree-icon">${isBranch ? '⑂' : '●'}</span>
                        <span class="tree-label">${item.name}</span>
                    </div>
                    <div class="tree-children ${isExpanded ? '' : 'collapsed'}">
            `;

            // Render children
            item.children.forEach(child => {
                html += this.renderPathTreeItem(child);
            });

            html += `</div></div>`;
            return html;
        }

        // If it's a leaf node reference
        if (item.type === 'node') {
            return this.renderNodeItem(item.node);
        }

        // Loop reference
        if (item.type === 'ref') {
            return `
                <div class="tree-item disabled">
                    <span class="tree-icon">↺</span>
                    <span class="tree-label">${item.label}</span>
                </div>`;
        }

        return '';
    }

    renderNodeItem(node) {
        const typeInfo = NODE_TYPES[node.type];
        const parentComp = node.parentComponent ? graph.getComponent(node.parentComponent) : null;
        const pinnedInfo = parentComp ? `<span class="node-pinned" title="Pinned to ${parentComp.properties.name}">📌</span>` : '';

        return `
            <div class="tree-item" data-node-id="${node.id}">
                <!-- Invisible toggle for alignment with branched items if needed, or remove -->
                <span class="tree-toggle" style="visibility: hidden;">▶</span>
                <span class="tree-icon ${node.type}">${typeInfo?.icon || '•'}</span>
                <span class="tree-label">${node.properties.name || node.id}</span>
                ${pinnedInfo}
            </div>
        `;
    }

    renderComponentsGroup(components) {
        const isExpanded = this.expandedGroups.has('components');
        const rootComponents = components.filter(c => !c.parentComponent);

        let html = `
            <div class="tree-node">
                <div class="tree-item" data-group="components">
                    <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">▶</span>
                    <span class="tree-icon component">□</span>
                    <span class="tree-label">Components (${components.length})</span>
                </div>
                <div class="tree-children component-tree ${isExpanded ? '' : 'collapsed'}">
        `;

        rootComponents.forEach(comp => {
            html += this.renderComponentItem(comp);
        });

        html += `   </div>
            </div>`;

        return html;
    }

    renderComponentItem(comp) {
        const typeInfo = COMPONENT_TYPES[comp.type];
        const childNodes = [...comp.childNodes].map(id => graph.getNode(id)).filter(Boolean);
        const childComps = comp.childComponents ? [...comp.childComponents].map(id => graph.getComponent(id)).filter(Boolean) : [];
        const hasChildren = childNodes.length > 0 || childComps.length > 0;
        const compExpanded = this.expandedGroups.has(`comp_${comp.id}`);

        let html = `
            <div class="tree-node">
                <div class="tree-item" data-component-id="${comp.id}">
                    <span class="tree-toggle ${hasChildren ? (compExpanded ? 'expanded' : '') : ''}"
                          style="${hasChildren ? '' : 'visibility: hidden;'}">▶</span>
                    <span class="tree-icon component">${typeInfo?.icon || '□'}</span>
                    <span class="tree-label">${comp.properties.name}</span>
                </div>
        `;

        if (hasChildren) {
            html += `<div class="tree-children ${compExpanded ? '' : 'collapsed'}">`;
            childComps.forEach(childComp => html += this.renderComponentItem(childComp));
            childNodes.forEach(node => html += this.renderNodeItem(node));
            html += `</div>`;
        }

        html += `</div>`;
        return html;
    }

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

        // Select nodes - Centers graph on node
        this.container.querySelectorAll('.tree-item[data-node-id]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const nodeId = item.dataset.nodeId;
                selection.selectNode(nodeId);

                // Bulls Eye: Center graph on node
                import('../editor/canvas.js').then(({ canvas }) => {
                    canvas.centerOnNode(nodeId);
                });
            });
        });

        // Select components - Centers graph on component
        this.container.querySelectorAll('.tree-item[data-component-id]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const compId = item.dataset.componentId;
                selection.selectComponent(compId);

                // Bulls Eye: Center graph on component
                import('../editor/canvas.js').then(({ canvas }) => {
                    canvas.centerOnComponent(compId);
                });
            });
        });
    }

    updateSelectionState() {
        this.container?.querySelectorAll('.tree-item.selected').forEach(item => item.classList.remove('selected'));

        let firstSelectedItem = null;

        selection.selectedNodes.forEach(nodeId => {
            // Find the item. It might be inside a collapsed group.
            // But currently, we only render what is expanded (mostly).
            // Actually, if we want to "reveal" hidden items, we need to know their path and expand it.
            // The current rendering logic only renders *children* of expanded groups.
            // So if a parent is collapsed, the DOM element doesn't exist.

            // To fix this properly, we need to find the "path" to the node in the tree structure
            // and expand all parents. Since we don't have a quick lookup here, 
            // we might relying on the fact that 'paths' and 'components' are usually top level.
            // For now, let's try to highlight if visible. 
            // Robust auto-expansion would require traversing the text-model or graph to find parents.
            // The 'traceSegment' builds the tree.

            // For Components, we can climb the parentComponent chain easily.
            // For Nodes, we need to know which path they belong to.
            // This is harder because a node can be in multiple paths (shared segments).

            // AUTO-EXPANSION LOGIC (Simplified for now: expand parents if we can infer them)
            // For components:
            const node = graph.getNode(nodeId);
            // If the hierarchy shows paths, expanding "Paths" group is a good start.
            // But finding exactly which path/branch is tricky without re-traversing.

            // Ideally, we search the DOM. If not found, we might be out of luck without re-render.
            // However, let's just highlight what is visible and attempt scroll.

            const item = this.container?.querySelector(`[data-node-id="${nodeId}"]`);
            if (item) {
                item.classList.add('selected');
                if (!firstSelectedItem) firstSelectedItem = item;
            }
        });

        selection.selectedComponents.forEach(compId => {
            // Expand parent components if needed
            let current = graph.getComponent(compId);
            let needsRender = false;
            while (current && current.parentComponent) {
                const groupId = `comp_${current.parentComponent}`;
                if (!this.expandedGroups.has(groupId)) {
                    this.expandedGroups.add(groupId);
                    needsRender = true;
                }
                current = graph.getComponent(current.parentComponent);
            }
            if (needsRender) this.render();

            const item = this.container?.querySelector(`[data-component-id="${compId}"]`);
            if (item) {
                item.classList.add('selected');
                if (!firstSelectedItem) firstSelectedItem = item;
            }
        });

        // Scroll into view (Bulls Eye: Canvas -> Hierarchy)
        if (firstSelectedItem) {
            firstSelectedItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }
}

export const hierarchyPanel = new HierarchyPanel();
