firebase.initializeApp({
    apiKey: "AIzaSyCcbwgF109oa31ETJQLJfviGchCgXxr8jY",
    authDomain: "focal-rampart-457023-r6.firebaseapp.com",
    projectId: "focal-rampart-457023-r6",
    storageBucket: "focal-rampart-457023-r6.firebasestorage.app",
    messagingSenderId: "536100777628",
    appId: "1:536100777628:web:bfed021ed505a04c358759"
});

const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();
const emailProvider = firebase.auth.EmailAuthProvider;
const STEAM_API_BASE = 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/';
const REQUEST_TIMEOUT = 6500;

const allGames = [
    { id:'csgo',  appid:'730',     title:'CS:GO / CS2',         img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/header.jpg' },
    { id:'rust',  appid:'252490',  title:'Rust',                img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/252490/header.jpg' },
    { id:'r6',    appid:'359550',  title:'Rainbow Six Siege',   img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/359550/header.jpg' },
    { id:'apex',  appid:'1172470', title:'Apex Legends',        img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1172470/header.jpg' },
    { id:'dota2', appid:'570',     title:'Dota 2',              img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/header.jpg' },
    { id:'pubg',  appid:'578080',  title:'PUBG: Battlegrounds', img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/578080/header.jpg' },
    { id:'hell2', appid:'2086430', title:'Helldivers 2',        img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2086430/header.jpg' },
    { id:'gtav',  appid:'271590',  title:'Grand Theft Auto V',  img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg' },
    { id:'dbd',   appid:'381210',  title:'Dead by Daylight',    img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/381210/header.jpg' },
    { id:'wf',    appid:'230410',  title:'Warframe',            img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/230410/header.jpg' },
    { id:'d2',    appid:'1085660', title:'Destiny 2',           img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1085660/header.jpg' },
    { id:'wt',    appid:'236390',  title:'War Thunder',         img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/236390/header.jpg' },
    { id:'tf2',   appid:'440',     title:'Team Fortress 2',     img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/440/header.jpg' },
    { id:'ow2',   appid:'2357570', title:'Overwatch 2',         img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2357570/header.jpg' },
    { id:'rl',    appid:'252950',  title:'Rocket League',       img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/252950/header.jpg' },
    { id:'lethal',appid:'1966720', title:'Lethal Company',      img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1966720/header.jpg' },
    { id:'darkdarker',appid:'2016550', title:'Dark and Darker',  img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2016550/header.jpg' },
    { id:'vrising',appid:'1604030',  title:'V Rising',           img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1604030/header.jpg' },
    { id:'arcriders',appid:'',       title:'Arc Raiders',        img:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1891700/header.jpg' }
];

const trendingIds = ['csgo','rust','r6','apex','dota2','pubg','vrising','darkdarker'];
const trending = allGames.filter(g => trendingIds.includes(g.id)).map(g => ({ ...g, players: '---' }));

let posts = [];
let currentUser = null;
let currentFilter = 'All';
let currentSearchQ = '';
let squadUnsub = null;
let chatUnsub = null;
let dmUnsub = null;
let inboxUnsub = null;
let currentChatId = null;
let currentDmId = null;
let currentDmTarget = null;
let steamDataHealthy = false;
let inboxItems = [];
let chatViewDmUnsub = null;
let chatViewSquadUnsub = null;
let chatViewSquadData = {};
let chatViewSubs = [];

const $ = id => document.getElementById(id);

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const candidate = raw.match(/^https?:\/\//i) ? raw : `https://${raw}`;
        const url = new URL(candidate);
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
    } catch {
        return '';
    }
}

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

function currentDisplayName() {
    if (!currentUser) return 'Guest';
    return currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Player');
}

function formatTime(ts) {
    if (!ts) return 'Just now';
    const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return date.toLocaleString();
}

function showToast(message, error = false) {
    const box = $('feedToolbarText');
    if (box) box.textContent = message;
    if (error) console.warn(message);
}

function hideLoadingScreen() {
    const el = $('loadingScreen');
    if (!el) return;
    el.classList.add('hidden-out');
    setTimeout(() => el.remove(), 500);
}

function openModal(id) {
    $(id).classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModalById(id) {
    $(id).classList.remove('open');
    document.body.style.overflow = '';
}

function friendlyErr(code) {
    return ({
        'auth/invalid-email':'Invalid email address.',
        'auth/user-not-found':'No account with that email.',
        'auth/wrong-password':'Incorrect password.',
        'auth/email-already-in-use':'Email already in use.',
        'auth/weak-password':'Password must be 6+ characters.',
        'auth/requires-recent-login':'Please sign in again, then retry this change.',
        'auth/popup-closed-by-user':'The popup was closed before finishing.',
        'auth/invalid-credential':'Invalid email or password.'
    })[code] || 'Something went wrong. Try again.';
}

function buildConversationId(a, b) {
    return [a, b].sort().join('_');
}

function memberCount(post) {
    return Array.isArray(post.members) ? post.members.length : 0;
}

function isOwner(post) {
    return currentUser && post.userId === currentUser.uid;
}

function isAdmin(post) {
    return currentUser && Array.isArray(post.admins) && post.admins.includes(currentUser.uid);
}

function canModerate(post) {
    return isOwner(post) || isAdmin(post);
}

function isMember(post) {
    return currentUser && Array.isArray(post.members) && post.members.some(member => member.uid === currentUser.uid);
}

function selectedGameValue(selectId, customId) {
    const base = $(selectId).value.trim();
    if (base !== 'Other') return base;
    return $(customId).value.trim();
}

async function fetchJsonWithTimeout(url, timeout = REQUEST_TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

async function getSteamPlayerCount(appid) {
    const url = `${STEAM_API_BASE}?appid=${appid}`;
    const proxiedUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const json = await fetchJsonWithTimeout(proxiedUrl);
    if (!json.contents) throw new Error('No Steam payload received');
    const count = JSON.parse(json.contents)?.response?.player_count;
    if (typeof count !== 'number') throw new Error('Invalid player count');
    return count;
}

document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initAuth();
    initAuthModal();
    initSettingsModal();
    initInbox();
    initFirestore();
    renderTrending();
    renderAllGames();
    populateGameSelect();
    populateFilterTags();
    renderFeedGameShelf();
    initFilters();
    initForms();
    initSearches();
    initChat();
    initChatView();
    updateOverviewStats();
    fetchSteamPlayers().finally(() => setTimeout(hideLoadingScreen, 250));
});

window.addEventListener('load', () => setTimeout(hideLoadingScreen, 900));

function initNav() {
    const activateView = target => {
        document.querySelectorAll('.pill').forEach(b => b.classList.toggle('active', b.dataset.target === target));
        document.querySelectorAll('.dock-btn').forEach(b => b.classList.toggle('active', b.dataset.target === target));
        document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === target));
    };

    document.querySelectorAll('.pill, .dock-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activateView(btn.dataset.target);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    window.switchView = id => {
        activateView(id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

function initAuth() {
    auth.onAuthStateChanged(async user => {
        currentUser = user;
        $('loginBtn').classList.toggle('hidden', !!user);
        $('userChip').classList.toggle('hidden', !user);
        $('authWall').classList.toggle('hidden', !!user);
        $('createPostForm').classList.toggle('hidden', !user);
        $('editAuthWall').classList.toggle('hidden', !!user);
        $('editPostsList').classList.toggle('hidden', !user);

        if (user) {
            setText('userName', currentDisplayName());
            const avatar = $('userAvatar');
            if (user.photoURL) {
                avatar.src = user.photoURL;
                avatar.style.display = 'block';
            } else {
                avatar.style.display = 'none';
            }
            $('settingsName').value = currentDisplayName();
            $('settingsEmail').value = user.email || '';
            subscribeInbox();
            subscribeChatViewSquads();
        } else {
            if (inboxUnsub) inboxUnsub();
            chatViewSubs.forEach(unsub => unsub());
            chatViewSubs = [];
            chatViewSquadData = {};
            inboxItems = [];
            $('dmList').innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><p>Sign in to use private messages.</p></div>';
            $('editPostsList').innerHTML = '';
        }

        renderPosts();
        renderEditPosts();
        renderChatViewSidebar();
        closeAuthModal();
    });

    $('loginBtn').addEventListener('click', openAuthModal);
    $('logoutBtn').addEventListener('click', () => {
        chatViewSubs.forEach(unsub => unsub());
        chatViewSubs = [];
        chatViewSquadData = {};
        auth.signOut();
    });
    $('chatNavBtn').addEventListener('click', openChatView);
    $('settingsBtn').addEventListener('click', openSettingsModal);
    $('inboxBtn').addEventListener('click', () => openDmModal());
}

function initAuthModal() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const isLogin = tab.dataset.tab === 'login';
            $('loginForm').classList.toggle('hidden', !isLogin);
            $('registerForm').classList.toggle('hidden', isLogin);
            $('loginError').classList.add('hidden');
            $('regError').classList.add('hidden');
        });
    });

    $('loginForm').addEventListener('submit', async e => {
        e.preventDefault();
        $('loginError').classList.add('hidden');
        try {
            const persistence = $('rememberMe').checked
                ? firebase.auth.Auth.Persistence.LOCAL
                : firebase.auth.Auth.Persistence.SESSION;
            await auth.setPersistence(persistence);
            await auth.signInWithEmailAndPassword($('loginEmail').value, $('loginPass').value);
        } catch (err) {
            $('loginError').textContent = friendlyErr(err.code);
            $('loginError').classList.remove('hidden');
        }
    });

    $('registerForm').addEventListener('submit', async e => {
        e.preventDefault();
        $('regError').classList.add('hidden');
        try {
            const cred = await auth.createUserWithEmailAndPassword($('regEmail').value, $('regPass').value);
            await cred.user.updateProfile({ displayName: $('regName').value.trim() });
            await db.collection('profiles').doc(cred.user.uid).set({
                displayName: $('regName').value.trim(),
                email: $('regEmail').value.trim(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            location.reload();
        } catch (err) {
            $('regError').textContent = friendlyErr(err.code);
            $('regError').classList.remove('hidden');
        }
    });

    $('googleSignIn').addEventListener('click', async () => {
        try {
            const cred = await auth.signInWithPopup(googleProvider);
            await db.collection('profiles').doc(cred.user.uid).set({
                displayName: currentDisplayName(),
                email: cred.user.email || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (err) {
            console.error(err);
        }
    });

    $('authModal').addEventListener('click', e => { if (e.target === $('authModal')) closeAuthModal(); });
}

function openAuthModal() { openModal('authModal'); }
function closeAuthModal() { closeModalById('authModal'); }
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;

function initSettingsModal() {
    $('settingsModal').addEventListener('click', e => { if (e.target === $('settingsModal')) closeSettingsModal(); });

    $('profileSettingsForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!currentUser) return;
        const name = $('settingsName').value.trim();
        const msg = $('profileSettingsMsg');
        msg.classList.add('hidden');
        try {
            await currentUser.updateProfile({ displayName: name });
            await db.collection('profiles').doc(currentUser.uid).set({
                displayName: name,
                email: currentUser.email || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            setText('userName', name);
            renderPosts();
            renderEditPosts();
            msg.textContent = 'Profile updated.';
            msg.classList.remove('hidden');
        } catch (err) {
            msg.textContent = friendlyErr(err.code);
            msg.classList.remove('hidden');
        }
    });

    $('emailSettingsForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!currentUser) return;
        const msg = $('emailSettingsMsg');
        msg.classList.add('hidden');
        try {
            await reauthenticateIfNeeded($('settingsCurrentPassword').value.trim());
            await currentUser.updateEmail($('settingsEmail').value.trim());
            await db.collection('profiles').doc(currentUser.uid).set({
                email: $('settingsEmail').value.trim(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            msg.textContent = 'Email updated.';
            msg.classList.remove('hidden');
        } catch (err) {
            msg.textContent = friendlyErr(err.code);
            msg.classList.remove('hidden');
        }
    });

    $('passwordSettingsForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!currentUser) return;
        const msg = $('passwordSettingsMsg');
        msg.classList.add('hidden');
        try {
            await reauthenticateIfNeeded($('settingsOldPassword').value.trim());
            await currentUser.updatePassword($('settingsNewPassword').value.trim());
            msg.textContent = 'Password updated.';
            msg.classList.remove('hidden');
        } catch (err) {
            msg.textContent = friendlyErr(err.code);
            msg.classList.remove('hidden');
        }
    });
}

async function reauthenticateIfNeeded(password) {
    if (!currentUser) throw new Error('No current user');
    const provider = currentUser.providerData[0]?.providerId;
    if (provider === 'password') {
        if (!password) throw { code: 'auth/wrong-password' };
        const credential = emailProvider.credential(currentUser.email, password);
        return currentUser.reauthenticateWithCredential(credential);
    }
    if (provider === 'google.com') {
        return currentUser.reauthenticateWithPopup(googleProvider);
    }
}

function openSettingsModal() {
    if (!currentUser) return openAuthModal();
    $('settingsName').value = currentDisplayName();
    $('settingsEmail').value = currentUser.email || '';
    openModal('settingsModal');
}

function closeSettingsModal() { closeModalById('settingsModal'); }
window.closeSettingsModal = closeSettingsModal;

function initInbox() {
    $('dmModal').addEventListener('click', e => { if (e.target === $('dmModal')) closeDmModal(); });

    $('dmForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!currentUser || !currentDmId || !currentDmTarget) return;
        const text = $('dmInput').value.trim();
        if (!text) return;
        try {
            await db.collection('conversations').doc(currentDmId).set({
                members: [currentUser.uid, currentDmTarget.uid],
                memberNames: {
                    [currentUser.uid]: currentDisplayName(),
                    [currentDmTarget.uid]: currentDmTarget.name
                },
                lastMessage: text,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            await db.collection('conversations').doc(currentDmId).collection('messages').add({
                text,
                user: currentDisplayName(),
                userId: currentUser.uid,
                ts: firebase.firestore.FieldValue.serverTimestamp()
            });
            $('dmInput').value = '';
        } catch (err) {
            console.error('DM send error:', err);
        }
    });
}

function subscribeInbox() {
    if (!currentUser) return;
    if (inboxUnsub) inboxUnsub();
    inboxUnsub = db.collection('conversations')
        .where('members', 'array-contains', currentUser.uid)
        .onSnapshot(snap => {
            let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            items.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            inboxItems = items;
            renderInboxList(items);
            renderChatViewSidebar();
        }, () => {
            inboxItems = [];
            renderInboxList([]);
            renderChatViewSidebar();
        });
}

function renderInboxList(items) {
    if (!items.length) {
        $('dmList').innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><p>No private messages yet.</p></div>';
        return;
    }
    $('dmList').innerHTML = items.map(item => {
        const otherUid = (item.members || []).find(uid => uid !== currentUser.uid);
        const otherName = item.memberNames?.[otherUid] || 'Player';
        return `<button class="dm-list-item ${currentDmId === item.id ? 'active' : ''}" onclick="openDmWith('${otherUid}','${escapeHtml(otherName)}')">
            <strong>${escapeHtml(otherName)}</strong>
            <span>${escapeHtml(item.lastMessage || 'Open conversation')}</span>
        </button>`;
    }).join('');
}

window.openDmWith = function(uid, name) {
    if (!currentUser) return openAuthModal();
    currentDmTarget = { uid, name };
    currentDmId = buildConversationId(currentUser.uid, uid);
    $('dmHeader').innerHTML = `<div class="pc-avatar" style="width:36px;height:36px;font-size:.9rem">${escapeHtml(name[0]?.toUpperCase() || 'P')}</div><h3>${escapeHtml(name)}</h3><span class="pc-game">Private</span>`;
    $('dmMessages').innerHTML = '<div class="empty-state" style="padding:2rem"><i class="fa-solid fa-paper-plane"></i><p>Loading messages...</p></div>';
    openDmModal();
    if (dmUnsub) dmUnsub();
    dmUnsub = db.collection('conversations').doc(currentDmId).collection('messages').orderBy('ts', 'asc').onSnapshot(snap => {
        const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (!msgs.length) {
            $('dmMessages').innerHTML = '<div class="empty-state" style="padding:2rem"><p>No private messages yet.</p></div>';
            renderInboxListFromDomRefresh();
            return;
        }
        $('dmMessages').innerHTML = msgs.map(m => {
            const mine = m.userId === currentUser.uid;
            return `<div class="chat-msg ${mine ? 'mine' : 'other'}"><div class="chat-msg-name">${escapeHtml(m.user || 'Player')}</div><div class="chat-msg-text">${escapeHtml(m.text || '')}</div><div class="chat-msg-time">${escapeHtml(formatTime(m.ts))}</div></div>`;
        }).join('');
        $('dmMessages').scrollTop = $('dmMessages').scrollHeight;
        renderInboxListFromDomRefresh();
    });
};

function renderInboxListFromDomRefresh() {
    const active = Array.from(document.querySelectorAll('.dm-list-item'));
    active.forEach(item => item.classList.toggle('active', item.getAttribute('onclick')?.includes(currentDmTarget?.uid)));
}

function openDmModal() {
    if (!currentUser) return openAuthModal();
    if (!currentDmId) {
        $('dmHeader').innerHTML = '<h3>Your Inbox</h3><span class="pc-game">DMs</span>';
        $('dmMessages').innerHTML = '<div class="empty-state" style="padding:2rem"><p>Select a conversation or message a player from the squad feed.</p></div>';
    }
    openModal('dmModal');
}

function closeDmModal() {
    closeModalById('dmModal');
}
window.closeDmModal = closeDmModal;

function initChatView() {
    $('chatTabDms').addEventListener('click', () => switchChatTab('dms'));
    $('chatTabSquads').addEventListener('click', () => switchChatTab('squads'));

    const chatViewForm = document.createElement('form');
    chatViewForm.className = 'chat-input-row';
    chatViewForm.id = 'chatViewForm';
    chatViewForm.innerHTML = '<input type="text" id="chatViewInput" placeholder="Type a message..." autocomplete="off" required><button type="submit" class="btn-glow"><i class="fa-solid fa-paper-plane"></i></button>';

    chatViewForm.addEventListener('submit', async e => {
        e.preventDefault();
        if (!currentUser || !window._chatViewTarget) return;
        const text = $('chatViewInput').value.trim();
        if (!text) return;
        try {
            if (window._chatViewTarget.type === 'dm') {
                const dmId = window._chatViewTarget.id;
                const target = window._chatViewTarget;
                await db.collection('conversations').doc(dmId).set({
                    members: [currentUser.uid, target.uid],
                    memberNames: {
                        [currentUser.uid]: currentDisplayName(),
                        [target.uid]: target.name
                    },
                    lastMessage: text,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                await db.collection('conversations').doc(dmId).collection('messages').add({
                    text, user: currentDisplayName(), userId: currentUser.uid,
                    ts: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await db.collection('squads').doc(window._chatViewTarget.id).collection('messages').add({
                    text, user: currentDisplayName(), userId: currentUser.uid,
                    ts: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            $('chatViewInput').value = '';
        } catch (err) {
            console.error('Chat send error:', err);
        }
    });

    const input = chatViewForm.querySelector('input');
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatViewForm.dispatchEvent(new Event('submit'));
        }
    });
}

function switchChatTab(tab) {
    $('chatTabDms').classList.toggle('active', tab === 'dms');
    $('chatTabSquads').classList.toggle('active', tab === 'squads');
    window._chatViewTab = tab;
    window._chatViewTarget = null;
    if (chatViewDmUnsub) { chatViewDmUnsub(); chatViewDmUnsub = null; }
    if (chatViewSquadUnsub) { chatViewSquadUnsub(); chatViewSquadUnsub = null; }
    renderChatViewSidebar();
    const main = $('chatViewMain');
    main.innerHTML = '<div class="chat-view-placeholder"><div class="empty-state"><i class="fa-solid fa-comments"></i><p>Select a conversation to start chatting.</p></div></div>';
}

function renderChatViewSidebar() {
    const list = $('chatSidebarList');
    if (!list) return;
    const tab = window._chatViewTab || 'dms';
    if (tab === 'squads') {
        const squadEntries = Object.entries(chatViewSquadData);
        if (!squadEntries.length) {
            list.innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><p>Join a squad to start chatting.</p></div>';
            return;
        }
        list.innerHTML = squadEntries.map(([postId, data]) => {
            const init = escapeHtml((data.post?.title || 'S')[0].toUpperCase());
            const title = escapeHtml(data.post?.title || 'Squad Chat');
            const game = escapeHtml(data.post?.game || '');
            const preview = data.messages?.length ? escapeHtml(data.messages[data.messages.length - 1].text || '').substring(0, 40) : 'No messages yet';
            const active = window._chatViewTarget?.id === postId ? 'active' : '';
            return `<button class="chat-list-item ${active}" onclick="openChatViewSquad('${postId}')">
                <div class="chat-list-avatar">${init}</div>
                <div class="chat-list-info">
                    <div class="chat-list-name">${title}</div>
                    <div class="chat-list-preview">${preview}</div>
                    <div class="chat-list-game">${game}</div>
                </div>
            </button>`;
        }).join('');
    } else {
        if (!inboxItems.length) {
            list.innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><p>No conversations yet.</p></div>';
            return;
        }
        list.innerHTML = inboxItems.map(item => {
            const otherUid = (item.members || []).find(uid => uid !== currentUser?.uid);
            const otherName = item.memberNames?.[otherUid] || 'Player';
            const init = escapeHtml(otherName[0]?.toUpperCase() || 'P');
            const active = window._chatViewTarget?.id === item.id ? 'active' : '';
            return `<button class="chat-list-item ${active}" onclick="openChatViewDm('${escapeHtml(otherUid)}','${escapeHtml(otherName)}')">
                <div class="chat-list-avatar">${init}</div>
                <div class="chat-list-info">
                    <div class="chat-list-name">${escapeHtml(otherName)}</div>
                    <div class="chat-list-preview">${escapeHtml(item.lastMessage || 'Open conversation')}</div>
                </div>
            </button>`;
        }).join('');
    }
}

window.openChatViewDm = function(uid, name) {
    if (!currentUser) return openAuthModal();
    window._chatViewTarget = { type: 'dm', id: buildConversationId(currentUser.uid, uid), uid, name };
    const main = $('chatViewMain');
    main.innerHTML = `
        <div class="chat-view-head">
            <div class="pc-avatar" style="width:32px;height:32px;font-size:.8rem">${escapeHtml(name[0]?.toUpperCase() || 'P')}</div>
            <h3>${escapeHtml(name)}</h3>
            <span class="pc-game">DM</span>
        </div>
        <div class="chat-view-messages" id="chatViewMessages"></div>
        <form class="chat-input-row" id="chatViewForm"><input type="text" id="chatViewInput" placeholder="Type a message..." autocomplete="off" required><button type="submit" class="btn-glow"><i class="fa-solid fa-paper-plane"></i></button></form>`;
    attachChatViewForm();
    $('chatViewMessages').innerHTML = '<div class="empty-state" style="padding:2rem"><p>Loading messages...</p></div>';
    renderChatViewSidebar();
    if (chatViewDmUnsub) chatViewDmUnsub();
    chatViewDmUnsub = db.collection('conversations').doc(window._chatViewTarget.id).collection('messages').orderBy('ts', 'asc').onSnapshot(snap => {
        const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderChatViewMessages(msgs, window._chatViewTarget.id, 'dm');
    });
};

window.openChatViewSquad = function(postId) {
    if (!currentUser) return openAuthModal();
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    window._chatViewTarget = { type: 'squad', id: postId };
    const main = $('chatViewMain');
    main.innerHTML = `
        <div class="chat-view-head">
            <div class="pc-avatar" style="width:32px;height:32px;font-size:.8rem">${escapeHtml((post.user || 'G')[0].toUpperCase())}</div>
            <div><h3>${escapeHtml(post.title)}</h3><span class="pc-game">${escapeHtml(post.game)}</span></div>
            ${canModerate(post) ? `<button class="pc-join alt" onclick="openManageMembers('${post.id}')" style="margin-left:auto"><i class="fa-solid fa-user-shield"></i> Manage</button>` : ''}
        </div>
        <div class="chat-view-messages" id="chatViewMessages"></div>
        <form class="chat-input-row" id="chatViewForm"><input type="text" id="chatViewInput" placeholder="Type a message..." autocomplete="off" required><button type="submit" class="btn-glow"><i class="fa-solid fa-paper-plane"></i></button></form>`;
    attachChatViewForm();
    $('chatViewMessages').innerHTML = '<div class="empty-state" style="padding:2rem"><p>Loading messages...</p></div>';
    renderChatViewSidebar();
    if (chatViewSquadUnsub) chatViewSquadUnsub();
    chatViewSquadUnsub = db.collection('squads').doc(postId).collection('messages').orderBy('ts', 'asc').onSnapshot(snap => {
        const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderChatViewMessages(msgs, postId, 'squad');
    });
};

function renderChatViewMessages(msgs, convId, type) {
    const container = $('chatViewMessages');
    if (!container) return;
    if (!msgs.length) {
        container.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No messages yet - say hi.</p></div>';
        return;
    }
    container.innerHTML = msgs.map(m => {
        const mine = m.userId === currentUser.uid;
        let canDelete = mine;
        if (type === 'squad') {
            const post = posts.find(p => p.id === convId);
            canDelete = canModerate(post) || mine;
        }
        return `<div class="chat-msg ${mine ? 'mine' : 'other'}"><div class="chat-msg-name">${escapeHtml(m.user || 'Player')}</div><div class="chat-msg-text">${escapeHtml(m.text || '')}</div><div class="chat-msg-time">${escapeHtml(formatTime(m.ts))}</div>${canDelete ? `<button class="chat-delete" onclick="deleteChatViewMessage('${convId}','${m.id}','${type}')"><i class="fa-solid fa-trash"></i></button>` : ''}</div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

window.deleteChatViewMessage = async function(convId, msgId, type) {
    if (!currentUser) return;
    if (type === 'squad') {
        await db.collection('squads').doc(convId).collection('messages').doc(msgId).delete();
    } else {
        await db.collection('conversations').doc(convId).collection('messages').doc(msgId).delete();
    }
};

function attachChatViewForm() {
    const form = $('chatViewForm');
    if (!form) return;
    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!currentUser || !window._chatViewTarget) return;
        const text = $('chatViewInput').value.trim();
        if (!text) return;
        try {
            if (window._chatViewTarget.type === 'dm') {
                const target = window._chatViewTarget;
                await db.collection('conversations').doc(target.id).set({
                    members: [currentUser.uid, target.uid],
                    memberNames: { [currentUser.uid]: currentDisplayName(), [target.uid]: target.name },
                    lastMessage: text,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                await db.collection('conversations').doc(target.id).collection('messages').add({
                    text, user: currentDisplayName(), userId: currentUser.uid,
                    ts: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await db.collection('squads').doc(window._chatViewTarget.id).collection('messages').add({
                    text, user: currentDisplayName(), userId: currentUser.uid,
                    ts: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            $('chatViewInput').value = '';
        } catch (err) { console.error('Chat send error:', err); }
    });
    const input = form.querySelector('input');
    if (input) input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.dispatchEvent(new Event('submit')); }
    });
}

function subscribeChatViewSquads() {
    chatViewSubs.forEach(unsub => unsub());
    chatViewSubs = [];
    chatViewSquadData = {};
    posts.forEach(post => {
        if (isMember(post)) {
            const unsub = db.collection('squads').doc(post.id).collection('messages').orderBy('ts', 'desc').limit(1).onSnapshot(snap => {
                chatViewSquadData[post.id] = {
                    post,
                    messages: snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                };
                renderChatViewSidebar();
            });
            chatViewSubs.push(unsub);
        }
    });
}

function openChatView() {
    switchView('chat-view');
    if (currentUser) {
        subscribeChatViewSquads();
        renderChatViewSidebar();
    }
}

function initFirestore() {
    if (squadUnsub) squadUnsub();
    squadUnsub = db.collection('squads').orderBy('createdAt', 'desc').onSnapshot(snap => {
        posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateOverviewStats();
        renderPosts();
        renderEditPosts();
        hideLoadingScreen();
    }, err => {
        console.warn('Firestore listen error:', err.message);
        $('postsContainer').innerHTML = `<div class="empty-state"><i class="fa-solid fa-wifi"></i><p>The live squad feed could not load right now.</p><p style="font-size:.8rem;margin-top:.5rem;color:var(--text-3)">${escapeHtml(err.message)}</p></div>`;
    });
}

function updateOverviewStats() {
    setText('catalogCount', `${allGames.length} games`);
    setText('feedResultCount', `${posts.length} squad post${posts.length === 1 ? '' : 's'}`);
    setText('feedToolbarText', posts.length ? 'Live squads are ready. Filter, chat, join, or DM.' : 'No live squads yet. Create the first one.');
}

function gameCard(g, showPlayers) {
    const playerText = steamDataHealthy ? `${g.players} online` : '---';
    return `<div class="game-card" onclick="openGameDetails('${g.id}')">
        <img src="${g.img}" alt="${escapeHtml(g.title)}" loading="lazy" onerror="this.src='https://placehold.co/460x215/1a1c28/f97316?text=${encodeURIComponent(g.title)}'">
        <div class="overlay"><h3>${escapeHtml(g.title)}</h3>${showPlayers ? `<div class="players"><i class="fa-solid fa-circle" style="font-size:.4rem;vertical-align:middle;margin-right:.3rem;color:#22c55e"></i>${playerText}</div>` : ''}</div>
    </div>`;
}

function renderTrending() { $('trendingGrid').innerHTML = trending.map(g => gameCard(g, true)).join(''); }

function renderAllGames(filter = '') {
    const list = filter ? allGames.filter(g => g.title.toLowerCase().includes(filter)) : allGames;
    $('allGamesGrid').innerHTML = list.map(g => gameCard(g, false)).join('') || '<p style="color:var(--text-3);text-align:center;grid-column:1/-1">No games found</p>';
}

function renderFeedGameShelf() {
    const items = [{ title: 'All', active: currentFilter === 'All' }].concat(allGames.slice(0, 8).map(g => ({ title: g.title, active: currentFilter === g.title })));
    $('feedGameShelf').innerHTML = items.map(item => `<button class="mini-game-chip ${item.active ? 'active' : ''}" onclick="setFeedFilter('${escapeHtml(item.title)}')">${escapeHtml(item.title)}</button>`).join('');
}

window.setFeedFilter = function(filter) {
    currentFilter = filter;
    document.querySelectorAll('#gameFilters .tag').forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
    renderFeedGameShelf();
    renderPosts();
};

function initSearches() {
    const homeInput = $('homeSearch');
    const homeResults = $('homeSearchResults');
    homeInput.addEventListener('input', () => {
        const q = homeInput.value.toLowerCase().trim();
        if (!q) {
            homeResults.classList.add('hidden');
            return;
        }
        const list = allGames.filter(g => g.title.toLowerCase().includes(q));
        homeResults.innerHTML = list.length ? list.map(g => `<div class="search-result-item" onclick="openGameDetails('${g.id}')"><img src="${g.img}" alt="${escapeHtml(g.title)}"><span>${escapeHtml(g.title)}</span></div>`).join('') : '<p style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:1rem">No games found</p>';
        homeResults.classList.remove('hidden');
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.home-search-wrap') && !e.target.closest('#homeSearchResults')) homeResults.classList.add('hidden');
    });
    $('gamesSearch').addEventListener('input', e => renderAllGames(e.target.value.toLowerCase().trim()));
    $('feedSearch').addEventListener('input', e => {
        currentSearchQ = e.target.value.toLowerCase().trim();
        renderPosts();
    });
}

function populateFilterTags() {
    const sorted = [...allGames].sort((a, b) => a.title.localeCompare(b.title));
    $('gameFilters').innerHTML = '<button class="tag active" data-filter="All">All</button>' + sorted.map(g => `<button class="tag" data-filter="${escapeHtml(g.title)}">${escapeHtml(g.title)}</button>`).join('');
}

function initFilters() {
    $('gameFilters').addEventListener('click', e => {
        const tag = e.target.closest('.tag');
        if (!tag) return;
        setFeedFilter(tag.dataset.filter);
    });
}

function populateGameSelect() {
    const select = $('inputGame');
    [...allGames].sort((a, b) => a.title.localeCompare(b.title)).forEach(g => {
        const option = document.createElement('option');
        option.value = g.title;
        option.textContent = g.title;
        select.appendChild(option);
    });
    const option = document.createElement('option');
    option.value = 'Other';
    option.textContent = 'Other';
    select.appendChild(option);
}

function initForms() {
    $('toggleRank').addEventListener('change', e => $('rankField').classList.toggle('hidden', !e.target.checked));
    $('inputGame').addEventListener('change', e => $('customGameField').classList.toggle('hidden', e.target.value !== 'Other'));

    $('createPostForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!currentUser) return openAuthModal();
        const game = selectedGameValue('inputGame', 'inputCustomGame');
        if (!game) return alert('Pick a game or type a custom one.');
        const data = {
            user: currentDisplayName(),
            userId: currentUser.uid,
            game,
            title: $('inputTitle').value.trim(),
            desc: $('inputDesc').value.trim(),
            rank: $('toggleRank').checked ? $('inputRank').value.trim() : 'None',
            memberLimit: Number($('inputLimit').value),
            members: [{ uid: currentUser.uid, name: currentDisplayName() }],
            admins: [currentUser.uid],
            mic: $('toggleMic').checked,
            discord: $('inputDiscord').value.trim() || '',
            discordServer: normalizeUrl($('inputDiscordServer').value),
            steam: normalizeUrl($('inputSteam').value),
            reps: 0,
            reppedBy: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await db.collection('squads').add(data);
            $('createPostForm').reset();
            $('rankField').classList.add('hidden');
            $('customGameField').classList.add('hidden');
            switchView('find-group-view');
        } catch (err) {
            alert('Failed to publish: ' + err.message);
        }
    });
}

function renderPosts() {
    const container = $('postsContainer');
    let list = currentFilter === 'All' ? [...posts] : posts.filter(p => p.game === currentFilter);
    if (currentSearchQ) {
        list = list.filter(p => String(p.title || '').toLowerCase().includes(currentSearchQ) || String(p.desc || '').toLowerCase().includes(currentSearchQ) || String(p.user || '').toLowerCase().includes(currentSearchQ));
    }

    setText('feedResultCount', `${list.length} squad post${list.length === 1 ? '' : 's'}`);
    setText('feedToolbarText', currentFilter === 'All' && !currentSearchQ ? 'Showing every live squad request.' : 'Showing filtered squad matches.');

    if (!list.length) {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-satellite-dish"></i><p>${posts.length === 0 ? 'No squads posted yet - be the first.' : 'No matching squads found.'}</p></div>`;
        return;
    }

    container.innerHTML = list.map(post => {
        const init = escapeHtml((post.user || 'G')[0].toUpperCase());
        const time = escapeHtml(formatTime(post.createdAt));
        const safeUser = escapeHtml(post.user || 'Guest');
        const safeGame = escapeHtml(post.game || 'Unknown');
        const safeTitle = escapeHtml(post.title || 'Untitled squad');
        const safeDesc = escapeHtml(post.desc || '');
        const safeRank = escapeHtml(post.rank || 'None');
        const memberTotal = memberCount(post);
        const limit = Number(post.memberLimit) || memberTotal;
        const discordServerUrl = normalizeUrl(post.discordServer);
        const steamUrl = normalizeUrl(post.steam);
        const joined = isMember(post);
        const full = memberTotal >= limit;
        const repped = currentUser && Array.isArray(post.reppedBy) && post.reppedBy.includes(currentUser.uid);
        const canManagePost = canModerate(post);

        let badges = `<span class="badge badge-slots"><i class="fa-solid fa-users"></i> ${memberTotal}/${limit} members</span>`;
        if (post.mic) badges += '<span class="badge badge-mic"><i class="fa-solid fa-microphone"></i> Mic</span>';
        if (post.rank && post.rank !== 'None') badges += `<span class="badge badge-rank"><i class="fa-solid fa-trophy"></i> ${safeRank}</span>`;

        let socials = '';
        if (post.discord) socials += `<span class="pc-social-link"><i class="fa-brands fa-discord"></i> ${escapeHtml(post.discord)}</span>`;
        if (discordServerUrl) socials += `<a href="${discordServerUrl}" target="_blank" rel="noreferrer" class="pc-social-link"><i class="fa-brands fa-discord"></i> Server</a>`;
        if (steamUrl) socials += `<a href="${steamUrl}" target="_blank" rel="noreferrer" class="pc-social-link"><i class="fa-brands fa-steam"></i> Profile</a>`;

        return `<article class="post-card thread-card">
            <div class="pc-top">
                <div class="pc-user"><div class="pc-avatar">${init}</div><div><div class="pc-name">${safeUser}</div><div class="pc-time">${time}</div></div></div>
                <div class="pc-game">${safeGame}</div>
            </div>
            <div class="pc-body">
                <h3>${safeTitle}</h3>
                <p>${safeDesc}</p>
                <div class="pc-badges">${badges}</div>
                ${socials ? `<div class="pc-socials">${socials}</div>` : ''}
            </div>
            <div class="thread-meta">
                <span><i class="fa-solid fa-user-group"></i> ${memberTotal} in squad</span>
                <span><i class="fa-solid fa-shield"></i> ${Array.isArray(post.admins) ? post.admins.length : 1} admin${Array.isArray(post.admins) && post.admins.length === 1 ? '' : 's'}</span>
                <span><i class="fa-solid fa-arrow-trend-up"></i> ${post.reps || 0} rep</span>
            </div>
            <div class="pc-footer wrap">
                <div class="action-row">
                    <button class="rep-btn ${repped ? 'repped' : ''}" onclick="repPost(event,'${post.id}')" ${repped ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i><span>${post.reps || 0}</span><span class="rep-label">${repped ? 'Repped' : '+Rep'}</span></button>
                    <button class="pc-join alt" onclick="openDmWith('${post.userId}','${safeUser.replace(/'/g, '&#39;')}')"><i class="fa-solid fa-envelope"></i> Message</button>
                </div>
                <div class="action-row">
                    <button class="pc-join alt" onclick="openChat('${post.id}')"><i class="fa-solid fa-comments"></i> Group Chat</button>
                    <button class="pc-join" onclick="joinSquad('${post.id}')" ${joined || full ? 'disabled' : ''}>${joined ? 'Joined' : full ? 'Squad Full' : 'Join Squad'}</button>
                    ${canManagePost ? `<button class="pc-join alt" onclick="openManageMembers('${post.id}')"><i class="fa-solid fa-user-shield"></i> Manage</button>` : ''}
                </div>
            </div>
        </article>`;
    }).join('');
}

window.repPost = async function(event, postId) {
    if (!currentUser) return openAuthModal();
    const post = posts.find(p => p.id === postId);
    if (!post || (post.reppedBy || []).includes(currentUser.uid)) return;
    try {
        await db.collection('squads').doc(postId).update({
            reps: firebase.firestore.FieldValue.increment(1),
            reppedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
        });
        event.currentTarget.classList.add('pop');
        setTimeout(() => event.currentTarget.classList.remove('pop'), 300);
    } catch (err) {
        console.error(err);
    }
};

window.joinSquad = async function(postId) {
    if (!currentUser) return openAuthModal();
    const ref = db.collection('squads').doc(postId);
    try {
        await db.runTransaction(async tx => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw new Error('Squad not found.');
            const post = snap.data();
            const members = Array.isArray(post.members) ? [...post.members] : [];
            if (members.some(member => member.uid === currentUser.uid)) return;
            if (members.length >= Number(post.memberLimit || 0)) throw new Error('This squad is full.');
            members.push({ uid: currentUser.uid, name: currentDisplayName() });
            tx.update(ref, { members, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        showToast('Joined squad. Open the group chat to say hi.');
    } catch (err) {
        alert(err.message);
    }
};

function renderEditPosts() {
    if (!currentUser) return;
    const mine = posts.filter(post => post.userId === currentUser.uid);
    const container = $('editPostsList');
    if (!mine.length) {
        container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-pen"></i><p>You have not created any squad posts yet.</p></div>';
        return;
    }
    container.innerHTML = mine.map(post => `
        <article class="edit-card">
            <div>
                <h3>${escapeHtml(post.title)}</h3>
                <p>${escapeHtml(post.game)} - ${memberCount(post)}/${Number(post.memberLimit) || memberCount(post)} members</p>
            </div>
            <div class="action-row">
                <button class="pc-join alt" onclick="openEditPost('${post.id}')"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                <button class="pc-join alt" onclick="openManageMembers('${post.id}')"><i class="fa-solid fa-user-shield"></i> Members</button>
                <button class="pc-join" onclick="deletePost('${post.id}')"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        </article>
    `).join('');
}

window.openEditPost = function(postId) {
    const post = posts.find(p => p.id === postId && p.userId === currentUser?.uid);
    if (!post) return;
    $('modalBody').innerHTML = `
        <form class="create-form modal-form" id="editPostForm">
            <h2 style="margin-bottom:1rem">Edit Squad Post</h2>
            <div class="field"><label for="editTitle">Post Title</label><input id="editTitle" type="text" value="${escapeHtml(post.title)}" required></div>
            <div class="field"><label for="editDesc">Description</label><textarea id="editDesc" rows="4" required>${escapeHtml(post.desc)}</textarea></div>
            <div class="field-row">
                <div class="field"><label for="editGame">Game</label><input id="editGame" type="text" value="${escapeHtml(post.game)}" required></div>
                <div class="field"><label for="editLimit">Group Limit</label><input id="editLimit" type="number" min="2" max="50" value="${Number(post.memberLimit) || memberCount(post)}" required></div>
            </div>
            <div class="field"><label for="editRank">Rank</label><input id="editRank" type="text" value="${escapeHtml(post.rank || 'None')}"></div>
            <div class="field"><label for="editDiscord">Discord Username</label><input id="editDiscord" type="text" value="${escapeHtml(post.discord || '')}"></div>
            <div class="field"><label for="editDiscordServer">Discord Server Invite</label><input id="editDiscordServer" type="text" value="${escapeHtml(post.discordServer || '')}"></div>
            <div class="field"><label for="editSteam">Steam Profile</label><input id="editSteam" type="text" value="${escapeHtml(post.steam || '')}"></div>
            <div class="dash-actions"><button class="btn-glow" type="submit">Save Changes</button><button class="btn-ghost" type="button" onclick="closeModal()">Cancel</button></div>
        </form>`;
    openModal('gameModal');
    $('editPostForm').addEventListener('submit', async e => {
        e.preventDefault();
        const nextLimit = Number($('editLimit').value);
        if (nextLimit < memberCount(post)) return alert('Group limit cannot be smaller than current members.');
        await db.collection('squads').doc(postId).update({
            title: $('editTitle').value.trim(),
            desc: $('editDesc').value.trim(),
            game: $('editGame').value.trim(),
            memberLimit: nextLimit,
            rank: $('editRank').value.trim() || 'None',
            discord: $('editDiscord').value.trim(),
            discordServer: normalizeUrl($('editDiscordServer').value),
            steam: normalizeUrl($('editSteam').value),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeModal();
    });
};

window.deletePost = async function(postId) {
    if (!confirm('Delete this squad post?')) return;
    await db.collection('squads').doc(postId).delete();
};

window.openManageMembers = function(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post || !canModerate(post)) return;
    const members = Array.isArray(post.members) ? post.members : [];
    $('modalBody').innerHTML = `
        <div class="manage-shell">
            <h2>Manage Squad</h2>
            <p class="detail-note">Promote members to admin or remove them from the squad chat.</p>
            <div class="manage-list">${members.map(member => {
                const owner = member.uid === post.userId;
                const admin = Array.isArray(post.admins) && post.admins.includes(member.uid);
                return `<div class="manage-row"><div><strong>${escapeHtml(member.name || 'Player')}</strong><span>${owner ? 'Owner' : admin ? 'Admin' : 'Member'}</span></div><div class="action-row">${!owner && isOwner(post) && !admin ? `<button class="pc-join alt" onclick="promoteAdmin('${post.id}','${member.uid}')">Make Admin</button>` : ''}${!owner ? `<button class="pc-join" onclick="removeMember('${post.id}','${member.uid}')">Remove</button>` : ''}</div></div>`;
            }).join('')}</div>
        </div>`;
    openModal('gameModal');
};

window.promoteAdmin = async function(postId, uid) {
    const post = posts.find(p => p.id === postId);
    if (!post || !isOwner(post)) return;
    const admins = Array.isArray(post.admins) ? [...post.admins] : [post.userId];
    if (!admins.includes(uid)) admins.push(uid);
    await db.collection('squads').doc(postId).update({ admins, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
};

window.removeMember = async function(postId, uid) {
    const post = posts.find(p => p.id === postId);
    if (!post || !canModerate(post) || uid === post.userId) return;
    const members = (post.members || []).filter(member => member.uid !== uid);
    const admins = (post.admins || []).filter(adminId => adminId !== uid);
    await db.collection('squads').doc(postId).update({ members, admins, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
};

function initChat() {
    $('chatForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!currentUser || !currentChatId) return;
        const text = $('chatInput').value.trim();
        if (!text) return;
        try {
            await db.collection('squads').doc(currentChatId).collection('messages').add({
                user: currentDisplayName(),
                userId: currentUser.uid,
                text,
                ts: firebase.firestore.FieldValue.serverTimestamp()
            });
            $('chatInput').value = '';
        } catch (err) {
            console.error('Chat send error:', err);
        }
    });
    $('chatModal').addEventListener('click', e => { if (e.target === $('chatModal')) closeChatModal(); });
}

window.openChat = function(postId) {
    if (!currentUser) return openAuthModal();
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    currentChatId = postId;
    $('chatHeader').innerHTML = `<div class="pc-avatar" style="width:36px;height:36px;font-size:.9rem">${escapeHtml((post.user || 'G')[0].toUpperCase())}</div><div><h3>${escapeHtml(post.title)}</h3><span class="pc-game">${escapeHtml(post.game)}</span></div>${canModerate(post) ? `<button class="pc-join alt" onclick="openManageMembers('${post.id}')">Manage</button>` : ''}`;
    $('chatMessages').innerHTML = '<div class="empty-state" style="padding:2rem"><i class="fa-solid fa-comments"></i><p>Loading messages...</p></div>';
    openModal('chatModal');
    if (chatUnsub) chatUnsub();
    chatUnsub = db.collection('squads').doc(postId).collection('messages').orderBy('ts', 'asc').onSnapshot(snap => {
        const messages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (!messages.length) {
            $('chatMessages').innerHTML = '<div class="empty-state" style="padding:2rem"><p>No messages yet - say hi.</p></div>';
            return;
        }
        $('chatMessages').innerHTML = messages.map(message => {
            const mine = message.userId === currentUser.uid;
            const mod = canModerate(post) || mine;
            return `<div class="chat-msg ${mine ? 'mine' : 'other'}"><div class="chat-msg-name">${escapeHtml(message.user || 'Player')}</div><div class="chat-msg-text">${escapeHtml(message.text || '')}</div><div class="chat-msg-time">${escapeHtml(formatTime(message.ts))}</div>${mod ? `<button class="chat-delete" onclick="deleteChatMessage('${post.id}','${message.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}</div>`;
        }).join('');
        $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
    });
};

window.deleteChatMessage = async function(postId, messageId) {
    const post = posts.find(p => p.id === postId);
    if (!post || !currentUser) return;
    await db.collection('squads').doc(postId).collection('messages').doc(messageId).delete();
};

function closeChatModal() {
    closeModalById('chatModal');
    if (chatUnsub) {
        chatUnsub();
        chatUnsub = null;
    }
    currentChatId = null;
}
window.closeChatModal = closeChatModal;

async function fetchSteamPlayers() {
    setText('gamesSteamStatus', 'Please wait loading...');
    const results = await Promise.allSettled(trending.map(async game => {
        const count = await getSteamPlayerCount(game.appid);
        game.players = count.toLocaleString();
        return true;
    }));
    steamDataHealthy = results.some(result => result.status === 'fulfilled');
    setText('gamesSteamStatus', steamDataHealthy ? 'Live counts ready' : 'Loading Steam data...');
    renderTrending();
}

window.openGameDetails = async function(gid) {
    const game = allGames.find(g => g.id === gid);
    if (!game) return;
    $('modalBody').innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    openModal('gameModal');
    let count = 0;
    let peak = 0;
    try {
        count = await getSteamPlayerCount(game.appid);
        peak = Math.floor(count * 1.25);
    } catch {}
    $('modalBody').innerHTML = `
        <div class="dash-head">
            <div class="dash-title"><h1 class="gradient-text">${escapeHtml(game.title)}</h1></div>
            <div class="dash-stats"><div class="dash-stat"><div class="dash-stat-label">Online Now</div><div class="dash-stat-val">${count.toLocaleString()}</div></div><div class="dash-stat"><div class="dash-stat-label">24h Peak</div><div class="dash-stat-val">${peak.toLocaleString()}</div></div></div>
        </div>
        <p class="detail-note">${count ? 'Live Steam activity loaded successfully.' : 'Please wait loading...'}</p>
        <div class="dash-chart"><h3><i class="fa-solid fa-chart-area"></i> Player Activity (24h)</h3><div style="height:250px;position:relative"><canvas id="detailChart"></canvas></div></div>
        <div class="dash-actions"><button class="btn-glow" onclick="closeModal();switchView('create-post-view');setTimeout(()=>{if($('inputGame')){$('inputGame').value='${escapeHtml(game.title)}';$('customGameField').classList.add('hidden');}},80)"><i class="fa-solid fa-plus"></i> Create Squad</button><button class="btn-ghost" onclick="closeModal()">Close</button></div>`;
    setTimeout(() => {
        const ctx = $('detailChart').getContext('2d');
        const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
        const data = labels.map(() => Math.floor((count || 80000) * (.8 + Math.random() * .4)));
        const grad = ctx.createLinearGradient(0, 0, 0, 250);
        grad.addColorStop(0, 'rgba(249,115,22,.28)');
        grad.addColorStop(1, 'rgba(34,211,238,0)');
        new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ data, borderColor: '#22d3ee', backgroundColor: grad, fill: true, tension: .45, pointRadius: 0, borderWidth: 3 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false, grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: 'rgba(255,255,255,.25)', font: { size: 10 } } }, x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,.25)', font: { size: 10 }, maxRotation: 0 } } } }
        });
    }, 60);
};

function closeModal() {
    closeModalById('gameModal');
}
window.closeModal = closeModal;

$('gameModal').addEventListener('click', e => { if (e.target === $('gameModal')) closeModal(); });
