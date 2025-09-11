// Firebase Configuration - SAME AS MAIN APP
const firebaseConfig = {
    apiKey: "AIzaSyA61LVsUjl1CsR3XeMyEjjZ-DDU6rMHwhU",
    authDomain: "predictking-database.firebaseapp.com",
    projectId: "predictking-database",
    storageBucket: "predictking-database.firebasestorage.app",
    messagingSenderId: "786291226968",
    appId: "1:786291226968:web:4608df217228f4ecdf0d2d"
};

// Initialize Firebase
// Initialize Firebase with better error handling
let db;
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization failed:', error);
    alert('Database connection failed. Please refresh the page.');
}

// Global Variables
let users = [];
let events = [];
let analytics = {};
let settings = {
    vigPercentage: 5,
    dailyBuyinLimit: 1000,
    perAdReward: 50,
    activeAds: [
        'https://www.youtube.com/embed/r9xWOA_S3_g',
        'https://www.youtube.com/embed/srRdl60cDVw'
    ]
};

// Initialize Admin Panel
document.addEventListener('DOMContentLoaded', function() {
    loadUsers();
    loadEvents();
    loadAnalytics();
    loadSettings();
    showTab('dashboard');
    
    // Set up form listeners
    document.getElementById('create-event-form').addEventListener('submit', createEvent);
    document.getElementById('send-message-form').addEventListener('submit', sendMessage);
    document.getElementById('message-type').addEventListener('change', handleMessageTypeChange);
    
    // Start real-time updates
    startRealTimeUpdates();
});

// Tab Management
function showTab(tabName, e) {
    const content = document.getElementById('tab-content');
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => btn.classList.remove('active'));
    if (e && e.target) {
        e.target.classList.add('active');
    } else {
        const targetTab = document.querySelector(`[onclick="showTab('${tabName}')"]`);
        if (targetTab) targetTab.classList.add('active');
    }
    
    // Load tab content
    switch(tabName) {
        case 'dashboard':
            content.innerHTML = createDashboardTab();
            loadDashboardData();
            break;
        case 'users':
            content.innerHTML = createUsersTab();
            loadUsersTable();
            break;
        case 'events':
            content.innerHTML = createEventsTab();
            loadEventsGrid();
            break;
        case 'archived':
            content.innerHTML = createArchivedEventsTab();
            loadArchivedEvents();
            break;
        case 'settings':
            content.innerHTML = createSettingsTab();
            loadSettingsForm();
            break;
        case 'messages':
            content.innerHTML = createMessagesTab();
            break;
        case 'analytics':
            content.innerHTML = createAnalyticsTab();
            loadAnalyticsData();
            break;
        case 'inbox':
            content.innerHTML = createInboxTab();
            loadInbox();
            break;
    }
}

// Dashboard Tab
function createDashboardTab() {
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="total-users">0</div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="active-events">0</div>
                <div class="stat-label">Active Events</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="total-bets">0</div>
                <div class="stat-label">Total Bets</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="total-revenue">₹0</div>
                <div class="stat-label">Total Revenue</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="pending-kyc">0</div>
                <div class="stat-label">Pending KYC</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="users-debt">0</div>
                <div class="stat-label">Users in Debt</div>
            </div>
        </div>
        
        <h3>Recent Activity</h3>
        <div class="logs-container" id="recent-logs">
            <div class="log-entry">
                <span class="log-timestamp">[Loading...]</span>
                <span>Fetching recent activity...</span>
            </div>
        </div>
    `;
}

async function loadDashboardData() {
    try {
        // Load users count
        const usersSnapshot = await db.collection('users').get();
        document.getElementById('total-users').textContent = usersSnapshot.size;
        
        // Load pending KYC count
        const pendingKYC = usersSnapshot.docs.filter(doc => doc.data().kycStatus === 'pending').length;
        document.getElementById('pending-kyc').textContent = pendingKYC;
        
        // Load users in debt count
        const usersInDebt = usersSnapshot.docs.filter(doc => doc.data().debt > 0).length;
        document.getElementById('users-debt').textContent = usersInDebt;
        
        // Load events count
        const eventsSnapshot = await db.collection('events').where('status', '==', 'active').get();
        document.getElementById('active-events').textContent = eventsSnapshot.size;
        
        // Load recent activity logs
        const logsSnapshot = await db.collection('activity_logs')
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();
            
        displayRecentLogs(logsSnapshot.docs);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function displayRecentLogs(logs) {
    const container = document.getElementById('recent-logs');
    container.innerHTML = '';
    
    logs.forEach(log => {
        const data = log.data();
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        
        const timestamp = data.timestamp.toDate().toLocaleString();
        entry.innerHTML = `
            <span class="log-timestamp">[${timestamp}]</span>
            <span>${formatLogAction(data.action, data.data)}</span>
        `;
        
        container.appendChild(entry);
    });
}

function formatLogAction(action, data) {
    switch(action) {
        case 'login':
            return `User logged in`;
        case 'registration':
            return `New user registered: ${data.nickname}`;
        case 'bet_placed':
            return `Bet placed: ${data.amount} on ${data.eventId}`;
        case 'ad_view':
            return `User watched ad`;
        case 'buyin':
            return `Buy-in: ${data.amount} via ${data.method}`;
        default:
            return `${action} - ${JSON.stringify(data)}`;
    }
}

// Users Tab
function createUsersTab() {
    return `
        <div class="form-group">
            <button class="btn" onclick="refreshUsers()">REFRESH USERS</button>
            <button class="btn btn-secondary" onclick="exportUsers()">EXPORT DATA</button>
        </div>
        
        <table class="users-table" id="users-table">
            <thead>
                <tr>
                    <th>Nickname</th>
                    <th>Display Name</th>
                    <th>KYC Status</th>
                    <th>Rep Score</th>
                    <th>Balance</th>
                    <th>Instagram</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="users-tbody">
                <tr><td colspan="8">Loading users...</td></tr>
            </tbody>
        </table>
    `;
}

async function loadUsersTable() {
    try {
        const usersSnapshot = await db.collection('users').get();
        users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayUsersTable();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function displayUsersTable() {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        
        // Calculate actual balance (positive or negative)
        const actualBalance = user.balance - (user.debt || 0);
        const balanceClass = actualBalance < 0 ? 'debt-amount' : '';
        const balanceDisplay = `<span class="${balanceClass}">${formatCurrency(actualBalance, user.currency)}</span>`;
            
        row.innerHTML = `
            <td>${user.nickname}</td>
            <td>${user.displayName}</td>
            <td><span class="status-${user.kycStatus}">${user.kycStatus.toUpperCase()}</span></td>
            <td><span class="rep-${user.repScore.toLowerCase()}">${user.repScore}</span></td>
            <td>${balanceDisplay}</td>
            <td>@${user.instagram}</td>
            <td class="user-actions">
                ${user.kycStatus === 'pending' ? 
                    `<button class="btn" onclick="approveKYC('${user.id}')">APPROVE</button>
                     <button class="btn btn-danger" onclick="rejectKYC('${user.id}')">REJECT</button>` : ''}
                <button class="btn btn-${user.repScore === 'GOOD' ? 'warning' : 'secondary'}" onclick="toggleRepScore('${user.id}')">
                    ${user.repScore === 'GOOD' ? 'MARK BAD' : 'MARK GOOD'}
                </button>
                <button class="btn btn-secondary" onclick="adjustBalance('${user.id}')">ADJUST</button>
                <button class="btn btn-primary" onclick="sendIndividualMessage('${user.id}', '${user.displayName}')">MESSAGE</button>
                <button class="btn btn-danger" onclick="deleteUser('${user.id}')">DELETE</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

async function sendIndividualMessage(userId, displayName) {
    const subject = prompt(`Enter message title for ${displayName}:`);
    if (!subject) return;
    
    const message = prompt('Enter message content:');
    if (!message) return;
    
    try {
        await db.collection('notifications').add({
            userId: userId,
            title: subject,
            message: message,
            timestamp: firebase.firestore.Timestamp.now(),
            read: false,
            type: 'admin'
        });
        
        showNotification(`Message sent to ${displayName}`);
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Error sending message');
    }
}

async function approveKYC(userId) {
    try {
        await db.collection('users').doc(userId).update({
            kycStatus: 'approved'
        });
        
        // Send approval message
        await db.collection('notifications').add({
            userId: userId,
            title: 'KYC Approved!',
            message: 'Your account has been approved. You can now start betting!',
            timestamp: firebase.firestore.Timestamp.now(),
            read: false
        });
        
        showNotification('KYC approved successfully');
        loadUsersTable();
    } catch (error) {
        console.error('Error approving KYC:', error);
    }
}

async function rejectKYC(userId) {
    if (!confirm('Are you sure you want to reject this KYC?')) return;
    
    try {
        await db.collection('users').doc(userId).update({
            kycStatus: 'rejected'
        });
        
        showNotification('KYC rejected');
        loadUsersTable();
    } catch (error) {
        console.error('Error rejecting KYC:', error);
    }
}

async function toggleRepScore(userId) {
    const user = users.find(u => u.id === userId);
    const newScore = user.repScore === 'GOOD' ? 'BAD' : 'GOOD';
    
    try {
        await db.collection('users').doc(userId).update({
            repScore: newScore
        });
        
        showNotification(`Rep score updated to ${newScore}`);
        loadUsersTable();
    } catch (error) {
        console.error('Error updating rep score:', error);
    }
}

function adjustBalance(userId) {
    const user = users.find(u => u.id === userId);
    const newBalance = prompt(`Current balance: ${user.balance}\nEnter new balance:`, user.balance);
    
    if (newBalance === null || isNaN(newBalance)) return;
    
    updateUserBalance(userId, parseFloat(newBalance));
}

async function updateUserBalance(userId, newBalance) {
    try {
        await db.collection('users').doc(userId).update({
            balance: newBalance,
            debt: newBalance < 0 ? Math.abs(newBalance) : 0
        });
        
        showNotification('Balance updated successfully');
        loadUsersTable();
    } catch (error) {
        console.error('Error updating balance:', error);
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to DELETE this user? This action cannot be undone.')) return;
    
    try {
        await db.collection('users').doc(userId).delete();
        showNotification('User deleted successfully');
        loadUsersTable();
    } catch (error) {
        console.error('Error deleting user:', error);
    }
}

// Events Tab
function createEventsTab() {
    return `
        <div class="form-group">
            <button class="btn" onclick="showModal('create-event-modal')">CREATE NEW EVENT</button>
            <button class="btn btn-secondary" onclick="refreshEvents()">REFRESH</button>
        </div>
        
        <div class="events-grid" id="events-grid">
            <div style="text-align: center; grid-column: 1/-1;">Loading events...</div>
        </div>
    `;
}

async function loadEventsGrid() {
    try {
        const eventsSnapshot = await db.collection('events').orderBy('startTime', 'desc').get();
        events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayEventsGrid();
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

async function displayEventsGrid() {
    const grid = document.getElementById('events-grid');
    grid.innerHTML = '';
    
    // Filter out archived events
    const activeEvents = events.filter(e => e.archive_status !== 'archived');
    
    for (const event of activeEvents) {
        const card = document.createElement('div');
        card.className = 'event-card';
        
        const startTime = event.startTime ? new Date(event.startTime.seconds * 1000).toLocaleString() : 'TBD';
        
        // Get vote counts for this event
        const voteCounts = await getEventVoteCounts(event.id);
        const voteCountsHtml = generateVoteCountsHtml(voteCounts);
        
        card.innerHTML = `
            <h3>${event.title}</h3>
            <p><strong>Start:</strong> ${startTime}</p>
            <p><strong>Status:</strong> <span class="event-status ${event.status}">${event.status.toUpperCase()}</span></p>
            <p><strong>Display:</strong> <span class="event-status ${event.display_status || 'visible'}">${(event.display_status || 'visible').toUpperCase()}</span></p>
            <p><strong>Total Bets:</strong> ${event.totalBets || 0}</p>
            <p><strong>Total Pot:</strong> ₹${event.totalPot || 0}</p>
            ${voteCountsHtml}
            <div class="user-actions">
                <button class="btn btn-secondary" onclick="editEvent('${event.id}')">EDIT</button>
                ${event.status === 'active' ? `<button class="btn btn-warning" onclick="settleEvent('${event.id}')">SETTLE</button>` : ''}
                ${event.display_status !== 'hidden' ? `<button class="btn btn-info" onclick="hideEvent('${event.id}')">HIDE</button>` : `<button class="btn btn-info" onclick="showEvent('${event.id}')">SHOW</button>`}
                <button class="btn btn-secondary" onclick="archiveEvent('${event.id}')">ARCHIVE</button>
                <button class="btn btn-danger" onclick="deleteEvent('${event.id}')">DELETE</button>
            </div>
        `;
        
        grid.appendChild(card);
    }
}


// Get vote counts for a specific event
async function getEventVoteCounts(eventId) {
    try {
        const votesSnapshot = await db.collection('event_votes')
            .where('eventId', '==', eventId)
            .get();
        
        const voteCounts = {};
        votesSnapshot.docs.forEach(doc => {
            const vote = doc.data();
            const winner = vote.selectedWinner;
            voteCounts[winner] = (voteCounts[winner] || 0) + 1;
        });
        
        return voteCounts;
    } catch (error) {
        console.error('Error getting vote counts:', error);
        return {};
    }
}

// Generate HTML for displaying vote counts
function generateVoteCountsHtml(voteCounts) {
    if (Object.keys(voteCounts).length === 0) {
        return '<p><strong>Votes:</strong> No votes yet</p>';
    }
    
    const voteItems = Object.entries(voteCounts)
        .sort(([,a], [,b]) => b - a) // Sort by vote count descending
        .map(([team, count]) => `${team}: ${count}`)
        .join(', ');
    
    return `<p><strong>Votes:</strong> ${voteItems}</p>`;
}

// Replace the entire createEvent function with:
async function createEvent(e) {
    e.preventDefault();
    
    const startTimeInput = document.getElementById('event-start').value;
    if (!startTimeInput) {
        showNotification('Please select start time');
        return;
    }
    
    const eventData = {
        title: document.getElementById('event-title').value,
        description: document.getElementById('event-description').value || '',
        profilePic: document.getElementById('event-profile-pic').value,
        backgroundImage: document.getElementById('event-background').value || '',
        startTime: firebase.firestore.Timestamp.fromDate(new Date(startTimeInput)),
        vigPercentage: parseInt(document.getElementById('event-vig').value) || 5,
        options: document.getElementById('event-options').value.split('\n').filter(opt => opt.trim()),
        status: 'active',
        display_status: 'visible',  // ADD THIS LINE
        archive_status: 'active',   // ADD THIS LINE
        totalBets: 0,
        totalPot: 0,
        createdAt: firebase.firestore.Timestamp.now()
    };
    
    if (eventData.options.length < 2) {
        showNotification('Please add at least 2 betting options');
        return;
    }
    
    try {
        await db.collection('events').add(eventData);
        closeModal('create-event-modal');
        showNotification('Event created successfully');
        loadEventsGrid();
        
        // Reset form
        document.getElementById('create-event-form').reset();
    } catch (error) {
        console.error('Error creating event:', error);
        showNotification('Error creating event');
    }
}

async function settleEvent(eventId) {
    const winner = prompt('Enter winning option (exact text):');
    if (!winner) return;
    
    if (!confirm(`Settle event with "${winner}" as winner? This will process all bets and cannot be undone.`)) return;
    
    try {
        showNotification('Settling event and processing bets...');
        
        // Get event data
        const eventDoc = await db.collection('events').doc(eventId).get();
        const eventData = eventDoc.data();
        
        // Get betting pool data
        const poolDoc = await db.collection('betting_pools').doc(eventId).get();
        const poolData = poolDoc.exists ? poolDoc.data() : null;
        
        if (!poolData) {
            throw new Error('No betting pool found for this event');
        }
        
        // Calculate winnings
        const totalPool = poolData.totalPool;
        const vigAmount = totalPool * (poolData.vigPercentage / 100);
        const totalAfterVig = totalPool - vigAmount;
        const winnerPool = poolData.optionPools[winner] || 0;
        
        if (winnerPool === 0) {
            throw new Error('No bets placed on winning option');
        }
        
        const winningMultiplier = totalAfterVig / winnerPool;
        
        // Get all betting slips for this event
        const slipsSnapshot = await db.collection('betting_slips')
            .where('eventId', '==', eventId)
            .where('status', '==', 'placed')
            .get();
        
        // Process settlements in batches
        const batch = db.batch();
        const userUpdates = {};
        
        for (const slipDoc of slipsSnapshot.docs) {
            const slip = slipDoc.data();
            const isWinner = slip.selectedOption === winner;
            
            let winAmount = 0;
            let newStatus = '';
            
            if (isWinner) {
                winAmount = slip.betAmount * winningMultiplier;
                newStatus = 'placed & won';
            } else {
                winAmount = 0;
                newStatus = 'placed & lost';
            }
            
            const netProfit = winAmount - slip.betAmount;
            
            // Update betting slip
            batch.update(slipDoc.ref, {
                status: newStatus,
                winAmount: winAmount,
                netProfit: netProfit,
                settledAt: firebase.firestore.Timestamp.now()
            });
            
            // Accumulate user balance changes
            if (!userUpdates[slip.userId]) {
                userUpdates[slip.userId] = {
                    balanceChange: 0,
                    totalWagered: 0,
                    totalWon: 0,
                    slips: []
                };
            }
            
            userUpdates[slip.userId].balanceChange += netProfit;
            userUpdates[slip.userId].totalWagered += slip.betAmount;
            userUpdates[slip.userId].totalWon += winAmount;
            userUpdates[slip.userId].slips.push({
                option: slip.selectedOption,
                amount: slip.betAmount,
                winAmount: winAmount,
                isWinner: isWinner
            });
        }
        
        // Update user balances and send notifications
        for (const [userId, userData] of Object.entries(userUpdates)) {
            const userDoc = await db.collection('users').doc(userId).get();
            const user = userDoc.data();
            
            const newBalance = user.balance + userData.balanceChange;
            const newDebt = newBalance < 0 ? Math.abs(newBalance) : 0;
            const actualBalance = Math.max(0, newBalance); // This is the actual wallet balance
            
            // Update user balance
            batch.update(userDoc.ref, {
                balance: actualBalance,
                debt: newDebt,
                totalWinnings: (user.totalWinnings || 0) + Math.max(0, userData.balanceChange)
            });
            
            // Create notification with CORRECT balance display
            const netResult = userData.balanceChange;
            const resultText = netResult > 0 ? `won ${formatCurrency(netResult)}` : `lost ${formatCurrency(Math.abs(netResult))}`;
            
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
                userId: userId,
                title: `Event Settled: ${eventData.title}`,
                message: `You wagered ${formatCurrency(userData.totalWagered)} and ${resultText}. New balance: ${formatCurrency(actualBalance)}${newDebt > 0 ? ` (Debt: ${formatCurrency(newDebt)})` : ''}`,
                timestamp: firebase.firestore.Timestamp.now(),
                read: false,
                type: 'settlement'
            });
}
        
        // Update event status
        const eventRef = db.collection('events').doc(eventId);
        batch.update(eventRef, {
            status: 'settled',
            winner: winner,
            settledAt: firebase.firestore.Timestamp.now(),
            archive_status: 'active',
            display_status: 'visible'
        });
        
        // Commit all changes
        await batch.commit();
        
        showNotification(`Event settled successfully! ${slipsSnapshot.size} bets processed.`);
        loadEventsGrid();
        
    } catch (error) {
        console.error('Error settling event:', error);
        showNotification(`Error settling event: ${error.message}`);
    }
}

async function deleteEvent(eventId) {
    if (!confirm('Delete this event? All associated bets will be cancelled.')) return;
    
    try {
        await db.collection('events').doc(eventId).delete();
        showNotification('Event deleted successfully');
        loadEventsGrid();
    } catch (error) {
        console.error('Error deleting event:', error);
    }
}


function createArchivedEventsTab() {
    return `
        <div class="form-group">
            <button class="btn btn-secondary" onclick="refreshArchivedEvents()">REFRESH</button>
            <button class="btn btn-secondary" onclick="exportArchivedEvents()">EXPORT ARCHIVED</button>
        </div>
        
        <div class="events-grid" id="archived-events-grid">
            <div style="text-align: center; grid-column: 1/-1;">Loading archived events...</div>
        </div>
    `;
}

async function loadArchivedEvents() {
    try {
        const eventsSnapshot = await db.collection('events')
            .where('archive_status', '==', 'archived')
            .orderBy('archivedAt', 'desc')
            .get();
        const archivedEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        await displayArchivedEvents(archivedEvents);
    } catch (error) {
        console.error('Error loading archived events:', error);
    }
}

async function displayArchivedEvents(archivedEvents) {
    const grid = document.getElementById('archived-events-grid');
    grid.innerHTML = '';
    
    if (archivedEvents.length === 0) {
        grid.innerHTML = '<div style="text-align: center; grid-column: 1/-1;">No archived events found.</div>';
        return;
    }
    
    for (const event of archivedEvents) {
        const card = document.createElement('div');
        card.className = 'event-card archived';
        
        const startTime = event.startTime ? new Date(event.startTime.seconds * 1000).toLocaleString() : 'TBD';
        const archivedTime = event.archivedAt ? new Date(event.archivedAt.seconds * 1000).toLocaleString() : 'Unknown';
        
        // Get vote counts for archived events too
        const voteCounts = await getEventVoteCounts(event.id);
        const voteCountsHtml = generateVoteCountsHtml(voteCounts);
        
        card.innerHTML = `
            <h3>${event.title}</h3>
            <p><strong>Start:</strong> ${startTime}</p>
            <p><strong>Archived:</strong> ${archivedTime}</p>
            <p><strong>Status:</strong> <span class="event-status ${event.status}">${event.status.toUpperCase()}</span></p>
            <p><strong>Winner:</strong> ${event.winner || 'N/A'}</p>
            <p><strong>Total Bets:</strong> ${event.totalBets || 0}</p>
            <p><strong>Total Pot:</strong> ₹${event.totalPot || 0}</p>
            ${voteCountsHtml}
            <div class="user-actions">
                <button class="btn btn-info" onclick="unarchiveEvent('${event.id}')">UNARCHIVE</button>
                <button class="btn btn-danger" onclick="permanentlyDeleteEvent('${event.id}')">PERMANENT DELETE</button>
            </div>
        `;
        
        grid.appendChild(card);
    }
}

async function unarchiveEvent(eventId) {
    if (!confirm('Unarchive this event? It will appear in active events again.')) return;
    
    try {
        await db.collection('events').doc(eventId).update({
            archive_status: 'active',
            display_status: 'visible'
        });
        
        showNotification('Event unarchived successfully');
        loadArchivedEvents();
    } catch (error) {
        console.error('Error unarchiving event:', error);
    }
}

async function permanentlyDeleteEvent(eventId) {
    if (!confirm('PERMANENTLY DELETE this event? This cannot be undone!')) return;
    if (!confirm('Are you absolutely sure? All data will be lost forever!')) return;
    
    try {
        await db.collection('events').doc(eventId).delete();
        showNotification('Event permanently deleted');
        loadArchivedEvents();
    } catch (error) {
        console.error('Error permanently deleting event:', error);
    }
}

function refreshArchivedEvents() {
    loadArchivedEvents();
    showNotification('Archived events refreshed');
}

async function hideEvent(eventId) {
    try {
        await db.collection('events').doc(eventId).update({
            display_status: 'hidden'
        });
        
        showNotification('Event hidden from homepage');
        loadEventsGrid();
    } catch (error) {
        console.error('Error hiding event:', error);
    }
}

async function showEvent(eventId) {
    try {
        await db.collection('events').doc(eventId).update({
            display_status: 'visible'
        });
        
        showNotification('Event shown on homepage');
        loadEventsGrid();
    } catch (error) {
        console.error('Error showing event:', error);
    }
}

async function archiveEvent(eventId) {
    if (!confirm('Archive this event? It will be moved to archived events.')) return;
    
    try {
        await db.collection('events').doc(eventId).update({
            archive_status: 'archived',
            display_status: 'hidden',
            archivedAt: firebase.firestore.Timestamp.now()
        });
        
        showNotification('Event archived successfully');
        loadEventsGrid();
    } catch (error) {
        console.error('Error archiving event:', error);
    }
}


// Settings Tab
function createSettingsTab() {
    return `
        <h3>Platform Settings</h3>
        <form id="settings-form">
            <div class="form-row">
                <div class="form-group">
                    <label for="vig-percentage">Default Vig Percentage (%)</label>
                    <input type="number" id="vig-percentage" min="0" max="20" step="0.1" value="${settings.vigPercentage}">
                </div>
                <div class="form-group">
                    <label for="daily-limit">Daily Buy-in Limit</label>
                    <input type="number" id="daily-limit" min="0" value="${settings.dailyBuyinLimit}">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="ad-reward">Per Ad Reward (EVC)</label>
                    <input type="number" id="ad-reward" min="0" value="${settings.perAdReward}">
                </div>
            </div>
            
            <div class="form-group">
                <label for="active-ads">Active Ad URLs (one per line)</label>
                <textarea id="active-ads" rows="5">${settings.activeAds.join('\n')}</textarea>
            </div>
            
            <button type="submit" class="btn">UPDATE SETTINGS</button>
        </form>
        
        <h3>Platform Actions</h3>
        <div class="form-group">
            <button class="btn btn-warning" onclick="sendBulkMessage()">SEND BULK MESSAGE</button>
            <button class="btn btn-secondary" onclick="exportAllData()">EXPORT ALL DATA</button>
            <button class="btn btn-danger" onclick="resetDailyLimits()">RESET DAILY LIMITS</button>
        </div>
    `;
}

function loadSettingsForm() {
    document.getElementById('settings-form').addEventListener('submit', updateSettings);
}

async function updateSettings(e) {
    e.preventDefault();
    
    const newSettings = {
        vigPercentage: parseFloat(document.getElementById('vig-percentage').value),
        dailyBuyinLimit: parseInt(document.getElementById('daily-limit').value),
        perAdReward: parseInt(document.getElementById('ad-reward').value),
        activeAds: document.getElementById('active-ads').value.split('\n').filter(url => url.trim())
    };
    
    try {
        await db.collection('settings').doc('global').set(newSettings);
        settings = newSettings;
        showNotification('Settings updated successfully');
    } catch (error) {
        console.error('Error updating settings:', error);
    }
}

// Messages Tab
function createMessagesTab() {
    return `
        <div class="form-group">
            <button class="btn" onclick="showModal('send-message-modal')">SEND MESSAGE</button>
            <button class="btn btn-secondary" onclick="loadMessageHistory()">REFRESH</button>
        </div>
        
        <h3>Recent Messages</h3>
        <div class="logs-container" id="message-history">
            <div class="log-entry">Loading message history...</div>
        </div>
    `;
}


async function loadMessageHistory() {
    try {
        const messagesSnapshot = await db.collection('notifications')
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();

        const container = document.getElementById('message-history');
        container.innerHTML = '';

        messagesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const entry = document.createElement('div');
            entry.className = 'log-entry';

            const timestamp = data.timestamp?.toDate().toLocaleString() || 'Unknown time';
            entry.innerHTML = `
                <span class="log-timestamp">[${timestamp}]</span>
                <span>${data.title} → ${data.message}</span>
            `;

            container.appendChild(entry);
        });
    } catch (error) {
        console.error('Error loading message history:', error);
        document.getElementById('message-history').innerHTML =
            `<div class="log-entry">Error loading messages</div>`;
    }
}


async function sendMessage(e) {
    e.preventDefault();
    
    const messageType = document.getElementById('message-type').value;
    const subject = document.getElementById('message-subject').value;
    const content = document.getElementById('message-content').value;
    
    try {
        let targetUsers = [];
        
        switch(messageType) {
            case 'individual':
                targetUsers = [document.getElementById('target-user').value];
                break;
            case 'multiple':
                targetUsers = Array.from(document.getElementById('target-user').selectedOptions).map(opt => opt.value);
                break;
            case 'bulk':
                targetUsers = users.map(u => u.id);
                break;
            case 'kyc-pending':
                targetUsers = users.filter(u => u.kycStatus === 'pending').map(u => u.id);
                break;
            case 'debt':
                targetUsers = users.filter(u => u.debt > 0).map(u => u.id);
                break;
        }

        
        // Send notifications to all target users
        const batch = db.batch();
        targetUsers.forEach(userId => {
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
                userId: userId,
                title: subject,
                message: content,
                timestamp: firebase.firestore.Timestamp.now(),
                read: false,
                type: 'admin'
            });
        });
        
        await batch.commit();
        
        closeModal('send-message-modal');
        showNotification(`Message sent to ${targetUsers.length} users`);
        
        // Reset form
        document.getElementById('send-message-form').reset();
        
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

function handleMessageTypeChange() {
    const messageType = document.getElementById('message-type').value;
    const userSelectGroup = document.getElementById('user-select-group');
    
    if (messageType === 'individual' || messageType === 'multiple') {
        userSelectGroup.style.display = 'block';
        loadUsersList();
    } else {
        userSelectGroup.style.display = 'none';
    }
}


function loadUsersList() {
    const select = document.getElementById('target-user');
    select.innerHTML = '';
    
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.displayName} (@${user.nickname})`;
        select.appendChild(option);
    });
}


// Analytics Tab
function createAnalyticsTab() {
    return `
        <div class="analytics-controls">
            <div class="form-group">
                <label for="analytics-period">Time Period:</label>
                <select id="analytics-period" onchange="loadAnalyticsData()">
                    <option value="daily">Today</option>
                    <option value="weekly">This Week</option>
                    <option value="monthly">This Month</option>
                    <option value="all">All Time</option>
                </select>
                <button class="btn btn-secondary" onclick="exportAnalytics()">EXPORT ANALYTICS</button>
            </div>
        </div>

        <div class="stats-grid" id="analytics-stats">
            <div class="stat-card">
                <div class="stat-value" id="period-signups">0</div>
                <div class="stat-label" id="signups-label">Signups</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="period-bets">0</div>
                <div class="stat-label" id="bets-label">Bets Placed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="period-ads-viewed">0</div>
                <div class="stat-label" id="ads-viewed-label">Ads Viewed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="period-ads-clicked">0</div>
                <div class="stat-label" id="ads-clicked-label">Ads Clicked</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="period-buyins">₹0</div>
                <div class="stat-label" id="buyins-label">Buy-ins</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="period-wagered">₹0</div>
                <div class="stat-label" id="wagered-label">Money Wagered</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="conversion-rate">0%</div>
                <div class="stat-label">KYC Conversion</div>
            </div>
        </div>
        
        <div class="charts-container">
            <div class="chart-row">
                <div class="chart-section">
                    <h3>Activity Overview</h3>
                    <canvas id="activityChart" width="400" height="200"></canvas>
                </div>
                <div class="chart-section">
                    <h3>Revenue Breakdown</h3>
                    <canvas id="revenueChart" width="400" height="200"></canvas>
                </div>
            </div>
            
            <div class="chart-row">
                <div class="chart-section">
                    <h3>User Engagement Trends</h3>
                    <canvas id="engagementChart" width="800" height="300"></canvas>
                </div>
            </div>
            
            <div class="chart-row">
                <div class="chart-section">
                    <h3>Top User Activities</h3>
                    <canvas id="userActivitiesChart" width="400" height="200"></canvas>
                </div>
                <div class="chart-section">
                    <h3>Platform Health</h3>
                    <canvas id="healthChart" width="400" height="200"></canvas>
                </div>
            </div>
        </div>
    `;
}

let analyticsCharts = {};

async function loadAnalyticsData() {
    try {
        const period = document.getElementById('analytics-period')?.value || 'daily';
        const { startDate, endDate } = getDateRange(period);
        
        // Update labels based on period
        updatePeriodLabels(period);
        
        // Load all analytics data
        const [
            signupsData,
            betsData, 
            adsData,      // This now returns {views, clicks}
            buyinsData,
            activityData,
            usersData
        ] = await Promise.all([
            getSignupsData(startDate, endDate),
            getBetsData(startDate, endDate),
            getAdsData(startDate, endDate),    // Updated function
            getBuyinsData(startDate, endDate),
            getActivityData(startDate, endDate),
            getUsersData()
        ]);
        
        // Update stat cards
        updateStatCards(signupsData, betsData, adsData, buyinsData, usersData);
        
        // Create/update charts
        createCharts(period, activityData, buyinsData, betsData, adsData, usersData);
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        showNotification('Error loading analytics data');
    }
}

function getDateRange(period) {
    const now = new Date();
    let startDate, endDate = new Date();
    
    switch(period) {
        case 'daily':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'weekly':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;
        case 'monthly':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'all':
        default:
            startDate = new Date(2020, 0, 1); // Far back date
            break;
    }
    
    return { 
        startDate: firebase.firestore.Timestamp.fromDate(startDate), 
        endDate: firebase.firestore.Timestamp.fromDate(endDate) 
    };
}

function updatePeriodLabels(period) {
    const labels = {
        daily: 'Today',
        weekly: 'This Week', 
        monthly: 'This Month',
        all: 'All Time'
    };
    
    const suffix = labels[period];
    document.getElementById('signups-label').textContent = `Signups (${suffix})`;
    document.getElementById('bets-label').textContent = `Bets (${suffix})`;
    document.getElementById('ads-viewed-label').textContent = `Ads Viewed (${suffix})`;
    document.getElementById('ads-clicked-label').textContent = `Ads Clicked (${suffix})`;
    document.getElementById('buyins-label').textContent = `Buy-ins (${suffix})`;
    document.getElementById('wagered-label').textContent = `Wagered (${suffix})`;
}

async function getSignupsData(startDate, endDate) {
    const snapshot = await db.collection('users')
        .where('registrationDate', '>=', startDate)
        .where('registrationDate', '<=', endDate)
        .get();
    return snapshot.size;
}

async function getBetsData(startDate, endDate) {
    const snapshot = await db.collection('activity_logs')
        .where('action', '==', 'bet_placed')
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();
    
    let totalWagered = 0;
    snapshot.docs.forEach(doc => {
        const amount = doc.data().data?.amount || 0;
        totalWagered += amount;
    });
    
    return { count: snapshot.size, totalWagered };
}

async function getAdsData(startDate, endDate) {
    const [viewsSnapshot, clicksSnapshot] = await Promise.all([
        db.collection('activity_logs')
            .where('action', '==', 'ad_view')
            .where('timestamp', '>=', startDate)
            .where('timestamp', '<=', endDate)
            .get(),
        db.collection('activity_logs')
            .where('action', '==', 'ad_click')
            .where('timestamp', '>=', startDate)
            .where('timestamp', '<=', endDate)
            .get()
    ]);
    
    return { 
        views: viewsSnapshot.size, 
        clicks: clicksSnapshot.size 
    };
}

async function getBuyinsData(startDate, endDate) {
    const snapshot = await db.collection('activity_logs')
        .where('action', '==', 'buyin')
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();
        
    let totalBuyins = 0;
    snapshot.docs.forEach(doc => {
        const amount = doc.data().data?.amount || 0;
        totalBuyins += amount;
    });
    
    return { count: snapshot.size, totalAmount: totalBuyins };
}

async function getActivityData(startDate, endDate) {
    const snapshot = await db.collection('activity_logs')
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .orderBy('timestamp', 'desc')
        .get();
        
    const activities = {};
    const dailyActivity = {};
    
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const action = data.action;
        const date = data.timestamp.toDate().toDateString();
        
        // Count by action type
        activities[action] = (activities[action] || 0) + 1;
        
        // Count by date
        if (!dailyActivity[date]) dailyActivity[date] = 0;
        dailyActivity[date]++;
    });
    
    return { activities, dailyActivity, total: snapshot.size };
}

async function getUsersData() {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => doc.data());
    
    const approved = users.filter(u => u.kycStatus === 'approved').length;
    const pending = users.filter(u => u.kycStatus === 'pending').length;
    const debt = users.filter(u => u.debt > 0).length;
    
    return { total: users.length, approved, pending, debt };
}

function updateStatCards(signups, bets, ads, buyins, usersData) {
    document.getElementById('period-signups').textContent = signups;
    document.getElementById('period-bets').textContent = bets.count;
    document.getElementById('period-ads-viewed').textContent = ads.views;
    document.getElementById('period-ads-clicked').textContent = ads.clicks;
    document.getElementById('period-buyins').textContent = formatCurrency(buyins.totalAmount);
    document.getElementById('period-wagered').textContent = formatCurrency(bets.totalWagered);
    
    const conversionRate = usersData.total > 0 ? 
        ((usersData.approved / usersData.total) * 100).toFixed(1) : 0;
    document.getElementById('conversion-rate').textContent = conversionRate + '%';
}

function createCharts(period, activityData, buyinsData, betsData, adsData, usersData) {
    // Destroy existing charts
    Object.values(analyticsCharts).forEach(chart => {
        if (chart) chart.destroy();
    });
    analyticsCharts = {};
    
    // Activity Overview Chart
    const activityCtx = document.getElementById('activityChart')?.getContext('2d');
    if (activityCtx) {
        analyticsCharts.activity = new Chart(activityCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(activityData.activities),
                datasets: [{
                    data: Object.values(activityData.activities),
                    backgroundColor: [
                        '#9ef01a', '#ff0a54', '#ffa500', '#00d4ff', 
                        '#ff6b9d', '#a78bfa', '#10b981', '#f59e0b'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { 
                        labels: { color: '#FFF3DA' }
                    }
                }
            }
        });
    }
    
    // Revenue Chart - UPDATE this section
    const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
    if (revenueCtx) {
        analyticsCharts.revenue = new Chart(revenueCtx, {
            type: 'pie',
            data: {
                labels: ['Buy-ins', 'Ad Revenue (Completed)', 'Betting Fees'],
                datasets: [{
                    data: [
                        buyinsData.totalAmount,
                        adsData.views * settings.perAdReward, // Only count completed views for revenue
                        betsData.totalWagered * (settings.vigPercentage / 100)
                    ],
                    backgroundColor: ['#9ef01a', '#ffa500', '#ff0a54']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { 
                        labels: { color: '#FFF3DA' }
                    }
                }
            }
        });
    }
    
    // Engagement Trends - REPLACE the existing engagement chart code
    const engagementCtx = document.getElementById('engagementChart')?.getContext('2d');
    if (engagementCtx && Object.keys(activityData.dailyActivity).length > 0) {
        const dates = Object.keys(activityData.dailyActivity).sort();
        
        // Fill in missing dates to ensure consecutive display
        const startDate = new Date(dates[0]);
        const endDate = new Date(dates[dates.length - 1]);
        const allDates = [];
        const allCounts = [];
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateString = d.toDateString();
            allDates.push(d.toLocaleDateString());
            allCounts.push(activityData.dailyActivity[dateString] || 0);
        }
        
        analyticsCharts.engagement = new Chart(engagementCtx, {
            type: 'line',
            data: {
                labels: allDates,
                datasets: [{
                    label: 'Daily Activity',
                    data: allCounts,
                    borderColor: '#9ef01a',
                    backgroundColor: 'rgba(158, 240, 26, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { 
                        ticks: { color: '#FFF3DA' },
                        grid: { color: '#333' },
                        beginAtZero: true
                    },
                    x: { 
                        ticks: { color: '#FFF3DA' },
                        grid: { color: '#333' }
                    }
                },
                plugins: {
                    legend: { 
                        labels: { color: '#FFF3DA' }
                    }
                }
            }
        });
    }
    
    // User Activities Bar Chart
    const userActivitiesCtx = document.getElementById('userActivitiesChart')?.getContext('2d');
    if (userActivitiesCtx) {
        const topActivities = Object.entries(activityData.activities)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 6);
            
        analyticsCharts.userActivities = new Chart(userActivitiesCtx, {
            type: 'bar',
            data: {
                labels: topActivities.map(([action]) => action.replace('_', ' ')),
                datasets: [{
                    label: 'Count',
                    data: topActivities.map(([, count]) => count),
                    backgroundColor: '#9ef01a',
                    borderColor: '#7bc908',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { 
                        ticks: { color: '#FFF3DA' },
                        grid: { color: '#333' }
                    },
                    x: { 
                        ticks: { color: '#FFF3DA' },
                        grid: { color: '#333' }
                    }
                },
                plugins: {
                    legend: { 
                        labels: { color: '#FFF3DA' }
                    }
                }
            }
        });
    }
    
    // Platform Health
    const healthCtx = document.getElementById('healthChart')?.getContext('2d');
    if (healthCtx) {
        analyticsCharts.health = new Chart(healthCtx, {
            type: 'doughnut',
            data: {
                labels: ['Approved KYC', 'Pending KYC', 'Users with Debt'],
                datasets: [{
                    data: [usersData.approved, usersData.pending, usersData.debt],
                    backgroundColor: ['#9ef01a', '#ffa500', '#ff0a54']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { 
                        labels: { color: '#FFF3DA' }
                    }
                }
            }
        });
    }
}

function exportAnalytics() {
    const period = document.getElementById('analytics-period').value;
    const data = {
        period: period,
        signups: document.getElementById('period-signups').textContent,
        bets: document.getElementById('period-bets').textContent,
        ads: document.getElementById('period-ads').textContent,
        buyins: document.getElementById('period-buyins').textContent,
        wagered: document.getElementById('period-wagered').textContent,
        conversion: document.getElementById('conversion-rate').textContent,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `predictking-analytics-${period}-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function createInboxTab() {
    return `
        <h3>📥 Complaints Inbox</h3>
        <div class="logs-container" id="complaints-list">
            <div class="log-entry">Loading complaints...</div>
        </div>
    `;
}

async function loadInbox() {
    try {
        const complaintsSnapshot = await db.collection('admin_complaints')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();

        const container = document.getElementById('complaints-list');
        container.innerHTML = '';

        for (const doc of complaintsSnapshot.docs) {
            const data = doc.data();
            const user = users.find(u => u.id === data.userId);

            const displayName = user ? user.displayName : "Unknown";
            const nickname = user ? user.nickname : "";
            // ✅ if complaintNumber missing in complaint doc, fallback to user.complaintCount
            const complaintNumber = data.complaintNumber || 69; // Use stored number or default to 1
            const timestamp = data.timestamp?.toDate().toLocaleString() || "Unknown";

            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.innerHTML = `
                <span class="log-timestamp">[${timestamp}]</span>
                <strong>${displayName} (@${nickname})</strong><br>
                Complaint #${complaintNumber}: ${data.complaintText}
                <div class="user-actions">
                    <button class="btn btn-secondary" onclick="replyToComplaint('${data.userId}', ${complaintNumber})">Reply</button>
                </div>
            `;

            container.appendChild(entry);
        }
    } catch (error) {
        console.error('Error loading inbox:', error);
    }
}



async function replyToComplaint(userId, complaintNumber) {
    const replyMessage = prompt("Enter your reply:");
    if (!replyMessage) return;

    try {
        await db.collection('notifications').add({
            userId: userId,
            title: `Reply to Complaint ${complaintNumber}`,
            message: replyMessage,
            timestamp: firebase.firestore.Timestamp.now(),
            read: false,
            type: 'admin-reply'
        });

        showNotification(`Reply sent for complaint #${complaintNumber}`);
    } catch (error) {
        console.error('Error sending reply:', error);
    }
}



// Utility Functions
function formatCurrency(amount, currency = 'INR') {
    const symbols = { INR: '₹', USD: '$', EUR: '€' };
    return `${symbols[currency] || '₹'}${amount}`;
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    const text = document.getElementById('notification-text');
    
    text.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Data Loading Functions
async function loadUsers() {
    try {
        const usersSnapshot = await db.collection('users').get();
        users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadEvents() {
    try {
        const eventsSnapshot = await db.collection('events').get();
        events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

async function loadSettings() {
    try {
        const settingsDoc = await db.collection('settings').doc('global').get();
        if (settingsDoc.exists) {
            settings = { ...settings, ...settingsDoc.data() };
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function loadAnalytics() {
    try {
        const analyticsDoc = await db.collection('analytics').doc('summary').get();
        if (analyticsDoc.exists) {
            analytics = analyticsDoc.data();
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// Refresh Functions
function refreshUsers() {
    loadUsers().then(() => {
        if (document.getElementById('users-tbody')) {
            displayUsersTable();
        }
        showNotification('Users refreshed');
    });
}

function refreshEvents() {
    loadEvents().then(() => {
        if (document.getElementById('events-grid')) {
            displayEventsGrid();
        }
        showNotification('Events refreshed');
    });
}

// Real-time Updates
function startRealTimeUpdates() {
    // Listen for new users
    db.collection('users').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                console.log('New user registered:', change.doc.data().nickname);
            }
        });
    });
    
    // Listen for new activity
    db.collection('activity_logs')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .onSnapshot(snapshot => {
            if (document.getElementById('recent-logs')) {
                loadDashboardData();
            }
        });
}

// Export Functions
function exportUsers() {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Nickname,Display Name,Email,KYC Status,Rep Score,Balance,Debt,Instagram\n"
        + users.map(u => 
            `${u.nickname},${u.displayName},${u.email || ''},${u.kycStatus},${u.repScore},${u.balance},${u.debt || 0},${u.instagram}`
        ).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `predictking-users-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportAllData() {
    const allData = {
        users: users,
        events: events,
        settings: settings,
        analytics: analytics,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `predictking-full-export-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Bulk Actions
async function sendBulkMessage() {
    const message = prompt('Enter message to send to all users:');
    if (!message) return;
    
    try {
        const batch = db.batch();
        users.forEach(user => {
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
                userId: user.id,
                title: 'Important Announcement',
                message: message,
                timestamp: firebase.firestore.Timestamp.now(),
                read: false,
                type: 'admin'
            });
        });
        
        await batch.commit();
        showNotification(`Bulk message sent to ${users.length} users`);
    } catch (error) {
        console.error('Error sending bulk message:', error);
    }
}

async function resetDailyLimits() {
    if (!confirm('Reset daily buy-in limits for all users?')) return;
    
    try {
        const batch = db.batch();
        users.forEach(user => {
            const userRef = db.collection('users').doc(user.id);
            batch.update(userRef, {
                dailyBuyinUsed: 0,
                lastBuyinReset: firebase.firestore.Timestamp.now()
            });
        });
        
        await batch.commit();
        showNotification('Daily limits reset for all users');
    } catch (error) {
        console.error('Error resetting daily limits:', error);
    }
}

// Modal close on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}
