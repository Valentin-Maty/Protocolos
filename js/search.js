/* ===== SEARCH FUNCTIONALITY ===== */

import { debounce, showToast } from './utils.js';

class SearchManager {
    constructor(searchInputId, resultsContainerId, options = {}) {
        this.searchInput = document.getElementById(searchInputId);
        this.resultsContainer = document.getElementById(resultsContainerId);
        this.options = {
            debounceTime: 300,
            minLength: 1,
            caseSensitive: false,
            highlightMatches: true,
            showResultsCount: true,
            noResultsMessage: 'No se encontraron resultados',
            ...options
        };
        
        this.items = [];
        this.filteredItems = [];
        this.currentQuery = '';
        
        this.init();
    }
    
    init() {
        if (!this.searchInput || !this.resultsContainer) {
            console.warn('Search elements not found');
            return;
        }
        
        this.collectItems();
        this.bindEvents();
        this.createSearchStatus();
    }
    
    collectItems() {
        const items = this.resultsContainer.querySelectorAll('[data-searchable]');
        this.items = Array.from(items).map(item => ({
            element: item,
            text: this.extractSearchText(item),
            category: item.dataset.category || '',
            keywords: item.dataset.keywords || ''
        }));
        
        console.log(`Search initialized with ${this.items.length} items`);
    }
    
    extractSearchText(element) {
        const title = element.querySelector('.card-title, .step-title, h1, h2, h3')?.textContent || '';
        const description = element.querySelector('.card-description, .step-content, p')?.textContent || '';
        const category = element.dataset.category || '';
        const keywords = element.dataset.keywords || '';
        
        return `${title} ${description} ${category} ${keywords}`.toLowerCase().trim();
    }
    
    bindEvents() {
        const debouncedSearch = debounce(this.handleSearch.bind(this), this.options.debounceTime);
        
        this.searchInput.addEventListener('input', debouncedSearch);
        this.searchInput.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // Clear search button
        const clearButton = this.searchInput.parentNode.querySelector('.search-clear');
        if (clearButton) {
            clearButton.addEventListener('click', this.clearSearch.bind(this));
        }
        
        // Search on focus if there's existing text
        this.searchInput.addEventListener('focus', () => {
            if (this.searchInput.value.length >= this.options.minLength) {
                this.handleSearch();
            }
        });
    }
    
    handleSearch() {
        const query = this.searchInput.value.trim();
        
        if (query.length < this.options.minLength) {
            this.showAllItems();
            this.updateSearchStatus(this.items.length, query);
            return;
        }
        
        this.currentQuery = query;
        this.filteredItems = this.filterItems(query);
        this.renderResults();
        this.updateSearchStatus(this.filteredItems.length, query);
        
        // Analytics
        if (window.gtag) {
            window.gtag('event', 'search', {
                search_term: query,
                results_count: this.filteredItems.length
            });
        }
    }
    
    filterItems(query) {
        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
        
        return this.items.filter(item => {
            const text = this.options.caseSensitive ? item.text : item.text.toLowerCase();
            
            // All search terms must be present
            return searchTerms.every(term => {
                return text.includes(term) || 
                       item.category.toLowerCase().includes(term) ||
                       item.keywords.toLowerCase().includes(term);
            });
        });
    }
    
    renderResults() {
        // Hide all items first
        this.items.forEach(item => {
            item.element.style.display = 'none';
            item.element.setAttribute('aria-hidden', 'true');
        });
        
        // Show filtered items
        if (this.filteredItems.length === 0) {
            this.showNoResults();
        } else {
            this.hideNoResults();
            this.filteredItems.forEach(item => {
                item.element.style.display = '';
                item.element.setAttribute('aria-hidden', 'false');
                
                if (this.options.highlightMatches) {
                    this.highlightMatches(item.element, this.currentQuery);
                }
            });
        }
        
        // Smooth scroll to top of results
        this.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    highlightMatches(element, query) {
        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
        const textElements = element.querySelectorAll('.card-title, .card-description, .step-title');
        
        textElements.forEach(textEl => {
            let html = textEl.innerHTML;
            
            // Remove existing highlights
            html = html.replace(/<mark class="search-highlight">(.*?)<\/mark>/gi, '$1');
            
            searchTerms.forEach(term => {
                const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
                html = html.replace(regex, '<mark class="search-highlight">$1</mark>');
            });
            
            textEl.innerHTML = html;
        });
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    showAllItems() {
        this.items.forEach(item => {
            item.element.style.display = '';
            item.element.setAttribute('aria-hidden', 'false');
            this.removeHighlights(item.element);
        });
        this.hideNoResults();
    }
    
    removeHighlights(element) {
        const highlights = element.querySelectorAll('.search-highlight');
        highlights.forEach(highlight => {
            highlight.outerHTML = highlight.innerHTML;
        });
    }
    
    showNoResults() {
        let noResultsEl = this.resultsContainer.querySelector('.no-results');
        
        if (!noResultsEl) {
            noResultsEl = document.createElement('div');
            noResultsEl.className = 'no-results';
            noResultsEl.innerHTML = `
                <div class="no-results-content">
                    <div class="no-results-icon">🔍</div>
                    <h3>No se encontraron resultados</h3>
                    <p>Intenta con diferentes palabras clave o revisa la ortografía.</p>
                    <button class="btn btn-primary" onclick="document.getElementById('${this.searchInput.id}').value=''; document.getElementById('${this.searchInput.id}').focus(); this.closest('.search-manager').dispatchEvent(new Event('clearSearch'))">
                        Limpiar búsqueda
                    </button>
                </div>
            `;
            this.resultsContainer.appendChild(noResultsEl);
        }
        
        noResultsEl.style.display = 'block';
        noResultsEl.setAttribute('aria-live', 'polite');
    }
    
    hideNoResults() {
        const noResultsEl = this.resultsContainer.querySelector('.no-results');
        if (noResultsEl) {
            noResultsEl.style.display = 'none';
        }
    }
    
    createSearchStatus() {
        if (!this.options.showResultsCount) return;
        
        let statusEl = document.getElementById('search-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'search-status';
            statusEl.className = 'search-status';
            statusEl.setAttribute('aria-live', 'polite');
            statusEl.setAttribute('aria-atomic', 'true');
            
            // Insert after search input
            this.searchInput.parentNode.insertAdjacentElement('afterend', statusEl);
        }
    }
    
    updateSearchStatus(count, query) {
        const statusEl = document.getElementById('search-status');
        if (!statusEl) return;
        
        if (!query) {
            statusEl.textContent = `Mostrando ${count} protocolos`;
        } else if (count === 0) {
            statusEl.textContent = `Sin resultados para "${query}"`;
        } else {
            statusEl.textContent = `${count} resultado${count !== 1 ? 's' : ''} para "${query}"`;
        }
        
        statusEl.className = `search-status ${count === 0 ? 'no-results' : ''}`;
    }
    
    handleKeydown(event) {
        switch (event.key) {
            case 'Escape':
                this.clearSearch();
                break;
            case 'Enter':
                event.preventDefault();
                if (this.filteredItems.length === 1) {
                    // Auto-select single result
                    const firstResult = this.filteredItems[0].element.querySelector('a, button');
                    if (firstResult) {
                        firstResult.click();
                    }
                }
                break;
        }
    }
    
    clearSearch() {
        this.searchInput.value = '';
        this.currentQuery = '';
        this.showAllItems();
        this.updateSearchStatus(this.items.length, '');
        this.searchInput.focus();
        
        showToast('Búsqueda limpiada', 'info', 1500);
    }
    
    // Public API
    updateItems() {
        this.collectItems();
        if (this.currentQuery) {
            this.handleSearch();
        }
    }
    
    setQuery(query) {
        this.searchInput.value = query;
        this.handleSearch();
    }
    
    getResults() {
        return this.filteredItems;
    }
}

// Initialize search when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Main search functionality
    if (document.getElementById('searchInput') && document.getElementById('cardsGrid')) {
        window.searchManager = new SearchManager('searchInput', 'cardsGrid', {
            highlightMatches: true,
            showResultsCount: true
        });
    }
});

export default SearchManager;