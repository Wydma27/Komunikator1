const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./database');

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Inicjalizacja bazy danych
db.initDatabase();

// Aktywni użytkownicy online (socket.id -> username)
let onlineUsers = new Map();

// REST API endpoints
app.post('/api/register', (req, res) => {
    const { username, email, password, avatar } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Nazwa użytkownika i hasło są wymagane' });
    }

    const result = db.addUser({ username, email, password, avatar });

    if (result.success) {
        const { password, ...userWithoutPassword } = result.user;
        res.json({ success: true, user: userWithoutPassword });
    } else {
        res.status(400).json(result);
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Nazwa użytkownika i hasło są wymagane' });
    }

    const user = db.findUserByUsername(username);

    if (!user) {
        return res.status(401).json({ success: false, message: 'Nieprawidłowa nazwa użytkownika lub hasło' });
    }

    if (user.password !== password) {
        return res.status(401).json({ success: false, message: 'Nieprawidłowa nazwa użytkownika lub hasło' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
});

app.post('/api/user/update', (req, res) => {
    const { username, updates } = req.body;

    if (!username) {
        return res.status(400).json({ success: false, message: 'Nazwa użytkownika jest wymagana' });
    }

    const result = db.updateUser(username, updates);

    if (result.success) {
        const { password, ...userWithoutPassword } = result.user;

        // Powiadom wszystkich online o zmianie
        io.emit('user:updated', userWithoutPassword);

        res.json({ success: true, user: userWithoutPassword });
    } else {
        res.status(400).json(result);
    }
});



const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
    // Uruchom cleanup co godzinę
    setInterval(() => {
        db.cleanupOldMessages();
    }, 60 * 60 * 1000);
    // Uruchom cleanup przy starcie
    db.cleanupOldMessages();
});

io.on('connection', (socket) => {
    console.log(`Użytkownik połączony: ${socket.id}`);

    const getSocketIdByUsername = (username) => {
        return Array.from(onlineUsers.entries())
            .find(([_, name]) => name === username)?.[0];
    };

    socket.on('user:login', (userData) => {
        const { username } = userData;
        const dbUser = db.findUserByUsername(username);

        if (dbUser) {
            onlineUsers.set(socket.id, username);

            // NAJPIERW wyślij pełną listę WSZYSTKICH użytkowników (dla wyszukiwarki)
            const allUsers = db.getAllUsers().map(u => {
                const { password, ...uData } = u;
                const isOnline = getSocketIdByUsername(u.username);
                return {
                    ...uData,
                    status: isOnline ? 'online' : 'offline',
                    lastSeen: u.createdAt
                };
            });
            console.log(`📋 Sending ${allUsers.length} users to ${username}`);
            socket.emit('users:list', allUsers);

            // Wyślij listę użytkowników online
            const broadcastOnlineUsers = () => {
                const onlineUsersList = Array.from(onlineUsers.values()).map(uname => {
                    const user = db.findUserByUsername(uname);
                    if (user) {
                        const { password, ...userWithoutPassword } = user;
                        return {
                            ...userWithoutPassword,
                            socketId: getSocketIdByUsername(uname),
                            status: 'online'
                        };
                    }
                    return null;
                }).filter(Boolean);
                io.emit('users:online', onlineUsersList);
            };

            broadcastOnlineUsers();

            // Wyślij historię czatu ogólnego
            const generalMessages = db.getMessages('general');
            socket.emit('messages:history', { chatId: 'general', messages: generalMessages });

            // Wyślij info o zalogowanym użytkowniku
            const { password, ...currentUserData } = dbUser;
            socket.emit('user:data', currentUserData);

            // Wyślij grupy użytkownika
            const userGroups = db.getUserGroups(username);
            socket.emit('groups:list', userGroups);
        }
    });

    // Obsługa zaproszeń
    socket.on('friend:request:send', ({ toUser }) => {
        const fromUser = onlineUsers.get(socket.id);
        console.log(`📨 Friend request from ${fromUser} to ${toUser}`);

        if (!fromUser) {
            console.log('❌ No fromUser found');
            return;
        }

        const result = db.sendFriendRequest(fromUser, toUser);
        console.log(`Result:`, result);

        if (result.success) {
            socket.emit('friend:request:sent', { success: true, to: toUser });

            // Powiadom odbiorcę jeśli online
            const recipientSocketId = getSocketIdByUsername(toUser);
            console.log(`Recipient ${toUser} socket: ${recipientSocketId}`);

            if (recipientSocketId) {
                io.to(recipientSocketId).emit('friend:request:received', {
                    from: fromUser,
                    message: `Otrzymałeś zaproszenie do znajomych od ${fromUser}`
                });

                // Odśwież dane użytkownika u odbiorcy
                const recipient = db.findUserByUsername(toUser);
                if (recipient) {
                    const { password, ...recipientData } = recipient;
                    console.log(`Sending updated user data to ${toUser}:`, recipientData.friendRequests);
                    io.to(recipientSocketId).emit('user:data', recipientData);
                }
            }
        } else {
            console.log(`❌ Failed to send request: ${result.message}`);
            socket.emit('friend:request:sent', { success: false, message: result.message });
        }
    });

    socket.on('friend:request:respond', ({ fromUser, action }) => { // action: 'accept' | 'reject'
        const currentUser = onlineUsers.get(socket.id);
        if (!currentUser) return;

        const result = db.handleFriendRequest(currentUser, fromUser, action);

        if (result.success) {
            // Odśwież dane bieżącego użytkownika
            const updatedCurrentUser = db.findUserByUsername(currentUser);
            if (updatedCurrentUser) {
                const { password, ...data } = updatedCurrentUser;
                socket.emit('user:data', data);
            }

            if (action === 'accept') {
                // Powiadom obu o nowej znajomości
                const friendSocketId = getSocketIdByUsername(fromUser);

                // Dla mnie
                const friend = db.findUserByUsername(fromUser);
                if (friend) {
                    const { password, ...friendData } = friend;
                    socket.emit('friend:added', { friend: friendData });
                }

                // Dla niego
                if (friendSocketId) {
                    io.to(friendSocketId).emit('friend:request:accepted', {
                        by: currentUser,
                        message: `${currentUser} zaakceptował Twoje zaproszenie!`
                    });

                    if (updatedCurrentUser) {
                        const { password, ...data } = updatedCurrentUser;
                        io.to(friendSocketId).emit('friend:added', { friend: data });
                        // Również odśwież jego dane (by usunąć ew. wiszące requesty wizualnie jeśli jakieś były dwustronne/chociaż logika to obsłużyła w bazie)
                        const friendUserData = db.findUserByUsername(fromUser);
                        if (friendUserData) {
                            const { password, ...fData } = friendUserData;
                            io.to(friendSocketId).emit('user:data', fData);
                        }
                    }
                }
            }
        }
    });

    // Stare dodawanie 'friend:add' zostawiamy dla kompatybilności lub zmieniamy na request?
    // User prosił o menu akceptacji, więc 'friend:add' teraz powinno wysyłać request.
    // Zmienię logikę friend:add by działała jak send request, ale klient musi być gotowy.
    // Ale w Sidebar mamy "Add Friend" -> to powinno być Send Request.
    // Zróbmy tak: friend:add w kliencie wywołuje teraz friend:request:send? Nie, serwer musi obsłużyć.
    // Zostawiam friend:add jako alias do friend:request:send dla uproszczenia refaktoringu klienta w 1 kroku,
    // albo zmieniam w kliencie. Zmienię w kliencie na 'friend:request:send'.

    // Legacy endpoint support (optional) or just remove functionality to force new flow
    // socket.on('friend:add', ... ) -> COMMENTED OUT TO FORCE NEW FLOW

    socket.on('chat:history:fetch', ({ chatId }) => {
        const currentUsername = onlineUsers.get(socket.id);
        console.log(`📜 Fetching history for chatId: ${chatId}, user: ${currentUsername}`);

        let dbChatId = chatId;

        if (chatId.startsWith('group_')) {
            // Group chat
            const group = db.getGroup(chatId);
            if (!group || !group.members.includes(currentUsername)) {
                console.log('User not in group or group not found');
                return;
            }
            // dbChatId is already correct
        } else if (chatId !== 'general' && currentUsername) {
            // Private chat
            const usernames = [currentUsername, chatId].sort();
            dbChatId = usernames.join('-');
            console.log(`   Constructed DB chatId: ${dbChatId}`);
        }

        const messages = db.getMessages(dbChatId);
        console.log(`   Found ${messages.length} messages`);
        socket.emit('messages:history', { chatId, messages });
    });

    socket.on('message:send', (messageData) => {
        const { content, type, replyTo, to } = messageData;
        const senderUsername = onlineUsers.get(socket.id);

        if (!senderUsername) return;

        const sender = db.findUserByUsername(senderUsername);
        if (!sender) return;

        const newMessage = {
            id: Date.now().toString() + Math.random(),
            content,
            sender: {
                id: sender.id,
                username: sender.username,
                avatar: sender.avatar
            },
            timestamp: new Date().toISOString(),
            type: type || 'text',
            replyTo,
            reactions: {},
            readBy: [socket.id]
        };

        if (to && to.startsWith('group_')) {
            // Wiadomość grupowa
            const group = db.getGroup(to);
            if (group && group.members.includes(senderUsername)) {
                db.saveMessage(to, newMessage);

                // Wyślij do wszystkich członków grupy
                group.members.forEach(member => {
                    const socketId = getSocketIdByUsername(member);
                    if (socketId) {
                        io.to(socketId).emit('message:new', { chatId: to, message: newMessage });

                        if (member !== senderUsername) {
                            io.to(socketId).emit('alert:new', {
                                title: `Nowa wiadomość w grupie ${group.name}`,
                                message: `${senderUsername}: ${content}`,
                                type: 'message',
                                from: to
                            });
                        }
                    }
                });
            }

        } else if (to && to !== 'general') {
            const recipientUser = db.findUserByUsername(to);
            if (!recipientUser) return;

            const usernames = [senderUsername, to].sort();
            const chatId = usernames.join('-');

            console.log(`💬 Saving message to DB chatId: ${chatId}`);
            db.saveMessage(chatId, newMessage);

            // Wyślij do nadawcy
            console.log(`   Sending to sender (${senderUsername}) with chatId: ${to}`);
            socket.emit('message:new', { chatId: to, message: newMessage });

            // Wyślij do odbiorcy
            const recipientSocketId = getSocketIdByUsername(to);
            if (recipientSocketId) {
                console.log(`   Sending to recipient (${to}) with chatId: ${senderUsername}`);
                io.to(recipientSocketId).emit('message:new', { chatId: senderUsername, message: newMessage });
                io.to(recipientSocketId).emit('alert:new', {
                    title: `Nowa wiadomość od ${senderUsername}`,
                    message: content,
                    type: 'message',
                    from: senderUsername
                });
            }

        } else {
            db.saveMessage('general', newMessage);
            io.emit('message:new', { chatId: 'general', message: newMessage });
        }
    });

    socket.on('message:react:v2', ({ chatId, messageId, emoji }) => {
        const username = onlineUsers.get(socket.id);
        if (!username) return;

        // Tutaj logika reakcji powinna być solidniejsza co do chatId, ale zostawiamy v2/react poprawione
    });

    socket.on('message:react', ({ messageId, emoji, chatId }) => {  // chatId tutaj to activeChatId z klienta (np. 'general' lub username)
        const senderUsername = onlineUsers.get(socket.id);
        if (!senderUsername) return;

        let dbChatId = 'general';
        if (chatId.startsWith('group_')) {
            dbChatId = chatId;
        } else if (chatId !== 'general') {
            const usernames = [senderUsername, chatId].sort();
            dbChatId = usernames.join('-');
        }

        const result = db.addReaction(dbChatId, messageId, emoji, senderUsername);

        if (result.success) {
            const updatedMessage = result.message;

            if (dbChatId === 'general') {
                io.emit('message:updated', { chatId: 'general', message: updatedMessage });
            } else if (dbChatId.startsWith('group_')) {
                // Grupa
                const group = db.getGroup(dbChatId);
                if (group) {
                    group.members.forEach(member => {
                        const socketId = getSocketIdByUsername(member);
                        if (socketId) {
                            io.to(socketId).emit('message:updated', { chatId: dbChatId, message: updatedMessage });
                        }
                    });
                }
            } else {
                // Priv
                const [u1, u2] = dbChatId.split('-');
                const socket1 = getSocketIdByUsername(u1);
                const socket2 = getSocketIdByUsername(u2);

                if (socket1) io.to(socket1).emit('message:updated', { chatId: u2 === u1 ? u1 : (u1 === senderUsername ? u2 : u1), message: updatedMessage });

                // Logic fix for private chat:
                if (socket1) {
                    const chatTarget = u1 === senderUsername ? u2 : u2; // Sender sees chat with u2 (if u1==sender) -- wait, logic is: chatId is the OTHER PERSON username.
                    // u1 is user. If u1 is sender, he is looking at chat "u2".
                    // If u1 is NOT sender (is u2), he is looking at chat "u1".
                    // BUT here we process sockets independently.
                }

                // Simply:
                // For user u1, the chat ID is u2.
                // For user u2, the chat ID is u1.

                if (socket1) { // User u1
                    const target = u1 === u1 ? u2 : u1; // u2
                    io.to(socket1).emit('message:updated', { chatId: u2, message: updatedMessage });
                }
                if (socket2) { // User u2
                    const target = u2 === u2 ? u1 : u2; // u1
                    io.to(socket2).emit('message:updated', { chatId: u1, message: updatedMessage });
                }
            }
        }
    });



    socket.on('typing:start', ({ to }) => {
        const username = onlineUsers.get(socket.id);
        if (!username) return;

        if (to && to.startsWith('group_')) {
            const group = db.getGroup(to);
            if (group) {
                group.members.forEach(member => {
                    if (member !== username) {
                        const socketId = getSocketIdByUsername(member);
                        if (socketId) {
                            io.to(socketId).emit('typing:user', { username, isTyping: true, chatId: to });
                        }
                    }
                });
            }
        } else if (to && to !== 'general') {
            const recipientSocketId = getSocketIdByUsername(to);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('typing:user', { username, isTyping: true, chatId: username });
            }
        } else if (to === 'general') {
            socket.broadcast.emit('typing:user', { username, isTyping: true, chatId: 'general' });
        }
    });

    // Endpoint tworzenia grupy
    app.post('/api/groups/create', (req, res) => {
        const { name, members, createdBy } = req.body; // members: [username1, username2]

        if (!name || !createdBy) {
            return res.status(400).json({ success: false, message: 'Nazwa grupy i twórca są wymagane' });
        }

        const membersList = members || [];
        const result = db.createGroup(name, createdBy, membersList);

        if (result.success) {
            // Powiadom członków grupy o nowej grupie
            const group = result.group;
            group.members.forEach(member => {
                // Find socket for member using the helper (we need access to getSocketIdByUsername, but it's inside io.on)
                // We can iterate onlineUsers map
                const socketId = Array.from(onlineUsers.entries()).find(([_, name]) => name === member)?.[0];
                if (socketId) {
                    io.to(socketId).emit('group:created', group);
                }
            });
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    });

    socket.on('typing:stop', ({ to }) => {
        const username = onlineUsers.get(socket.id);
        if (!username) return;

        if (to && to.startsWith('group_')) {
            const group = db.getGroup(to);
            if (group) {
                group.members.forEach(member => {
                    if (member !== username) {
                        const socketId = getSocketIdByUsername(member);
                        if (socketId) {
                            io.to(socketId).emit('typing:user', { username, isTyping: false, chatId: to });
                        }
                    }
                });
            }
        } else if (to && to !== 'general') {
            const recipientSocketId = getSocketIdByUsername(to);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('typing:user', { username, isTyping: false, chatId: username });
            }
        } else if (to === 'general') {
            socket.broadcast.emit('typing:user', { username, isTyping: false, chatId: 'general' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Użytkownik rozłączony: ${socket.id}`);
        const username = onlineUsers.get(socket.id);

        if (username) {
            onlineUsers.delete(socket.id);
            const onlineUsersList = Array.from(onlineUsers.values()).map(uname => {
                const user = db.findUserByUsername(uname);
                if (user) {
                    const { password, ...userWithoutPassword } = user;
                    return {
                        ...userWithoutPassword,
                        socketId: getSocketIdByUsername(uname),
                        status: 'online'
                    };
                }
                return null;
            }).filter(Boolean);

            io.emit('users:online', onlineUsersList);
        }
    });
});


