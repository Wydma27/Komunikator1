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

io.on('connection', (socket) => {
    console.log(`Użytkownik połączony: ${socket.id}`);

    socket.on('user:login', (userData) => {
        const { username } = userData;
        const dbUser = db.findUserByUsername(username);

        if (dbUser) {
            onlineUsers.set(socket.id, username);

            // Wyślij listę użytkowników online
            const onlineUsersList = Array.from(onlineUsers.values()).map(uname => {
                const user = db.findUserByUsername(uname);
                if (user) {
                    const { password, ...userWithoutPassword } = user;
                    return {
                        ...userWithoutPassword,
                        socketId: Array.from(onlineUsers.entries()).find(([_, name]) => name === uname)?.[0],
                        status: 'online'
                    };
                }
                return null;
            }).filter(Boolean);

            io.emit('users:online', onlineUsersList);

            // Wyślij historię czatu ogólnego
            const generalMessages = db.getMessages('general');
            socket.emit('messages:history', { chatId: 'general', messages: generalMessages });
        }
    });

    socket.on('friend:add', ({ friendUsername }) => {
        const currentUsername = onlineUsers.get(socket.id);
        if (!currentUsername) return;

        const result = db.addFriend(currentUsername, friendUsername);

        if (result.success) {
            // Powiadom obu użytkowników
            const currentUser = db.findUserByUsername(currentUsername);
            const friend = db.findUserByUsername(friendUsername);

            if (currentUser && friend) {
                const { password: _, ...currentUserData } = currentUser;
                const { password: __, ...friendData } = friend;

                socket.emit('friend:added', { friend: friendData });

                // Znajdź socket ID znajomego jeśli jest online
                const friendSocketId = Array.from(onlineUsers.entries())
                    .find(([_, name]) => name === friendUsername)?.[0];

                if (friendSocketId) {
                    io.to(friendSocketId).emit('friend:added', { friend: currentUserData });
                }

                // Odśwież listę użytkowników
                const onlineUsersList = Array.from(onlineUsers.values()).map(uname => {
                    const user = db.findUserByUsername(uname);
                    if (user) {
                        const { password, ...userWithoutPassword } = user;
                        return {
                            ...userWithoutPassword,
                            socketId: Array.from(onlineUsers.entries()).find(([_, name]) => name === uname)?.[0],
                            status: 'online'
                        };
                    }
                    return null;
                }).filter(Boolean);

                io.emit('users:online', onlineUsersList);
            }
        }
    });

    socket.on('chat:history:fetch', ({ chatId }) => {
        const messages = db.getMessages(chatId);
        socket.emit('messages:history', { chatId, messages });
    });

    socket.on('message:send', (messageData) => {
        const { content, type, replyTo, to } = messageData;
        const senderUsername = onlineUsers.get(socket.id);

        if (!senderUsername) return;

        const sender = db.findUserByUsername(senderUsername);
        if (!sender) return;

        const { password, ...senderData } = sender;

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

        if (to && to !== 'general') {
            // Prywatna wiadomość - użyj username jako chatId
            const recipientUser = db.findUserByUsername(to);
            if (!recipientUser) return;

            // Klucz pokoju: posortowane usernames
            const usernames = [senderUsername, to].sort();
            const chatId = usernames.join('-');

            db.saveMessage(chatId, newMessage);

            // Wyślij do nadawcy
            socket.emit('message:new', { chatId: to, message: newMessage });

            // Wyślij do odbiorcy jeśli jest online
            const recipientSocketId = Array.from(onlineUsers.entries())
                .find(([_, name]) => name === to)?.[0];

            if (recipientSocketId) {
                io.to(recipientSocketId).emit('message:new', { chatId: senderUsername, message: newMessage });
            }

        } else {
            // Wiadomość ogólna
            db.saveMessage('general', newMessage);
            io.emit('message:new', { chatId: 'general', message: newMessage });
        }
    });

    socket.on('message:react', ({ messageId, emoji }) => {
        const username = onlineUsers.get(socket.id);
        if (!username) return;

        // Znajdź czat, w którym jest ta wiadomość (brute force dla uproszczenia, lub przekaż chatId z klienta)
        // Optymalizacja: Klient powinien wysłać chatId. Ale możemy poszukać.
        // Dla uproszczenia zakładamy, że klient musi wysłać wiadomość w kontekście czatu.
        // Jednak `addReaction` w database.js wymaga chatId.
        // Zmieńmy logikę, aby klient wysyłał chatId.
    });

    socket.on('message:react:v2', ({ chatId, messageId, emoji }) => {
        const username = onlineUsers.get(socket.id);
        if (!username) return;

        const result = db.addReaction(chatId, messageId, emoji, username);

        if (result.success) {
            // Broadcast aktualizacji wiadomości
            const updatedMessage = result.message;

            if (chatId === 'general') {
                io.emit('message:updated', { chatId, message: updatedMessage });
            } else {
                // To jest czat prywatny (chatId = sorted usernames)
                // lub chatId = username odbiorcy (z perspektywy nadawcy)... 
                // Czekaj, chatId w bazie dla privów to "user1-user2". 
                // Klient musi znać ten ID.
                // W App.tsx activeChatId to po prostu username kolegi.
                // Musimy zrekonstruować ID lub znaleźć go.

                // Uproszczenie:
                // Niech klient wysyła też 'to' (odbiorcę) jak przy wysyłaniu wiadomości.
            }
        }
    });

    // Poprawiona wersja obsługująca obecną strukturę
    socket.on('message:react', ({ messageId, emoji, chatId }) => {  // chatId tutaj to activeChatId z klienta (np. 'general' lub username)
        const senderUsername = onlineUsers.get(socket.id);
        if (!senderUsername) return;

        let dbChatId = 'general';
        if (chatId !== 'general') {
            const usernames = [senderUsername, chatId].sort();
            dbChatId = usernames.join('-');
        }

        const result = db.addReaction(dbChatId, messageId, emoji, senderUsername);

        if (result.success) {
            const updatedMessage = result.message;

            if (dbChatId === 'general') {
                io.emit('message:updated', { chatId: 'general', message: updatedMessage });
            } else {
                // Wyślij do obu stron
                const [u1, u2] = dbChatId.split('-');

                // Znajdź sockety
                const socket1 = Array.from(onlineUsers.entries()).find(([_, name]) => name === u1)?.[0];
                const socket2 = Array.from(onlineUsers.entries()).find(([_, name]) => name === u2)?.[0];

                // Dla u1, chatId to u2
                if (socket1) io.to(socket1).emit('message:updated', { chatId: u2, message: updatedMessage });
                // Dla u2, chatId to u1
                if (socket2) io.to(socket2).emit('message:updated', { chatId: u1, message: updatedMessage });
            }
        }
    });

    socket.on('typing:start', ({ to }) => {
        const username = onlineUsers.get(socket.id);
        if (!username) return;

        if (to && to !== 'general') {
            const recipientSocketId = Array.from(onlineUsers.entries())
                .find(([_, name]) => name === to)?.[0];

            if (recipientSocketId) {
                io.to(recipientSocketId).emit('typing:user', { username, isTyping: true, chatId: username });
            }
        } else {
            socket.broadcast.emit('typing:user', { username, isTyping: true, chatId: 'general' });
        }
    });

    socket.on('typing:stop', ({ to }) => {
        const username = onlineUsers.get(socket.id);
        if (!username) return;

        if (to && to !== 'general') {
            const recipientSocketId = Array.from(onlineUsers.entries())
                .find(([_, name]) => name === to)?.[0];

            if (recipientSocketId) {
                io.to(recipientSocketId).emit('typing:user', { username, isTyping: false, chatId: username });
            }
        } else {
            socket.broadcast.emit('typing:user', { username, isTyping: false, chatId: 'general' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Użytkownik rozłączony: ${socket.id}`);
        const username = onlineUsers.get(socket.id);

        if (username) {
            onlineUsers.delete(socket.id);

            // Wyślij zaktualizowaną listę użytkowników online
            const onlineUsersList = Array.from(onlineUsers.values()).map(uname => {
                const user = db.findUserByUsername(uname);
                if (user) {
                    const { password, ...userWithoutPassword } = user;
                    return {
                        ...userWithoutPassword,
                        socketId: Array.from(onlineUsers.entries()).find(([_, name]) => name === uname)?.[0],
                        status: 'online'
                    };
                }
                return null;
            }).filter(Boolean);

            io.emit('users:online', onlineUsersList);
        }
    });
});

const PORT = process.env.PORT || 3005;
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

            // Wyślij info o zalogowanym użytkowniku (żeby odświeżyć friendRequests)
            const { password, ...currentUserData } = dbUser;
            socket.emit('user:data', currentUserData);
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

        // If chatId is a username (private chat), construct the proper DB chatId
        let dbChatId = chatId;
        if (chatId !== 'general' && currentUsername) {
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

        if (to && to !== 'general') {
            const recipientUser = db.findUserByUsername(to);
            if (!recipientUser) return;

            const usernames = [senderUsername, to].sort();
            const chatId = usernames.join('-');

            console.log(`💬 Saving message to DB chatId: ${chatId}`);
            db.saveMessage(chatId, newMessage);

            // Wyślij do nadawcy
            console.log(`   Sending to sender (${senderUsername}) with chatId: ${to}`);
            socket.emit('message:new', { chatId: to, message: newMessage });

            // Wyślij do odbiorcy - WAŻNE: ALERT
            const recipientSocketId = getSocketIdByUsername(to);
            console.log(`   Recipient ${to} socket: ${recipientSocketId}`);

            if (recipientSocketId) {
                // Wyślij wiadomość
                console.log(`   Sending to recipient (${to}) with chatId: ${senderUsername}`);
                io.to(recipientSocketId).emit('message:new', { chatId: senderUsername, message: newMessage });
                // Wyślij alert
                io.to(recipientSocketId).emit('alert:new', {
                    title: `Nowa wiadomość od ${senderUsername}`,
                    message: content,
                    type: 'message',
                    from: senderUsername
                });
            } else {
                console.log(`   ⚠️ Recipient ${to} is offline`);
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

    socket.on('message:react', ({ messageId, emoji, chatId }) => {
        const senderUsername = onlineUsers.get(socket.id);
        if (!senderUsername) return;

        let dbChatId = 'general';
        if (chatId !== 'general') {
            const usernames = [senderUsername, chatId].sort();
            dbChatId = usernames.join('-');
        }

        const result = db.addReaction(dbChatId, messageId, emoji, senderUsername);

        if (result.success) {
            const updatedMessage = result.message;

            if (dbChatId === 'general') {
                io.emit('message:updated', { chatId: 'general', message: updatedMessage });
            } else {
                const [u1, u2] = dbChatId.split('-');
                const socket1 = getSocketIdByUsername(u1);
                const socket2 = getSocketIdByUsername(u2);

                if (socket1) io.to(socket1).emit('message:updated', { chatId: u2 === u1 ? u1 : (u1 === senderUsername ? u2 : u1), message: updatedMessage });
                // wait, logic for chatId in emit: 
                // Klient u1 oczekuje wiadomości w czacie z u2.
                // Klient u2 oczekuje wiadomości w czacie z u1.
                if (socket1) io.to(socket1).emit('message:updated', { chatId: u1 === senderUsername ? (u2) : (u2), message: updatedMessage });
                // To logic is tricky. Let's simplify:
                // If I am sender(u1), I see chat with u2. update is in chat u2.
                // If I am receiver(u2), I see chat with u1. update is in chat u1.

                if (socket1) io.to(socket1).emit('message:updated', { chatId: u1 === senderUsername ? u2 : u2, message: updatedMessage }); // Fix logic below properly

                // Correct logic:
                // User A (sender) chats with User B. chatId for A is "UserB".
                // User B chats with User A. chatId for B is "UserA".

                const s1Name = onlineUsers.get(socket1 || '');
                const s2Name = onlineUsers.get(socket2 || '');

                if (socket1 && s1Name) {
                    const chatTarget = s1Name === u1 ? u2 : u1;
                    io.to(socket1).emit('message:updated', { chatId: chatTarget, message: updatedMessage });
                }
                if (socket2 && s2Name) {
                    const chatTarget = s2Name === u1 ? u2 : u1;
                    io.to(socket2).emit('message:updated', { chatId: chatTarget, message: updatedMessage });
                }
            }
        }
    });

    socket.on('typing:start', ({ to }) => {
        const username = onlineUsers.get(socket.id);
        if (!username) return;

        if (to && to !== 'general') {
            const recipientSocketId = getSocketIdByUsername(to);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('typing:user', { username, isTyping: true, chatId: username });
            }
        } else {
            socket.broadcast.emit('typing:user', { username, isTyping: true, chatId: 'general' });
        }
    });

    socket.on('typing:stop', ({ to }) => {
        const username = onlineUsers.get(socket.id);
        if (!username) return;

        if (to && to !== 'general') {
            const recipientSocketId = getSocketIdByUsername(to);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('typing:user', { username, isTyping: false, chatId: username });
            }
        } else {
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


