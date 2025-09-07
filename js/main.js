/* ===== MAIN APPLICATION ===== */

import { debounce, throttle, lazyLoadImages, isInViewport, performance as perfUtils } from './utils.js';
import SearchManager from './search.js';
import { ModalManager, ScriptModal } from './modal.js';

class ProtocolApp {
    constructor() {
        this.init();
    }
    
    init() {
        // Performance tracking
        perfUtils.mark('app-init-start');
        
        this.setupServiceWorker();
        this.initializeComponents();
        this.bindGlobalEvents();
        this.setupScrollBehavior();
        this.setupFilters();
        this.optimizeImages();
        
        // Mark app as ready
        document.body.classList.add('app-ready');
        perfUtils.mark('app-init-end');
        perfUtils.measure('app-init-duration', 'app-init-start', 'app-init-end');
        
        console.log('ProtocolApp initialized successfully');
    }
    
    setupServiceWorker() {
        if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        }
    }
    
    initializeComponents() {
        // Initialize modal manager
        this.modalManager = new ModalManager();
        
        // Initialize search if elements exist
        if (document.getElementById('searchInput') && document.getElementById('cardsGrid')) {
            this.searchManager = new SearchManager('searchInput', 'cardsGrid');
        }
        
        // Initialize script modal
        this.scriptModal = new ScriptModal();
        
        // Make available globally
        window.app = this;
    }
    
    bindGlobalEvents() {
        // Handle theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', this.handleThemeChange.bind(this));
            this.handleThemeChange(mediaQuery);
        }
        
        // Handle connection changes
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', this.handleConnectionChange.bind(this));
            this.handleConnectionChange();
        }
        
        // Handle visibility changes (tab switching)
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        // Global error handling
        window.addEventListener('error', this.handleError.bind(this));
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
        
        // Performance observer
        if ('PerformanceObserver' in window) {
            this.setupPerformanceObserver();
        }
    }
    
    setupScrollBehavior() {
        const fabButton = document.getElementById('scrollTop') || document.querySelector('.fab');
        if (!fabButton) return;
        
        const throttledScrollHandler = throttle(() => {
            const shouldShow = window.pageYOffset > 300;
            fabButton.classList.toggle('show', shouldShow);
            
            // Update progress indicator if exists
            const progressBar = document.querySelector('.scroll-progress');
            if (progressBar) {
                const scrollPercentage = (window.pageYOffset / (document.body.scrollHeight - window.innerHeight)) * 100;
                progressBar.style.width = `${Math.min(scrollPercentage, 100)}%`;
            }
        }, 16); // ~60fps
        
        window.addEventListener('scroll', throttledScrollHandler);
        
        // Smooth scroll to top
        fabButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.scrollToTop();
        });
    }
    
    scrollToTop() {
        const start = window.pageYOffset;
        const startTime = performance.now();
        const duration = 800; // ms
        
        const easeInOutCubic = (t) => {
            return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        };
        
        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = easeInOutCubic(progress);
            
            window.scrollTo(0, start * (1 - ease));
            
            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            }
        };
        
        requestAnimationFrame(animateScroll);
    }
    
    setupFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        if (filterButtons.length === 0) return;
        
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleFilterClick(button);
            });
        });
    }
    
    handleFilterClick(clickedButton) {
        const category = clickedButton.dataset.category || 'all';
        const cards = document.querySelectorAll('[data-category]');
        
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        
        clickedButton.classList.add('active');
        clickedButton.setAttribute('aria-pressed', 'true');
        
        // Filter cards with animation
        cards.forEach((card, index) => {
            const shouldShow = category === 'all' || card.dataset.category === category;
            
            if (shouldShow) {
                setTimeout(() => {
                    card.style.display = '';
                    card.classList.add('filter-show');
                    card.setAttribute('aria-hidden', 'false');
                }, index * 50); // Stagger animation
            } else {
                card.style.display = 'none';
                card.classList.remove('filter-show');
                card.setAttribute('aria-hidden', 'true');
            }
        });
        
        // Update results count
        const visibleCount = document.querySelectorAll(`[data-category="${category}"], [data-category]`).length;
        const statusEl = document.getElementById('filter-status');
        if (statusEl) {
            const categoryName = clickedButton.textContent.trim();
            statusEl.textContent = category === 'all' 
                ? `Mostrando todos los protocolos (${cards.length})` 
                : `Mostrando ${visibleCount} protocolos de ${categoryName}`;
        }
        
        // Analytics
        if (window.gtag) {
            window.gtag('event', 'filter_select', {
                filter_category: category,
                results_count: visibleCount
            });
        }
    }
    
    optimizeImages() {
        // Lazy load images
        lazyLoadImages('img[data-src]');
        
        // Add loading attribute to regular images
        document.querySelectorAll('img:not([loading])').forEach(img => {
            img.setAttribute('loading', 'lazy');
        });
        
        // WebP support detection
        this.detectWebPSupport().then(supportsWebP => {
            if (supportsWebP) {
                document.body.classList.add('webp-support');
            }
        });
    }
    
    async detectWebPSupport() {
        return new Promise(resolve => {
            const webP = new Image();
            webP.onload = webP.onerror = () => {
                resolve(webP.height === 2);
            };
            webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });
    }
    
    handleThemeChange(e) {
        const isDark = e.matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        
        // Update theme color for mobile browsers
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
            themeColorMeta.content = isDark ? '#2c3e50' : '#e74c3c';
        }
    }
    
    handleConnectionChange() {
        const connection = navigator.connection;
        const isSlowConnection = connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g';
        
        document.body.classList.toggle('slow-connection', isSlowConnection);
        
        if (isSlowConnection) {
            // Disable animations on slow connections
            document.body.classList.add('reduce-motion');
        }
    }
    
    handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            // App is hidden, pause any intensive operations
            this.pauseAnimations();
        } else {
            // App is visible again
            this.resumeAnimations();
        }
    }
    
    pauseAnimations() {
        document.body.classList.add('animations-paused');
    }
    
    resumeAnimations() {
        document.body.classList.remove('animations-paused');
    }
    
    handleError(event) {
        console.error('Global error:', event.error);
        
        // Send to analytics if available
        if (window.gtag) {
            window.gtag('event', 'exception', {
                description: event.error.message,
                fatal: false
            });
        }
    }
    
    handleUnhandledRejection(event) {
        console.error('Unhandled promise rejection:', event.reason);
        
        // Send to analytics if available
        if (window.gtag) {
            window.gtag('event', 'exception', {
                description: 'Unhandled Promise Rejection: ' + event.reason,
                fatal: false
            });
        }
    }
    
    setupPerformanceObserver() {
        try {
            // Largest Contentful Paint
            const lcpObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (window.gtag) {
                        window.gtag('event', 'timing_complete', {
                            name: 'LCP',
                            value: Math.round(entry.startTime)
                        });
                    }
                }
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            
            // First Input Delay
            const fidObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (window.gtag) {
                        window.gtag('event', 'timing_complete', {
                            name: 'FID',
                            value: Math.round(entry.processingStart - entry.startTime)
                        });
                    }
                }
            });
            fidObserver.observe({ entryTypes: ['first-input'] });
            
        } catch (error) {
            console.warn('Performance observer not supported:', error);
        }
    }
    
    // Public API methods
    refreshSearch() {
        if (this.searchManager) {
            this.searchManager.updateItems();
        }
    }
    
    openModal(modalId) {
        return this.modalManager.openModal(modalId);
    }
    
    closeModal() {
        return this.modalManager.closeModal();
    }
    
    filterByCategory(category) {
        const filterButton = document.querySelector(`[data-category="${category}"]`);
        if (filterButton) {
            this.handleFilterClick(filterButton);
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.protocolApp = new ProtocolApp();
    });
} else {
    window.protocolApp = new ProtocolApp();
}

// Legacy function support for existing HTML
window.openScriptModal = () => window.protocolApp?.openModal('scriptModal');
window.closeScriptModal = () => window.protocolApp?.closeModal();
window.filterCategory = (category) => window.protocolApp?.filterByCategory(category);
window.scrollToTop = () => window.protocolApp?.scrollToTop();

export default ProtocolApp;