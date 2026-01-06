/**
 * Notification Manager - Displays toast notifications to the user
 *
 * Provides visual feedback for errors, warnings, success, and info messages.
 * Notifications appear in the top-right corner with slide-in animation,
 * auto-dismiss after 5 seconds, and support stacking.
 */

class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.defaultDuration = 5000; // 5 seconds
    }

    /**
     * Initialize the notification manager by creating the container
     */
    init() {
        // Create container if it doesn't exist
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }
    }

    /**
     * Show a notification
     * @param {string} message - The message to display
     * @param {string} type - Type of notification: 'info' | 'success' | 'warning' | 'error'
     * @param {Object} options - Optional settings
     * @param {number} options.duration - Duration in ms before auto-dismiss (0 = no auto-dismiss)
     * @param {boolean} options.dismissible - Whether clicking dismisses (default: true)
     * @returns {HTMLElement} The notification element
     */
    show(message, type = 'info', options = {}) {
        // Ensure container exists
        if (!this.container) {
            this.init();
        }

        const {
            duration = this.defaultDuration,
            dismissible = true
        } = options;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        // Create icon based on type
        const icon = this.getIcon(type);

        // Create message element
        const messageEl = document.createElement('span');
        messageEl.className = 'notification-message';
        messageEl.textContent = message;

        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', 'Dismiss notification');

        // Assemble notification
        notification.appendChild(icon);
        notification.appendChild(messageEl);
        notification.appendChild(closeBtn);

        // Add to container (new notifications at top)
        this.container.insertBefore(notification, this.container.firstChild);
        this.notifications.push(notification);

        // Trigger reflow for animation
        notification.offsetHeight;
        notification.classList.add('notification-show');

        // Setup dismiss handlers
        const dismiss = () => this.dismiss(notification);

        if (dismissible) {
            notification.addEventListener('click', dismiss);
        }

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
        });

        // Auto-dismiss after duration
        if (duration > 0) {
            notification._timeout = setTimeout(dismiss, duration);
        }

        // Store reference for cleanup
        notification._dismiss = dismiss;

        return notification;
    }

    /**
     * Dismiss a specific notification
     * @param {HTMLElement} notification - The notification element to dismiss
     */
    dismiss(notification) {
        if (!notification || notification._dismissed) return;

        notification._dismissed = true;

        // Clear auto-dismiss timeout
        if (notification._timeout) {
            clearTimeout(notification._timeout);
        }

        // Animate out
        notification.classList.remove('notification-show');
        notification.classList.add('notification-hide');

        // Remove from DOM after animation
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }

            // Remove from tracking array
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 300); // Match CSS transition duration
    }

    /**
     * Dismiss all notifications
     */
    dismissAll() {
        [...this.notifications].forEach(n => this.dismiss(n));
    }

    /**
     * Get the icon SVG for a notification type
     * @param {string} type - The notification type
     * @returns {HTMLElement} The icon element
     */
    getIcon(type) {
        const iconWrapper = document.createElement('span');
        iconWrapper.className = 'notification-icon';

        const icons = {
            info: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>`,
            success: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>`,
            warning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>`,
            error: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>`
        };

        iconWrapper.innerHTML = icons[type] || icons.info;
        return iconWrapper;
    }

    /**
     * Convenience method for info notifications
     */
    info(message, options = {}) {
        return this.show(message, 'info', options);
    }

    /**
     * Convenience method for success notifications
     */
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }

    /**
     * Convenience method for warning notifications
     */
    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }

    /**
     * Convenience method for error notifications
     */
    error(message, options = {}) {
        return this.show(message, 'error', options);
    }
}

// Export singleton instance
export const notifications = new NotificationManager();
