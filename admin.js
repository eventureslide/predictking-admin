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
    document.getElementById('edit-event-form').addEventListener('submit', updateEvent);
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
        
        // Calculate wallet balance (balance - debt)
        const walletBalance = user.balance - (user.debt || 0);
        const balanceClass = walletBalance < 0 ? 'debt-amount' : '';
        const balanceDisplay = `<span class="${balanceClass}" style="color: ${walletBalance < 0 ? '#ffc857' : '#9ef01a'};">${formatCurrency(walletBalance, user.currency)}</span>`;
                    
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
        // When admin sets balance directly, we need to adjust balance and debt properly
        // If newBalance is negative, set debt to 0 and balance to the negative value
        // If newBalance is positive, set debt to 0 and balance to the positive value
        // The wallet balance (balance - debt) should equal what admin entered
        
        let actualBalance, actualDebt;
        
        if (newBalance < 0) {
            // For negative wallet balance: set balance to 0 and debt to absolute value
            actualBalance = 0;
            actualDebt = Math.abs(newBalance);
        } else {
            // For positive wallet balance: set balance to the value and debt to 0
            actualBalance = newBalance;
            actualDebt = 0;
        }
        
        await db.collection('users').doc(userId).update({
            balance: actualBalance,
            debt: actualDebt
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
        // Force fresh data fetch
        const eventsSnapshot = await db.collection('events').orderBy('startTime', 'desc').get();
        // Get fresh event data each time
        events = [];
        for (const doc of eventsSnapshot.docs) {
            const freshDoc = await db.collection('events').doc(doc.id).get();
            events.push({ id: doc.id, ...freshDoc.data() });
        }
        console.log('Loaded fresh events data:', events);
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
        
        // Get settlement data if event is settled
        const settlementData = await getEventSettlement(event.id);
        const settlementHtml = generateSettlementHtml(settlementData);
        
        // Get current odds from betting pool
        // Get both initial and current odds
        const oddsHtml = await generateOddsHtml(event.id, event);
        
        card.innerHTML = `
            <h3>${event.title}</h3>
            <p><strong>Sport:</strong> <span style="color: #ffa500; font-weight: bold;">${event.sportType || 'Not Set'}</span></p>
            <p><strong>Start:</strong> ${startTime}</p>
            <p><strong>Status:</strong> <span class="event-status ${event.status}">${event.status.toUpperCase()}</span></p>
            <p><strong>Display:</strong> <span class="event-status ${event.display_status || 'visible'}">${(event.display_status || 'visible').toUpperCase()}</span></p>
            <p><strong>Total Bets:</strong> ${event.totalBets || 0}</p>
            <p><strong>Total Pot:</strong> ₹${event.totalPot || 0}</p>
            ${voteCountsHtml}
            ${oddsHtml}
            ${settlementHtml}
            <div class="user-actions">
                <button class="btn btn-secondary" onclick="editEvent('${event.id}')">EDIT</button>
                <button class="btn btn-info" onclick="refreshEventOdds('${event.id}')">REFRESH ODDS</button>
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

// Get settlement data for a specific event
async function getEventSettlement(eventId) {
    try {
        const settlementSnapshot = await db.collection('event_settlements')
            .where('eventId', '==', eventId)
            .limit(1)
            .get();
        
        if (!settlementSnapshot.empty) {
            return settlementSnapshot.docs[0].data();
        }
        return null;
    } catch (error) {
        console.error('Error getting settlement data:', error);
        return null;
    }
}

// Generate HTML for displaying settlement data
function generateSettlementHtml(settlementData) {
    if (!settlementData) {
        return '';
    }
    
    const settledTime = settlementData.settledAt ? 
        new Date(settlementData.settledAt.seconds * 1000).toLocaleString() : 'Unknown';
    
    let vigStatsHtml = '';
    if (settlementData.vigStats) {
        const stats = settlementData.vigStats;
        const statusColor = stats.isHealthy ? '#9ef01a' : '#ff0a54';
        const actualVig = stats.actualVig || stats.profitLoss;
        const profitLossText = actualVig >= 0 ? `+₹${Math.floor(actualVig)}` : `₹${Math.floor(actualVig)}`;
        
        vigStatsHtml = `
            <p><strong>Algorithm Health:</strong> 
                <span style="color: ${statusColor}; font-weight: bold;">
                    ${stats.healthStatus.toUpperCase()}, ${profitLossText}
                </span>
            </p>
            <p><strong>Expected Vig:</strong> ₹${Math.floor(stats.expectedVig)} | <strong>Actual Vig:</strong> ₹${Math.floor(actualVig)}</p>
        `;
    }
    
    return `
        <div class="settlement-info" style="background: rgba(158, 240, 26, 0.1); padding: 8px; border-radius: 4px; margin: 8px 0;">
            <h4 style="margin: 0 0 4px 0; color: #9ef01a;">Settlement Details</h4>
            <p><strong>Winner:</strong> ${settlementData.winner}</p>
            <p><strong>Settled:</strong> ${settledTime}</p>
            <p><strong>Total Bets Settled:</strong> ${settlementData.totalBetsSettled}</p>
            <p><strong>Winners Won:</strong> ₹${Math.floor(settlementData.winnersWin || 0)}</p>
            <p><strong>Losers Lost:</strong> ₹${Math.floor(settlementData.losersLose || 0)}</p>
            <p><strong>My Vig:</strong> ₹${Math.floor(settlementData.myVig)} (${settlementData.vigPercentage}%)</p>
            ${vigStatsHtml}
        </div>
    `;
}

// Generate HTML for displaying current odds
// Generate HTML for displaying both initial and current odds
async function generateOddsHtml(eventId, event) {
    try {
        const initialOdds = event.initialOdds || {};
        let currentOdds = event.currentOdds || {};
        
        // Debug logging
        console.log(`Event ${eventId} - Initial Odds:`, initialOdds);
        console.log(`Event ${eventId} - Current Odds from event:`, currentOdds);
        
        // Try to get most up-to-date current odds from betting pool
        try {
            const poolDoc = await db.collection('betting_pools').doc(eventId).get();
            if (poolDoc.exists) {
                const poolData = poolDoc.data();
                if (poolData.currentOdds) {
                    currentOdds = poolData.currentOdds;
                    console.log(`Event ${eventId} - Current Odds from betting pool:`, currentOdds);
                }
            }
        } catch (poolError) {
            console.log('No betting pool found, using event currentOdds');
        }
        
        // Also try to fetch fresh event data directly
        try {
            const eventDoc = await db.collection('events').doc(eventId).get();
            if (eventDoc.exists) {
                const freshEventData = eventDoc.data();
                if (freshEventData.currentOdds) {
                    currentOdds = freshEventData.currentOdds;
                    console.log(`Event ${eventId} - Fresh Current Odds from events collection:`, currentOdds);
                }
            }
        } catch (fetchError) {
            console.log('Error fetching fresh event data:', fetchError);
        }
        
        let oddsHtml = '';
        
        // Get the order from initial odds to maintain consistency
        const teamOrder = Object.keys(initialOdds);
        
        // Display Initial Odds
        if (Object.keys(initialOdds).length > 0) {
            const initialOddsItems = teamOrder
                .map(team => `${team}: ${parseFloat(initialOdds[team]).toFixed(2)}x`)
                .join(', ');
            oddsHtml += `<p><strong>Initial Odds:</strong> ${initialOddsItems}</p>`;
        }
        
        // Display Current Odds
        if (Object.keys(currentOdds).length > 0) {
            const currentOddsItems = teamOrder
                .map(team => {
                    const odds = currentOdds[team];
                    return odds ? `${team}: ${parseFloat(odds).toFixed(2)}x` : `${team}: N/A`;
                })
                .join(', ');
            
            oddsHtml += `<p><strong>Current Odds:</strong> ${currentOddsItems}</p>`;
        } else {
            oddsHtml += `<p><strong>Current Odds:</strong> <span style="color: #ffa500;">No current odds found</span></p>`;
        }
        
        if (oddsHtml === '') {
            return '<p><strong>Odds:</strong> Not set</p>';
        }
        
        return oddsHtml;
    } catch (error) {
        console.error('Error getting odds:', error);
        return '<p><strong>Odds:</strong> Error loading</p>';
    }
}

function generateOddsInputs() {
    const optionsText = document.getElementById('event-options').value;
    const options = optionsText.split('\n').filter(opt => opt.trim());
    const oddsContainer = document.getElementById('odds-container');
    const oddsInputsDiv = document.getElementById('odds-inputs');
    
    if (options.length < 2) {
        oddsContainer.style.display = 'none';
        return;
    }
    
    oddsContainer.style.display = 'block';
    oddsInputsDiv.innerHTML = '';
    
    options.forEach((option, index) => {
        const inputGroup = document.createElement('div');
        inputGroup.className = 'form-row';
        inputGroup.innerHTML = `
            <div class="form-group" style="flex: 1;">
                <label for="odds-${index}">${option.trim()} - Initial Odds</label>
                <input type="number" id="odds-${index}" min="1.01" max="50" step="0.01" value="2.00" required>
            </div>
        `;
        oddsInputsDiv.appendChild(inputGroup);
    });
}

// Replace the entire createEvent function with:
async function createEvent(e) {
    e.preventDefault();
    
    const startTimeInput = document.getElementById('event-start').value;
    if (!startTimeInput) {
        showNotification('Please select start time');
        return;
    }
    
    const options = document.getElementById('event-options').value.split('\n').filter(opt => opt.trim());
    
    if (options.length < 2) {
        showNotification('Please add at least 2 betting options');
        return;
    }
    
    // Collect initial odds for each option
    const initialOdds = {};
    let hasValidOdds = true;
    
    options.forEach((option, index) => {
        const oddsInput = document.getElementById(`odds-${index}`);
        const oddsValue = parseFloat(oddsInput.value);
        
        if (isNaN(oddsValue) || oddsValue < 1.01) {
            hasValidOdds = false;
            return;
        }
        
        initialOdds[option.trim()] = oddsValue;
    });
    
    if (!hasValidOdds) {
        showNotification('Please enter valid odds (minimum 1.01) for all options');
        return;
    }
    
    const eventData = {
        title: document.getElementById('event-title').value,
        description: document.getElementById('event-description').value || '',
        sportType: document.getElementById('event-sport-type').value.trim(),
        profilePic: document.getElementById('event-profile-pic').value,
        backgroundImage1: document.getElementById('event-background1').value || '',
        backgroundImage2: document.getElementById('event-background2').value || '',
        backgroundImage3: document.getElementById('event-background3').value || '',
        backgroundImage4: document.getElementById('event-background4').value || '',
        team1Logo: document.getElementById('event-team1-logo').value || '',
        team2Logo: document.getElementById('event-team2-logo').value || '',
        statusColor: document.getElementById('event-status-color').value || '#9ef01a',
        startTime: firebase.firestore.Timestamp.fromDate(new Date(startTimeInput)),
        vigPercentage: parseInt(document.getElementById('event-vig').value) || 5,
        options: options,
        initialOdds: initialOdds,
        currentOdds: {...initialOdds},
        status: 'active',
        display_status: 'visible',
        archive_status: 'active',
        totalBets: 0,
        totalPot: 0,
        createdAt: firebase.firestore.Timestamp.now()
    };
    
    try {
        const eventRef = await db.collection('events').add(eventData);
        
        // Initialize betting pool with initial odds
        await db.collection('betting_pools').doc(eventRef.id).set({
            eventId: eventRef.id,
            totalPool: 0,
            vigPercentage: eventData.vigPercentage,
            optionPools: options.reduce((acc, option) => {
                acc[option.trim()] = 0;
                return acc;
            }, {}),
            currentOdds: {...initialOdds},
            initialOdds: {...initialOdds},
            lastUpdated: firebase.firestore.Timestamp.now()
        });
        
        closeModal('create-event-modal');
        showNotification('Event created successfully with initial odds');
        loadEventsGrid();
        
        // Reset form
        document.getElementById('create-event-form').reset();
        document.getElementById('odds-container').style.display = 'none';
    } catch (error) {
        console.error('Error creating event:', error);
        showNotification('Error creating event');
    }
}

function editEvent(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) {
        showNotification('Event not found');
        return;
    }
    
    // Populate the edit form with current event data
    document.getElementById('edit-event-id').value = eventId;
    document.getElementById('edit-event-title').value = event.title || '';
    document.getElementById('edit-event-description').value = event.description || '';
    document.getElementById('edit-event-sport-type').value = event.sportType || '';
    document.getElementById('edit-event-profile-pic').value = event.profilePic || '';
    document.getElementById('edit-event-background1').value = event.backgroundImage1 || event.backgroundImage || '';
    document.getElementById('edit-event-background2').value = event.backgroundImage2 || '';
    document.getElementById('edit-event-background3').value = event.backgroundImage3 || '';
    document.getElementById('edit-event-background4').value = event.backgroundImage4 || '';
    document.getElementById('edit-event-team1-logo').value = event.team1Logo || '';
    document.getElementById('edit-event-team2-logo').value = event.team2Logo || '';
    document.getElementById('edit-event-status-color').value = event.statusColor || '#9ef01a';
    document.getElementById('edit-event-vig').value = event.vigPercentage || 5;
    document.getElementById('edit-event-status').value = event.status || 'active';
    
    // Convert timestamp to datetime-local format
    if (event.startTime) {
        const date = event.startTime.toDate();
        const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('edit-event-start').value = localDateTime;
    }
    
    showModal('edit-event-modal');
}

async function updateEvent(e) {
    e.preventDefault();
    
    const eventId = document.getElementById('edit-event-id').value;
    const startTimeInput = document.getElementById('edit-event-start').value;
    
    if (!startTimeInput) {
        showNotification('Please select start time');
        return;
    }
    
    const updatedData = {
        title: document.getElementById('edit-event-title').value,
        description: document.getElementById('edit-event-description').value || '',
        sportType: document.getElementById('edit-event-sport-type').value.trim(),
        profilePic: document.getElementById('edit-event-profile-pic').value,
        backgroundImage1: document.getElementById('edit-event-background1').value || '',
        backgroundImage2: document.getElementById('edit-event-background2').value || '',
        backgroundImage3: document.getElementById('edit-event-background3').value || '',
        backgroundImage4: document.getElementById('edit-event-background4').value || '',
        team1Logo: document.getElementById('edit-event-team1-logo').value || '',
        team2Logo: document.getElementById('edit-event-team2-logo').value || '',
        statusColor: document.getElementById('edit-event-status-color').value || '#9ef01a',
        startTime: firebase.firestore.Timestamp.fromDate(new Date(startTimeInput)),
        vigPercentage: parseInt(document.getElementById('edit-event-vig').value) || 5,
        status: document.getElementById('edit-event-status').value.toLowerCase().trim(),
        updatedData: firebase.firestore.Timestamp.now()
    };
    
    try {
        await db.collection('events').doc(eventId).update(updatedData);
        
        closeModal('edit-event-modal');
        showNotification('Event updated successfully');
        loadEventsGrid();
    } catch (error) {
        console.error('Error updating event:', error);
        showNotification('Error updating event');
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
        
        const totalPool = poolData.totalPool || 0;
        const vigPercentage = poolData.vigPercentage || 5;
        
        // Get all betting slips for this event
        const slipsSnapshot = await db.collection('betting_slips')
            .where('eventId', '==', eventId)
            .where('status', '==', 'placed')
            .get();
        
        // Process settlements in batches
        const batch = db.batch();
        const userUpdates = {};
        
        let winnersWin = 0;
        let losersLose = 0;
        let totalBetsSettled = 0;
        
        for (const slipDoc of slipsSnapshot.docs) {
            const slip = slipDoc.data();
            const isWinner = slip.selectedOption === winner;
            totalBetsSettled++;
            
            let winAmount = 0;
            let newStatus = '';
            
            if (isWinner) {
                // Winner gets payout based on their LOCKED ODDS
                winAmount = Math.floor(slip.potentialWinning || (slip.betAmount * (slip.odds || 2.0)));
                newStatus = 'placed & won';
                winnersWin += winAmount;
            } else {
                // Loser loses their bet amount
                winAmount = 0;
                newStatus = 'placed & lost';
                losersLose += (slip.betAmount || 0);
            }
            
            // Update betting slip
            batch.update(slipDoc.ref, {
                status: newStatus,
                actualWinning: winAmount,
                settledAt: firebase.firestore.Timestamp.now()
            });
            
            // Accumulate user balance changes
            if (!userUpdates[slip.userId]) {
                userUpdates[slip.userId] = {
                    balanceToAdd: 0,
                    totalWagered: 0,
                    totalWon: 0,
                    slips: []
                };
            }
            
            userUpdates[slip.userId].balanceToAdd += isWinner ? winAmount : 0;
            userUpdates[slip.userId].totalWagered += (slip.betAmount || 0);
            userUpdates[slip.userId].totalWon += winAmount;
            userUpdates[slip.userId].slips.push({
                option: slip.selectedOption,
                amount: slip.betAmount || 0,
                winAmount: winAmount,
                isWinner: isWinner
            });
        }
        
        // Update user balances and send notifications
        for (const [userId, userData] of Object.entries(userUpdates)) {
            if (userData.balanceToAdd > 0) {
                // Winners get balance updates
                const userDoc = await db.collection('users').doc(userId).get();
                const user = userDoc.data();
                
                const newBalance = (user.balance || 0) + userData.balanceToAdd;
                
                batch.update(userDoc.ref, {
                    balance: Math.floor(newBalance),
                    totalWinnings: (user.totalWinnings || 0) + userData.balanceToAdd
                });
                
                const walletBalance = newBalance - (user.debt || 0);
                
                const notifRef = db.collection('notifications').doc();
                batch.set(notifRef, {
                    userId: userId,
                    title: `Event Settled: ${eventData.title}`,
                    message: `Congratulations! You won ${formatCurrency(userData.balanceToAdd)} on ${winner}. Wallet balance: ${formatCurrency(walletBalance)}`,
                    timestamp: firebase.firestore.Timestamp.now(),
                    read: false,
                    type: 'settlement'
                });
            } else {
                // Losers get notification only
                const notifRef = db.collection('notifications').doc();
                batch.set(notifRef, {
                    userId: userId,
                    title: `Event Settled: ${eventData.title}`,
                    message: `Your bet on ${userData.slips[0]?.option} didn't win. Better luck next time!`,
                    timestamp: firebase.firestore.Timestamp.now(),
                    read: false,
                    type: 'settlement'
                });
            }
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
        
        // Calculate your vig (profit)
        const myVig = totalPool - winnersWin;
        const expectedVig = (totalPool * vigPercentage) / 100;
        const isHealthy = myVig >= expectedVig;

        // Create settlement record with vigStats
        const settlementRef = db.collection('event_settlements').doc(eventId);
        batch.set(settlementRef, {
            eventId: eventId,
            eventTitle: eventData.title || 'Unknown Event',
            winner: winner,
            winnersWin: winnersWin,
            losersLose: losersLose,
            totalPot: totalPool,
            myVig: myVig,
            vigPercentage: vigPercentage,
            vigStats: {
                isHealthy: isHealthy,
                expectedVig: expectedVig,
                actualVig: myVig,
                profitLoss: myVig, // This should be actual vig only, not difference
                healthStatus: isHealthy ? 'healthy' : 'unhealthy'
            },
            settledAt: firebase.firestore.Timestamp.now(),
            totalBetsSettled: totalBetsSettled
        });

        // Store vig statistics for analytics
        const vigStatsRef = db.collection('vig_analytics').doc();
        batch.set(vigStatsRef, {
            eventId: eventId,
            eventTitle: eventData.title || 'Unknown Event',
            settledDate: firebase.firestore.Timestamp.now(),
            totalPot: totalPool,
            expectedVig: expectedVig,
            actualVig: myVig,
            profitLoss: myVig, // This should be actual vig only
            isHealthy: isHealthy,
            vigPercentage: vigPercentage
        });

        // Commit all changes
        await batch.commit();

        showNotification(`Event settled successfully! ${totalBetsSettled} bets processed. Your profit: ${formatCurrency(myVig, 'INR')}`);
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
            <p><strong>Sport:</strong> <span style="color: #ffa500; font-weight: bold;">${event.sportType || 'Not Set'}</span></p>
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

async function refreshEventOdds(eventId) {
    try {
        showNotification('Refreshing odds...');
        
        // Force refresh by reloading events grid
        await loadEventsGrid();
        
        showNotification('Odds refreshed successfully');
    } catch (error) {
        console.error('Error refreshing odds:', error);
        showNotification('Error refreshing odds');
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
            <div class="stat-card" style="border-color: #9ef01a;">
                <div class="stat-value" id="vig-profit-loss" style="font-size: 2rem;">₹0</div>
                <div class="stat-label" id="vig-label">Vig Profit/Loss</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="algorithm-health">0%</div>
                <div class="stat-label" id="health-label">Algorithm Health</div>
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
                    <h3>Vig Performance by Event</h3>
                    <canvas id="vigPerformanceChart" width="800" height="300"></canvas>
                </div>
            </div>
            
            <div class="chart-row">
                <div class="chart-section">
                    <h3>Algorithm Health Trends</h3>
                    <canvas id="algorithmHealthChart" width="400" height="200"></canvas>
                </div>
                <div class="chart-section">
                    <h3>Profit/Loss Breakdown</h3>
                    <canvas id="profitLossChart" width="400" height="200"></canvas>
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
        
        // Load all analytics data with better error handling
        const [
            signupsData,
            betsData, 
            adsData,
            buyinsData,
            activityData,
            usersData,
            vigData
        ] = await Promise.all([
            getSignupsData(startDate, endDate).catch(e => { console.error('Signups error:', e); return 0; }),
            getBetsData(startDate, endDate).catch(e => { console.error('Bets error:', e); return { count: 0, totalWagered: 0 }; }),
            getAdsData(startDate, endDate).catch(e => { console.error('Ads error:', e); return { views: 0, clicks: 0 }; }),
            getBuyinsData(startDate, endDate).catch(e => { console.error('Buyins error:', e); return { count: 0, totalAmount: 0 }; }),
            getActivityData(startDate, endDate).catch(e => { console.error('Activity error:', e); return { activities: {}, dailyActivity: {}, total: 0 }; }),
            getUsersData().catch(e => { console.error('Users error:', e); return { total: 0, approved: 0, pending: 0, debt: 0 }; }),
            getVigData(startDate, endDate).catch(e => { console.error('Vig error:', e); return { totalProfitLoss: 0, healthyCount: 0, unhealthyCount: 0, events: [] }; })
        ]);

        // Update stat cards
        updateStatCards(signupsData, betsData, adsData, buyinsData, usersData, vigData);

        // Create/update charts with delay to ensure DOM is ready
        setTimeout(() => {
            createCharts(period, activityData, buyinsData, betsData, adsData, usersData, vigData);
        }, 100);
        
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

function generateDateRange(startDate, endDate) {
    const dates = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
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
    const dailyActivitiesByDate = {};
    
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const action = data.action;
        const date = data.timestamp.toDate().toDateString();
        
        // Count by action type
        activities[action] = (activities[action] || 0) + 1;
        
        // Count by date
        if (!dailyActivity[date]) dailyActivity[date] = 0;
        dailyActivity[date]++;
        
        // Store detailed activities by date
        if (!dailyActivitiesByDate[date]) dailyActivitiesByDate[date] = [];
        dailyActivitiesByDate[date].push({
            action: action,
            timestamp: data.timestamp.toDate(),
            data: data.data || {}
        });
    });
    
    return { activities, dailyActivity, dailyActivitiesByDate, total: snapshot.size };
}

async function getUsersData() {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => doc.data());
    
    const approved = users.filter(u => u.kycStatus === 'approved').length;
    const pending = users.filter(u => u.kycStatus === 'pending').length;
    const debt = users.filter(u => u.debt > 0).length;
    
    return { total: users.length, approved, pending, debt };
}

async function getVigData(startDate, endDate) {
    const snapshot = await db.collection('vig_analytics')
        .where('settledDate', '>=', startDate)
        .where('settledDate', '<=', endDate)
        .orderBy('settledDate', 'desc')
        .get();
    
    let totalProfitLoss = 0;
    let healthyCount = 0;
    let unhealthyCount = 0;
    const events = [];
    
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        totalProfitLoss += data.profitLoss;
        
        if (data.isHealthy) {
            healthyCount++;
        } else {
            unhealthyCount++;
        }
        
        events.push({
            title: data.eventTitle,
            profitLoss: data.profitLoss,
            isHealthy: data.isHealthy,
            date: data.settledDate.toDate()
        });
    });
    
    return { totalProfitLoss, healthyCount, unhealthyCount, events };
}

function updateStatCards(signups, bets, ads, buyins, usersData, vigData) {
    document.getElementById('period-signups').textContent = signups;
    document.getElementById('period-bets').textContent = bets.count;
    document.getElementById('period-ads-viewed').textContent = ads.views;
    document.getElementById('period-ads-clicked').textContent = ads.clicks;
    document.getElementById('period-buyins').textContent = formatCurrency(buyins.totalAmount);
    document.getElementById('period-wagered').textContent = formatCurrency(bets.totalWagered);
    
    const conversionRate = usersData.total > 0 ? 
        ((usersData.approved / usersData.total) * 100).toFixed(1) : 0;
    document.getElementById('conversion-rate').textContent = conversionRate + '%';
    
    // Update vig stats
    const vigElement = document.getElementById('vig-profit-loss');
    const profitLoss = vigData.totalProfitLoss;
    const profitLossText = profitLoss >= 0 ? `+${formatCurrency(profitLoss)}` : `-${formatCurrency(Math.abs(profitLoss))}`;
    vigElement.textContent = profitLossText;
    vigElement.style.color = profitLoss >= 0 ? '#9ef01a' : '#ff0a54';
    
    const totalEvents = vigData.healthyCount + vigData.unhealthyCount;
    const healthPercentage = totalEvents > 0 ? ((vigData.healthyCount / totalEvents) * 100).toFixed(1) : 0;
    const healthElement = document.getElementById('algorithm-health');
    healthElement.textContent = healthPercentage + '%';
    healthElement.style.color = healthPercentage >= 70 ? '#9ef01a' : healthPercentage >= 40 ? '#ffa500' : '#ff0a54';
}

function createCharts(period, activityData, buyinsData, betsData, adsData, usersData, vigData) {
    // Destroy existing charts
    Object.values(analyticsCharts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    analyticsCharts = {};
    
    // Activity Overview Chart
    const activityCtx = document.getElementById('activityChart');
    if (activityCtx && Object.keys(activityData.activities).length > 0) {
        analyticsCharts.activity = new Chart(activityCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(activityData.activities).map(key => key.replace('_', ' ')),
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
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        labels: { color: '#FFF3DA' }
                    }
                }
            }
        });
    }
    
    // Revenue Chart
    const revenueCtx = document.getElementById('revenueChart');
    if (revenueCtx) {
        const totalAdRevenue = adsData.views * (settings.perAdReward || 50);
        const totalVigRevenue = vigData.totalProfitLoss > 0 ? vigData.totalProfitLoss : 0; // Only count positive vig as revenue
        
        analyticsCharts.revenue = new Chart(revenueCtx, {
            type: 'pie',
            data: {
                labels: ['Vig Revenue', 'Ad Revenue'],
                datasets: [{
                    data: [
                        totalVigRevenue || 0,
                        totalAdRevenue || 0
                    ],
                    backgroundColor: ['#9ef01a', '#ffa500']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        labels: { color: '#FFF3DA' }
                    }
                }
            }
        });
    }
    
    // Engagement Trends
    const engagementCtx = document.getElementById('engagementChart');
    if (engagementCtx) {
        // Generate complete date range based on period
        const { startDate, endDate } = getDateRange(period);
        const dateRange = generateDateRange(startDate.toDate(), endDate.toDate());
        
        // Create chart data for all dates in range, filling missing dates with 0
        const chartData = dateRange.map(date => {
            const dateString = date.toDateString();
            const count = activityData.dailyActivity[dateString] || 0;
            const activities = activityData.dailyActivitiesByDate?.[dateString] || [];
            
            return {
                x: date.toLocaleDateString(),
                y: count,
                fullDate: dateString,
                activities: activities
            };
        });
        
        analyticsCharts.engagement = new Chart(engagementCtx, {
            type: 'line',
            data: {
                labels: chartData.map(d => d.x),
                datasets: [{
                    label: 'Daily Activity',
                    data: chartData.map(d => d.y),
                    borderColor: '#9ef01a',
                    backgroundColor: 'rgba(158, 240, 26, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const dataIndex = activeElements[0].index;
                        const clickedData = chartData[dataIndex];
                        showActivityDetailModal(clickedData.fullDate, clickedData.y, clickedData.activities);
                    }
                },
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
    const userActivitiesCtx = document.getElementById('userActivitiesChart');
    if (userActivitiesCtx && Object.keys(activityData.activities).length > 0) {
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
                maintainAspectRatio: false,
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
    
    // Platform Health
    const healthCtx = document.getElementById('healthChart');
    if (healthCtx) {
        analyticsCharts.health = new Chart(healthCtx, {
            type: 'doughnut',
            data: {
                labels: ['Approved KYC', 'Pending KYC', 'Users with Debt'],
                datasets: [{
                    data: [usersData.approved || 0, usersData.pending || 0, usersData.debt || 0],
                    backgroundColor: ['#9ef01a', '#ffa500', '#ff0a54']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        labels: { color: '#FFF3DA' }
                    }
                }
            }
        });
    }
}

function showActivityDetailModal(date, totalCount, activities) {
    // Create modal HTML
    const modalHtml = `
        <div id="activity-detail-modal" class="modal" style="display: block;">
            <div class="modal-content">
                <span class="close" onclick="closeActivityDetailModal()">&times;</span>
                <h2>Activity Details for ${new Date(date).toLocaleDateString()}</h2>
                <p><strong>Total Activities: ${totalCount}</strong></p>
                <div class="logs-container" style="max-height: 400px;">
                    ${activities.map(activity => `
                        <div class="log-entry">
                            <span class="log-timestamp">[${activity.timestamp.toLocaleTimeString()}]</span>
                            <span>${formatLogAction(activity.action, activity.data)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('activity-detail-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeActivityDetailModal() {
    const modal = document.getElementById('activity-detail-modal');
    if (modal) {
        modal.remove();
    }
}

// Vig Performance Chart
const vigPerformanceCtx = document.getElementById('vigPerformanceChart');
if (vigPerformanceCtx && vigData.events.length > 0) {
    const chartData = vigData.events.map(event => ({
        x: event.title.substring(0, 20) + '...',
        y: event.profitLoss
    }));
    
    analyticsCharts.vigPerformance = new Chart(vigPerformanceCtx, {
        type: 'bar',
        data: {
            labels: chartData.map(d => d.x),
            datasets: [{
                label: 'Profit/Loss per Event',
                data: chartData.map(d => d.y),
                backgroundColor: chartData.map(d => d.y >= 0 ? '#9ef01a' : '#ff0a54'),
                borderColor: chartData.map(d => d.y >= 0 ? '#7bc908' : '#cc0844'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
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

// Algorithm Health Chart
const algorithmHealthCtx = document.getElementById('algorithmHealthChart');
if (algorithmHealthCtx) {
    analyticsCharts.algorithmHealth = new Chart(algorithmHealthCtx, {
        type: 'doughnut',
        data: {
            labels: ['Healthy Events', 'Unhealthy Events'],
            datasets: [{
                data: [vigData.healthyCount || 0, vigData.unhealthyCount || 0],
                backgroundColor: ['#9ef01a', '#ff0a54']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    labels: { color: '#FFF3DA' }
                }
            }
        }
    });
}

// Profit/Loss Breakdown Chart
const profitLossCtx = document.getElementById('profitLossChart');
if (profitLossCtx) {
    const profitEvents = vigData.events.filter(e => e.profitLoss >= 0);
    const lossEvents = vigData.events.filter(e => e.profitLoss < 0);
    const totalProfit = profitEvents.reduce((sum, e) => sum + e.profitLoss, 0);
    const totalLoss = Math.abs(lossEvents.reduce((sum, e) => sum + e.profitLoss, 0));
    
    analyticsCharts.profitLoss = new Chart(profitLossCtx, {
        type: 'pie',
        data: {
            labels: ['Total Profit', 'Total Loss'],
            datasets: [{
                data: [totalProfit, totalLoss],
                backgroundColor: ['#9ef01a', '#ff0a54']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    labels: { color: '#FFF3DA' }
                }
            }
        }
    });
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
