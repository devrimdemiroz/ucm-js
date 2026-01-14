/**
 * Mobile Navigation - Bottom navigation and slide-up panels for mobile devices
 * Optimized for iOS Chrome, Safari, and Android browsers
 */

import { selection } from '../editor/selection.js';
import { settingsPanel } from './settings-panel.js';

class MobileNav {
    constructor() {
        this.nav = null;
        this.panel = null;
        this.backdrop = null;
        this.currentPanel = 'none';
        this.isOpen = false;
        this.isMobile = false;
    }

    init() {
        this.nav = document.getElementById('mobile-nav');
        this.panel = document.getElementById('mobile-panel');
        this.panelTitle = document.getElementById('mobile-panel-title');
        this.panelContent = document.getElementById('mobile-panel-content');
        this.backdrop = document.getElementById('mobile-backdrop');
        this.closeBtn = document.getElementById('mobile-panel-close');

        if (!this.nav) return;

        // Check if mobile
        this.checkMobile();
        window.addEventListener('resize', () => this.checkMobile());

        // Navigation button clicks
        this.nav.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleNavClick(e));
        });

        // Close panel
        this.closeBtn?.addEventListener('click', () => this.closePanel());
        this.backdrop?.addEventListener('click', () => this.closePanel());

        // Prevent scroll on panel content from propagating
        this.panelContent?.addEventListener('touchmove', (e) => {
            e.stopPropagation();
        }, { passive: true });

        // Handle touch gestures on panel (swipe down to close)
        this.setupSwipeToClose();
    }

    checkMobile() {
        this.isMobile = window.innerWidth <= 768;
    }

    handleNavClick(e) {
        const btn = e.currentTarget;
        const panelType = btn.dataset.panel;

        // Update active state
        this.nav.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (panelType === 'none') {
            this.closePanel();
            return;
        }

        if (this.currentPanel === panelType && this.isOpen) {
            this.closePanel();
        } else {
            this.openPanel(panelType);
        }
    }

    openPanel(type) {
        this.currentPanel = type;
        this.isOpen = true;

        // Set title and content
        const titles = {
            tools: 'Tools',
            hierarchy: 'Hierarchy',
            properties: 'Properties',
            settings: 'Settings'
        };
        this.panelTitle.textContent = titles[type] || 'Panel';

        // Populate content
        this.populatePanel(type);

        // Show panel
        this.panel.classList.add('open');
        this.backdrop.classList.add('visible');
    }

    closePanel() {
        this.isOpen = false;
        this.panel.classList.remove('open');
        this.backdrop.classList.remove('visible');

        // Set canvas button as active
        const canvasBtn = document.getElementById('mobile-btn-canvas');
        this.nav.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
        canvasBtn?.classList.add('active');
    }

    populatePanel(type) {
        switch (type) {
            case 'tools':
                this.populateToolsPanel();
                break;
            case 'hierarchy':
                this.populateHierarchyPanel();
                break;
            case 'properties':
                this.populatePropertiesPanel();
                break;
            case 'settings':
                this.populateSettingsPanel();
                break;
        }
    }

    populateToolsPanel() {
        this.panelContent.innerHTML = `
            <div class="mobile-tools-grid">
                <button class="mobile-tool-btn ${selection.currentTool === 'select' ? 'active' : ''}" data-tool="select">
                    <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M7,2l12,11.2l-5.8,0.5l3.3,7.3l-2.2,1l-3.2-7.4L7,18.5V2"/></svg>
                    <span>Select</span>
                </button>
                <button class="mobile-tool-btn ${selection.currentTool === 'path' ? 'active' : ''}" data-tool="path">
                    <svg viewBox="0 0 24 24" width="28" height="28">
                        <circle cx="4" cy="12" r="3" fill="currentColor"/>
                        <rect x="18" y="10" width="4" height="8" fill="currentColor"/>
                        <path stroke="currentColor" stroke-width="2" fill="none" d="M7,12 Q12,4 18,12"/>
                    </svg>
                    <span>Path</span>
                </button>
                <button class="mobile-tool-btn ${selection.currentTool === 'component' ? 'active' : ''}" data-tool="component">
                    <svg viewBox="0 0 24 24" width="28" height="28">
                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                        <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span>Component</span>
                </button>
                <button class="mobile-tool-btn" data-action="delete">
                    <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19M8,9H16V19H8V9M15.5,4L14.5,3H9.5L8.5,4H5V6H19V4H15.5Z"/></svg>
                    <span>Delete</span>
                </button>
                <button class="mobile-tool-btn" data-action="undo">
                    <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z"/></svg>
                    <span>Undo</span>
                </button>
                <button class="mobile-tool-btn" data-action="redo">
                    <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M10.5,8C13.15,8 15.55,9 17.4,10.6L21,7V16H12L15.62,12.38C14.23,11.22 12.46,10.5 10.5,10.5C6.96,10.5 3.95,12.81 2.9,16L0.53,15.22C1.92,11.03 5.85,8 10.5,8Z"/></svg>
                    <span>Redo</span>
                </button>
            </div>
        `;

        // Add tool button listeners
        this.panelContent.querySelectorAll('.mobile-tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                selection.setTool(btn.dataset.tool);
                this.updateToolsActive();
            });
        });

        // Add action button listeners
        this.panelContent.querySelectorAll('.mobile-tool-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                const { history } = await import('../core/history.js');
                
                switch (action) {
                    case 'delete':
                        selection.deleteSelected();
                        break;
                    case 'undo':
                        history.undo();
                        break;
                    case 'redo':
                        history.redo();
                        break;
                }
            });
        });

        // Add grid styles
        const style = document.createElement('style');
        style.textContent = `
            .mobile-tools-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
            }
            .mobile-tool-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 4px;
                padding: 16px 8px;
                background: var(--bg-secondary);
                border: 2px solid transparent;
                border-radius: 12px;
                color: var(--text-primary);
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                -webkit-tap-highlight-color: transparent;
            }
            .mobile-tool-btn.active {
                border-color: var(--selection-color);
                background: rgba(41, 182, 246, 0.1);
            }
            .mobile-tool-btn:active {
                transform: scale(0.95);
            }
        `;
        if (!document.getElementById('mobile-tools-style')) {
            style.id = 'mobile-tools-style';
            document.head.appendChild(style);
        }
    }

    updateToolsActive() {
        this.panelContent.querySelectorAll('.mobile-tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === selection.currentTool);
        });
    }

    populateHierarchyPanel() {
        // Clone the hierarchy content from desktop panel
        const desktopHierarchy = document.getElementById('hierarchy-tree');
        if (desktopHierarchy) {
            this.panelContent.innerHTML = desktopHierarchy.outerHTML;
        } else {
            this.panelContent.innerHTML = '<p style="color: var(--text-muted);">No diagram loaded</p>';
        }
    }

    populatePropertiesPanel() {
        // Clone the properties content from desktop panel
        const desktopProps = document.getElementById('properties-content');
        if (desktopProps) {
            this.panelContent.innerHTML = desktopProps.innerHTML;
        } else {
            this.panelContent.innerHTML = '<p style="color: var(--text-muted);">Select an element</p>';
        }
    }

    populateSettingsPanel() {
        const settings = settingsPanel.getSettings();
        this.panelContent.innerHTML = `
            <div class="mobile-settings-list">
                <div class="mobile-setting-item">
                    <span>Transit Mode</span>
                    <label class="switch">
                        <input type="checkbox" id="mobile-transit-mode" ${settings.transitMode ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="mobile-setting-item">
                    <span>Show Grid</span>
                    <label class="switch">
                        <input type="checkbox" id="mobile-show-grid" ${settings.showGrid ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="mobile-setting-item">
                    <span>Show Labels</span>
                    <label class="switch">
                        <input type="checkbox" id="mobile-show-labels" ${settings.showLabels ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="mobile-setting-item">
                    <span>Show Auto Waypoints</span>
                    <label class="switch">
                        <input type="checkbox" id="mobile-show-auto-wp" ${settings.showAutoWaypoints ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="mobile-setting-item">
                    <span>Edge Routing</span>
                    <select id="mobile-routing-mode" class="setting-select">
                        <option value="octilinear" ${settings.routingMode === 'octilinear' ? 'selected' : ''}>Metro</option>
                        <option value="orthogonal" ${settings.routingMode === 'orthogonal' ? 'selected' : ''}>Orthogonal</option>
                        <option value="freeform" ${settings.routingMode === 'freeform' ? 'selected' : ''}>Freeform</option>
                    </select>
                </div>
            </div>
        `;

        // Add settings styles
        const style = document.createElement('style');
        style.textContent = `
            .mobile-settings-list {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .mobile-setting-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid var(--border-light);
            }
            .mobile-setting-item:last-child {
                border-bottom: none;
            }
            .mobile-setting-item span {
                font-size: 14px;
            }
            .mobile-setting-item .setting-select {
                min-width: 120px;
            }
        `;
        if (!document.getElementById('mobile-settings-style')) {
            style.id = 'mobile-settings-style';
            document.head.appendChild(style);
        }

        // Add event listeners
        document.getElementById('mobile-transit-mode')?.addEventListener('change', (e) => {
            settingsPanel.setTransitMode(e.target.checked);
        });
        document.getElementById('mobile-show-grid')?.addEventListener('change', (e) => {
            settingsPanel.setGridVisibility(e.target.checked);
        });
        document.getElementById('mobile-show-labels')?.addEventListener('change', (e) => {
            settingsPanel.setLabelVisibility(e.target.checked);
        });
        document.getElementById('mobile-show-auto-wp')?.addEventListener('change', (e) => {
            settingsPanel.setShowAutoWaypoints(e.target.checked);
        });
        document.getElementById('mobile-routing-mode')?.addEventListener('change', (e) => {
            settingsPanel.setRoutingMode(e.target.value);
        });
    }

    setupSwipeToClose() {
        if (!this.panel) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        const header = this.panel.querySelector('.mobile-panel-header');
        if (!header) return;

        header.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
        }, { passive: true });

        header.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            
            // Only allow dragging down
            if (diff > 0) {
                this.panel.style.transform = `translateY(${diff}px)`;
            }
        }, { passive: true });

        header.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            
            const diff = currentY - startY;
            
            // If dragged more than 80px, close the panel
            if (diff > 80) {
                this.closePanel();
            }
            
            // Reset transform
            this.panel.style.transform = '';
        });
    }
}

export const mobileNav = new MobileNav();
