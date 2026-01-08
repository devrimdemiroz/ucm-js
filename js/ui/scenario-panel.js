/**
 * Scenario Panel - UI for managing and visualizing scenario path traversals
 *
 * Based on jUCMNav's scenario management:
 * - List and manage scenario definitions
 * - Execute scenarios to highlight paths
 * - View traversal results
 */

import { graph } from '../core/graph.js';
import { scenarioManager } from '../core/scenario.js';
import { selection } from '../editor/selection.js';
import { renderer } from '../editor/canvas-renderer.js';
import { notifications } from './notifications.js';

class ScenarioPanel {
    constructor() {
        this.container = null;
        this.isInitialized = false;
    }

    init() {
        this.container = document.getElementById('scenario-content');
        if (!this.container) {
            // Create scenario tab if it doesn't exist
            this.createScenarioTab();
        }

        this.subscribeToEvents();
        this.render();
        this.isInitialized = true;
    }

    createScenarioTab() {
        // Find the sidebar tabs container
        const tabsContainer = document.querySelector('.sidebar-tabs');
        const contentContainer = document.querySelector('.sidebar-content') || document.querySelector('#left-panel');

        if (!tabsContainer || !contentContainer) return;

        // Check if scenario tab already exists
        if (document.querySelector('[data-tab="scenario"]')) {
            this.container = document.getElementById('scenario-content');
            return;
        }

        // Add scenario tab button
        const tabButton = document.createElement('button');
        tabButton.className = 'tab-btn';
        tabButton.setAttribute('data-tab', 'scenario');
        tabButton.setAttribute('title', 'Scenarios');
        tabButton.innerHTML = '▶'; // Play icon for scenarios
        tabsContainer.appendChild(tabButton);

        // Add scenario content panel
        const contentPanel = document.createElement('div');
        contentPanel.id = 'scenario-content';
        contentPanel.className = 'tab-content';
        contentPanel.style.display = 'none';
        contentContainer.appendChild(contentPanel);

        this.container = contentPanel;

        // Wire up tab switching
        tabButton.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            tabButton.classList.add('active');
            contentPanel.style.display = 'block';
            this.render();
        });
    }

    subscribeToEvents() {
        // Re-render when scenarios change
        scenarioManager.on('scenario:created', () => this.render());
        scenarioManager.on('scenario:updated', () => this.render());
        scenarioManager.on('scenario:deleted', () => this.render());
        scenarioManager.on('scenario:traversed', ({ scenario }) => {
            this.render();
            this.updateHighlighting();
        });
        scenarioManager.on('scenario:activated', () => this.updateHighlighting());
        scenarioManager.on('scenario:cleared', () => {
            renderer.clearScenarioHighlight();
            this.render();
        });
        scenarioManager.on('scenarios:loaded', () => this.render());

        // Update highlighting when graph changes
        graph.on('node:updated', () => this.updateHighlightingIfActive());
        graph.on('edge:updated', () => this.updateHighlightingIfActive());
    }

    updateHighlightingIfActive() {
        if (scenarioManager.activeScenario) {
            this.updateHighlighting();
        }
    }

    updateHighlighting() {
        const pathData = scenarioManager.getHighlightedPath();
        if (pathData) {
            renderer.highlightScenarioPath(pathData);
        } else {
            renderer.clearScenarioHighlight();
        }
    }

    render() {
        if (!this.container) return;

        const scenarios = scenarioManager.getAllScenarios();
        const activeId = scenarioManager.activeScenario;

        let html = `
            <div class="scenario-panel">
                <div class="panel-header">
                    <h3>Scenarios</h3>
                    <div class="panel-actions">
                        <button class="btn-icon" id="btn-add-scenario" title="Create scenario from selected start">+</button>
                        <button class="btn-icon" id="btn-clear-highlight" title="Clear highlighting">✕</button>
                    </div>
                </div>

                <div class="scenario-list">
        `;

        if (scenarios.length === 0) {
            html += `
                <div class="empty-state">
                    <p>No scenarios defined</p>
                    <p class="hint">Select a start node and click + to create a scenario</p>
                </div>
            `;
        } else {
            scenarios.forEach(scenario => {
                const isActive = scenario.id === activeId;
                const statusIcon = scenario.traversed
                    ? (scenario.errors.length > 0 ? '⚠️' : '✓')
                    : '○';
                const statusClass = scenario.traversed
                    ? (scenario.errors.length > 0 ? 'warning' : 'success')
                    : '';

                html += `
                    <div class="scenario-item ${isActive ? 'active' : ''}" data-scenario-id="${scenario.id}">
                        <div class="scenario-header">
                            <span class="scenario-status ${statusClass}">${statusIcon}</span>
                            <span class="scenario-name">${this.escapeHtml(scenario.name)}</span>
                            <div class="scenario-color" style="background: ${scenario.highlightColor}"></div>
                        </div>
                        <div class="scenario-actions">
                            <button class="btn-small btn-run" data-action="run" title="Run scenario">▶</button>
                            <button class="btn-small btn-edit" data-action="edit" title="Edit">✎</button>
                            <button class="btn-small btn-delete" data-action="delete" title="Delete">🗑</button>
                        </div>
                        ${scenario.traversed ? this.renderTraversalInfo(scenario) : ''}
                    </div>
                `;
            });
        }

        html += `
                </div>

                <div class="scenario-info">
                    <p class="hint">Tip: Scenarios highlight paths through your UCM diagram, showing the traversal from start to end.</p>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.attachEventListeners();
    }

    renderTraversalInfo(scenario) {
        const nodeCount = scenario.traversedNodes.length;
        const edgeCount = scenario.traversedEdges.length;
        const endCount = scenario.reachedEndNodes.length;

        let info = `<div class="traversal-info">`;
        info += `<span>${nodeCount} nodes, ${edgeCount} edges</span>`;

        if (endCount > 0) {
            info += `<span class="success">Reached ${endCount} end${endCount > 1 ? 's' : ''}</span>`;
        }

        if (scenario.errors.length > 0) {
            info += `<div class="traversal-errors">`;
            scenario.errors.forEach(err => {
                info += `<span class="error">⚠ ${this.escapeHtml(err)}</span>`;
            });
            info += `</div>`;
        }

        info += `</div>`;
        return info;
    }

    attachEventListeners() {
        // Add scenario button
        const addBtn = this.container.querySelector('#btn-add-scenario');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.createScenarioFromSelection());
        }

        // Clear highlight button
        const clearBtn = this.container.querySelector('#btn-clear-highlight');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                scenarioManager.clearHighlighting();
            });
        }

        // Scenario item actions
        this.container.querySelectorAll('.scenario-item').forEach(item => {
            const scenarioId = item.dataset.scenarioId;

            // Click to activate
            item.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    scenarioManager.setActiveScenario(scenarioId);
                    const scenario = scenarioManager.getScenario(scenarioId);
                    if (scenario && scenario.traversed) {
                        this.updateHighlighting();
                    }
                    this.render();
                }
            });

            // Run button
            item.querySelector('[data-action="run"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.runScenario(scenarioId);
            });

            // Edit button
            item.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editScenario(scenarioId);
            });

            // Delete button
            item.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteScenario(scenarioId);
            });
        });
    }

    createScenarioFromSelection() {
        // Check if a start node is selected
        const selectedNodes = [...selection.selectedNodes];
        if (selectedNodes.length === 0) {
            notifications.show('Select a start node first', 'warning');
            return;
        }

        // Find start nodes in selection
        const startNodes = selectedNodes
            .map(id => graph.getNode(id))
            .filter(n => n && n.type === 'start');

        if (startNodes.length === 0) {
            // If no start selected, try to find all start nodes
            const allStarts = graph.getAllNodes().filter(n => n.type === 'start');
            if (allStarts.length === 1) {
                const scenario = scenarioManager.createFromStartNode(allStarts[0].id);
                if (scenario) {
                    notifications.show(`Created scenario: ${scenario.name}`, 'success');
                    this.render();
                }
            } else if (allStarts.length > 1) {
                notifications.show('Multiple start nodes found. Select one to create a scenario.', 'info');
            } else {
                notifications.show('No start nodes in diagram', 'warning');
            }
            return;
        }

        // Create scenario from first selected start
        const scenario = scenarioManager.createFromStartNode(startNodes[0].id);
        if (scenario) {
            notifications.show(`Created scenario: ${scenario.name}`, 'success');
            this.render();
        }
    }

    runScenario(scenarioId) {
        const result = scenarioManager.executeScenario(scenarioId);

        if (result.success) {
            notifications.show('Scenario completed successfully', 'success');
        } else if (result.error) {
            notifications.show(`Scenario error: ${result.error}`, 'error');
        } else {
            notifications.show('Scenario traversed with warnings', 'warning');
        }
    }

    editScenario(scenarioId) {
        const scenario = scenarioManager.getScenario(scenarioId);
        if (!scenario) return;

        // Simple prompt-based editing (could be enhanced with modal)
        const newName = prompt('Scenario name:', scenario.name);
        if (newName && newName !== scenario.name) {
            scenarioManager.updateScenario(scenarioId, { name: newName });
        }

        // Color picker
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9'];
        const currentIdx = colors.indexOf(scenario.highlightColor);
        const nextColor = colors[(currentIdx + 1) % colors.length];

        if (confirm(`Change highlight color to ${nextColor}?`)) {
            scenarioManager.updateScenario(scenarioId, { highlightColor: nextColor });
            if (scenarioManager.activeScenario === scenarioId) {
                this.updateHighlighting();
            }
        }
    }

    deleteScenario(scenarioId) {
        const scenario = scenarioManager.getScenario(scenarioId);
        if (!scenario) return;

        if (confirm(`Delete scenario "${scenario.name}"?`)) {
            scenarioManager.deleteScenario(scenarioId);
            notifications.show('Scenario deleted', 'info');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

export const scenarioPanel = new ScenarioPanel();
