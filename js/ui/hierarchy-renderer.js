/**
 * Hierarchy Renderer - Generates HTML for the hierarchy tree view
 * 
 * Responsible for:
 * - Rendering path tree items
 * - Rendering component tree items
 * - Rendering node items
 */

import { graph } from '../core/graph.js';
import { NODE_TYPES, COMPONENT_TYPES } from '../core/node-types.js';

/**
 * Render the paths section of the hierarchy tree
 * @param {Array} pathTrees - Array of path tree structures
 * @param {Set} expandedGroups - Set of expanded group IDs
 * @returns {string} HTML string
 */
export function renderPathsSection(pathTrees, expandedGroups) {
    const pathsExpanded = expandedGroups.has('paths');

    let html = `
        <div class="tree-node">
            <div class="tree-item" data-group="paths">
                <span class="tree-toggle ${pathsExpanded ? 'expanded' : ''}">▶</span>
                <span class="tree-icon">⟶</span>
                <span class="tree-label">Paths (${pathTrees.length})</span>
            </div>
            <div class="tree-children ${pathsExpanded ? '' : 'collapsed'}">
    `;

    pathTrees.forEach(tree => {
        html += renderPathTreeItem(tree, expandedGroups);
    });

    html += `   </div>
        </div>`;

    return html;
}

/**
 * Render the components section of the hierarchy tree
 * @param {Array} components - Array of all components
 * @param {Set} expandedGroups - Set of expanded group IDs
 * @returns {string} HTML string
 */
export function renderComponentsSection(components, expandedGroups) {
    const isExpanded = expandedGroups.has('components');
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
        html += renderComponentItem(comp, expandedGroups);
    });

    html += `   </div>
        </div>`;

    return html;
}

/**
 * Render a path tree item (recursive)
 * @param {Object} item - Path tree item
 * @param {Set} expandedGroups - Set of expanded group IDs
 * @returns {string} HTML string
 */
export function renderPathTreeItem(item, expandedGroups) {
    // If it's a branch/root container
    if (item.startNode || item.type === 'branch') {
        const isExpanded = expandedGroups.has(item.id);
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

        item.children.forEach(child => {
            html += renderPathTreeItem(child, expandedGroups);
        });

        html += `</div></div>`;
        return html;
    }

    // If it's a leaf node reference
    if (item.type === 'node') {
        return renderNodeItem(item.node);
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

/**
 * Render a single node item
 * @param {Object} node - The node to render
 * @returns {string} HTML string
 */
export function renderNodeItem(node) {
    const typeInfo = NODE_TYPES[node.type];
    const parentComp = node.parentComponent ? graph.getComponent(node.parentComponent) : null;
    const pinnedInfo = parentComp
        ? `<span class="node-pinned" title="Pinned to ${parentComp.properties.name}">📌</span>`
        : '';

    return `
        <div class="tree-item" data-node-id="${node.id}">
            <span class="tree-toggle" style="visibility: hidden;">▶</span>
            <span class="tree-icon ${node.type}">${typeInfo?.icon || '•'}</span>
            <span class="tree-label">${node.properties.name || node.id}</span>
            ${pinnedInfo}
        </div>
    `;
}

/**
 * Render a single component item (recursive for nested components)
 * @param {Object} comp - The component to render
 * @param {Set} expandedGroups - Set of expanded group IDs
 * @returns {string} HTML string
 */
export function renderComponentItem(comp, expandedGroups) {
    const typeInfo = COMPONENT_TYPES[comp.type];
    const childNodes = [...comp.childNodes]
        .map(id => graph.getNode(id))
        .filter(Boolean);
    const childComps = comp.childComponents
        ? [...comp.childComponents].map(id => graph.getComponent(id)).filter(Boolean)
        : [];
    const hasChildren = childNodes.length > 0 || childComps.length > 0;
    const compExpanded = expandedGroups.has(`comp_${comp.id}`);

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
        childComps.forEach(childComp => html += renderComponentItem(childComp, expandedGroups));
        childNodes.forEach(node => html += renderNodeItem(node));
        html += `</div>`;
    }

    html += `</div>`;
    return html;
}
