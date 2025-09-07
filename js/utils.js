/* ===== UTILITIES ===== */

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately
 * @returns {Function} Debounced function
 */
export function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

/**
 * Throttle function to limit function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Animate element with CSS classes
 * @param {Element} element - DOM element
 * @param {string} animation - CSS animation class
 * @param {Function} callback - Optional callback function
 */
export function animateCSS(element, animation, callback = null) {
    const animationName = `animate__${animation}`;
    element.classList.add('animate__animated', animationName);
    
    function handleAnimationEnd(event) {
        event.stopPropagation();
        element.classList.remove('animate__animated', animationName);
        if (callback) callback();
    }
    
    element.addEventListener('animationend', handleAnimationEnd, {once: true});
}

/**
 * Check if element is in viewport
 * @param {Element} element - DOM element to check
 * @returns {boolean} Is element in viewport
 */
export function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * Lazy load images
 * @param {string} selector - CSS selector for images
 */
export function lazyLoadImages(selector = 'img[data-src]') {
    const images = document.querySelectorAll(selector);
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => {
        img.classList.add('lazy');
        imageObserver.observe(img);
    });
}

/**
 * Copy text to clipboard with fallback
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
    try {
        // Modern API
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        const success = document.execCommand('copy');
        textarea.remove();
        return success;
    } catch (error) {
        console.error('Failed to copy text: ', error);
        return false;
    }
}

/**
 * Show toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type (success, error, info, warning)
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    toastContainer.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Create toast container if it doesn't exist
 * @returns {Element} Toast container
 */
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
    return container;
}

/**
 * Format number with locale
 * @param {number} number - Number to format
 * @param {string} locale - Locale string
 * @returns {string} Formatted number
 */
export function formatNumber(number, locale = 'es-CL') {
    return new Intl.NumberFormat(locale).format(number);
}

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @param {string} locale - Locale string
 * @returns {string} Formatted currency
 */
export function formatCurrency(amount, currency = 'CLP', locale = 'es-CL') {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0
    }).format(amount);
}

/**
 * Get preferred color scheme
 * @returns {string} 'dark' or 'light'
 */
export function getColorScheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

/**
 * Performance monitoring
 */
export const performance = {
    /**
     * Mark performance point
     * @param {string} name - Mark name
     */
    mark(name) {
        if (window.performance && window.performance.mark) {
            window.performance.mark(name);
        }
    },
    
    /**
     * Measure performance between marks
     * @param {string} name - Measure name
     * @param {string} startMark - Start mark name
     * @param {string} endMark - End mark name
     */
    measure(name, startMark, endMark) {
        if (window.performance && window.performance.measure) {
            window.performance.measure(name, startMark, endMark);
        }
    },
    
    /**
     * Get performance entries
     * @param {string} type - Entry type
     * @returns {Array} Performance entries
     */
    getEntries(type = null) {
        if (window.performance && window.performance.getEntriesByType) {
            return type ? window.performance.getEntriesByType(type) : window.performance.getEntries();
        }
        return [];
    }
};