
// ========================================
// Chat UI Renderers
// ========================================
import { Toast, UI } from '../utils/ui_helpers.js';

let activeChatUserId = null;

export const ChatRenderers = {

    // Admin: Render main chat interface
    renderAdminChat: () => {
        const container = document.getElementById('admin-chat-container');
        if (!container) return;

        // Left: User List
        const userListPanel = document.getElementById('chat-user-list') || document.createElement('div');
        userListPanel.id = 'chat-user-list';
        userListPanel.className = 'glass-panel';
        userListPanel.style.height = '100%';
        userListPanel.style.overflowY = 'auto';

        // Right: Chat Window
        const chatWindow = document.getElementById('chat-window') || document.createElement('div');
        chatWindow.id = 'chat-window';
        chatWindow.className = 'glass-panel';
        chatWindow.style.display = 'flex';
        chatWindow.style.flexDirection = 'column';
        chatWindow.style.height = '100%';

        if (!document.getElementById('chat-user-list')) {
            container.style.display = 'grid';
            container.style.gridTemplateColumns = '300px 1fr';
            container.style.gap = '20px';
            container.style.height = 'calc(100vh - 140px)';
            container.innerHTML = ''; // Force clear any whitespace/comments
            container.appendChild(userListPanel);
            container.appendChild(chatWindow);
        }

        ChatRenderers.renderUserList();
        ChatRenderers.renderActiveChat();
    },

    renderUserList: () => {
        const list = document.getElementById('chat-user-list');
        if (!list) return;

        const users = window.store.getUsers().filter(u => u.id !== window.store.getCurrentUser().id);

        // Header with Broadcast Button
        let html = `
            <div style="padding:15px; border-bottom:1px solid var(--border); position:sticky; top:0; background:var(--glass-bg); backdrop-filter:blur(10px); z-index:10;">
                <h3 style="margin:0 0 10px 0;">Messages</h3>
                <button class="btn-primary" style="width:100%; font-size:0.85rem;" onclick="window.openBroadcastModal()">
                    <i class="fa-solid fa-bullhorn"></i> New Broadcast
                </button>
            </div>
            <div style="padding:10px;">
                <!-- Broadcast Channel -->
                <div class="chat-user-item ${activeChatUserId === 'all' ? 'active' : ''}" 
                     onclick="window.selectChatUser('all')"
                     style="padding:12px; border-radius:8px; display:flex; gap:12px; cursor:pointer; margin-bottom:5px; background:${activeChatUserId === 'all' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.05)'}; border:1px solid ${activeChatUserId === 'all' ? 'var(--warning)' : 'transparent'}; transition:all 0.2s;">
                    <div style="position:relative; display:flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:50%; background:var(--warning); color:#fff;">
                        <i class="fa-solid fa-tower-broadcast"></i>
                    </div>
                    <div style="flex:1; overflow:hidden;">
                        <div style="display:flex; justify-content:space-between;">
                            <strong style="font-size:0.9rem; color:var(--text-primary);">Broadcast Channel</strong>
                        </div>
                        <p style="margin:2px 0 0; font-size:0.8rem; color:var(--text-secondary);">History of all alerts</p>
                    </div>
                </div>
                <hr style="border:0; border-top:1px solid var(--border); margin:10px 0;">
        `;

        if (users.length === 0) {
            html += '<p style="text-align:center; padding:20px; color:var(--text-muted);">No staff members found.</p>';
        } else {
            html += users.map(u => {
                const isActive = u.id === activeChatUserId;
                const status = window.store.getWorkerStatus(u.id);
                // Preview last message (optional optimization)
                const lastMsg = window.store.getMessages(u.id).slice(-1)[0];
                const preview = lastMsg ? (lastMsg.content.length > 25 ? lastMsg.content.substring(0, 25) + '...' : lastMsg.content) : 'No messages';

                return `
                <div class="chat-user-item ${isActive ? 'active' : ''}" 
                     onclick="window.selectChatUser('${u.id}')"
                     style="padding:12px; border-radius:8px; display:flex; gap:12px; cursor:pointer; margin-bottom:5px; background:${isActive ? 'rgba(59,130,246,0.1)' : 'transparent'}; border:1px solid ${isActive ? 'var(--primary)' : 'transparent'}; transition:all 0.2s;">
                    <div style="position:relative;">
                        <img src="${u.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name) + '&background=random'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                        <span style="position:absolute; bottom:0; right:0; width:10px; height:10px; border-radius:50%; background:${status === 'in' ? '#10b981' : '#6b7280'}; border:2px solid var(--bg-body);"></span>
                    </div>
                    <div style="flex:1; overflow:hidden;">
                        <div style="display:flex; justify-content:space-between;">
                            <strong style="font-size:0.9rem; color:var(--text-primary);">${u.name}</strong>
                            ${lastMsg ? `<span style="font-size:0.7rem; color:var(--text-muted);">${new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                        </div>
                        <p style="margin:2px 0 0; font-size:0.8rem; color:${isActive ? 'var(--primary)' : 'var(--text-secondary)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${lastMsg && lastMsg.senderId === window.store.getCurrentUser().id ? 'You: ' : ''}${preview}
                        </p>
                    </div>
                </div>
                `;
            }).join('');
        }
        html += '</div>';
        list.innerHTML = html;
    },

    renderActiveChat: () => {
        const windowEl = document.getElementById('chat-window');
        if (!windowEl) return;

        if (!activeChatUserId) {
            windowEl.innerHTML = `
                <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted);">
                    <i class="fa-regular fa-comments" style="font-size:3rem; margin-bottom:15px; opacity:0.5;"></i>
                    <p>Select a staff member to start chatting</p>
                </div>
            `;
            return;
        }

        // Broadcast Channel Special Handling
        let user, messages;
        if (activeChatUserId === 'all') {
            user = { name: "Broadcast Channel", role: "Public Alerts", avatar: null };
            messages = window.store.getMessages('all');
        } else {
            user = window.store.getUsers().find(u => u.id === activeChatUserId);
            messages = window.store.getMessages(activeChatUserId);
        }

        // Chat Header
        let html = `
            <div style="padding:15px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.02);">
                ${activeChatUserId === 'all'
                ? `<div style="width:36px; height:36px; border-radius:50%; background:var(--warning); display:flex; align-items:center; justify-content:center; color:#fff;"><i class="fa-solid fa-tower-broadcast"></i></div>`
                : `<img src="${user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=random'}" style="width:36px; height:36px; border-radius:50%;">`
            }
                <div>
                    <h4 style="margin:0; font-size:1rem;">${user.name}</h4>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${user.role}</span>
                </div>
            </div>
        `;

        // Messages Area
        html += `<div id="chat-messages-area" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:10px;">`;

        if (messages.length === 0) {
            html += '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-top:20px;">No messages yet. Say hi!</p>';
        } else {
            const myId = window.store.getCurrentUser().id;
            html += messages.map(m => {
                const isMe = m.senderId === myId;
                return `
                    <div style="align-self:${isMe ? 'flex-end' : 'flex-start'}; max-width:70%;">
                        <div style="
                            padding:10px 14px; 
                            border-radius:12px; 
                            background:${isMe ? 'var(--primary)' : 'var(--glass-bg)'}; 
                            color:${isMe ? '#fff' : 'var(--text-primary)'};
                            border:1px solid ${isMe ? 'var(--primary)' : 'var(--border)'};
                            font-size:0.9rem;
                            box-shadow:0 2px 4px rgba(0,0,0,0.05);
                        ">
                            ${m.content}
                        </div>
                        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px; text-align:${isMe ? 'right' : 'left'};">
                            ${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                `;
            }).join('');
        }
        html += `</div>`;

        // Input Area
        html += `
            <form onsubmit="window.sendChatMessage(event)" style="padding:15px; border-top:1px solid var(--border); display:flex; gap:10px;">
                <input type="text" id="chat-input" placeholder="Type a message..." autocomplete="off"
                       style="flex:1; padding:10px 14px; border-radius:20px; border:1px solid var(--border); background:var(--bg-body); color:var(--text-primary); outline:none;">
                <button type="submit" class="btn-primary" style="padding:0 20px; border-radius:20px;">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </form>
        `;

        windowEl.innerHTML = html;

        // Auto-scroll to bottom
        setTimeout(() => {
            const area = document.getElementById('chat-messages-area');
            if (area) area.scrollTop = area.scrollHeight;
        }, 50);
    },

    // Field Chat: Simplified Interface
    renderFieldChat: () => {
        const container = document.getElementById('field-tab-messages');
        if (!container) return;

        // Ensure we have a distinct container for field chat
        container.innerHTML = `
            <div id="field-chat-window" class="glass-panel" style="flex:1; display:flex; flex-direction:column; padding:0; overflow:hidden;"></div>
        `;

        const chatWindow = document.getElementById('field-chat-window');
        const currentUser = window.store.getCurrentUser();
        // For field users, we usually just chat with "Admin" (or all broadcasts)
        // Ideally, they should see a list of admins? Or just a single "Support" channel?
        // Let's implement a "Support Channel" (User <-> Admins) and "Broadcasts" (Read Only).
        // For simplicity in this version, we will treat it as a GLOBAL CHAT or just chat with Admin.
        // Let's make it a simple group chat for now, or 1:1 with Admin?
        // The Admin UI expects 1:1. 
        // Let's make Field Staff see a list of Admins to chat with? 
        // OR simpler: Just one "Admin" chat.
        // Let's assume the "Receiver" is an Admin ID. 
        // We need to find an admin.

        const admins = window.store.getUsers().filter(u => u.role === 'admin');
        const adminId = admins.length > 0 ? admins[0].id : 'admin'; // Fallback

        // Let's reuse renderActiveChat logic but adapted? 
        // Actually, let's keep it simple: Field user sees ONE chat thread with "HQ".

        const messages = window.store.getMessages(); // Gets all messages for this user (including broadcasts)

        let html = `
            <div style="padding:15px; border-bottom:1px solid var(--border); background:rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0;">HQ Support</h3>
                <span class="badge">Online</span>
            </div>
            <div id="field-chat-messages" style="flex:1; overflow-y:auto; padding:15px; display:flex; flex-direction:column; gap:12px;">
        `;

        if (messages.length === 0) {
            html += '<p style="text-align:center; opacity:0.6; margin-top:20px;">No messages yet.</p>';
        } else {
            const myId = currentUser.id;
            html += messages.map(m => {
                const isMe = m.senderId === myId;
                const isBroadcast = m.receiverId === 'all';
                return `
                    <div style="align-self:${isMe ? 'flex-end' : 'flex-start'}; max-width:85%;">
                        ${isBroadcast ? '<div style="font-size:0.7rem; color:var(--warning); margin-bottom:2px; font-weight:bold;"><i class="fa-solid fa-bullhorn"></i> BROADCAST</div>' : ''}
                        <div style="
                            padding:12px 16px; 
                            border-radius:16px; 
                            background:${isMe ? 'var(--primary)' : (isBroadcast ? 'rgba(245, 158, 11, 0.15)' : 'var(--glass-bg)')}; 
                            color:${isMe ? '#fff' : (isBroadcast ? '#f59e0b' : 'var(--text-primary)')};
                            border:1px solid ${isMe ? 'var(--primary)' : (isBroadcast ? '#f59e0b' : 'var(--border)')};
                            font-size:0.95rem;
                            box-shadow:0 1px 3px rgba(0,0,0,0.1);
                        ">
                            ${m.content}
                        </div>
                        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px; text-align:${isMe ? 'right' : 'left'};">
                            ${m.senderName || 'Unknown'} • ${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                `;
            }).join('');
        }

        html += `</div>
            <form onsubmit="window.sendFieldMessage(event)" style="padding:15px; border-top:1px solid var(--border); display:flex; gap:10px; background:var(--glass-bg);">
                <input type="text" id="field-chat-input" placeholder="Message HQ..." autocomplete="off" required
                       style="flex:1; padding:12px; border-radius:25px; border:1px solid var(--border); background:var(--bg-body); color:var(--text-primary); outline:none;">
                <button type="submit" class="btn-primary" style="padding:0 20px; border-radius:25px;">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </form>
        `;

        chatWindow.innerHTML = html;
        setTimeout(() => {
            const area = document.getElementById('field-chat-messages');
            if (area) area.scrollTop = area.scrollHeight;
        }, 50);
    },

    // Broadcast Modal
    renderBroadcastModal: () => {
        UI.openModal('broadcast-modal');
    }
};

// Global handlers
window.selectChatUser = (id) => {
    activeChatUserId = id;
    ChatRenderers.renderUserList();
    ChatRenderers.renderActiveChat();
};

window.sendChatMessage = async (e) => {
    e.preventDefault();
    if (!activeChatUserId) return;
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    input.value = '';
    try {
        await window.store.sendMessage(activeChatUserId, content);
    } catch (err) {
        Toast.error("Failed to send message");
    }
};

window.sendFieldMessage = async (e) => {
    e.preventDefault();
    const input = document.getElementById('field-chat-input');
    const content = input.value.trim();
    if (!content) return;

    // Find an admin to send to. In a real app, this might go to a specific dispatcher's ID or a "support" group ID.
    // For now, we pick the first admin found or just broadcast to 'admin-group' if we had one.
    // Let's just pick the first Admin user from the store.
    const admins = window.store.getUsers().filter(u => u.role === 'admin');
    if (admins.length === 0) {
        Toast.error("No admins online to receive message.");
        return;
    }
    const receiverId = admins[0].id; // Simple routing for now

    input.value = '';
    try {
        await window.store.sendMessage(receiverId, content);
    } catch (err) {
        Toast.error("Failed to send message");
    }
};

window.openBroadcastModal = () => {
    ChatRenderers.renderBroadcastModal();
};

window.sendBroadcast = async (e) => {
    e.preventDefault();
    const input = document.getElementById('broadcast-input');
    const content = input.value.trim();
    if (!content) return;

    try {
        await window.store.sendMessage('all', content);
        const modal = document.getElementById('broadcast-modal');
        if (modal) modal.classList.add('hidden');
        input.value = '';
        Toast.success("Alert sent to all staff");
    } catch (err) {
        Toast.error("Failed to send broadcast");
    }
};
