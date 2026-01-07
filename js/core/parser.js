/**
 * UCM Parser - Converts DSL Text to Graph Operations
 *
 * Syntax v3 (Human Readable & Regex Friendly):
 *   ucm "Name"
 *   component "Name" type <type> at (x, y) size (w, h) {
 *     <node_type> "Name" at (x, y)
 *   }
 *   link "Source" -> "Target"
 */

// Regex patterns
const PATTERNS = {
    // ucm "Name" or ucm Name
    ucm: /^ucm\s+(?:"([^"]+)"|(\S+))/i,

    // component "Name" type <type> at (x, y) size (w, h) {
    // Allow negative coordinates with -?\d+
    compStart: /^\s*component\s+(?:"([^"]+)"|(\S+))\s+type\s+(\w+)\s+at\s*\((-?\d+),\s*(-?\d+)\)\s+size\s*\((-?\d+),\s*(-?\d+)\)\s*\{/i,

    // closing brace }
    compEnd: /^\s*\}\s*$/,

    // <type> "Name" at (x, y)
    // Allow negative coordinates with -?\d+
    node: /^\s*(start|end|responsibility|fork|join)\s+(?:"([^"]+)"|(\S+))\s+at\s*\((-?\d+),\s*(-?\d+)\)/i,

    // link "A" -> "B"
    link: /^\s*link\s+(?:"([^"]+)"|(\S+))\s*->\s*(?:"([^"]+)"|(\S+))/i
};

export const parser = {
    /**
     * Validate coordinate values
     */
    validateCoordinates(x, y, lineNum, result, context = 'position') {
        const MAX_COORD = 100000;
        const MIN_COORD = -100000;

        if (x < MIN_COORD || y < MIN_COORD || x > MAX_COORD || y > MAX_COORD) {
            result.errors.push({
                line: lineNum,
                message: `Invalid ${context}: coordinates (${x}, ${y}) out of range (${MIN_COORD} to ${MAX_COORD})`
            });
            return false;
        }

        return true;
    },

    /**
     * Validate size values
     */
    validateSize(width, height, lineNum, result) {
        const MAX_SIZE = 50000;
        const MIN_SIZE = 10;

        if (width <= 0 || height <= 0) {
            result.errors.push({
                line: lineNum,
                message: `Invalid size: dimensions (${width}, ${height}) must be positive`
            });
            return false;
        }

        if (width < MIN_SIZE || height < MIN_SIZE) {
            result.warnings.push({
                line: lineNum,
                message: `Very small size (${width}, ${height}) - minimum recommended is ${MIN_SIZE}`
            });
        }

        if (width > MAX_SIZE || height > MAX_SIZE) {
            result.errors.push({
                line: lineNum,
                message: `Invalid size: dimensions (${width}, ${height}) exceed maximum ${MAX_SIZE}`
            });
            return false;
        }

        return true;
    },

    /**
     * Check for duplicate names
     */
    checkDuplicateName(name, existingMap, lineNum, result, type = 'element') {
        if (existingMap.has(name)) {
            result.warnings.push({
                line: lineNum,
                message: `Duplicate ${type} name "${name}" - previous definition will be used`
            });
            return true;
        }
        return false;
    },

    /**
     * Parse DSL text and update graph
     * @returns {Object} { success: boolean, errors: Array<{line, message}> }
     */
    parse(text, graph) {
        const result = { success: true, errors: [], warnings: [] };

        if (!text || !text.trim()) {
            return result;
        }

        graph.clear();

        const lines = text.split('\n');
        const nodeMap = new Map(); // name -> node object
        const componentMap = new Map(); // name -> component object
        const linkQueue = []; // store links to process after all nodes exist
        let currentComponent = null;
        this.compStack = []; // Stack for nested components

        lines.forEach((rawLine, lineIndex) => {
            const lineNum = lineIndex + 1;
            const line = rawLine.trim();

            if (!line || line.startsWith('#') || line.startsWith('//')) return;

            // 1. UCM Name
            let match = line.match(PATTERNS.ucm);
            if (match) {
                return; // Graph name not currently stored
            }

            // 2. Component Start
            match = line.match(PATTERNS.compStart);
            if (match) {
                const name = match[1] || match[2];
                const type = match[3];
                const x = parseInt(match[4], 10);
                const y = parseInt(match[5], 10);
                const w = parseInt(match[6], 10);
                const h = parseInt(match[7], 10);

                const coordsValid = this.validateCoordinates(x, y, lineNum, result, 'component position');
                const sizeValid = this.validateSize(w, h, lineNum, result);

                this.checkDuplicateName(name, componentMap, lineNum, result, 'component');

                if (coordsValid && sizeValid) {
                    const comp = graph.addComponent(type.toLowerCase(), {
                        name: name,
                        x, y, width: w, height: h
                    });

                    // Nesting logic using a stack
                    if (!this.compStack) this.compStack = [];
                    if (currentComponent) {
                        graph.bindComponentToComponent(comp.id, currentComponent.id);
                        this.compStack.push(currentComponent);
                    }

                    currentComponent = comp;
                    componentMap.set(name, comp);
                }
                return;
            }

            // 3. Component End
            if (PATTERNS.compEnd.test(line)) {
                if (this.compStack && this.compStack.length > 0) {
                    currentComponent = this.compStack.pop();
                } else {
                    currentComponent = null;
                }
                return;
            }

            // 4. Node
            match = line.match(PATTERNS.node);
            if (match) {
                const type = match[1].toLowerCase();
                const name = match[2] || match[3];
                const x = parseInt(match[4], 10);
                const y = parseInt(match[5], 10);

                // Validate coordinates
                const coordsValid = this.validateCoordinates(x, y, lineNum, result, 'node position');

                // Check for duplicate node names
                const isDuplicate = this.checkDuplicateName(name, nodeMap, lineNum, result, 'node');

                // Only create node if validation passed and not a duplicate
                if (coordsValid && !isDuplicate) {
                    const node = graph.addNode(type, {
                        name: name,
                        x, y
                    });

                    // Auto-detect fork/join type from name (AND_Fork, OR_Join, etc.)
                    if (type === 'fork' || type === 'join') {
                        const upperName = name.toUpperCase();
                        let detectedType = 'or'; // Default to OR
                        if (upperName.includes('AND')) {
                            detectedType = 'and';
                        }
                        graph.updateNode(node.id, {
                            properties: { ...node.properties, [type + 'Type']: detectedType }
                        });
                    }

                    nodeMap.set(name, node);

                    if (currentComponent) {
                        graph.bindNodeToComponent(node.id, currentComponent.id);
                    }
                }
                return;
            }

            // 5. Link
            match = line.match(PATTERNS.link);
            if (match) {
                const srcName = match[1] || match[2];
                const tgtName = match[3] || match[4];
                linkQueue.push({ lineNum, srcName, tgtName });
                return;
            }

            result.warnings.push({ line: lineNum, message: `Syntax error or unrecognized: "${line}"` });
        });

        // Process Links
        linkQueue.forEach(({ lineNum, srcName, tgtName }) => {
            const fromNode = nodeMap.get(srcName);
            const toNode = nodeMap.get(tgtName);

            if (!fromNode) {
                result.errors.push({ line: lineNum, message: `Link source unknown: "${srcName}"` });
                return;
            }
            if (!toNode) {
                result.errors.push({ line: lineNum, message: `Link target unknown: "${tgtName}"` });
                return;
            }

            graph.addEdge(fromNode.id, toNode.id);
        });

        result.success = result.errors.length === 0;
        return result;
    }
};
