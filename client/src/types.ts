export interface User {
    id: string; // Database ID
    username: string;
    avatar: string;
    status: 'online' | 'offline';
    lastSeen: string;
    friends: string[]; // Lista username znajomych
    socketId?: string; // Socket ID (tylko dla online users)
    friendRequests?: { from: string; timestamp: string }[];
}

export interface MessageReaction {
    [emoji: string]: string[];
}

export interface Message {
    id: string;
    content: string;
    sender: {
        id: string;
        username: string;
        avatar: string;
    };
    timestamp: string;
    type: 'text' | 'image' | 'gif';
    replyTo?: string | null;
    reactions: MessageReaction;
    readBy: string[];
}

export interface ChatSession {
    id: string; // 'general' lub UserID
    name: string;
    avatar?: string;
    type: 'group' | 'private';
    unreadCount: number;
    lastMessage?: Message;
}

export interface Group {
    id: string;
    name: string;
    members: string[]; // usernames
    createdBy: string;
    createdAt: string;
    avatar: string;
}
