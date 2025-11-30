// ========== TOAST NOTIFICATION SYSTEM ==========

// Create toast container if it doesn't exist
function initToastContainer() {
    if (!document.querySelector('.toast-container')) {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
}

// Show toast notification
function showToast(title, message, type = 'info', duration = 4000) {
    initToastContainer();

    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

    container.appendChild(toast);

    // Auto remove after duration
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ========== COLLAPSIBLE SECTIONS ==========

function toggleCollapsible(id) {
    const element = document.getElementById(id);
    if (element) {
        element.classList.toggle('open');
    }
}

// ========== MODAL SYSTEM ==========

function showModal(title, content, onConfirm = null) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => {
        if (e.target === overlay) closeModal(overlay);
    };

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <div class="modal-body">
      ${content}
    </div>
    ${onConfirm ? `
      <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" id="modal-confirm">Confirm</button>
      </div>
    ` : ''}
  `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (onConfirm) {
        document.getElementById('modal-confirm').onclick = () => {
            onConfirm();
            overlay.remove();
        };
    }

    return overlay;
}

function closeModal(overlay) {
    overlay.remove();
}

// ========== TABS SYSTEM ==========

function initTabs(tabsContainerId) {
    const container = document.getElementById(tabsContainerId);
    if (!container) return;

    const buttons = container.querySelectorAll('.tab-button');
    const contents = container.querySelectorAll('.tab-content');

    buttons.forEach((button, index) => {
        button.onclick = () => {
            // Remove active from all
            buttons.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // Add active to clicked
            button.classList.add('active');
            contents[index].classList.add('active');
        };
    });
}

// ========== LOADING SPINNER ==========

function showLoading(buttonElement) {
    const originalText = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = `<span class="spinner"></span> Loading...`;

    return () => {
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalText;
    };
}

// ========== FORM VALIDATION ==========

function validateForm(formId, rules) {
    const form = document.getElementById(formId);
    if (!form) return false;

    let isValid = true;

    for (const [fieldId, rule] of Object.entries(rules)) {
        const field = document.getElementById(fieldId);
        if (!field) continue;

        const value = field.value.trim();

        // Required check
        if (rule.required && !value) {
            showFieldError(field, rule.message || 'This field is required');
            isValid = false;
            continue;
        }

        // Pattern check
        if (rule.pattern && value && !rule.pattern.test(value)) {
            showFieldError(field, rule.message || 'Invalid format');
            isValid = false;
            continue;
        }

        // Min length
        if (rule.minLength && value.length < rule.minLength) {
            showFieldError(field, `Minimum ${rule.minLength} characters required`);
            isValid = false;
            continue;
        }

        clearFieldError(field);
    }

    return isValid;
}

function showFieldError(field, message) {
    field.style.borderColor = 'var(--danger)';

    let errorDiv = field.parentElement.querySelector('.field-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.style.color = 'var(--danger)';
        errorDiv.style.fontSize = '0.85rem';
        errorDiv.style.marginTop = '4px';
        field.parentElement.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
}

function clearFieldError(field) {
    field.style.borderColor = '';
    const errorDiv = field.parentElement.querySelector('.field-error');
    if (errorDiv) errorDiv.remove();
}

// ========== UTILITY FUNCTIONS ==========

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied!', 'Text copied to clipboard', 'success', 2000);
    }).catch(() => {
        showToast('Error', 'Failed to copy text', 'error');
    });
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showToast,
        toggleCollapsible,
        showModal,
        closeModal,
        initTabs,
        showLoading,
        validateForm,
        formatDate,
        debounce,
        copyToClipboard
    };
}
