/**
 * UCM File Loader - Loads and manages .ducm files
 * DUCM v2 = Regex-friendly declarative format
 * 
 * Syntax (no quotes, no commas, no parentheses):
 *   ucm <name>
 *   COMP <type> <name> at <x> <y> size <w> <h>
 *     <NODETYPE> <name> at <x> <y>
 *   END
 *   LINK <source> TO <target>
 */

import { graph } from './graph.js';
import { canvas } from '../editor/canvas.js';
import { tracing } from './tracing.js';
import { parser } from './parser.js';
import { serializer } from './serializer.js';

class FileLoader {
    constructor() {
        this.examples = [
            {
                id: 'demo-parallel-processing',
                name: 'Parallel Processing Demo',
                path: 'examples/demo-parallel-processing.ducm'
            },
            {
                id: 'observability-stack',
                name: 'Observability Stack',
                path: 'examples/observability-stack.ducm'
            },
            {
                id: 'dilbert',
                name: 'Dilbert Commute',
                path: 'examples/dilbert.ducm'
            }
        ];
        this.currentFile = null;
    }

    /**
     * Get list of available example files
     */
    getExamples() {
        return this.examples;
    }

    /**
     * Load a .ducm file by path
     */
    async loadFile(path) {
        try {
            tracing.startUserAction('user.load_file', { 'file.path': path });

            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load file: ${response.status}`);
            }

            const text = await response.text();

            // Use the shared parser to update the graph directly
            const result = parser.parse(text, graph);

            if (!result.success) {
                console.warn('Parser errors:', result.errors);
            }

            // Extract name if possible (parser might not store it on graph yet, but we can verify)
            // For now, we assume success means graph is populated.

            this.currentFile = { path, name: path.split('/').pop() }; // Generic name fallback

            // Emit event to notify history to reset
            // @agent main - 2026-01-05 - P2.3 implementation
            graph.emit('graph:loaded', { clearHistory: true });

            // Re-render canvas
            canvas.renderAll();

            console.log(`📂 Loaded: ${path}`);
            console.log(`   Stats: ${graph.getAllNodes().length} nodes, ${graph.getAllEdges().length} edges`);

            tracing.createServerSpan('file.loaded', {
                'file.path': path,
                'node.count': graph.getAllNodes().length,
                'edge.count': graph.getAllEdges().length
            }, 50);

            return true;
        } catch (error) {
            console.error('Failed to load DUCM file:', error);
            throw error;
        }
    }

    /**
     * Load an example by ID
     */
    async loadExample(exampleId) {
        const example = this.examples.find(e => e.id === exampleId);
        if (!example) {
            throw new Error(`Example not found: ${exampleId}`);
        }
        return this.loadFile(example.path);
    }

    /**
     * Get current loaded file info
     */
    getCurrentFile() {
        return this.currentFile;
    }

    /**
     * Export current graph as DUCM v2 text
     */
    exportAsDUCM() {
        return serializer.serialize(graph);
    }

    /**
     * Download current graph as .ducm file
     */
    downloadAsDUCM(filename = 'diagram.ducm') {
        const text = this.exportAsDUCM();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
    }
}

export const fileLoader = new FileLoader();
