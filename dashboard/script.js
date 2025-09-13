// PUBG License Management Dashboard JavaScript
class LicenseManager {
    constructor() {
        this.currentUser = null;
        this.licenses = JSON.parse(localStorage.getItem('licenses') || '[]');
        this.customers = JSON.parse(localStorage.getItem('customers') || '[]');
        this.settings = JSON.parse(localStorage.getItem('settings') || '{"defaultDuration": 30, "maxDevices": 3}');
        
        // SECURE CREDENTIALS - CHANGED FOR PRODUCTION
        this.adminCredentials = {
            username: 'pubg_admin',
            password: 'SecurePUBG2024!@#'
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        // إخفاء الداش بورد وإظهار نافذة تسجيل الدخول فوراً
        document.getElementById('dashboard').classList.add('d-none');
        
        // انتظار تحميل Bootstrap ثم إظهار نافذة تسجيل الدخول
        setTimeout(() => {
            this.showLoginModal();
        }, 100);
        
        this.updateStatistics();
        this.loadTables();
    }
    
    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });
        
        // Tab change events
        document.querySelectorAll('#mainTabs button').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                this.handleTabChange(e.target.getAttribute('data-bs-target'));
            });
        });
        
        // Refresh buttons
        const refreshLicenses = document.getElementById('refreshLicenses');
        if (refreshLicenses) {
            refreshLicenses.addEventListener('click', () => {
                this.loadLicensesTable();
            });
        }
        
        const refreshCustomers = document.getElementById('refreshCustomers');
        if (refreshCustomers) {
            refreshCustomers.addEventListener('click', () => {
                this.loadCustomersTable();
            });
        }
        
        // Add other event listeners if elements exist
        this.setupOptionalEventListeners();
    }
    
    setupOptionalEventListeners() {
        const elements = [
            { id: 'createLicenseForm', event: 'submit', handler: (e) => { e.preventDefault(); this.createLicense(); }},
            { id: 'saveLicense', event: 'click', handler: () => this.addLicense() },
            { id: 'saveCustomer', event: 'click', handler: () => this.addCustomer() },
            { id: 'generateKey', event: 'click', handler: () => {
                const keyField = document.getElementById('modalLicenseKey');
                if (keyField) keyField.value = this.generateLicenseKey();
            }},
            { id: 'saveSettings', event: 'click', handler: () => this.saveSettings() },
            { id: 'exportData', event: 'click', handler: () => this.exportData() },
            { id: 'importData', event: 'click', handler: () => this.importData() },
            { id: 'clearData', event: 'click', handler: () => this.clearAllData() },
            { id: 'licenseType', event: 'change', handler: (e) => this.updateExpiryDate(e.target.value) }
        ];
        
        elements.forEach(({ id, event, handler }) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            }
        });
    }
    
    handleLogin() {
        console.log('🔐 محاولة تسجيل دخول جديدة');
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        try {
            if (username === this.adminCredentials.username && password === this.adminCredentials.password) {
                console.log('✅ بيانات الدخول صحيحة، جاري تسجيل الدخول...');
                this.currentUser = username;
                
                // Force hide the modal element
                const loginModalElement = document.getElementById('loginModal');
                if (loginModalElement) {
                    loginModalElement.style.display = 'none';
                    loginModalElement.classList.remove('show');
                    document.body.classList.remove('modal-open');
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) { backdrop.remove(); }
                }
                
                // Show dashboard
                const dashboardElement = document.getElementById('dashboard');
                if (dashboardElement) {
                    dashboardElement.classList.remove('d-none');
                }
                
                this.showSuccessMessage('🎉 تم تسجيل الدخول بنجاح!');
                
                // Clear login form
                document.getElementById('loginForm').reset();
                const loginError = document.getElementById('loginError');
                if (loginError) {
                    loginError.classList.add('d-none');
                }
                
                // Refresh data
                this.updateStatistics();
                this.loadTables();
                
            } else {
                throw new Error('❌ اسم المستخدم أو كلمة المرور غير صحيحة');
            }
        } catch (error) {
            this.showLoginError(error.message);
        }
    }
    
    handleLogout() {
        this.currentUser = null;
        document.getElementById('dashboard').classList.add('d-none');
        this.showLoginModal();
    }
    
    showLoginModal() {
        // إخفاء الداش بورد فوراً
        document.getElementById('dashboard').classList.add('d-none');
        
        // إظهار نافذة تسجيل الدخول فوراً
        const loginModalElement = document.getElementById('loginModal');
        
        // إزالة أي مودال موجود مسبقاً
        const existingModal = bootstrap.Modal.getInstance(loginModalElement);
        if (existingModal) {
            existingModal.dispose();
        }
        
        // إنشاء مودال جديد وإظهاره
        const loginModal = new bootstrap.Modal(loginModalElement, {
            backdrop: 'static',
            keyboard: false,
            focus: true
        });
        
        loginModal.show();
        
        // تركيز على حقل اسم المستخدم بعد ظهور المودال
        loginModalElement.addEventListener('shown.bs.modal', () => {
            const usernameField = document.getElementById('username');
            if (usernameField) {
                usernameField.focus();
            }
        }, { once: true });
        
        // مسح أي رسائل خطأ سابقة
        const loginError = document.getElementById('loginError');
        if (loginError) {
            loginError.classList.add('d-none');
        }
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.reset();
        }
    }
    
    showLoginError(message) {
        const loginErrorMessage = document.getElementById('loginErrorMessage');
        const loginError = document.getElementById('loginError');
        
        if (loginErrorMessage) {
            loginErrorMessage.textContent = message;
        }
        if (loginError) {
            loginError.classList.remove('d-none');
        }
    }
    
    generateLicenseKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 20; i++) {
            if (i > 0 && i % 4 === 0) result += '-';
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    updateStatistics() {
        const activeLicenses = this.licenses.filter(l => l.status === 'active').length;
        const expiringSoon = this.licenses.filter(l => {
            if (l.status !== 'active') return false;
            const expiryDate = new Date(l.expiryDate);
            const today = new Date();
            const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
        }).length;
        
        const totalLicensesEl = document.getElementById('totalLicenses');
        const activeLicensesEl = document.getElementById('activeLicenses');
        const expiringLicensesEl = document.getElementById('expiringLicenses');
        const totalCustomersEl = document.getElementById('totalCustomers');
        
        if (totalLicensesEl) totalLicensesEl.textContent = this.licenses.length;
        if (activeLicensesEl) activeLicensesEl.textContent = activeLicenses;
        if (expiringLicensesEl) expiringLicensesEl.textContent = expiringSoon;
        if (totalCustomersEl) totalCustomersEl.textContent = this.customers.length;
    }
    
    loadTables() {
        this.loadLicensesTable();
        this.loadCustomersTable();
        this.populateCustomerDropdowns();
    }
    
    loadLicensesTable() {
        const tbody = document.getElementById('licensesTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        this.licenses.forEach(license => {
            const row = document.createElement('tr');
            
            // Determine status class and text
            let statusClass = 'status-active';
            let statusText = 'Active';
            
            if (license.status === 'revoked') {
                statusClass = 'status-revoked';
                statusText = 'Revoked';
            } else {
                const expiryDate = new Date(license.expiryDate);
                const today = new Date();
                if (expiryDate < today) {
                    statusClass = 'status-expired';
                    statusText = 'Expired';
                }
            }
            
            row.innerHTML = `
                <td><code>${license.key}</code></td>
                <td>${license.customerName}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${license.expiryDate}</td>
                <td>
                    <button class="btn btn-info btn-sm action-btn" onclick="licenseManager.editLicense('${license.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-warning btn-sm action-btn" onclick="licenseManager.extendLicense('${license.id}')">
                        <i class="fas fa-clock"></i>
                    </button>
                    <button class="btn btn-danger btn-sm action-btn" onclick="licenseManager.revokeLicense('${license.id}')">
                        <i class="fas fa-ban"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }
    
    loadCustomersTable() {
        const tbody = document.getElementById('customersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        this.customers.forEach(customer => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${customer.name}</td>
                <td>${customer.phone}</td>
                <td>${customer.whatsapp || '-'}</td>
                <td>${customer.telegram || '-'}</td>
                <td>${customer.discord || '-'}</td>
                <td>
                    <button class="btn btn-info btn-sm action-btn" onclick="licenseManager.editCustomer('${customer.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm action-btn" onclick="licenseManager.deleteCustomer('${customer.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    populateCustomerDropdowns() {
        const selects = [
            document.getElementById('customerSelect'),
            document.getElementById('modalCustomerSelect')
        ];
        
        selects.forEach(select => {
            if (select) {
                select.innerHTML = '<option value="">Select Customer</option>';
                this.customers.forEach(customer => {
                    const option = document.createElement('option');
                    option.value = customer.id;
                    option.textContent = customer.name;
                    select.appendChild(option);
                });
            }
        });
    }
    
    showSuccessMessage(message) {
        this.showToast(message, 'success');
    }
    
    showErrorMessage(message) {
        this.showToast(message, 'danger');
    }
    
    showInfoMessage(message) {
        this.showToast(message, 'info');
    }
    
    showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast
        const toastId = `toast_${Date.now()}`;
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        const toastInstance = new bootstrap.Toast(toast, { delay: 4000 });
        toastInstance.show();
        
        // Remove toast element after it's hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
    
    saveLicenses() {
        localStorage.setItem('licenses', JSON.stringify(this.licenses));
    }
    
    saveCustomers() {
        localStorage.setItem('customers', JSON.stringify(this.customers));
    }
    
    // Placeholder methods for complete functionality
    handleTabChange(target) {
        console.log('Tab changed to:', target);
        switch(target) {
            case '#licenses':
                this.loadLicensesTable();
                break;
            case '#customers':
                this.loadCustomersTable();
                break;
            case '#create':
                this.populateCustomerDropdowns();
                break;
            default:
                break;
        }
    }
    
    createLicense() { console.log('Create license function called'); }
    addLicense() { console.log('Add license function called'); }
    addCustomer() { console.log('Add customer function called'); }
    updateExpiryDate() { console.log('Update expiry date function called'); }
    editLicense() { console.log('Edit license function called'); }
    extendLicense() { console.log('Extend license function called'); }
    revokeLicense() { console.log('Revoke license function called'); }
    editCustomer() { console.log('Edit customer function called'); }
    deleteCustomer() { console.log('Delete customer function called'); }
    loadSettings() { console.log('Load settings function called'); }
    saveSettings() { console.log('Save settings function called'); }
    exportData() { console.log('Export data function called'); }
    importData() { console.log('Import data function called'); }
    clearAllData() { console.log('Clear all data function called'); }
}

// Initialize the license manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.licenseManager = new LicenseManager();
    
    // Add some sample data for demonstration
    setTimeout(() => {
        if (window.licenseManager && window.licenseManager.customers.length === 0) {
            // Add sample customers
            const sampleCustomers = [
                {
                    id: '1',
                    name: 'أحمد محمد',
                    phone: '+966501234567',
                    whatsapp: '+966501234567',
                    telegram: '@ahmed_pubg',
                    discord: 'Ahmed#1234',
                    createdDate: '2024-01-15'
                },
                {
                    id: '2',
                    name: 'سارة علي',
                    phone: '+966502345678',
                    whatsapp: '+966502345678',
                    telegram: '@sara_gaming',
                    discord: 'SaraGamer#5678',
                    createdDate: '2024-01-20'
                }
            ];
            
            window.licenseManager.customers = sampleCustomers;
            window.licenseManager.saveCustomers();
            
            // Add sample licenses
            const sampleLicenses = [
                {
                    id: '1',
                    key: 'PUBG-ABCD-EFGH-IJKL-MNOP',
                    customerId: '1',
                    customerName: 'أحمد محمد',
                    type: 'premium',
                    status: 'active',
                    createdDate: '2024-01-15',
                    expiryDate: '2024-04-15',
                    deviceLimit: 2,
                    devicesBound: 1,
                    notes: 'Premium license for 90 days'
                },
                {
                    id: '2',
                    key: 'PUBG-QRST-UVWX-YZ12-3456',
                    customerId: '2',
                    customerName: 'سارة علي',
                    type: 'basic',
                    status: 'active',
                    createdDate: '2024-01-20',
                    expiryDate: '2024-02-20',
                    deviceLimit: 1,
                    devicesBound: 1,
                    notes: 'Basic license for 30 days'
                }
            ];
            
            window.licenseManager.licenses = sampleLicenses;
            window.licenseManager.saveLicenses();
            
            window.licenseManager.updateStatistics();
            window.licenseManager.loadTables();
        }
    }, 2000);
});