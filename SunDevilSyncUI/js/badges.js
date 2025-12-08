// Badge-related UI logic (minting, verifying, listing)

function formatTimestamp(seconds) {
    if (!seconds) return 'N/A';
    const date = new Date(Number(seconds) * 1000);
    return date.toLocaleString();
}

async function initBadgeStatus() {
    const statusEl = document.getElementById('badge-status');
    if (!statusEl || !window.api) return;

    const status = await window.api.get('/badges/status');
    if (!status) {
        statusEl.textContent = 'Status: unavailable';
        statusEl.classList.add('badge-warning');
        return;
    }

    if (status.usesMock) {
        statusEl.textContent = 'Mock mode (no chain connection)';
        statusEl.classList.add('badge-warning');
    } else if (status.configured) {
        statusEl.textContent = 'On-chain ready';
        statusEl.classList.add('badge-success');
    } else {
        statusEl.textContent = 'Not configured';
        statusEl.classList.add('badge-warning');
    }
}

function renderMintResult(container, payload, result) {
    if (!container) return;
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Minted Badge #${result?.tokenId ?? '?'}</h3>
                <span class="badge badge-success">${result?.network || 'mock'}</span>
            </div>
            <div class="card-body">
                <p><strong>Student:</strong> ${payload.studentWallet}</p>
                <p><strong>Event:</strong> ${payload.eventName} (ID: ${payload.eventId}) on ${payload.eventDate}</p>
                <p><strong>Achievement:</strong> ${payload.achievementType}</p>
                <p><strong>Metadata URI:</strong> <a href="${payload.metadataURI}" target="_blank" rel="noreferrer">${payload.metadataURI}</a></p>
                ${result?.transactionHash ? `<p><strong>Tx:</strong> <a href="https://amoy.polygonscan.com/tx/${result.transactionHash}" target="_blank" rel="noreferrer">${result.transactionHash}</a></p>` : ''}
            </div>
        </div>
    `;
}

function renderBadgeDetails(container, badge) {
    if (!container) return;
    if (!badge) {
        container.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <p class="text-secondary">Badge not found.</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Badge #${badge.tokenId}</h3>
                <span class="badge badge-success">${badge.network || 'mock'}</span>
            </div>
            <div class="card-body">
                <p><strong>Event:</strong> ${badge.eventName} (ID: ${badge.eventId})</p>
                <p><strong>Date:</strong> ${badge.eventDate}</p>
                <p><strong>Achievement:</strong> ${badge.achievementType}</p>
                <p><strong>Issued At:</strong> ${formatTimestamp(badge.issuedAt)}</p>
                <p><strong>Issuer:</strong> ${badge.issuer}</p>
                <p><strong>Metadata (event link):</strong> <a href="${badge.tokenURI || badge.metadataURI}" target="_blank" rel="noreferrer">${badge.tokenURI || badge.metadataURI}</a></p>
                ${badge.transactionHash ? `<p><strong>Tx:</strong> <a href="https://amoy.polygonscan.com/tx/${badge.transactionHash}" target="_blank" rel="noreferrer">${badge.transactionHash}</a></p>` : ''}
            </div>
        </div>
    `;
}

function renderBadgeList(container, badges) {
    if (!container) return;
    if (!badges || badges.length === 0) {
        container.innerHTML = `<p class="text-secondary">No badges minted yet.</p>`;
        return;
    }

    container.innerHTML = badges.map((badge) => {
        const mintedAt = badge.created_at ? new Date(badge.created_at).toLocaleString() : 'N/A';
        return `
            <div class="card" style="margin-bottom: var(--spacing-md);">
                <div class="card-header">
                    <h3 class="card-title">Badge #${badge.token_id}</h3>
                    <span class="badge badge-secondary">${badge.network || 'mock'}</span>
                </div>
                <div class="card-body">
                    <p><strong>Student:</strong> ${badge.student_wallet}</p>
                    <p><strong>Badge ID (use for verification):</strong> ${badge.token_id}</p>
                    <p><strong>Event:</strong> ${badge.event_name} (ID: ${badge.event_id}) on ${badge.event_date}</p>
                    <p><strong>Achievement:</strong> ${badge.achievement_type}</p>
                    <p><strong>Metadata (event link):</strong> <a href="${badge.metadata_uri}" target="_blank" rel="noreferrer">${badge.metadata_uri}</a></p>
                    <p><strong>Minted:</strong> ${mintedAt}</p>
                    <div style="margin-top: 8px;">
                        <a class="btn btn-outline" href="verify.html?token=${badge.token_id}">Verify</a>
                        ${badge.tx_hash ? `<a class="btn btn-secondary" style="margin-left: 8px;" href="https://amoy.polygonscan.com/tx/${badge.tx_hash}" target="_blank" rel="noreferrer">View Tx</a>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderMyBadges(container, badges) {
    if (!container) return;
    if (!badges || badges.length === 0) {
        container.innerHTML = `<p class="text-secondary">No badges yet. Enroll in an event to earn one.</p>`;
        return;
    }
    container.innerHTML = badges.map((badge) => {
        const mintedAt = badge.created_at ? new Date(badge.created_at).toLocaleString() : 'N/A';
        const network = badge.network || 'mock';
        const txLink = badge.tx_hash ? (network.toLowerCase().includes('amoy') ? `https://amoy.polygonscan.com/tx/${badge.tx_hash}` : badge.tx_hash) : null;
        return `
            <div class="card" style="margin-bottom: var(--spacing-md);">
                <div class="card-header">
                    <h3 class="card-title">Badge #${badge.token_id}</h3>
                    <span class="badge badge-secondary">${badge.achievement_type}</span>
                    <span class="badge badge-secondary">${network}</span>
                </div>
                <div class="card-body">
                    <p><strong>Badge ID (use for verification):</strong> ${badge.token_id}</p>
                    <p><strong>Event:</strong> ${badge.event_name} (ID: ${badge.event_id})</p>
                    <p><strong>Date:</strong> ${badge.event_date}</p>
                    <p><strong>Metadata (event link):</strong> <a href="${badge.metadata_uri}" target="_blank" rel="noreferrer">${badge.metadata_uri}</a></p>
                    <p><strong>Minted:</strong> ${mintedAt}</p>
                    <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                        <a class="btn btn-outline" href="verify.html?token=${badge.token_id}">Verify</a>
                        ${txLink ? `<a class="btn btn-secondary" href="${txLink}" target="_blank" rel="noreferrer">Tx</a>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function parseQueryTokenId() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    return token ? Number(token) : null;
}

async function setupMintForm(badgeListContainer) {
    const form = document.getElementById('badge-mint-form');
    const resultContainer = document.getElementById('badge-mint-result');
    if (!form || !window.api) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = window.getCurrentUser ? window.getCurrentUser() : window.currentUser;
        if (!user) {
            window.showToast?.('Please login as admin to mint badges', 'error');
            return;
        }
        if (user.role !== 'admin') {
            window.showToast?.('Admin access required', 'error');
            return;
        }

        const payload = {
            studentWallet: form.studentWallet.value.trim(),
            eventId: Number(form.eventId.value),
            eventName: form.eventName.value.trim(),
            eventDate: form.eventDate.value,
            achievementType: form.achievementType.value.trim(),
            metadataURI: form.metadataURI.value.trim()
        };

        if (resultContainer) {
            resultContainer.innerHTML = '<div class="card"><div class="card-body"><p>Minting badge...</p></div></div>';
        }

        const result = await window.api.post('/badges/mint', payload);
        if (!result) {
            if (resultContainer) {
                resultContainer.innerHTML = '<div class="card"><div class="card-body"><p class="text-secondary">Mint failed. Check console for details.</p></div></div>';
            }
            return;
        }

        window.showToast?.('Badge minted', 'success');
        renderMintResult(resultContainer, payload, result);
        form.reset();
        loadMintedBadges(badgeListContainer); // refresh list if on badges page
    });
}

async function setupLookupForm() {
    const form = document.getElementById('badge-lookup-form');
    const statusEl = document.getElementById('badge-lookup-status');
    const resultContainer = document.getElementById('badge-result');
    if (!form || !window.api) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tokenId = Number(form.tokenId.value);
        if (!tokenId || tokenId < 1) {
            window.showToast?.('Enter a valid token ID', 'error');
            return;
        }

        if (statusEl) statusEl.textContent = 'Verifying...';
        const badge = await window.api.get(`/badges/${tokenId}`);
        renderBadgeDetails(resultContainer, badge);
        if (statusEl) statusEl.textContent = badge ? 'Verified' : 'Not found';
    });

    // Support deep link verify.html?token=ID
    const queryToken = parseQueryTokenId();
    if (queryToken) {
        form.tokenId.value = queryToken;
        form.dispatchEvent(new Event('submit'));
    }
}

async function loadMintedBadges(container) {
    if (!container || !window.api) return;
    container.innerHTML = '<p class="text-secondary">Loading badges...</p>';
    const badges = await window.api.get('/badges');
    renderBadgeList(container, badges || []);
}

async function loadMyBadges(container, section) {
    if (!container || !window.api) return;
    if (!section) section = container.closest('section');
    if (section) section.style.display = 'block';
    container.innerHTML = '<p class="text-secondary">Loading your badges...</p>';
    const badges = await window.api.get('/my-badges', { suppressToast: true });
    if (!badges) {
        container.innerHTML = '<p class="text-secondary">Login to view your badges.</p>';
        if (section) section.style.display = 'none';
        return;
    }
    renderMyBadges(container, badges);
}

function renderLoginRequired(container) {
    if (container) {
        container.innerHTML = `<p class="text-secondary">Please login to view badges.</p>`;
    }
}

async function loadBadgesForRole() {
    const badgeListContainer = document.getElementById('badge-list');
    const myBadgeContainer = document.getElementById('my-badges-list');
    const myBadgeSection = document.getElementById('my-badges-section');
    const heading = document.getElementById('badges-heading');

    await (window.authReady || auth.checkAuth());
    const user = window.getCurrentUser ? window.getCurrentUser() : window.currentUser;
    if (!user) {
        renderLoginRequired(badgeListContainer || myBadgeContainer);
        if (myBadgeSection) myBadgeSection.style.display = 'none';
        if (heading) heading.textContent = 'Please login to view badges';
        return;
    }

    const role = user.role || 'student';
    if (role === 'admin') {
        if (heading) heading.textContent = 'All Minted Badges';
        // Admin: show all badges ever issued
        if (myBadgeSection) myBadgeSection.style.display = 'none';
        if (badgeListContainer) {
            badgeListContainer.innerHTML = '<p class="text-secondary">Loading badges...</p>';
            const badges = await window.api.get('/badges');
            renderBadgeList(badgeListContainer, badges || []);
        }
    } else if (role === 'verifier') {
        if (heading) heading.textContent = 'All Verified Badges';
        // Verifier: show badges minted/verified by them
        if (myBadgeSection) myBadgeSection.style.display = 'none';
        if (badgeListContainer) {
            badgeListContainer.innerHTML = '<p class="text-secondary">Loading your verified badges...</p>';
            const badges = await window.api.get('/badges/issued-by-me');
            renderBadgeList(badgeListContainer, badges || []);
        }
    } else {
        if (heading) heading.textContent = 'All Badges';
        // Student/default: show only their badges
        if (badgeListContainer) badgeListContainer.innerHTML = '';
        if (myBadgeSection) myBadgeSection.style.display = 'block';
        if (myBadgeContainer) {
            await loadMyBadges(myBadgeContainer, myBadgeSection);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initBadgeStatus();
    setupMintForm(document.getElementById('badge-list'));
    setupLookupForm();
    loadBadgesForRole();
});
