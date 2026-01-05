/**
 * UCM Exporter - Handles exporting the graph to various formats
 */

import { graph } from './graph.js';

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
     * Export the graph as an SVG file
     */
    exportSVG() {
        const svgElement = document.getElementById('canvas');
        if (!svgElement) return;

        // Clone the SVG to avoid modifying the original
        const svgClone = svgElement.cloneNode(true);

        // Remove selection layer from export
        const selectionLayer = svgClone.querySelector('#layer-selection');
        if (selectionLayer) selectionLayer.remove();

        // Ensure proper namespaces and dimensions
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // Get bounding box of all content to set viewBox
        const bbox = svgElement.getBBox();
        const padding = 20;
        svgClone.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`);
        svgClone.setAttribute('width', bbox.width + padding * 2);
        svgClone.setAttribute('height', bbox.height + padding * 2);

        const svgData = new XMLSerializer().serializeToString(svgClone);
        this.downloadFile(svgData, 'ucm_diagram.svg', 'image/svg+xml');
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
     * @agent main - 2026-01-05 - P2.4 implementation
     */
    async exportPNG(scale = 2) {
        const svgElement = document.getElementById('canvas');
        if (!svgElement) return;

        // Get the bounding box for the content
        const bbox = svgElement.getBBox();
        const padding = 20;
        const width = bbox.width + padding * 2;
        const height = bbox.height + padding * 2;

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

        // Remove selection layer
        const selectionLayer = svgClone.querySelector('#layer-selection');
        if (selectionLayer) selectionLayer.remove();

        // Set proper dimensions
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgClone.setAttribute('width', width);
        svgClone.setAttribute('height', height);
        svgClone.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);

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
                    resolve(true);
                } catch (err) {
                    reject(err);
                }
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
     * Export the graph as a PNG image
     */
    exportPNG() {
        const svgElement = document.getElementById('canvas');
        if (!svgElement) return;

        // 1. Get SVG data with proper sizing
        // Use logic similar to exportSVG to ensure full content is visible
        const svgClone = svgElement.cloneNode(true);
        const selectionLayer = svgClone.querySelector('#layer-selection');
        if (selectionLayer) selectionLayer.remove();

        // Get bounding box
        const bbox = svgElement.getBBox();
        const padding = 20;
        const width = bbox.width + padding * 2;
        const height = bbox.height + padding * 2;

        svgClone.setAttribute('width', width);
        svgClone.setAttribute('height', height);
        svgClone.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);

        // Ensure background is valid (often needed for PNG)
        svgClone.style.backgroundColor = 'white';

        const svgData = new XMLSerializer().serializeToString(svgClone);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        // 2. Render to Canvas
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);

            ctx.drawImage(img, 0, 0);

            // 3. Download
            const pngUrl = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = 'ucm_diagram.png';
            a.click();

            URL.revokeObjectURL(url);
        };
        img.src = url;
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
