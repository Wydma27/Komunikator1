const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

// Inicjalizacja bazy danych
function initDatabase() {
    if (!fs.existsSync(DB_PATH)) {
        const initialData = {
            users: [],
            messages: {
                general: []
            },
            groups: []
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    } else {
        // Migration: Ensure all users have friendRequests array
        const db = readDatabase();
        let changed = false;
        db.users.forEach(user => {
            if (!user.friendRequests) {
                user.friendRequests = [];
                changed = true;
            }
        });
        if (!db.groups) {
            db.groups = [];
            changed = true;
        }
        if (changed) writeDatabase(db);
    }
}

// Odczyt bazy danych
function readDatabase() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Błąd odczytu bazy danych:', error);
        return { users: [], messages: { general: [] } };
    }
}

// Zapis bazy danych
function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Błąd zapisu bazy danych:', error);
        return false;
    }
}

// Znajdź użytkownika po nazwie
function findUserByUsername(username) {
    const db = readDatabase();
    return db.users.find(u => u.username === username);
}

// Znajdź użytkownika po email
function findUserByEmail(email) {
    const db = readDatabase();
    return db.users.find(u => u.email === email);
}

// Dodaj nowego użytkownika
function addUser(userData) {
    const db = readDatabase();

    // Sprawdź czy użytkownik już istnieje
    if (findUserByUsername(userData.username)) {
        return { success: false, message: 'Użytkownik o tej nazwie już istnieje' };
    }

    if (userData.email && findUserByEmail(userData.email)) {
        return { success: false, message: 'Email jest już zarejestrowany' };
    }

    const newUser = {
        id: Date.now().toString(),
        username: userData.username,
        email: userData.email || '',
        password: userData.password, // W produkcji należy hashować!
        avatar: userData.avatar || '',
        friends: [],
        friendRequests: [],
        createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDatabase(db);

    return { success: true, user: newUser };
}

// Aktualizuj użytkownika
function updateUser(username, updates) {
    const db = readDatabase();
    const userIndex = db.users.findIndex(u => u.username === username);

    if (userIndex === -1) {
        return { success: false, message: 'Użytkownik nie znaleziony' };
    }

    // Sprawdź czy nowa nazwa użytkownika nie jest zajęta
    if (updates.username && updates.username !== username) {
        if (findUserByUsername(updates.username)) {
            return { success: false, message: 'Nazwa użytkownika jest już zajęta' };
        }
    }

    db.users[userIndex] = { ...db.users[userIndex], ...updates };
    writeDatabase(db);

    return { success: true, user: db.users[userIndex] };
}

// Dodaj znajomego
function addFriend(username, friendUsername) {
    const db = readDatabase();
    const user = db.users.find(u => u.username === username);
    const friend = db.users.find(u => u.username === friendUsername);

    if (!user || !friend) {
        return { success: false, message: 'Użytkownik nie znaleziony' };
    }

    if (!user.friends) user.friends = [];
    if (!friend.friends) friend.friends = [];

    if (!user.friends.includes(friendUsername)) {
        user.friends.push(friendUsername);
    }

    if (!friend.friends.includes(username)) {
        friend.friends.push(username);
    }

    writeDatabase(db);
    writeDatabase(db);
    return { success: true };
}

// Wyślij zaproszenie do znajomych
function sendFriendRequest(fromUsername, toUsername) {
    const db = readDatabase();
    const fromUser = db.users.find(u => u.username === fromUsername);
    const toUser = db.users.find(u => u.username === toUsername);

    if (!fromUser || !toUser) {
        return { success: false, message: 'Użytkownik nie znaleziony' };
    }

    if (toUser.friends.includes(fromUsername)) {
        return { success: false, message: 'Użytkownik jest już Twoim znajomym' };
    }

    if (!toUser.friendRequests) toUser.friendRequests = [];

    if (toUser.friendRequests.some(req => req.from === fromUsername)) {
        return { success: false, message: 'Zaproszenie zostało już wysłane' };
    }

    // Check if they sent us a request already - if so, auto-accept (optional, but good UX)
    // For now, simple request logic.
    toUser.friendRequests.push({
        from: fromUsername,
        timestamp: new Date().toISOString()
    });

    writeDatabase(db);
    return { success: true };
}

// Zaakceptuj/Odrzuć zaproszenie
function handleFriendRequest(username, fromUsername, action) {
    const db = readDatabase();
    const user = db.users.find(u => u.username === username);

    if (!user) return { success: false, message: 'Użytkownik nie znaleziony' };
    if (!user.friendRequests) user.friendRequests = [];

    const reqIndex = user.friendRequests.findIndex(r => r.from === fromUsername);

    if (reqIndex === -1) {
        return { success: false, message: 'Nie znaleziono zaproszenia' };
    }

    // Usuń zaproszenie
    user.friendRequests.splice(reqIndex, 1);

    if (action === 'accept') {
        const friend = db.users.find(u => u.username === fromUsername);
        if (friend) {
            if (!user.friends.includes(fromUsername)) user.friends.push(fromUsername);
            if (!friend.friends.includes(username)) friend.friends.push(username);
        }
    }

    writeDatabase(db);
    return { success: true };
}

// Wyczyść stare wiadomości (> 24h)
function cleanupOldMessages() {
    const db = readDatabase();
    const now = Date.now();
    const timeLimit = 24 * 60 * 60 * 1000; // 24h
    let changed = false;

    Object.keys(db.messages).forEach(chatId => {
        const originalLength = db.messages[chatId].length;
        db.messages[chatId] = db.messages[chatId].filter(msg => {
            const msgTime = new Date(msg.timestamp).getTime();
            return (now - msgTime) < timeLimit;
        });

        if (db.messages[chatId].length !== originalLength) {
            changed = true;
        }
    });

    if (changed) {
        writeDatabase(db);
        console.log('Wyczyszczono stare wiadomości');
    }
}

// Zapisz wiadomość
function saveMessage(chatId, message) {
    const db = readDatabase();

    if (!db.messages[chatId]) {
        db.messages[chatId] = [];
    }

    db.messages[chatId].push(message);

    // Ogranicz historię do 1000 wiadomości na czat
    if (db.messages[chatId].length > 1000) {
        db.messages[chatId] = db.messages[chatId].slice(-1000);
    }

    writeDatabase(db);
}

// Dodaj reakcję
function addReaction(chatId, messageId, emoji, username) {
    const db = readDatabase();
    const messages = db.messages[chatId];

    if (!messages) return { success: false };

    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return { success: false };

    let message = messages[messageIndex];
    if (!message.reactions) message.reactions = {};
    if (!message.reactions[emoji]) message.reactions[emoji] = [];

    // Toggle reaction
    if (message.reactions[emoji].includes(username)) {
        message.reactions[emoji] = message.reactions[emoji].filter(u => u !== username);
        if (message.reactions[emoji].length === 0) {
            delete message.reactions[emoji];
        }
    } else {
        message.reactions[emoji].push(username);
    }

    messages[messageIndex] = message;
    writeDatabase(db);

    return { success: true, message: message };
}

// Pobierz wiadomości
function getMessages(chatId) {
    const db = readDatabase();
    return db.messages[chatId] || [];
}

// Pobierz wszystkich użytkowników
function getAllUsers() {
    const db = readDatabase();
    return db.users;
}

module.exports = {
    initDatabase,
    readDatabase,
    writeDatabase,
    findUserByUsername,
    findUserByEmail,
    addUser,
    updateUser,
    addFriend,
    saveMessage,
    addReaction,
    getMessages,
    getAllUsers,
    sendFriendRequest,
    handleFriendRequest,
    cleanupOldMessages,
    createGroup,
    getUserGroups,
    getGroup
};

// Utwórz grupę
function createGroup(name, creatorUsername, membersUsernames) {
    const db = readDatabase();

    // Add creator to members if not present
    const members = [...new Set([creatorUsername, ...membersUsernames])];

    const newGroup = {
        id: 'group_' + Date.now().toString(),
        name,
        members,
        createdBy: creatorUsername,
        createdAt: new Date().toISOString(),
        avatar: '' // Optional group avatar
    };

    if (!db.groups) db.groups = [];
    db.groups.push(newGroup);

    // Initialize messages for this group
    if (!db.messages[newGroup.id]) {
        db.messages[newGroup.id] = [];
    }

    writeDatabase(db);
    return { success: true, group: newGroup };
}

// Pobierz grupy użytkownika
function getUserGroups(username) {
    const db = readDatabase();
    if (!db.groups) return [];
    return db.groups.filter(g => g.members.includes(username));
}

// Znajdź grupę po ID
function getGroup(groupId) {
    const db = readDatabase();
    if (!db.groups) return null;
    return db.groups.find(g => g.id === groupId);
}
