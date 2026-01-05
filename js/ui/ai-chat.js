/**
 * AI Chat - Smart command interpreter for graph operations
 * Understands spatial context: "between X and Y", "after X", "inside X", etc.
 */

import { graph } from '../core/graph.js';
import { canvas } from '../editor/canvas.js';

class AIChat {
    constructor() {
        this.input = null;
        this.sendBtn = null;
        this.responseEl = null;
    }

    init() {
        this.input = document.getElementById('ai-prompt');
        this.sendBtn = document.getElementById('btn-ai-send');
        this.responseEl = document.getElementById('ai-response');

        if (!this.input) return;

        this.sendBtn?.addEventListener('click', () => this.processCommand());
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.processCommand();
            }
        });
    }

    processCommand() {
        const cmd = this.input.value.trim();
        if (!cmd) return;

        this.input.value = '';

        try {
            const result = this.interpret(cmd);
            this.showResponse(result, 'success');
            canvas.renderAll();
        } catch (e) {
            this.showResponse(e.message, 'error');
        }
    }

    showResponse(msg, type = '') {
        if (this.responseEl) {
            this.responseEl.textContent = msg;
            this.responseEl.className = `ai-response ${type}`;
        }
    }

    // ============================================
    // Spatial Context Parsing
    // ============================================

    /**
     * Parse spatial context from command
     * Returns: { type: 'between'|'after'|'before'|'inside'|'above'|'below'|'left'|'right', refs: [...] }
     */
    parseSpatialContext(cmd) {
        const cmdLower = cmd.toLowerCase();

        // "between X and Y"
        let match = cmdLower.match(/between\s+["']?([^"']+?)["']?\s+and\s+["']?([^"']+?)["']?(?:\s|$|,|\.)/i);
        if (match) {
            return { type: 'between', refs: [match[1].trim(), match[2].trim()] };
        }

        // "after X" or "right of X"
        match = cmdLower.match(/(?:after|right\s+of|to\s+the\s+right\s+of)\s+["']?([^"']+?)["']?(?:\s|$|,|\.)/i);
        if (match) {
            return { type: 'after', refs: [match[1].trim()] };
        }

        // "before X" or "left of X"
        match = cmdLower.match(/(?:before|left\s+of|to\s+the\s+left\s+of)\s+["']?([^"']+?)["']?(?:\s|$|,|\.)/i);
        if (match) {
            return { type: 'before', refs: [match[1].trim()] };
        }

        // "inside X" or "in X" or "within X"
        match = cmdLower.match(/(?:inside|in|within)\s+["']?([^"']+?)["']?(?:\s|$|,|\.)/i);
        if (match) {
            return { type: 'inside', refs: [match[1].trim()] };
        }

        // "above X" or "on top of X"
        match = cmdLower.match(/(?:above|on\s+top\s+of|over)\s+["']?([^"']+?)["']?(?:\s|$|,|\.)/i);
        if (match) {
            return { type: 'above', refs: [match[1].trim()] };
        }

        // "below X" or "under X"
        match = cmdLower.match(/(?:below|under|beneath)\s+["']?([^"']+?)["']?(?:\s|$|,|\.)/i);
        if (match) {
            return { type: 'below', refs: [match[1].trim()] };
        }

        // "next to X"
        match = cmdLower.match(/(?:next\s+to|beside|near)\s+["']?([^"']+?)["']?(?:\s|$|,|\.)/i);
        if (match) {
            return { type: 'nextto', refs: [match[1].trim()] };
        }

        return null;
    }

    /**
     * Find element by name (node or component)
     */
    findElementByName(name) {
        // Try components first
        const comp = this.findComponentByName(name);
        if (comp) return { type: 'component', element: comp };

        // Try nodes
        const node = this.findNodeByName(name);
        if (node) return { type: 'node', element: node };

        return null;
    }

    /**
     * Get position/bounds of an element
     */
    getElementBounds(el) {
        if (!el) return null;

        if (el.type === 'component') {
            return el.element.bounds;
        } else if (el.type === 'node') {
            const pos = el.element.position;
            return { x: pos.x, y: pos.y, width: 0, height: 0 };
        }
        return null;
    }

    /**
     * Calculate position based on spatial context
     */
    calculatePosition(spatialCtx, defaultPos = { x: 200, y: 200 }) {
        if (!spatialCtx) return defaultPos;

        const refs = spatialCtx.refs.map(name => this.findElementByName(name));
        const bounds = refs.map(r => this.getElementBounds(r));

        // Filter out nulls
        const validBounds = bounds.filter(Boolean);
        if (validBounds.length === 0) return defaultPos;

        const padding = 30;

        switch (spatialCtx.type) {
            case 'between': {
                if (validBounds.length >= 2) {
                    const b1 = validBounds[0];
                    const b2 = validBounds[1];
                    return {
                        x: (b1.x + b1.width / 2 + b2.x + b2.width / 2) / 2,
                        y: (b1.y + b1.height / 2 + b2.y + b2.height / 2) / 2
                    };
                }
                break;
            }
            case 'after': {
                const b = validBounds[0];
                return {
                    x: b.x + b.width + padding,
                    y: b.y + (b.height / 2)
                };
            }
            case 'before': {
                const b = validBounds[0];
                return {
                    x: b.x - padding - 200, // account for component width
                    y: b.y + (b.height / 2)
                };
            }
            case 'inside': {
                const b = validBounds[0];
                return {
                    x: b.x + b.width / 2,
                    y: b.y + b.height / 2
                };
            }
            case 'above': {
                const b = validBounds[0];
                return {
                    x: b.x + b.width / 2,
                    y: b.y - padding - 100
                };
            }
            case 'below': {
                const b = validBounds[0];
                return {
                    x: b.x + b.width / 2,
                    y: b.y + b.height + padding
                };
            }
            case 'nextto': {
                const b = validBounds[0];
                return {
                    x: b.x + b.width + padding,
                    y: b.y
                };
            }
        }

        return defaultPos;
    }

    /**
     * Calculate component bounds based on spatial context
     */
    calculateComponentBounds(spatialCtx, name) {
        const defaultBounds = { x: 100, y: 100, width: 200, height: 150 };

        if (!spatialCtx) return defaultBounds;

        const refs = spatialCtx.refs.map(name => this.findElementByName(name));
        const validRefs = refs.filter(Boolean);
        const bounds = validRefs.map(r => this.getElementBounds(r)).filter(Boolean);

        if (bounds.length === 0) return defaultBounds;

        const padding = 30;

        switch (spatialCtx.type) {
            case 'between': {
                if (bounds.length >= 2) {
                    const b1 = bounds[0];
                    const b2 = bounds[1];

                    // Find the gap between the two components
                    const leftComp = b1.x < b2.x ? b1 : b2;
                    const rightComp = b1.x < b2.x ? b2 : b1;

                    const gapX = rightComp.x - (leftComp.x + leftComp.width);
                    const avgY = (b1.y + b2.y) / 2;
                    const maxHeight = Math.max(b1.height || 150, b2.height || 150);

                    if (gapX > 50) {
                        // Fit in the gap
                        return {
                            x: leftComp.x + leftComp.width + padding,
                            y: avgY,
                            width: Math.max(100, gapX - padding * 2),
                            height: maxHeight
                        };
                    } else {
                        // Place in the middle horizontally, same height
                        return {
                            x: (b1.x + b1.width / 2 + b2.x + b2.width / 2) / 2 - 100,
                            y: avgY,
                            width: 200,
                            height: maxHeight
                        };
                    }
                }
                break;
            }
            case 'after':
            case 'nextto': {
                const b = bounds[0];
                return {
                    x: b.x + b.width + padding,
                    y: b.y,
                    width: 200,
                    height: b.height || 150
                };
            }
            case 'before': {
                const b = bounds[0];
                return {
                    x: b.x - 200 - padding,
                    y: b.y,
                    width: 200,
                    height: b.height || 150
                };
            }
            case 'inside': {
                const b = bounds[0];
                // Create a smaller component inside
                return {
                    x: b.x + padding,
                    y: b.y + 30, // below header
                    width: b.width - padding * 2,
                    height: b.height - 50
                };
            }
            case 'above': {
                const b = bounds[0];
                return {
                    x: b.x,
                    y: b.y - 150 - padding,
                    width: b.width || 200,
                    height: 150
                };
            }
            case 'below': {
                const b = bounds[0];
                return {
                    x: b.x,
                    y: b.y + b.height + padding,
                    width: b.width || 200,
                    height: 150
                };
            }
        }

        return defaultBounds;
    }

    // ============================================
    // Extract element name from command
    // ============================================

    extractName(cmd, keywords) {
        // Remove spatial context phrases to find the actual name
        let cleaned = cmd;

        // Remove common phrases
        const removePatterns = [
            /between\s+["']?[^"']+?["']?\s+and\s+["']?[^"']+?["']?/gi,
            /(?:after|before|inside|in|within|above|below|under|next\s+to|beside|near|left\s+of|right\s+of)\s+["']?[^"']+?["']?/gi,
            /(?:add|create|new|place|put)\s+/gi,
            /(?:component|responsibility|resp|start|end|node|path)\s*/gi,
            /called\s+/gi,
            /named\s+/gi,
        ];

        for (const pattern of removePatterns) {
            cleaned = cleaned.replace(pattern, ' ');
        }

        // Clean up and get remaining text as name
        cleaned = cleaned.replace(/["']/g, '').trim();

        // If we have something left, use it as name
        if (cleaned && cleaned.length > 0 && cleaned.length < 50) {
            return cleaned.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
        }

        return null;
    }

    // ============================================
    // Main Interpreter
    // ============================================

    interpret(cmd) {
        const cmdLower = cmd.toLowerCase();

        // Parse spatial context first
        const spatialCtx = this.parseSpatialContext(cmd);

        // Add component with spatial awareness
        if (cmdLower.match(/(?:add|create|new|place|put)\s+(?:a\s+)?component/i)) {
            const bounds = this.calculateComponentBounds(spatialCtx);

            // Extract name - look for quoted name or word after component
            let name = null;
            let match = cmd.match(/component\s+(?:called\s+|named\s+)?["']([^"']+)["']/i);
            if (match) {
                name = match[1];
            } else {
                match = cmd.match(/component\s+(?:called\s+|named\s+)?(\w+)/i);
                if (match && !['between', 'after', 'before', 'inside', 'in', 'above', 'below', 'next'].includes(match[1].toLowerCase())) {
                    name = match[1];
                }
            }

            if (!name) {
                name = this.extractName(cmd, ['component']) || `Component${graph.getAllComponents().length + 1}`;
            }

            const comp = graph.addComponent('team', { name, ...bounds });

            // If "inside X", bind to parent
            if (spatialCtx?.type === 'inside' && spatialCtx.refs[0]) {
                const parent = this.findElementByName(spatialCtx.refs[0]);
                if (parent?.type === 'component') {
                    graph.bindComponentToComponent(comp.id, parent.element.id);
                }
            }

            const locationMsg = spatialCtx ? ` ${spatialCtx.type} ${spatialCtx.refs.join(' and ')}` : '';
            return `Added component "${name}"${locationMsg}`;
        }

        // Add responsibility with spatial awareness
        if (cmdLower.match(/(?:add|create|new|place|put)\s+(?:a\s+)?(?:responsibility|resp)/i)) {
            const pos = this.calculatePosition(spatialCtx, { x: 300, y: 200 });

            let name = null;
            let match = cmd.match(/(?:responsibility|resp)\s+(?:called\s+|named\s+)?["']([^"']+)["']/i);
            if (match) {
                name = match[1];
            } else {
                match = cmd.match(/(?:responsibility|resp)\s+(?:called\s+|named\s+)?(\w+)/i);
                if (match && !['between', 'after', 'before', 'inside', 'in', 'above', 'below', 'next'].includes(match[1].toLowerCase())) {
                    name = match[1];
                }
            }

            if (!name) {
                name = this.extractName(cmd, ['responsibility', 'resp']) || `Resp${graph.getNodesByType('responsibility').length + 1}`;
            }

            const node = graph.addNode('responsibility', { name, x: pos.x, y: pos.y });

            // If "inside X" or "in X", bind to component
            if (spatialCtx?.type === 'inside' && spatialCtx.refs[0]) {
                const parent = this.findElementByName(spatialCtx.refs[0]);
                if (parent?.type === 'component') {
                    graph.bindNodeToComponent(node.id, parent.element.id);
                }
            }

            return `Added responsibility "${name}"`;
        }

        // Add start with spatial awareness
        let match = cmdLower.match(/(?:add|create|new)\s+(?:a\s+)?start/i);
        if (match) {
            const pos = this.calculatePosition(spatialCtx, { x: 100, y: 200 });

            let name = 'Start';
            const nameMatch = cmd.match(/start\s+(?:called\s+|named\s+)?["']?([^"'\s]+)["']?/i);
            if (nameMatch && !['between', 'after', 'before', 'inside', 'in'].includes(nameMatch[1].toLowerCase())) {
                name = nameMatch[1];
            }

            const node = graph.addNode('start', { name, x: pos.x, y: pos.y });

            if (spatialCtx?.type === 'inside' && spatialCtx.refs[0]) {
                const parent = this.findElementByName(spatialCtx.refs[0]);
                if (parent?.type === 'component') {
                    graph.bindNodeToComponent(node.id, parent.element.id);
                }
            }

            return `Added start point "${name}"`;
        }

        // Add end with spatial awareness
        match = cmdLower.match(/(?:add|create|new)\s+(?:a\s+)?end/i);
        if (match) {
            const pos = this.calculatePosition(spatialCtx, { x: 600, y: 200 });

            let name = 'End';
            const nameMatch = cmd.match(/end\s+(?:called\s+|named\s+)?["']?([^"'\s]+)["']?/i);
            if (nameMatch && !['between', 'after', 'before', 'inside', 'in'].includes(nameMatch[1].toLowerCase())) {
                name = nameMatch[1];
            }

            const node = graph.addNode('end', { name, x: pos.x, y: pos.y });

            if (spatialCtx?.type === 'inside' && spatialCtx.refs[0]) {
                const parent = this.findElementByName(spatialCtx.refs[0]);
                if (parent?.type === 'component') {
                    graph.bindNodeToComponent(node.id, parent.element.id);
                }
            }

            return `Added end point "${name}"`;
        }

        // Connect: "connect X to Y" or "link X to Y"
        match = cmd.match(/(?:connect|link)\s+["']?([^"']+?)["']?\s+(?:to|->|with)\s+["']?([^"']+?)["']?$/i);
        if (match) {
            const fromName = match[1].trim();
            const toName = match[2].trim();

            const fromNode = this.findNodeByName(fromName);
            const toNode = this.findNodeByName(toName);

            if (!fromNode) return `Node "${fromName}" not found`;
            if (!toNode) return `Node "${toName}" not found`;

            graph.addEdge(fromNode.id, toNode.id);
            return `Connected "${fromName}" to "${toName}"`;
        }

        // Pin/bind: "pin X to Y" or "bind X to Y" or "move X to Y" or "put X in Y"
        match = cmd.match(/(?:pin|bind|move|put)\s+["']?([^"']+?)["']?\s+(?:to|in|into|inside)\s+["']?([^"']+?)["']?$/i);
        if (match) {
            const itemName = match[1].trim();
            const targetName = match[2].trim();

            const item = this.findElementByName(itemName);
            const target = this.findElementByName(targetName);

            if (!item) return `"${itemName}" not found`;
            if (!target) return `"${targetName}" not found`;
            if (target.type !== 'component') return `"${targetName}" is not a component`;

            if (item.type === 'node') {
                graph.bindNodeToComponent(item.element.id, target.element.id);
                return `Pinned "${itemName}" to "${targetName}"`;
            } else if (item.type === 'component') {
                graph.bindComponentToComponent(item.element.id, target.element.id);
                return `Nested "${itemName}" inside "${targetName}"`;
            }
        }

        // Rename: "rename X to Y"
        match = cmd.match(/rename\s+["']?([^"']+?)["']?\s+to\s+["']?([^"']+?)["']?$/i);
        if (match) {
            const oldName = match[1].trim();
            const newName = match[2].trim();

            const el = this.findElementByName(oldName);
            if (!el) return `"${oldName}" not found`;

            if (el.type === 'node') {
                graph.updateNode(el.element.id, { properties: { name: newName } });
            } else {
                graph.updateComponent(el.element.id, { properties: { name: newName } });
            }
            return `Renamed "${oldName}" to "${newName}"`;
        }

        // Delete/remove: "delete X" or "remove X"
        match = cmd.match(/(?:delete|remove)\s+["']?([^"']+?)["']?$/i);
        if (match) {
            const name = match[1].trim();
            const el = this.findElementByName(name);

            if (!el) return `"${name}" not found`;

            if (el.type === 'node') {
                graph.removeNode(el.element.id);
            } else {
                graph.removeComponent(el.element.id);
            }
            return `Deleted "${name}"`;
        }

        // Create path: "create path from X to Y"
        match = cmd.match(/(?:create|add)\s+path\s+(?:from\s+)?["']?([^"']+?)["']?\s+to\s+["']?([^"']+?)["']?$/i);
        if (match) {
            const startName = match[1].trim();
            const endName = match[2].trim();

            const start = graph.addNode('start', { name: startName, x: 100, y: 300 });
            const end = graph.addNode('end', { name: endName, x: 500, y: 300 });
            graph.addEdge(start.id, end.id);

            return `Created path from "${startName}" to "${endName}"`;
        }

        // List: "list components" or "list nodes" or "show all"
        match = cmdLower.match(/(?:list|show|what)\s+(?:all\s+)?(?:components?|nodes?|elements?)/i);
        if (match) {
            const comps = graph.getAllComponents().map(c => c.properties.name).join(', ');
            const nodes = graph.getAllNodes().map(n => `${n.properties.name} (${n.type})`).join(', ');
            return `Components: ${comps || 'none'}\nNodes: ${nodes || 'none'}`;
        }

        // Clear all
        if (cmdLower === 'clear' || cmdLower === 'clear all') {
            graph.clear();
            return 'Cleared all elements';
        }

        // Help
        if (cmdLower === 'help' || cmdLower === '?') {
            return `Commands:
• add component X [between A and B]
• add resp X [inside Component]
• add start/end [after X]
• connect X to Y
• pin X to Component
• rename X to Y
• delete X
• list components`;
        }

        return `Unknown command. Type "help" for available commands.`;
    }

    findNodeByName(name) {
        const nameLower = name.toLowerCase();
        return graph.getAllNodes().find(n =>
            (n.properties.name || '').toLowerCase() === nameLower
        );
    }

    findComponentByName(name) {
        const nameLower = name.toLowerCase();
        return graph.getAllComponents().find(c =>
            (c.properties.name || '').toLowerCase() === nameLower
        );
    }
}

export const aiChat = new AIChat();
