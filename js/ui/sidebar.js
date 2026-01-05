/**
 * sidebar.js
 * Handles tab switching and sidebar state for the UCM Editor.
 */

class Sidebar {
    constructor() {
        this.activeTab = 'hierarchy';
    }

    init() {
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');

        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                this.setTab(tabId);
            });
        });

        console.log('Sidebar UI initialized');
    }

    setTab(tabId) {
        this.activeTab = tabId;

        // Update buttons
        this.tabBtns.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update contents
        this.tabContents.forEach(content => {
            if (content.id === `tab-${tabId}`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // Trigger event for tab change (useful for DSL editor refresh)
        const event = new CustomEvent('sidebar:tab-changed', { detail: { tabId } });
        document.dispatchEvent(event);
    }
}

export const sidebar = new Sidebar();
