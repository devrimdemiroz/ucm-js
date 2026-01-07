/**
 * UCM Node Types - Visual definitions and rendering info for each node type
 */

// Edge routing modes
export const ROUTING_MODES = {
    freeform: 'freeform',       // Free-form waypoints
    octilinear: 'octilinear',   // Metro-style 8 directions (0°, 45°, 90°, etc.)
    orthogonal: 'orthogonal'    // Only horizontal/vertical (90° turns)
};

// Current routing mode (can be changed via settings)
let currentRoutingMode = ROUTING_MODES.octilinear;

export function getRoutingMode() {
    return currentRoutingMode;
}

export function setRoutingMode(mode) {
    if (ROUTING_MODES[mode]) {
        currentRoutingMode = mode;
    }
}

export const NODE_TYPES = {
    start: {
        name: 'Start Point',
        icon: '●',
        color: '#000000',
        shape: 'circle',
        radius: 10,
        canHaveMultipleOut: false,
        canHaveMultipleIn: false,
        editable: ['name', 'description', 'precondition']
    },

    end: {
        name: 'End Point',
        icon: '▮',
        shape: 'bar',
        color: '#000000',
        width: 6,
        height: 20,
        canHaveMultipleOut: false,
        canHaveMultipleIn: true,
        editable: ['name', 'description', 'postcondition']
    },

    responsibility: {
        name: 'Responsibility',
        icon: '✕',
        shape: 'cross',
        color: '#000000',
        size: 14,
        canHaveMultipleOut: false,
        canHaveMultipleIn: true,
        editable: ['name', 'description', 'executionTime']
    },

    empty: {
        name: 'Empty Point',
        icon: '○',
        shape: 'circle',
        color: '#adb5bd',
        radius: 4,
        canHaveMultipleOut: false,
        canHaveMultipleIn: true,
        editable: [],
        convertibleTo: ['responsibility', 'fork', 'join']
    },

    fork: {
        name: 'Fork',
        icon: '◇',
        shape: 'junction',  // Invisible - paths curve through
        color: '#000000',
        radius: 3,
        canHaveMultipleOut: true,
        canHaveMultipleIn: true,
        editable: ['name', 'forkType'], // forkType: 'or' | 'and'
        forkType: 'or'
    },

    join: {
        name: 'Join',
        icon: '◇',
        shape: 'junction',  // Invisible - paths curve through
        color: '#000000',
        radius: 3,
        canHaveMultipleOut: true,
        canHaveMultipleIn: true,
        editable: ['name', 'joinType'], // joinType: 'or' | 'and'
        joinType: 'or'
    }
};

export const COMPONENT_TYPES = {
    team: {
        name: 'Team',
        icon: '□',
        color: '#000000',
        borderStyle: 'solid'
    },
    object: {
        name: 'Object',
        icon: '□',
        color: '#000000',
        borderStyle: 'solid'
    },
    process: {
        name: 'Process',
        icon: '□',
        color: '#000000',
        borderStyle: 'dashed'
    },
    agent: {
        name: 'Agent',
        icon: '□',
        color: '#000000',
        borderStyle: 'solid'
    },
    actor: {
        name: 'Actor',
        icon: '웃',
        color: '#000000',
        borderStyle: 'solid'
    }
};

/**
 * Create SVG element for a node based on its type
 * @param {Object} node - The node object
 * @param {number} [incomingAngle] - Optional angle (degrees) of the incoming edge for end points
 */
export function createNodeSVG(node, incomingAngle = null) {
    const typeInfo = NODE_TYPES[node.type];
    if (!typeInfo) return null;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `ucm-node node-${node.type}`);
    g.setAttribute('data-node-id', node.id);
    g.setAttribute('transform', `translate(${node.position.x}, ${node.position.y})`);

    let shape;

    switch (typeInfo.shape) {
        case 'circle':
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            shape.setAttribute('r', typeInfo.radius);
            shape.setAttribute('fill', typeInfo.color);
            break;

        case 'bar':
            // Create a group for the bar so we can rotate it
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', -typeInfo.width / 2);
            rect.setAttribute('y', -typeInfo.height / 2);
            rect.setAttribute('width', typeInfo.width);
            rect.setAttribute('height', typeInfo.height);
            rect.setAttribute('rx', 2);
            rect.setAttribute('fill', typeInfo.color);
            shape.appendChild(rect);

            // Rotate the bar to be perpendicular to the incoming edge
            // The bar is naturally vertical (width=6, height=20)
            // At 0° (horizontal from left), bar should be vertical (no rotation)
            // At 90° (coming from top/down), bar should be horizontal (90° rotation)
            // So rotation = incomingAngle (bar perpendicular to edge direction)
            if (incomingAngle !== null) {
                // Snap to nearest 45° for cleaner appearance
                const snappedAngle = Math.round(incomingAngle / 45) * 45;
                shape.setAttribute('transform', `rotate(${snappedAngle})`);
            }
            break;

        case 'cross':
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const size = typeInfo.size;

            // The X mark (Classic)
            const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line1.setAttribute('class', 'classic-x');
            line1.setAttribute('x1', -size / 2); line1.setAttribute('y1', -size / 2);
            line1.setAttribute('x2', size / 2); line1.setAttribute('y2', size / 2);
            line1.setAttribute('stroke', typeInfo.color);
            line1.setAttribute('stroke-width', 3);
            line1.setAttribute('stroke-linecap', 'round');

            const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line2.setAttribute('class', 'classic-x');
            line2.setAttribute('x1', size / 2); line2.setAttribute('y1', -size / 2);
            line2.setAttribute('x2', -size / 2); line2.setAttribute('y2', size / 2);
            line2.setAttribute('stroke', typeInfo.color);
            line2.setAttribute('stroke-width', 3);
            line2.setAttribute('stroke-linecap', 'round');

            // The Station Circle (Transit)
            const station = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            station.setAttribute('class', 'transit-station');
            station.setAttribute('r', 6);
            station.setAttribute('fill', 'white');
            station.setAttribute('stroke', typeInfo.color);
            station.setAttribute('stroke-width', 2);

            shape.appendChild(line1);
            shape.appendChild(line2);
            shape.appendChild(station);
            break;

        case 'diamond':
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const s = typeInfo.size;
            shape.setAttribute('points', `0,${-s} ${s},0 0,${s} ${-s},0`);
            shape.setAttribute('fill', typeInfo.color);
            break;

        case 'junction':
            const isAnd = (node.type === 'fork' && node.properties.forkType === 'and') ||
                (node.type === 'join' && node.properties.joinType === 'and');

            if (isAnd) {
                // AND Fork/Join: Vertical Bar (Thicker)
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                const w = 8;
                const h = 30;
                shape.setAttribute('x', -w / 2);
                shape.setAttribute('y', -h / 2);
                shape.setAttribute('width', w);
                shape.setAttribute('height', h);
                shape.setAttribute('fill', '#000000');
                shape.setAttribute('class', 'ucm-and-bar');
            } else {
                // OR Fork/Join: Small filled point (Smaller)
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                shape.setAttribute('r', 3.5);
                shape.setAttribute('fill', '#000000'); // Standard UCM point is filled
                shape.setAttribute('class', 'ucm-or-point');
            }
            break;
    }

    if (shape) {
        g.appendChild(shape);
    }

    // Add hit area for easier selection
    // Add hit area for easier selection
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hitArea.setAttribute('r', 18);
    hitArea.setAttribute('fill', 'white');
    hitArea.setAttribute('fill-opacity', '0');
    hitArea.setAttribute('class', 'hit-area');
    g.insertBefore(hitArea, g.firstChild);

    // Add selection box (Visual highlight, initially invisible)
    // Placed behind everything (first child)
    const selectionBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    selectionBox.setAttribute('x', -24);
    selectionBox.setAttribute('y', -24);
    selectionBox.setAttribute('width', 48);
    selectionBox.setAttribute('height', 48);
    selectionBox.setAttribute('rx', 6);
    selectionBox.setAttribute('fill', 'none');
    selectionBox.setAttribute('stroke', 'none');
    selectionBox.setAttribute('class', 'selection-box');
    g.insertBefore(selectionBox, g.firstChild);

    return g;
}

/**
 * Create or update label for a node
 */
export function createNodeLabel(node, offsetY = 25) {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'node-label');
    label.setAttribute('data-label-for', node.id);
    label.setAttribute('x', node.position.x);
    label.setAttribute('y', node.position.y + offsetY);
    label.textContent = node.properties.name || '';
    return label;
}

/**
 * Create SVG path for an edge with rounded corners and waypoint markers
 */
export function createEdgeSVG(edge, sourceNode, targetNode) {
    // Handle backward compatibility if sourceNode is just a position (no type)
    const sourcePos = sourceNode.position || sourceNode;
    const targetPos = targetNode.position || targetNode;
    const sourceType = sourceNode.type;
    const targetType = targetNode.type;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'ucm-edge-group');
    group.setAttribute('data-edge-id', edge.id);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'ucm-edge');

    // Pass node types to routing logic
    const options = {
        sourceType,
        targetType
    };

    const d = calculateEdgePath(sourcePos, targetPos, edge.controlPoints, options);
    const midPoint = getMidpoint(sourcePos, targetPos, edge.controlPoints);
    const angle = getAngle(sourcePos, targetPos, edge.controlPoints);

    // Add invisible wide hit area for easier selection
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', d);
    hitPath.setAttribute('fill', 'none');
    hitPath.setAttribute('stroke', 'white');
    hitPath.setAttribute('stroke-opacity', '0');
    hitPath.setAttribute('stroke-width', '15');
    hitPath.style.pointerEvents = 'stroke';
    group.appendChild(hitPath);

    path.setAttribute('d', d);
    group.appendChild(path);

    // Add visible waypoint markers (draw.io style)
    if (edge.controlPoints && edge.controlPoints.length > 0) {
        edge.controlPoints.forEach((cp, index) => {
            const waypoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            waypoint.setAttribute('class', 'waypoint-marker');
            waypoint.setAttribute('data-waypoint-index', index);
            waypoint.setAttribute('cx', cp.x);
            waypoint.setAttribute('cy', cp.y);
            waypoint.setAttribute('r', 5);
            group.appendChild(waypoint);
        });
    }

    // Midpoint Arrow
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrow.setAttribute('class', 'mid-arrow');
    arrow.setAttribute('d', 'M -6 -4 L 4 0 L -6 4 Z');
    arrow.setAttribute('transform', `translate(${midPoint.x}, ${midPoint.y}) rotate(${angle})`);
    arrow.setAttribute('fill', '#000');
    group.appendChild(arrow);

    return group;
}

/**
 * Helpers for midpoint arrows
 */
function getMidpoint(source, target, controlPoints) {
    if (!controlPoints || controlPoints.length === 0) {
        return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
    }
    // Simple midpoint of control points/bezier is complex, use approximation
    const cp = controlPoints[0];
    const x = 0.25 * source.x + 0.5 * cp.x + 0.25 * target.x;
    const y = 0.25 * source.y + 0.5 * cp.y + 0.25 * target.y;
    return { x, y };
}

function getAngle(source, target, controlPoints) {
    let dx, dy;
    if (!controlPoints || controlPoints.length === 0) {
        dx = target.x - source.x;
        dy = target.y - source.y;
    } else {
        // Angle at midpoint for bezier
        const cp = controlPoints[0];
        dx = 0.5 * (cp.x - source.x) + 0.5 * (target.x - cp.x);
        dy = 0.5 * (cp.y - source.y) + 0.5 * (target.y - cp.y);
    }
    return Math.atan2(dy, dx) * 180 / Math.PI;
}

/**
 * Calculate SVG path string for an edge
 * Uses rounded corners at waypoints (draw.io style)
 * Supports octilinear routing for metro-map style paths
 */
export function calculateEdgePath(source, target, controlPoints = [], options = {}) {
    const mode = options.routingMode || currentRoutingMode;

    // Always generate octilinear waypoints - every edge gets proper routing
    let effectivePoints = controlPoints;
    if (mode !== ROUTING_MODES.freeform) {
        // If no manual waypoints, auto-generate
        if (controlPoints.length === 0) {
            effectivePoints = generateOctilinearRoute(source, target, mode, options.sourceType, options.targetType);
        }
        // If manual waypoints exist, ensure each segment is octilinear
        // by adding intermediate waypoints if needed
    }

    // Direct line if still no waypoints
    if (effectivePoints.length === 0) {
        return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    }

    // Radius for rounded corners (adjustable)
    const radius = 15;

    // Build path with rounded corners at each waypoint
    const allPoints = [source, ...effectivePoints, target];
    let d = `M ${source.x} ${source.y}`;

    for (let i = 1; i < allPoints.length - 1; i++) {
        const prev = allPoints[i - 1];
        const curr = allPoints[i];
        const next = allPoints[i + 1];

        // Calculate vectors
        const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
        const v2 = { x: next.x - curr.x, y: next.y - curr.y };

        // Normalize and get distances
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        if (len1 === 0 || len2 === 0) {
            d += ` L ${curr.x} ${curr.y}`;
            continue;
        }

        // Calculate how much to pull back from corner (limited by segment length)
        const pullback = Math.min(radius, len1 / 2, len2 / 2);

        // Start point of curve (pulled back from corner on incoming segment)
        const startX = curr.x - (v1.x / len1) * pullback;
        const startY = curr.y - (v1.y / len1) * pullback;

        // End point of curve (moved forward from corner on outgoing segment)
        const endX = curr.x + (v2.x / len2) * pullback;
        const endY = curr.y + (v2.y / len2) * pullback;

        // Draw line to start of curve, then quadratic bezier through corner
        d += ` L ${startX} ${startY}`;
        d += ` Q ${curr.x} ${curr.y} ${endX} ${endY}`;
    }

    // Final line to target
    d += ` L ${target.x} ${target.y}`;

    return d;
}

/**
 * Generate octilinear route between two points
 * London Tube Map style: horizontal runs with 45° diagonal transitions
 * Key principle: Diagonals are used to change between horizontal levels,
 * keeping horizontal segments dominant for readability
 */
function generateOctilinearRoute(source, target, mode = ROUTING_MODES.octilinear, sourceType, targetType) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // If points are very close or already aligned, no waypoints needed
    if (absDx < 5 && absDy < 5) return [];

    // For orthogonal mode: only horizontal/vertical
    if (mode === ROUTING_MODES.orthogonal) {
        // Prefer horizontal-first then vertical
        if (absDx > 5 && absDy > 5) {
            return [{ x: target.x, y: source.y }];
        }
        return [];
    }

    // Octilinear: allow 45° diagonals
    // Check if already on an octilinear angle (0°, 45°, 90°, etc.)
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const normalizedAngle = ((angle % 45) + 45) % 45;

    // If angle is close to an octilinear direction, draw direct line
    if (normalizedAngle < 5 || normalizedAngle > 40) {
        return [];
    }

    // London Tube Map Style Routing:
    // - Prefer HORIZONTAL segments (the "main runs")
    // - Use 45° DIAGONALS to transition between horizontal levels
    // - Diagonal segment length = vertical distance (for 45°)
    // - Pattern: Horizontal → Diagonal → Horizontal

    const waypoints = [];
    const diagonalLen = absDy; // 45° diagonal covers vertical distance

    // Special case: Fork directly to Join (Symmetrical S-shape)
    if (sourceType === 'fork' && targetType === 'join' && absDx > absDy) {
        // Diagonal -> Horizontal -> Diagonal
        const halfDy = dy / 2;
        const absHalfDy = Math.abs(halfDy);

        // Check if we have enough horizontal space
        if (absDx > absDy) {
            // Waypoint 1: Diverge
            const wp1 = { x: source.x + absHalfDy, y: source.y + halfDy };
            // Waypoint 2: Converge
            const wp2 = { x: target.x - absHalfDy, y: target.y - halfDy };
            return [wp1, wp2];
        }
    }

    // Fork Logic: Prefer "Diagonal First" (Diverge immediately)
    if (sourceType === 'fork' && absDx > absDy) {
        // Waypoint at end of diagonal
        // x = source.x + (dx > 0 ? diagLen : -diagLen)
        // y = target.y
        // This creates Source -> Waypoint (Diagonal) -> Target (Horizontal)
        return [{
            x: source.x + (dx > 0 ? diagonalLen : -diagonalLen),
            y: target.y
        }];
    }

    // Default Logic (Join or Normal): Prefer "Diagonal Last" (Converge at end)
    if (absDx > absDy) {
        // Primarily horizontal movement
        // Strategy: Start with horizontal, then diagonal at the end toward target
        // This keeps entry/exit clean and diagonals near the destination

        // Calculate where diagonal should start (near target)
        const diagStartX = target.x - (dx > 0 ? diagonalLen : -diagonalLen);

        if (absDy > 15) {
            // Create: source → horizontal → diagonal start → target
            waypoints.push({
                x: diagStartX,
                y: source.y
            });
        }
    } else {
        // Primarily vertical movement  
        // Strategy: Short horizontal exit, then diagonal, then horizontal entry
        const diagLen = absDx;

        if (absDx > 15) {
            // Diagonal transition near target (approach horizontally)
            waypoints.push({
                x: target.x,
                y: source.y + (dy > 0 ? (absDy - diagLen) : -(absDy - diagLen))
            });
        }
    }

    return waypoints;
}

/**
 * Snap a point to the nearest octilinear angle from a reference point
 * Useful for interactive waypoint placement
 */
export function snapToOctilinear(refPoint, point, snapAngle = 45) {
    const dx = point.x - refPoint.x;
    const dy = point.y - refPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 5) return point;

    // Get current angle and snap to nearest octilinear
    const angle = Math.atan2(dy, dx);
    const snapRad = (snapAngle * Math.PI) / 180;
    const snappedAngle = Math.round(angle / snapRad) * snapRad;

    return {
        x: refPoint.x + Math.cos(snappedAngle) * distance,
        y: refPoint.y + Math.sin(snappedAngle) * distance
    };
}

/**
 * Get the connection point on a node for edge attachment
 */
export function getNodeConnectionPoint(node, direction = 'out') {
    const typeInfo = NODE_TYPES[node.type];
    const pos = node.position;

    // For now, just return center - can be enhanced for directional connection points
    return { x: pos.x, y: pos.y };
}

/**
 * Calculate the incoming angle for a node based on the last segment of incoming edges
 * Used to rotate end point bars to be perpendicular to the incoming path
 * @param {Object} node - The target node
 * @param {Array} inEdges - Array of incoming edge objects
 * @param {Function} getNode - Function to get a node by ID
 * @returns {number|null} - Angle in degrees, or null if no incoming edges
 */
export function calculateIncomingAngle(node, inEdges, getNode) {
    if (!inEdges || inEdges.length === 0) return null;

    // Use the first incoming edge (typically end points have only one)
    const edge = inEdges[0];
    if (!edge) return null;

    const sourceNode = getNode(edge.sourceNodeId);
    if (!sourceNode) return null;

    const sourcePos = sourceNode.position;
    const targetPos = node.position;

    // Calculate angle from last waypoint (or source) to the target
    let lastPoint = sourcePos;
    if (edge.controlPoints && edge.controlPoints.length > 0) {
        lastPoint = edge.controlPoints[edge.controlPoints.length - 1];
    }

    const dx = targetPos.x - lastPoint.x;
    const dy = targetPos.y - lastPoint.y;

    // Return angle in degrees
    return Math.atan2(dy, dx) * 180 / Math.PI;
}
