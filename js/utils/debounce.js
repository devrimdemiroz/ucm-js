/**
 * Utility functions for rate-limiting execution
 */

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * 
 * @param {Function} func The function to debounce
 * @param {number} wait The number of milliseconds to delay
 * @returns {Function} The debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 * 
 * @param {Function} func The function to throttle
 * @param {number} wait The number of milliseconds to throttle to
 * @returns {Function} The throttled function
 */
export function throttle(func, wait) {
    let inThrottle, lastFn, lastTime;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            lastTime = Date.now();
            inThrottle = true;
        } else {
            clearTimeout(lastFn);
            lastFn = setTimeout(() => {
                if (Date.now() - lastTime >= wait) {
                    func.apply(this, args);
                    lastTime = Date.now();
                }
            }, Math.max(wait - (Date.now() - lastTime), 0));
        }
    };
}

/**
 * Wraps a function in requestAnimationFrame for smooth UI updates
 * @param {Function} func The function to wrap
 * @returns {Function} The raF-throttled function
 */
export function rafThrottle(func) {
    let ticking = false;
    return function (...args) {
        if (!ticking) {
            requestAnimationFrame(() => {
                func.apply(this, args);
                ticking = false;
            });
            ticking = true;
        }
    };
}
