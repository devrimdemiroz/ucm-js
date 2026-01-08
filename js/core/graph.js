/**
 * UCM Graph - Core Graph Data Structure
 * Manages nodes and edges with CRUD operations and event emission
 */

import { tracing } from './tracing.js';
import { notifications } from '../ui/notifications.js';

export class UCMGraph {
    constructor() {
        this.nodes = new Map();
        this.edges = new Map();
        this.components = new Map();
        this.listeners = new Map();
        this.idCounter = 0;
    }

    // ============================================
    // ID Generation
    // ============================================

    generateId(prefix = 'node') {
        return `${prefix}_${++this.idCounter}`;
    }

    // ============================================
    // Event System
    // ============================================

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }

    // ============================================
    // Node Operations
    // ============================================

    addNode(type, data = {}) {
        const id = this.generateId('node');

        // Extract position from data
        let { x = 0, y = 0, ...properties } = data;

        // Safety check
        if (typeof x === 'object') x = 0;
        if (typeof y === 'object') y = 0;

        const node = {
            id,
            type,
            position: { x: Number(x), y: Number(y) },
            properties: {
                name: properties.name || this.getDefaultName(type),
                description: properties.description || '',
                ...properties
            },
            parentComponent: null,
            inEdges: new Set(),
            outEdges: new Set()
        };

        this.nodes.set(id, node);
        this.emit('node:added', node);

        // Trace node creation
        tracing.traceNodeCreation(type, id);

        return node;
    }

    getNode(id) {
        return this.nodes.get(id);
    }

    updateNode(id, updates) {
        const node = this.nodes.get(id);
        if (!node) return null;

        if (updates.position) {
            node.position = { ...node.position, ...updates.position };
        }
        if (updates.properties) {
            node.properties = { ...node.properties, ...updates.properties };
        }
        if (updates.type !== undefined) {
            node.type = updates.type;
        }
        if (updates.parentComponent !== undefined) {
            node.parentComponent = updates.parentComponent;
        }

        this.emit('node:updated', node);
        return node;
    }

    removeNode(id) {
        const node = this.nodes.get(id);
        if (!node) return false;

        // Path Healing: If node has exactly one in-edge and one out-edge, connect them
        // Using .size because inEdges and outEdges are Sets
        if (node.inEdges.size === 1 && node.outEdges.size === 1) {
            const inEdgeId = [...node.inEdges][0];
            const outEdgeId = [...node.outEdges][0];
            const inEdge = this.edges.get(inEdgeId);
            const outEdge = this.edges.get(outEdgeId);

            if (inEdge && outEdge) {
                const sourceId = inEdge.sourceNodeId;
                const targetId = outEdge.targetNodeId;

                // Merge control points (waypoints) if any
                const controlPoints = [
                    ...(inEdge.controlPoints || []),
                    { x: node.position.x, y: node.position.y }, // Keep deleted node's position as a waypoint
                    ...(outEdge.controlPoints || [])
                ];

                this.addEdge(sourceId, targetId, { controlPoints });
            }
        }

        // Remove connected edges
        [...node.inEdges, ...node.outEdges].forEach(edgeId => {
            this.removeEdge(edgeId);
        });

        this.nodes.delete(id);
        this.emit('node:removed', { id });
        return true;
    }

    moveNode(id, x, y) {
        return this.updateNode(id, { position: { x, y } });
    }

    getDefaultName(type) {
        const count = [...this.nodes.values()].filter(n => n.type === type).length;
        const typeNames = {
            start: 'Start',
            end: 'End',
            responsibility: 'Responsibility',
            empty: 'Point',
            fork: 'Fork',
            join: 'Join'
        };
        return `${typeNames[type] || 'Node'}${count + 1}`;
    }

    // ============================================
    // Edge Operations
    // ============================================

    addEdge(sourceId, targetId, properties = {}) {
        const sourceNode = this.nodes.get(sourceId);
        const targetNode = this.nodes.get(targetId);

        if (!sourceNode || !targetNode) return null;

        // UCM constraint: Start nodes can only have ONE outgoing edge
        if (sourceNode.type === 'start' && sourceNode.outEdges.size > 0) {
            notifications.warning('Start nodes can only have one outgoing path. Use a Fork for branching.');
            return null;
        }

        // UCM constraint: End nodes cannot have outgoing edges
        if (sourceNode.type === 'end') {
            notifications.warning('End nodes cannot have outgoing edges.');
            return null;
        }

        // UCM constraint: Start nodes cannot have incoming edges
        if (targetNode.type === 'start') {
            notifications.warning('Start nodes cannot have incoming edges.');
            return null;
        }

        const id = this.generateId('edge');
        const edge = {
            id,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            controlPoints: properties.controlPoints || [],
            condition: properties.condition || null,
            properties: {
                ...properties
            }
        };

        this.edges.set(id, edge);
        sourceNode.outEdges.add(id);
        targetNode.inEdges.add(id);

        this.emit('edge:added', edge);

        // Trace edge creation
        tracing.traceEdgeCreation(sourceId, targetId, id);

        return edge;
    }

    getEdge(id) {
        return this.edges.get(id);
    }

    updateEdge(id, updates) {
        const edge = this.edges.get(id);
        if (!edge) return null;

        if (updates.controlPoints) {
            edge.controlPoints = updates.controlPoints;
        }
        if (updates.condition !== undefined) {
            edge.condition = updates.condition;
        }
        if (updates.properties) {
            edge.properties = { ...edge.properties, ...updates.properties };
        }

        this.emit('edge:updated', edge);
        return edge;
    }

    removeEdge(id) {
        const edge = this.edges.get(id);
        if (!edge) return false;

        const sourceNode = this.nodes.get(edge.sourceNodeId);
        const targetNode = this.nodes.get(edge.targetNodeId);

        if (sourceNode) sourceNode.outEdges.delete(id);
        if (targetNode) targetNode.inEdges.delete(id);

        this.edges.delete(id);
        this.emit('edge:removed', { id });
        return true;
    }

    getEdgesBetween(sourceId, targetId) {
        return [...this.edges.values()].filter(
            e => e.sourceNodeId === sourceId && e.targetNodeId === targetId
        );
    }

    // ============================================
    // Component Operations
    // ============================================

    addComponent(type, data = {}) {
        const id = this.generateId('comp');

        // Extract bounds from data, default to standard size if missing
        // Verify that x/y are numbers, not objects
        let { x = 0, y = 0, width = 200, height = 100, ...rest } = data;

        // Safety check to prevent [object Object] errors if bad data comes in
        if (typeof x === 'object') x = 0;
        if (typeof y === 'object') y = 0;

        const component = {
            id,
            type, // team, object, process, agent, actor
            bounds: {
                x: Number(x),
                y: Number(y),
                width: Number(width),
                height: Number(height)
            },
            properties: {
                name: rest.name || `Component${this.components.size + 1}`,
                description: rest.description || '',
                ...rest
            },
            parentComponent: null,  // For nested components
            childComponents: new Set(),  // Child components
            childNodes: new Set()
        };

        this.components.set(id, component);
        this.emit('component:added', component);

        // Trace component creation
        tracing.traceComponentCreation(type, id);

        return component;
    }

    getComponent(id) {
        return this.components.get(id);
    }

    updateComponent(id, updates) {
        const component = this.components.get(id);
        if (!component) return null;

        if (updates.bounds) {
            component.bounds = { ...component.bounds, ...updates.bounds };
        }
        if (updates.properties) {
            component.properties = { ...component.properties, ...updates.properties };
        }
        if (updates.type !== undefined) {
            component.type = updates.type;
        }

        this.emit('component:updated', component);
        return component;
    }

    moveComponent(id, x, y) {
        const component = this.components.get(id);
        if (!component) return null;

        const dx = x - component.bounds.x;
        const dy = y - component.bounds.y;

        // Update component position
        component.bounds.x = x;
        component.bounds.y = y;

        // Move all bound nodes
        component.childNodes.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node) {
                this.moveNode(nodeId, node.position.x + dx, node.position.y + dy);
            }
        });

        // Move all child components recursively
        if (component.childComponents) {
            component.childComponents.forEach(childCompId => {
                const childComp = this.components.get(childCompId);
                if (childComp) {
                    this.moveComponent(childCompId, childComp.bounds.x + dx, childComp.bounds.y + dy);
                }
            });
        }

        this.emit('component:updated', component);
        return component;
    }

    removeComponent(id) {
        const component = this.components.get(id);
        if (!component) return false;

        // Unbind all nodes
        component.childNodes.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node) node.parentComponent = null;
        });

        // Unbind child components
        component.childComponents.forEach(childId => {
            const child = this.components.get(childId);
            if (child) child.parentComponent = null;
        });

        // Unbind from parent
        if (component.parentComponent) {
            const parent = this.components.get(component.parentComponent);
            if (parent) parent.childComponents.delete(id);
        }

        this.components.delete(id);
        this.emit('component:removed', { id });
        return true;
    }

    // Bind a component inside another component (nesting)
    bindComponentToComponent(childId, parentId) {
        const child = this.components.get(childId);
        const parent = this.components.get(parentId);

        if (!child || !parent || childId === parentId) return false;

        // Prevent circular nesting
        let ancestor = parent;
        while (ancestor) {
            if (ancestor.id === childId) return false;
            ancestor = ancestor.parentComponent ? this.components.get(ancestor.parentComponent) : null;
        }

        // Unbind from previous parent
        if (child.parentComponent) {
            const oldParent = this.components.get(child.parentComponent);
            if (oldParent) oldParent.childComponents.delete(childId);
        }

        child.parentComponent = parentId;
        parent.childComponents.add(childId);

        this.emit('component:nested', { childId, parentId });
        return true;
    }

    unbindComponentFromParent(childId) {
        const child = this.components.get(childId);
        if (!child || !child.parentComponent) return false;

        const parent = this.components.get(child.parentComponent);
        if (parent) parent.childComponents.delete(childId);

        child.parentComponent = null;
        this.emit('component:unnested', { childId });
        return true;
    }

    // Get root-level components (no parent)
    getRootComponents() {
        return [...this.components.values()].filter(c => !c.parentComponent);
    }

    // Get component hierarchy depth
    getComponentDepth(compId) {
        let depth = 0;
        let comp = this.components.get(compId);
        while (comp && comp.parentComponent) {
            depth++;
            comp = this.components.get(comp.parentComponent);
        }
        return depth;
    }

    bindNodeToComponent(nodeId, componentId) {
        const node = this.nodes.get(nodeId);
        const component = this.components.get(componentId);

        if (!node || !component) return false;

        // Unbind from previous component
        if (node.parentComponent) {
            const oldComponent = this.components.get(node.parentComponent);
            if (oldComponent) oldComponent.childNodes.delete(nodeId);
        }

        node.parentComponent = componentId;
        component.childNodes.add(nodeId);

        this.emit('node:bound', { nodeId, componentId });
        return true;
    }

    unbindNodeFromComponent(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node || !node.parentComponent) return false;

        const component = this.components.get(node.parentComponent);
        if (component) component.childNodes.delete(nodeId);

        node.parentComponent = null;
        this.emit('node:unbound', { nodeId });
        return true;
    }

    // ============================================
    // Query Methods
    // ============================================

    getAllNodes() {
        return [...this.nodes.values()];
    }

    getAllEdges() {
        return [...this.edges.values()];
    }

    getAllComponents() {
        return [...this.components.values()];
    }

    getNodesByType(type) {
        return [...this.nodes.values()].filter(n => n.type === type);
    }

    getConnectedNodes(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return { incoming: [], outgoing: [] };

        const incoming = [...node.inEdges].map(edgeId => {
            const edge = this.edges.get(edgeId);
            return edge ? this.nodes.get(edge.sourceNodeId) : null;
        }).filter(Boolean);

        const outgoing = [...node.outEdges].map(edgeId => {
            const edge = this.edges.get(edgeId);
            return edge ? this.nodes.get(edge.targetNodeId) : null;
        }).filter(Boolean);

        return { incoming, outgoing };
    }

    getBoundingBox(padding = 50) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        let hasContent = false;

        // Check node positions
        for (const node of this.nodes.values()) {
            hasContent = true;
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxX = Math.max(maxX, node.position.x);
            maxY = Math.max(maxY, node.position.y);
        }

        // Check component bounds
        for (const comp of this.components.values()) {
            hasContent = true;
            minX = Math.min(minX, comp.bounds.x);
            minY = Math.min(minY, comp.bounds.y);
            maxX = Math.max(maxX, comp.bounds.x + comp.bounds.width);
            maxY = Math.max(maxY, comp.bounds.y + comp.bounds.height);
        }

        // Check edge control points
        for (const edge of this.edges.values()) {
            if (edge.controlPoints) {
                for (const p of edge.controlPoints) {
                    hasContent = true;
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                }
            }
        }

        if (!hasContent) {
            return { x: 0, y: 0, width: 0, height: 0, center: { x: 0, y: 0 } };
        }

        // Add logical padding
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            center: {
                x: minX + (maxX - minX) / 2,
                y: minY + (maxY - minY) / 2
            }
        };
    }

    // ============================================
    // Serialization
    // ============================================

    toJSON() {
        return {
            nodes: [...this.nodes.values()].map(node => ({
                ...node,
                inEdges: [...node.inEdges],
                outEdges: [...node.outEdges]
            })),
            edges: [...this.edges.values()],
            components: [...this.components.values()].map(comp => ({
                ...comp,
                childNodes: [...comp.childNodes],
                childComponents: [...(comp.childComponents || [])]
            })),
            idCounter: this.idCounter
        };
    }

    fromJSON(data) {
        this.clear();

        this.idCounter = data.idCounter || 0;

        // Restore nodes
        data.nodes.forEach(nodeData => {
            const node = {
                ...nodeData,
                inEdges: new Set(nodeData.inEdges || []),
                outEdges: new Set(nodeData.outEdges || [])
            };
            this.nodes.set(node.id, node);
        });

        // Restore edges
        data.edges.forEach(edgeData => {
            this.edges.set(edgeData.id, { ...edgeData });
        });

        // Restore components
        (data.components || []).forEach(compData => {
            const comp = {
                ...compData,
                childNodes: new Set(compData.childNodes || []),
                childComponents: new Set(compData.childComponents || [])
            };
            this.components.set(comp.id, comp);
        });

        this.emit('graph:loaded', {});
    }

    clear() {
        this.nodes.clear();
        this.edges.clear();
        this.components.clear();
        this.idCounter = 0;
        this.emit('graph:cleared', {});
    }
}

// Singleton instance
export const graph = new UCMGraph();
