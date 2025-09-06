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
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

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
function showTab(tabName) {
    const content = document.getElementById('tab-content');
    const tabBtns = document.querySelectorAll('.tab-btn');
    /* Add right after those lines: */
    // Check if Firebase is initialized
    if (!firebase.apps.length) {
        console.error('Firebase not initialized');
        showNotification('Database connection error');
        return;
    }
    // Update active tab
    // Update active tab
    tabBtns.forEach(btn => btn.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // If called programmatically, find the tab by name
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
                    <th>Debt</th>
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
        
        const balanceDisplay = user.debt > 0 ? 
            `<span class="debt-amount">-${formatCurrency(user.debt, user.currency)}</span>` :
            formatCurrency(user.balance, user.currency);
            
        row.innerHTML = `
            <td>${user.nickname}</td>
            <td>${user.displayName}</td>
            <td><span class="status-${user.kycStatus}">${user.kycStatus.toUpperCase()}</span></td>
            <td><span class="rep-${user.repScore.toLowerCase()}">${user.repScore}</span></td>
            <td>${balanceDisplay}</td>
            <td>${user.debt > 0 ? formatCurrency(user.debt, user.currency) : '0'}</td>
            <td>@${user.instagram}</td>
            <td class="user-actions">
                ${user.kycStatus === 'pending' ? 
                    `<button class="btn" onclick="approveKYC('${user.id}')">APPROVE</button>
                     <button class="btn btn-danger" onclick="rejectKYC('${user.id}')">REJECT</button>` : ''}
                <button class="btn btn-${user.repScore === 'GOOD' ? 'warning' : 'secondary'}" onclick="toggleRepScore('${user.id}')">
                    ${user.repScore === 'GOOD' ? 'MARK BAD' : 'MARK GOOD'}
                </button>
                <button class="btn btn-secondary" onclick="adjustBalance('${user.id}')">ADJUST</button>
                <button class="btn btn-danger" onclick="deleteUser('${user.id}')">DELETE</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
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

function displayEventsGrid() {
    const grid = document.getElementById('events-grid');
    grid.innerHTML = '';
    
    events.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';
        
        const startTime = event.startTime ? new Date(event.startTime.seconds * 1000).toLocaleString() : 'TBD';
        
        card.innerHTML = `
            <h3>${event.title}</h3>
            <p><strong>Start:</strong> ${startTime}</p>
            <p><strong>Status:</strong> <span class="event-status ${event.status}">${event.status.toUpperCase()}</span></p>
            <p><strong>Total Bets:</strong> ${event.totalBets || 0}</p>
            <p><strong>Total Pot:</strong> ₹${event.totalPot || 0}</p>
            <div class="user-actions">
                <button class="btn btn-secondary" onclick="editEvent('${event.id}')">EDIT</button>
                <button class="btn btn-warning" onclick="settleEvent('${event.id}')">SETTLE</button>
                <button class="btn btn-danger" onclick="deleteEvent('${event.id}')">DELETE</button>
            </div>
        `;
        
        grid.appendChild(card);
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
    
    const eventData = {
        title: document.getElementById('event-title').value,
        description: document.getElementById('event-description').value || '',
        startTime: firebase.firestore.Timestamp.fromDate(new Date(startTimeInput)),
        vigPercentage: parseInt(document.getElementById('event-vig').value) || 5,
        options: document.getElementById('event-options').value.split('\n').filter(opt => opt.trim()),
        status: 'active',
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
    
    try {
        await db.collection('events').doc(eventId).update({
            status: 'completed',
            winner: winner,
            settledAt: firebase.firestore.Timestamp.now()
        });
        
        // TODO: Implement bet settlement logic
        
        showNotification('Event settled successfully');
        loadEventsGrid();
    } catch (error) {
        console.error('Error settling event:', error);
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
    
    if (messageType === 'individual') {
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
        <div class="stats-grid" id="analytics-stats">
            <div class="stat-card">
                <div class="stat-value" id="daily-signups">0</div>
                <div class="stat-label">Daily Signups</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="daily-bets">0</div>
                <div class="stat-label">Daily Bets</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="daily-revenue">₹0</div>
                <div class="stat-label">Daily Revenue</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="conversion-rate">0%</div>
                <div class="stat-label">KYC Conversion</div>
            </div>
        </div>
        
        <h3>User Activity Heatmap</h3>
        <div class="logs-container" id="activity-analytics">
            Loading analytics data...
        </div>
    `;
}

async function loadAnalyticsData() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = firebase.firestore.Timestamp.fromDate(today);
        
        // Daily signups
        const dailySignups = await db.collection('users')
            .where('registrationDate', '>=', todayTimestamp)
            .get();
        document.getElementById('daily-signups').textContent = dailySignups.size;
        
        // Daily activity
        const dailyActivity = await db.collection('activity_logs')
            .where('timestamp', '>=', todayTimestamp)
            .get();
            
        const bets = dailyActivity.docs.filter(doc => doc.data().action === 'bet_placed');
        document.getElementById('daily-bets').textContent = bets.length;
        
        // KYC Conversion rate
        const totalUsers = users.length;
        const approvedUsers = users.filter(u => u.kycStatus === 'approved').length;
        const conversionRate = totalUsers > 0 ? ((approvedUsers / totalUsers) * 100).toFixed(1) : 0;
        document.getElementById('conversion-rate').textContent = conversionRate + '%';
        
    } catch (error) {
        console.error('Error loading analytics:', error);
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
