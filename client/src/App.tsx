import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import ChatWindow from './components/ChatWindow';
import Sidebar from './components/Sidebar';
import LoginScreen from './components/LoginScreen';
import ProfileEditor from './components/ProfileEditor';
import type { User, Message, Group } from './types';

const SOCKET_URL = 'http://localhost:8000';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [chats, setChats] = useState<Record<string, Message[]>>({});
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [typingUsers, setTypingUsers] = useState<Record<string, Set<string>>>({ 'general': new Set() });
  const [isConnected, setIsConnected] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [alert, setAlert] = useState<{ message: string; title: string, visible: boolean } | null>(null);

  // Auto-hide alert
  useEffect(() => {
    if (alert?.visible) {
      const timer = setTimeout(() => {
        setAlert(prev => prev ? { ...prev, visible: false } : null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
    }
  }, [isDarkMode]);

  // Pobieranie historii po zmianie czatu
  useEffect(() => {
    if (socket && activeChatId && socket.connected) {
      console.log('📜 Requesting chat history for:', activeChatId);
      socket.emit('chat:history:fetch', { chatId: activeChatId });
    }
  }, [activeChatId, socket]);

  // Ref to track if we are already connecting/connected to avoid duplicates
  const socketInitialized = useRef(false);

  useEffect(() => {
    if (!currentUser || socketInitialized.current) return;

    socketInitialized.current = true;

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('✅ Połączono z serwerem');
      setIsConnected(true);
      // Send login event
      newSocket.emit('user:login', { username: currentUser.username });
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Rozłączono z serwerem');
      setIsConnected(false);
    });

    newSocket.on('users:list', (allUsers: User[]) => {
      console.log('📋 Received users:list', allUsers.length, 'users');
      setUsers(allUsers);
      // Ensure current user is up to date too
      const me = allUsers.find(u => u.username === currentUser.username);
      if (me) setCurrentUser(prev => ({ ...prev!, ...me }));
    });

    newSocket.on('groups:list', (userGroups: Group[]) => {
      console.log('📋 Received groups:list', userGroups.length);
      setGroups(userGroups);
    });

    newSocket.on('group:created', (newGroup: Group) => {
      setGroups(prev => [...prev, newGroup]);
      setAlert({ title: 'Nowa grupa', message: `Zostałeś dodany do grupy ${newGroup.name}`, visible: true });
    });

    newSocket.on('users:online', (onlineUsersList: User[]) => {
      console.log('🟢 Received users:online', onlineUsersList.length, 'users');

      // If we don't have users list yet, just set it
      setUsers(prev => {
        if (prev.length === 0) {
          return onlineUsersList;
        }

        // Otherwise update statuses
        const onlineUsernames = new Set(onlineUsersList.map(u => u.username));
        return prev.map(u => ({
          ...u,
          status: onlineUsernames.has(u.username) ? 'online' : 'offline'
        }));
      });
    });

    newSocket.on('user:updated', (updatedUser: User) => {
      // Aktualizuj użytkownika na liście
      setUsers(prev => prev.map(u => u.username === updatedUser.username ? updatedUser : u));

      // Jeśli to my, zaktualizuj currentUser
      if (updatedUser.username === currentUser.username || updatedUser.id === currentUser.id) {
        setCurrentUser(prev => ({ ...prev!, ...updatedUser }));
      }
    });

    newSocket.on('user:data', (userData: User) => {
      // Pełna aktualizacja danych użytkownika (w tym friendRequests)
      setCurrentUser(prev => ({ ...prev!, ...userData }));
    });

    newSocket.on('friend:request:received', ({ from: _from, message }: { from: string, message: string }) => {
      setAlert({ title: 'Zaproszenie', message, visible: true });
    });

    newSocket.on('friend:request:accepted', ({ by: _by, message }: { by: string, message: string }) => {
      setAlert({ title: 'Nowy znajomy!', message, visible: true });
    });

    newSocket.on('friend:request:sent', ({ success, message, to }: { success: boolean, message?: string, to?: string }) => {
      if (success) {
        setAlert({ title: 'Sukces', message: `Wysłano zaproszenie do ${to}`, visible: true });
      } else {
        setAlert({ title: 'Błąd', message: message || 'Nie udało się wysłać', visible: true });
      }
    });

    newSocket.on('alert:new', ({ title, message, from }: { title: string, message: string, from: string }) => {
      if (activeChatId !== from) {
        setAlert({ title, message, visible: true });
      }
    });

    newSocket.on('friend:added', ({ friend }: { friend: User }) => {
      console.log('Dodano znajomego:', friend);
      // Odśwież listę użytkowników loginem (dirty fix but works to fetch full state if needed)
      // newSocket.emit('user:login', { username: currentUser.username });
      // user:data event handles update now
    });

    newSocket.on('messages:history', ({ chatId, messages }: { chatId: string, messages: Message[] }) => {
      console.log('📬 Received history for', chatId, ':', messages.length, 'messages');
      setChats(prev => ({ ...prev, [chatId]: messages }));
    });

    newSocket.on('message:new', ({ chatId, message }: { chatId: string, message: Message }) => {
      setChats(prev => {
        const currentMessages = prev[chatId] || [];
        if (currentMessages.some(m => m.id === message.id)) return prev;
        return { ...prev, [chatId]: [...currentMessages, message] };
      });

      if (chatId === activeChatId) {
        setTimeout(() => {
          const chatContainer = document.querySelector('.chat-messages');
          if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 100);
      }
    });

    newSocket.on('message:updated', ({ chatId, message }: { chatId: string, message: Message }) => {
      setChats(prev => {
        const currentMessages = prev[chatId] || [];
        return {
          ...prev,
          [chatId]: currentMessages.map(m => m.id === message.id ? message : m)
        };
      });
    });

    newSocket.on('typing:user', ({ username, isTyping, chatId }) => {
      setTypingUsers(prev => {
        const chatTyping = new Set(prev[chatId] || []);
        if (isTyping) chatTyping.add(username);
        else chatTyping.delete(username);
        return { ...prev, [chatId]: chatTyping };
      });
    });

    setSocket(newSocket);
    return () => { newSocket.close(); };
  }, [currentUser?.username, currentUser?.id]);

  const handleLogin = (username: string, avatar: string, userId: string) => {
    setCurrentUser({
      id: userId,
      username,
      avatar,
      status: 'online',
      lastSeen: new Date().toISOString(),
      friends: []
    });
  };

  const handleLogout = () => {
    if (socket) socket.disconnect();
    setCurrentUser(null);
    setChats({ 'general': [] });
    setUsers([]);
    setActiveChatId('general');
  };

  const handleEditProfile = () => {
    setShowProfileEditor(true);
  };

  const handleProfileSave = (newUsername: string, newAvatar: string) => {
    if (currentUser) {
      setCurrentUser(prev => ({
        ...prev!,
        username: newUsername,
        avatar: newAvatar
      }));

      // Ponowne połączenie z nową nazwą
      if (socket) {
        socket.disconnect();
      }

      // Ustaw nowego użytkownika, co spowoduje reconnect
      setTimeout(() => {
        setCurrentUser(prev => ({
          ...prev!,
          username: newUsername,
          avatar: newAvatar
        }));
      }, 100);
    }
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    if (!chats[chatId]) setChats(prev => ({ ...prev, [chatId]: [] }));
  };

  const handleAddFriend = (friendUsername: string) => {
    if (socket) {
      socket.emit('friend:request:send', { toUser: friendUsername });
    }
  };

  const handleRespondToRequest = (fromUsername: string, action: 'accept' | 'reject') => {
    if (socket) {
      socket.emit('friend:request:respond', { fromUser: fromUsername, action });
    }
  };

  const handleCreateGroup = async (name: string, members: string[]) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`${SOCKET_URL}/api/groups/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, members, createdBy: currentUser.username })
      });
      const data = await response.json();
      if (data.success) {
        // Group will be added via socket event 'group:created'
      } else {
        setAlert({ title: 'Błąd', message: data.message, visible: true });
      }
    } catch (err) {
      console.error(err);
      setAlert({ title: 'Błąd', message: 'Nie udało się utworzyć grupy', visible: true });
    }
  };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  const activeGroup = groups.find(g => g.id === activeChatId);
  const activeChatUser = users.find(u => u.username === activeChatId);

  let activeChatName = '';
  if (activeGroup) {
    activeChatName = activeGroup.name;
  } else {
    activeChatName = activeChatId === 'general' ? 'Czat Ogólny' : (activeChatUser?.username || activeChatId);
  }

  const activeChatAvatar = activeGroup ? undefined : (activeChatId === 'general' ? undefined : activeChatUser?.avatar);

  return (
    <div className="app">
      <Sidebar
        users={users}
        currentUser={currentUser}
        groups={groups}
        isConnected={isConnected}
        onLogout={handleLogout}
        onThemeToggle={() => setIsDarkMode(prev => !prev)}
        isDarkMode={isDarkMode}
        onEditProfile={handleEditProfile}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onAddFriend={handleAddFriend}
        onRespondToRequest={handleRespondToRequest}
        onCreateGroup={handleCreateGroup}
        chats={chats}
      />

      {alert && alert.visible && (
        <div className="alert-toast">
          <h4>{alert.title}</h4>
          <p>{alert.message}</p>
        </div>
      )}

      {activeChatId ? (
        <ChatWindow
          socket={socket}
          currentUser={currentUser}
          messages={chats[activeChatId] || []}
          typingUsers={typingUsers[activeChatId] || new Set()}
          users={users}
          chatId={activeChatId}
          chatName={activeChatName}
          chatAvatar={activeChatAvatar}
        />
      ) : (
        <div className="chat-window empty-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>💬</div>
          <h2>Wybierz czat z listy</h2>
          <p>Wybierz znajomego aby rozpocząć rozmowę</p>
        </div>
      )}

      {showProfileEditor && (
        <ProfileEditor
          currentUsername={currentUser.username}
          currentAvatar={currentUser.avatar}
          onClose={() => setShowProfileEditor(false)}
          onSave={handleProfileSave}
        />
      )}
    </div>
  );
}

export default App;
