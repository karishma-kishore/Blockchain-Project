// Main JavaScript utilities for ASU Sun Devil Central

// API Base URL
const API_BASE_URL = 'http://localhost:3000/api';

// Auth State
let currentUser = null;

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
    async get(endpoint) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            showToast('Failed to load data', 'error');
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
            this.updateUI();
            showToast('Logged in successfully', 'success');
            return true;
        }
        return false;
    },

    async logout() {
        await api.post('/logout', {});
        currentUser = null;
        this.updateUI();
        showToast('Logged out', 'info');
        window.location.reload();
    },

    async checkAuth() {
        const result = await api.get('/me');
        if (result && result.user) {
            currentUser = result.user;
        }
        this.updateUI();
    },

    updateUI() {
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userDisplay = document.getElementById('user-display');
        const modal = document.getElementById('login-modal');

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
    }
};

// Modal Logic
function setupModal() {
    const modal = document.getElementById('login-modal');
    const btn = document.getElementById('login-btn');
    const span = document.getElementsByClassName("close")[0];
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
        return false;
    }

    const result = await api.post(`/groups/${groupId}/join`, {});
    if (result) {
        showToast('Joined group successfully!', 'success');
        return true;
    }
    return false;
}

// Utility: RSVP to event
async function toggleEventRSVP(eventId) {
    if (!currentUser) {
        showToast('Please login to RSVP', 'error');
        return false;
    }

    try {
        const result = await api.post(`/events/${eventId}/rsvp`, {});
        if (result) {
            const msg = result.status === 'confirmed' ? 'RSVP confirmed!' : 'RSVP cancelled';
            showToast(msg, 'success');
            return result.status === 'confirmed'; // Return true if joined, false if left
        }
    } catch (e) {
        // Error is already logged/toasted in api.post but we might want to catch specific logic
        return false;
    }
    return false;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    auth.checkAuth();
    setupModal();

    // Profile Button Handler
    const profileBtn = document.querySelector('.nav-icon[title="My Account"]');
    if (profileBtn) {
        profileBtn.style.cursor = 'pointer';
        profileBtn.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }
});

// Export for other scripts if needed (though mostly global)
window.api = api;
window.auth = auth;
window.currentUser = currentUser;
window.toggleGroupMembership = toggleGroupMembership;
window.toggleEventRSVP = toggleEventRSVP;
window.loadFromStorage = loadFromStorage;
window.toggleBookmark = toggleBookmark;

