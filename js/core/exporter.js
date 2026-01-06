/**
 * UCM Exporter - Handles exporting the graph to various formats
 */

import { graph } from './graph.js';
import { notifications } from '../ui/notifications.js';
import { serializer } from './serializer.js';

export const exporter = {
    /**
     * Export the graph as a JSON file
     */
    exportJSON() {
        const data = graph.toJSON();
        const json = JSON.stringify(data, null, 2);
        this.downloadFile(json, 'ucm_diagram.json', 'application/json');
    },

    /**
     * Export the graph as a DSL (.ducm) file
     */
    exportDSL() {
        const dsl = serializer.serialize(graph);
        this.downloadFile(dsl, 'ucm_diagram.ducm', 'text/plain');
        notifications.success('DSL exported');
    },

    /**
     * Export the graph as an SVG file
     * Fixed: Properly calculates bounds from graph data, removes pan/zoom transforms
     */
    exportSVG() {
        const svgElement = document.getElementById('canvas');
        if (!svgElement) {
            notifications.error('Export failed: Canvas element not found');
            return;
        }

        // Calculate content bounds from graph data (ignores pan/zoom)
        const bounds = this.calculateContentBounds();
        if (!bounds) {
            notifications.warning('Nothing to export - the diagram is empty');
            return;
        }

        const padding = 40;
        const width = bounds.width + padding * 2;
        const height = bounds.height + padding * 2;
        const viewBoxX = bounds.minX - padding;
        const viewBoxY = bounds.minY - padding;

        // Clone the SVG to avoid modifying the original
        const svgClone = svgElement.cloneNode(true);

        // CRITICAL: Remove the CSS transform (pan/zoom) from the cloned SVG
        svgClone.style.transform = 'none';
        svgClone.style.transformOrigin = 'initial';

        // CRITICAL: Also remove the transform from the viewport group (where pan/zoom is applied)
        const viewport = svgClone.querySelector('#viewport');
        if (viewport) {
            viewport.removeAttribute('transform');
        }

        // Remove selection layer from export
        const selectionLayer = svgClone.querySelector('#layer-selection');
        if (selectionLayer) selectionLayer.remove();

        // Remove the background rect (not needed in export)
        const bgRect = svgClone.querySelector('#canvas-bg');
        if (bgRect) bgRect.remove();

        // Ensure proper namespaces and dimensions
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        svgClone.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${width} ${height}`);
        svgClone.setAttribute('width', width);
        svgClone.setAttribute('height', height);

        // Add white background rectangle
        const bgRectExport = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRectExport.setAttribute('x', viewBoxX);
        bgRectExport.setAttribute('y', viewBoxY);
        bgRectExport.setAttribute('width', width);
        bgRectExport.setAttribute('height', height);
        bgRectExport.setAttribute('fill', 'white');
        svgClone.insertBefore(bgRectExport, svgClone.firstChild);

        const svgData = new XMLSerializer().serializeToString(svgClone);
        this.downloadFile(svgData, 'ucm_diagram.svg', 'image/svg+xml');
    },

    /**
     * Calculate the bounding box of all content from graph data
     * This is independent of any pan/zoom transforms
     */
    calculateContentBounds() {
        const nodes = graph.getAllNodes();
        const components = graph.getAllComponents();
        const edges = graph.getAllEdges();

        if (nodes.length === 0 && components.length === 0) {
            return null;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Include all nodes
        nodes.forEach(node => {
            const x = node.position.x;
            const y = node.position.y;
            // Assume node radius of ~15 for bounds
            minX = Math.min(minX, x - 15);
            minY = Math.min(minY, y - 15);
            maxX = Math.max(maxX, x + 15);
            maxY = Math.max(maxY, y + 50); // Extra for labels below
        });

        // Include all components
        components.forEach(comp => {
            const b = comp.bounds;
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        });

        // Include all edge waypoints/control points
        edges.forEach(edge => {
            if (edge.controlPoints && edge.controlPoints.length > 0) {
                edge.controlPoints.forEach(cp => {
                    minX = Math.min(minX, cp.x - 5);
                    minY = Math.min(minY, cp.y - 5);
                    maxX = Math.max(maxX, cp.x + 5);
                    maxY = Math.max(maxY, cp.y + 5);
                });
            }
        });

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    },

    /**
     * Export the graph as a .jucm (XML) file for jUCMNav compatibility
     * This is a simplified version of the jUCMNav format
     */
    exportJUCM() {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urn:URNspec xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:urn="http:///urn.ecore" name="UCMDiagram">
    <ucmspec>
        <maps name="UCMMap1" id="1">
            <nodes xmi:type="urn:StartPoint" name="Start" id="2" x="100" y="100"/>
        </maps>
    </ucmspec>
</urn:URNspec>`;

        // Actually implement a basic mapping
        const nodes = graph.getAllNodes();
        const components = graph.getAllComponents();
        const edges = graph.getAllEdges();

        let jucmXML = `<?xml version="1.0" encoding="UTF-8"?>
<urn:URNspec xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:urn="http:///urn.ecore" name="UCMDiagram">
    <ucmspec>
        <maps name="MainMap" id="map_1">
`;

        // Components
        components.forEach(comp => {
            const type = this.mapComponentType(comp.type);
            jucmXML += `            <components xmi:type="urn:${type}" name="${this.escapeXml(comp.properties.name)}" id="${comp.id}" x="${comp.bounds.x}" y="${comp.bounds.y}" width="${comp.bounds.width}" height="${comp.bounds.height}"/>\n`;
        });

        // Nodes
        nodes.forEach(node => {
            const type = this.mapNodeType(node.type);
            jucmXML += `            <nodes xmi:type="urn:${type}" name="${this.escapeXml(node.properties.name)}" id="${node.id}" x="${node.position.x}" y="${node.position.y}"/>\n`;
        });

        // Edges
        edges.forEach(edge => {
            jucmXML += `            <connections id="${edge.id}" source="${edge.sourceNodeId}" target="${edge.targetNodeId}"/>\n`;
        });

        jucmXML += `        </maps>
    </ucmspec>
</urn:URNspec>`;

        this.downloadFile(jucmXML, 'ucm_diagram.jucm', 'application/xml');
    },

    /**
     * Map internal node types to jUCMNav types
     */
    mapNodeType(type) {
        const mapping = {
            'start': 'StartPoint',
            'end': 'EndPoint',
            'responsibility': 'Responsibility',
            'empty': 'DirectionArrow',
            'fork': 'OrFork',
            'join': 'OrJoin'
        };
        return mapping[type] || 'NodeConnection';
    },

    /**
     * Map internal component types to jUCMNav types
     */
    mapComponentType(type) {
        const mapping = {
            'team': 'Component',
            'actor': 'Component',
            'process': 'Component',
            'agent': 'Component',
            'object': 'Component'
        };
        return mapping[type] || 'Component';
    },

    /**
     * Export the graph in Cytoscape.js readable format
     */
    exportCytoscape() {
        const nodes = graph.getAllNodes();
        const edges = graph.getAllEdges();

        const data = {
            elements: {
                nodes: nodes.map(n => ({
                    data: {
                        id: n.id,
                        name: n.properties.name,
                        type: n.type
                    },
                    position: n.position
                })),
                edges: edges.map(e => ({
                    data: {
                        id: e.id,
                        source: e.sourceNodeId,
                        target: e.targetNodeId
                    }
                }))
            }
        };

        const json = JSON.stringify(data, null, 2);
        this.downloadFile(json, 'ucm_cytoscape.json', 'application/json');
    },

    /**
     * Export the graph in D3.js readable format (nodes/links)
     */
    exportD3() {
        const nodes = graph.getAllNodes();
        const edges = graph.getAllEdges();

        const data = {
            nodes: nodes.map(n => ({
                id: n.id,
                name: n.properties.name,
                type: n.type,
                x: n.position.x,
                y: n.position.y
            })),
            links: edges.map(e => ({
                source: e.sourceNodeId,
                target: e.targetNodeId,
                id: e.id
            }))
        };

        const json = JSON.stringify(data, null, 2);
        this.downloadFile(json, 'ucm_d3.json', 'application/json');
    },

    /**
     * Export the graph as a PNG image
     * @param {number} scale - Resolution multiplier (1x, 2x, 4x)
     * Fixed: Uses calculateContentBounds for accurate sizing
     */
    async exportPNG(scale = 2) {
        const svgElement = document.getElementById('canvas');
        if (!svgElement) {
            notifications.error('Export failed: Canvas element not found');
            return;
        }

        // Calculate content bounds from graph data (ignores pan/zoom)
        const bounds = this.calculateContentBounds();
        if (!bounds) {
            notifications.warning('Nothing to export - the diagram is empty');
            return;
        }

        const padding = 40;
        const width = bounds.width + padding * 2;
        const height = bounds.height + padding * 2;
        const viewBoxX = bounds.minX - padding;
        const viewBoxY = bounds.minY - padding;

        // Create a canvas element
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');

        // Scale for higher resolution
        ctx.scale(scale, scale);

        // Set white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        // Clone the SVG
        const svgClone = svgElement.cloneNode(true);

        // CRITICAL: Remove the CSS transform (pan/zoom)
        svgClone.style.transform = 'none';
        svgClone.style.transformOrigin = 'initial';

        // CRITICAL: Also remove the transform from the viewport group
        const viewport = svgClone.querySelector('#viewport');
        if (viewport) {
            viewport.removeAttribute('transform');
        }

        // Remove selection layer
        const selectionLayer = svgClone.querySelector('#layer-selection');
        if (selectionLayer) selectionLayer.remove();

        // Remove background rect
        const bgRect = svgClone.querySelector('#canvas-bg');
        if (bgRect) bgRect.remove();

        // Set proper dimensions and viewBox
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgClone.setAttribute('width', width);
        svgClone.setAttribute('height', height);
        svgClone.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${width} ${height}`);

        // Convert SVG to data URL
        const svgData = new XMLSerializer().serializeToString(svgClone);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        // Load SVG into image
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(svgUrl);

            // Convert canvas to PNG and download
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ucm_diagram_${scale}x.png`;
                a.click();
                URL.revokeObjectURL(url);
            }, 'image/png');
        };
        img.src = svgUrl;
    },

    /**
     * Export the graph as a PDF (Simplified using print)
     */
    exportPDF() {
        window.print();
    },

    /**
     * Import a JSON file
     */
    importFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    graph.fromJSON(data);
                    notifications.success('File imported successfully');
                    resolve(true);
                } catch (err) {
                    notifications.error('Import failed: ' + err.message);
                    reject(err);
                }
            };
            reader.onerror = () => {
                notifications.error('Failed to read file');
                reject(new Error('Failed to read file'));
            };
            reader.readAsText(file);
        });
    },

    /**
     * Helper to download a file in the browser
     */
    downloadFile(content, fileName, contentType) {
        const a = document.createElement('a');
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    },

    /**
     * Escape XML characters
     */
    escapeXml(unsafe) {
        if (!unsafe) return "";
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }
};
