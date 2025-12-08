// Main JavaScript utilities for ASU Sun Devil Central

// API Base URL (defaults to current origin so it works on any port/host)
const API_ORIGIN = window.location.origin.startsWith('file') ? 'http://localhost:3000' : window.location.origin;
const API_BASE_URL = `${API_ORIGIN}/api`;
const NAV_LINKS = [
    { href: 'index.html', label: 'Home' },
    { href: 'portal.html', label: 'Portal' },
    { href: 'dashboard.html', label: 'My Account' },
    { href: 'groups.html', label: 'Groups' },
    { href: 'events.html', label: 'Events' },
    { href: 'store.html', label: 'Store' },
    { href: 'badges.html', label: 'Badges' },
    { href: 'verify.html', label: 'Verify Badge' },
    { href: 'admin.html', label: 'Admin', adminOnly: true }
];

// Auth State
let currentUser = null;
let authReadyPromise = null;
const sdcHistoryEvent = 'sdc:historyUpdated';

function normalizePathname() {
    const raw = window.location.pathname.split('/').pop() || 'index.html';
    return raw.replace(/\/$/, '') || 'index.html';
}

function buildNavTemplate() {
    const links = NAV_LINKS.map(link => `
        <li>
            <a href="${link.href}" data-route="${link.href.replace('.html', '')}"${link.adminOnly ? ' data-admin-only="true"' : ''}>
                ${link.label}
            </a>
        </li>
    `).join('');

    return `
        <div class="logo">🔱 Sun Devil Central</div>
        <ul class="top-nav-menu">${links}</ul>
        <div class="top-nav-right">
            <div class="auth-buttons">
                <button id="login-btn" class="btn-secondary">Login</button>
                <button id="logout-btn" class="btn-secondary" style="display: none;">Logout</button>
                <span id="user-display" style="display: none; margin-right: 10px; color: white;"></span>
            </div>
        </div>
    `;
}

function injectNav() {
    if (document.body.dataset.disableNav === 'true') return;
    const nav = document.querySelector('.top-nav');
    const navHtml = buildNavTemplate();

    if (nav) {
        nav.innerHTML = navHtml;
    } else {
        const navEl = document.createElement('nav');
        navEl.className = 'top-nav';
        navEl.innerHTML = navHtml;
        document.body.prepend(navEl);
    }

    setActiveNavLink();
}

function setActiveNavLink() {
    const current = normalizePathname().replace('.html', '');
    document.querySelectorAll('.top-nav-menu a').forEach(link => {
        const route = link.dataset.route || '';
        if (route === current || (route === 'index' && current === '')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function toggleAdminLinks() {
    const isAdmin = currentUser && currentUser.role === 'admin';
    document.querySelectorAll('[data-admin-only="true"]').forEach(link => {
        const container = link.closest('li') || link;
        container.style.display = isAdmin ? '' : 'none';
    });
}

function injectLoginModal() {
    const modalContent = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>Login</h2>
            <form id="login-form">
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" required>
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required>
                </div>
                <button type="submit" class="btn-primary">Login</button>
                <p id="login-error" style="color: red;"></p>
            </form>
        </div>
    `;

    let modal = document.getElementById('login-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'login-modal';
        modal.className = 'modal';
        modal.style.display = 'none';
        document.body.appendChild(modal);
    }
    modal.innerHTML = modalContent;
}

// Utility: Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Utility: Format time
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Utility: Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 10px 20px rgba(0,0,0,0.15);
        z-index: 3000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Utility: Get URL parameter
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Utility: Local Storage
function loadFromStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Utility: Toggle Bookmark
function toggleBookmark(id, type) {
    let bookmarks = loadFromStorage('bookmarks') || { groups: [], events: [] };
    // Ensure structure exists
    if (!bookmarks.groups) bookmarks.groups = [];
    if (!bookmarks.events) bookmarks.events = [];

    const list = type === 'group' ? bookmarks.groups : bookmarks.events;
    const index = list.indexOf(id);

    if (index === -1) {
        list.push(id);
        showToast('Bookmarked!', 'success');
    } else {
        list.splice(index, 1);
        showToast('Bookmark removed', 'info');
    }

    saveToStorage('bookmarks', bookmarks);
    return index === -1;
}

// API Service
const api = {
    async get(endpoint, options = {}) {
        const { suppressToast = false } = options;
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, { credentials: 'include' });
            if (!response.ok) {
                if (suppressToast && response.status === 401) return null;
                throw new Error('Network response was not ok');
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            if (!suppressToast) {
                showToast('Failed to load data', 'error');
            }
            return null;
        }
    },

    async post(endpoint, data) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Request failed');
            return result;
        } catch (error) {
            console.error('API Error:', error);
            showToast(error.message, 'error');
            return null;
        }
    }
};

// Auth Service
const auth = {
    async login(username, password) {
        const result = await api.post('/login', { username, password });
        if (result && result.user) {
            currentUser = result.user;
            authReadyPromise = Promise.resolve(currentUser);
            window.authReady = authReadyPromise;
            this.updateUI();
            showToast('Logged in successfully', 'success');
            return true;
        }
        return false;
    },

    async logout() {
        await api.post('/logout', {});
        currentUser = null;
        authReadyPromise = Promise.resolve(null);
        window.authReady = authReadyPromise;
        this.updateUI();
        showToast('Logged out', 'info');
        window.location.reload();
    },

    async checkAuth() {
        if (authReadyPromise) return authReadyPromise;

        authReadyPromise = (async () => {
            const result = await api.get('/me', { suppressToast: true });
            currentUser = result && result.user ? result.user : null;
            this.updateUI();
            return currentUser;
        })();

        window.authReady = authReadyPromise;
        return authReadyPromise;
    },

    updateUI() {
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userDisplay = document.getElementById('user-display');
        const modal = document.getElementById('login-modal');

        window.currentUser = currentUser;

        if (currentUser) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
            if (userDisplay) {
                userDisplay.textContent = `Hi, ${currentUser.username}`;
                userDisplay.style.display = 'inline-block';
            }
            if (modal) modal.style.display = 'none';
        } else {
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (userDisplay) userDisplay.style.display = 'none';
        }

        toggleAdminLinks();
    }
};

// Modal Logic
function setupModal() {
    const modal = document.getElementById('login-modal');
    const btn = document.getElementById('login-btn');
    const span = modal ? modal.querySelector('.close') : null;
    const form = document.getElementById('login-form');

    if (btn) {
        btn.onclick = function () {
            modal.style.display = "block";
        }
    }

    if (span) {
        span.onclick = function () {
            modal.style.display = "none";
        }
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    if (form) {
        form.onsubmit = async function (e) {
            e.preventDefault();
            const username = form.username.value;
            const password = form.password.value;
            const success = await auth.login(username, password);
            if (success) {
                form.reset();
            }
        }
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = function () {
            auth.logout();
        }
    }
}

// Utility: Join/Leave group
async function toggleGroupMembership(groupId) {
    if (!currentUser) {
        showToast('Please login to join groups', 'error');
        return null;
    }

    const result = await api.post(`/groups/${groupId}/join`, {});
    if (result) {
        const joined = result.status === 'joined';
        showToast(joined ? 'Joined group successfully!' : 'Left group', 'success');
        return result.status; // 'joined' or 'left'
    }
    return null;
}

// Utility: RSVP to event
async function toggleEventRSVP(eventId) {
    if (!currentUser) {
        showToast('Please login to RSVP', 'error');
        return null;
    }

    try {
        const result = await api.post(`/events/${eventId}/rsvp`, {});
        if (result) {
            const msg = result.status === 'confirmed' ? 'RSVP confirmed!' : 'RSVP cancelled';
            if (result.badge && result.badge.tokenId) {
                showToast(`${msg} — Enrollment badge #${result.badge.tokenId}`, 'success');
            } else {
                showToast(msg, 'success');
            }
            if (result.sdc && result.sdc.amount) {
                showToast(`Earned ${result.sdc.amount} SDC`, 'success');
                addSdcHistory({
                    type: 'reward',
                    amount: result.sdc.amount,
                    hash: result.sdc.hash,
                    network: result.sdc.network,
                    from: 'Sun Devil Central'
                });
                document.dispatchEvent(new CustomEvent('sdc:balanceMaybeChanged'));
            }
            return result; // include status and optional badge
        }
    } catch (e) {
        // Error is already logged/toasted in api.post but we might want to catch specific logic
        return null;
    }
    return null;
}

// SDC history helpers (local storage)
function sdcHistoryKey() {
    if (currentUser && currentUser.id) {
        return `sdc-history-user-${currentUser.id}`;
    }
    const wallet = currentUser && currentUser.wallet_address;
    return wallet ? `sdc-history-${wallet}` : 'sdc-history';
}

function getSdcHistory() {
    try {
        return JSON.parse(localStorage.getItem(sdcHistoryKey()) || '[]');
    } catch {
        return [];
    }
}

function addSdcHistory(entry) {
    const history = getSdcHistory();
    history.unshift({ ...entry, ts: Date.now() });
    localStorage.setItem(sdcHistoryKey(), JSON.stringify(history.slice(0, 50)));
    document.dispatchEvent(new CustomEvent(sdcHistoryEvent));
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const disableNav = document.body.dataset.disableNav === 'true';
    if (!disableNav) {
        injectNav();
        injectLoginModal();
        setupModal();
    }

    window.authReady = auth.checkAuth();
    await window.authReady;

});

// Export for other scripts if needed (though mostly global)
window.api = api;
window.auth = auth;
window.toggleGroupMembership = toggleGroupMembership;
window.toggleEventRSVP = toggleEventRSVP;
window.loadFromStorage = loadFromStorage;
window.toggleBookmark = toggleBookmark;
window.authReady = authReadyPromise;
window.currentUser = currentUser;
window.addSdcHistory = addSdcHistory;
window.getSdcHistory = getSdcHistory;
