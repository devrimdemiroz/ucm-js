/**
 * Tooltip - Custom premium tooltip system
 */

export class Tooltip {
    constructor() {
        this.el = null;
        this.activeTrigger = null;
        this.init();
    }

    init() {
        // Create tooltip element
        this.el = document.createElement('div');
        this.el.className = 'custom-tooltip';
        document.body.appendChild(this.el);

        // Proactively convert all titles to data-tooltips to avoid browser defaults
        this.convertAllTitles();

        // Global event listeners
        document.addEventListener('mouseover', this.handleMouseOver.bind(this));
        document.addEventListener('mouseout', this.handleMouseOut.bind(this));

        // Also watch for DOM changes (for dynamic elements)
        const observer = new MutationObserver(() => this.convertAllTitles());
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] });
    }

    convertAllTitles() {
        const elementsWithTitle = document.querySelectorAll('[title]');
        elementsWithTitle.forEach(el => {
            const title = el.getAttribute('title');
            if (title) {
                el.setAttribute('data-tooltip', title);
                el.removeAttribute('title');
            }
        });
    }

    handleMouseOver(e) {
        const trigger = e.target.closest('[data-tooltip]');
        if (!trigger || trigger === this.activeTrigger) return;

        this.show(trigger);
    }

    handleMouseOut(e) {
        if (!this.activeTrigger) return;

        // Check if we are still within the same trigger
        const trigger = e.target.closest('[data-tooltip]');
        if (trigger === this.activeTrigger) {
            // Check relatedTarget to see where we moved
            if (!this.activeTrigger.contains(e.relatedTarget)) {
                this.hide();
            }
        } else {
            this.hide();
        }
    }

    show(trigger) {
        this.activeTrigger = trigger;

        const text = trigger.getAttribute('data-tooltip');
        if (!text) return;

        // Parse shortcuts e.g. "Undo (Ctrl+Z)"
        const shortcutMatch = text.match(/\(([^)]+)\)$/);
        let content = text;
        if (shortcutMatch) {
            // Clean up the label part
            const label = text.substring(0, text.lastIndexOf(shortcutMatch[0])).trim();
            const shortcut = shortcutMatch[1];
            content = `${label}<span class="shortcut">${shortcut}</span>`;
        }

        this.el.innerHTML = content;

        // Position first, then show to prevent flickering
        this.position();
        this.el.classList.add('visible');
    }

    hide() {
        if (!this.el) return;
        this.el.classList.remove('visible');
        this.activeTrigger = null;
    }

    position() {
        if (!this.activeTrigger || !this.el) return;

        const rect = this.activeTrigger.getBoundingClientRect();

        // Temporary show to get dimensions
        this.el.style.visibility = 'hidden';
        this.el.style.display = 'block';
        const tooltipRect = this.el.getBoundingClientRect();
        this.el.style.display = '';
        this.el.style.visibility = '';

        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.bottom + 8;

        // Boundary checks
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        // If too low, show above
        if (top + tooltipRect.height > window.innerHeight - 10) {
            top = rect.top - tooltipRect.height - 8;
        }

        this.el.style.left = `${Math.round(left)}px`;
        this.el.style.top = `${Math.round(top)}px`;
    }
}

export const tooltip = new Tooltip();
