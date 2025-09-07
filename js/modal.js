/* ===== MODAL FUNCTIONALITY ===== */

import { copyToClipboard, showToast, animateCSS } from './utils.js';

class ModalManager {
    constructor() {
        this.activeModal = null;
        this.modalStack = [];
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.createModalBackdrop();
        
        // Handle browser back button
        window.addEventListener('popstate', this.handlePopState.bind(this));
    }
    
    bindEvents() {
        // Global event delegation for modal triggers
        document.addEventListener('click', (event) => {
            // Open modal buttons
            const openModalBtn = event.target.closest('[data-modal]');
            if (openModalBtn) {
                event.preventDefault();
                const modalId = openModalBtn.dataset.modal;
                this.openModal(modalId);
                return;
            }
            
            // Close modal buttons
            const closeModalBtn = event.target.closest('[data-modal-close]');
            if (closeModalBtn) {
                event.preventDefault();
                this.closeModal();
                return;
            }
            
            // Copy buttons
            const copyBtn = event.target.closest('[data-copy]');
            if (copyBtn) {
                event.preventDefault();
                const textToCopy = copyBtn.dataset.copy || copyBtn.textContent;
                this.handleCopy(textToCopy, copyBtn);
                return;
            }
        });
        
        // ESC key to close modal
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.activeModal) {
                this.closeModal();
            }
        });
        
        // Click outside to close modal
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal-backdrop')) {
                this.closeModal();
            }
        });
    }
    
    createModalBackdrop() {
        if (document.querySelector('.modal-backdrop')) return;
        
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.appendChild(backdrop);
    }
    
    openModal(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal with id "${modalId}" not found`);
            return;
        }
        
        // Close any existing modal first
        if (this.activeModal) {
            this.modalStack.push(this.activeModal);
        }
        
        this.activeModal = modal;
        
        // Set up modal
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', modalId + '-title');
        
        // Show backdrop
        const backdrop = document.querySelector('.modal-backdrop');
        backdrop.classList.add('show');
        
        // Show modal
        modal.classList.add('show');
        modal.style.display = 'flex';
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Focus management
        this.trapFocus(modal);
        
        // Auto-focus first focusable element
        const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            setTimeout(() => firstFocusable.focus(), 100);
        }
        
        // Add to browser history
        if (options.addToHistory !== false) {
            const currentState = history.state || {};
            history.pushState({...currentState, modal: modalId}, '', location.href);
        }
        
        // Trigger open event
        modal.dispatchEvent(new CustomEvent('modalopen', { detail: { modalId } }));
        
        // Analytics
        if (window.gtag) {
            window.gtag('event', 'modal_open', {
                modal_id: modalId
            });
        }
    }
    
    closeModal(options = {}) {
        if (!this.activeModal) return;
        
        const modal = this.activeModal;
        const modalId = modal.id;
        
        // Hide modal
        modal.classList.remove('show');
        
        // Animate out
        setTimeout(() => {
            modal.style.display = 'none';
            
            // Restore previous modal if any
            if (this.modalStack.length > 0) {
                this.activeModal = this.modalStack.pop();
            } else {
                this.activeModal = null;
                
                // Hide backdrop
                const backdrop = document.querySelector('.modal-backdrop');
                backdrop.classList.remove('show');
                
                // Restore body scroll
                document.body.style.overflow = '';
                
                // Restore focus to trigger element
                const triggerElement = document.querySelector(`[data-modal="${modalId}"]`);
                if (triggerElement) {
                    triggerElement.focus();
                }
            }
        }, 300);
        
        // Remove from browser history
        if (options.updateHistory !== false && history.state?.modal === modalId) {
            history.back();
        }
        
        // Trigger close event
        modal.dispatchEvent(new CustomEvent('modalclose', { detail: { modalId } }));
    }
    
    trapFocus(modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        const handleTabKey = (event) => {
            if (event.key !== 'Tab') return;
            
            if (event.shiftKey) {
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        };
        
        modal.addEventListener('keydown', handleTabKey);
        
        // Clean up on modal close
        modal.addEventListener('modalclose', () => {
            modal.removeEventListener('keydown', handleTabKey);
        }, { once: true });
    }
    
    handlePopState(event) {
        if (this.activeModal && !event.state?.modal) {
            this.closeModal({ updateHistory: false });
        }
    }
    
    async handleCopy(text, button) {
        const originalHTML = button.innerHTML;
        const originalTitle = button.title;
        
        try {
            const success = await copyToClipboard(text);
            
            if (success) {
                // Update button to show success
                button.innerHTML = '<span>✓</span><span>¡Copiado!</span>';
                button.title = 'Copiado al portapapeles';
                button.classList.add('copied');
                
                showToast('Texto copiado al portapapeles', 'success', 2000);
                
                // Reset button after delay
                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.title = originalTitle;
                    button.classList.remove('copied');
                }, 2000);
            } else {
                throw new Error('Copy failed');
            }
        } catch (error) {
            console.error('Copy failed:', error);
            showToast('Error al copiar texto', 'error', 3000);
        }
    }
    
    // Image modal functionality
    initImageModal() {
        const images = document.querySelectorAll('img[data-modal-image]');
        
        images.forEach(img => {
            img.addEventListener('click', () => {
                this.showImageModal(img);
            });
            
            // Make images keyboard accessible
            img.setAttribute('tabindex', '0');
            img.setAttribute('role', 'button');
            img.setAttribute('aria-label', 'Abrir imagen en modal');
            
            img.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.showImageModal(img);
                }
            });
        });
    }
    
    showImageModal(img) {
        const modal = this.createImageModal(img);
        document.body.appendChild(modal);
        this.openModal(modal.id);
        
        // Remove modal from DOM when closed
        modal.addEventListener('modalclose', () => {
            setTimeout(() => modal.remove(), 300);
        }, { once: true });
    }
    
    createImageModal(img) {
        const modalId = 'imageModal_' + Date.now();
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal image-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <button class="modal-close" data-modal-close aria-label="Cerrar modal">&times;</button>
                </div>
                <div class="modal-body">
                    <img src="${img.src}" alt="${img.alt}" class="modal-image">
                    ${img.alt ? `<p class="image-caption">${img.alt}</p>` : ''}
                </div>
            </div>
        `;
        
        return modal;
    }
}

// Script functionality for modals
class ScriptModal {
    constructor() {
        this.scripts = {
            general: `Hola [nombre del contacto], ¿cómo estás? Espero que todo vaya bien.

Te cuento que acabo de empezar a trabajar en TuMatch Inmobiliario, una de las empresas líderes en corretaje de propiedades en el país. En TuMatch somos muy rápidos para vender una propiedad o ponerla en arriendo, porque contamos con un equipo y una metodología que realmente funcionan.

Si tienes alguna propiedad que quieras vender o poner en arriendo, yo me encargo de todo. También, si conoces a alguien que necesite este servicio, por favor avísame, ¡me encantaría ayudar!

Estoy muy motivado con esta nueva actividad y me ayudaría mucho contar con tu apoyo. Mi compromiso es vender o arrendar en tiempo récord.

Estaré pendiente de cualquier oportunidad que puedas compartir conmigo. ¡Gracias por tu tiempo! ¿Te parece si te mando más información por WhatsApp o correo? Así puedes revisar todo con calma.`,
            
            whatsapp: `Hola [nombre del contacto], ¿cómo estás?

Te cuento que acabo de empezar a trabajar en TuMatch Inmobiliario, una de las empresas de corretaje de propiedades líder del país.

Una de las grandes ventajas de trabajar con nosotros es que somos súper rápidos para vender una propiedad o ponerla en arriendo.

Por casualidad, ¿conoces a alguien que quiera vender o poner en arriendo su propiedad? Si es así, envíame un mensaje y con gusto me encargo de todo.

Estoy muy motivado con este nuevo desafío y me encantaría poder contar con tu ayuda. ¡Gracias por tu apoyo!`
        };
        
        this.bindEvents();
    }
    
    bindEvents() {
        document.addEventListener('click', (event) => {
            const copyScriptBtn = event.target.closest('[data-copy-script]');
            if (copyScriptBtn) {
                event.preventDefault();
                const scriptType = copyScriptBtn.dataset.copyScript;
                this.copyScript(scriptType, copyScriptBtn);
            }
        });
    }
    
    async copyScript(scriptType, button) {
        const script = this.scripts[scriptType];
        if (!script) {
            showToast('Script no encontrado', 'error');
            return;
        }
        
        const success = await copyToClipboard(script);
        
        if (success) {
            const originalHTML = button.innerHTML;
            button.innerHTML = '<span>✓</span><span>¡Copiado!</span>';
            button.classList.add('copied');
            
            showToast('Script copiado al portapapeles', 'success');
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove('copied');
            }, 2000);
        } else {
            showToast('Error al copiar script', 'error');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.modalManager = new ModalManager();
    window.scriptModal = new ScriptModal();
    
    // Initialize image modals
    window.modalManager.initImageModal();
});

export { ModalManager, ScriptModal };