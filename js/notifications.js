const Notifications = {
  getAll() {
    return Storage.get(STORAGE_KEYS.NOTIFICATIONS) || [];
  },

  add(message, type = 'info', link = null) {
    const notifications = this.getAll();
    notifications.unshift({
      id: Storage.generateId(),
      message,
      type,
      read: false,
      link,
      createdAt: new Date().toISOString()
    });

    if (notifications.length > 50) {
      notifications.length = 50;
    }

    Storage.set(STORAGE_KEYS.NOTIFICATIONS, notifications);
    this.updateBadge();
  },

  markRead(id) {
    const notifications = this.getAll();
    const notif = notifications.find((n) => n.id === id);
    if (notif) notif.read = true;
    Storage.set(STORAGE_KEYS.NOTIFICATIONS, notifications);
    this.updateBadge();
  },

  markAllRead() {
    const notifications = this.getAll();
    notifications.forEach((n) => { n.read = true; });
    Storage.set(STORAGE_KEYS.NOTIFICATIONS, notifications);
    this.updateBadge();
  },

  getUnreadCount() {
    return this.getAll().filter((n) => !n.read).length;
  },

  updateBadge() {
    const badge = document.getElementById('notification-badge');
    const dot = document.getElementById('notification-dot');
    const count = this.getUnreadCount();

    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline' : 'none';
    }
    if (dot) {
      dot.style.display = count > 0 ? 'block' : 'none';
    }
  },

  renderPanel(container) {
    const notifications = this.getAll();

    if (notifications.length === 0) {
      container.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-muted)">No hay notificaciones</p>';
      return;
    }

    container.innerHTML = notifications.map((n) => `
      <div class="notification-item ${n.read ? '' : 'unread'} ${n.link ? 'notification-clickable' : ''}"
           data-id="${n.id}"
           data-has-link="${n.link ? '1' : '0'}"
           style="${n.read ? '' : 'background:var(--bg-hover)'}">
        <div style="display:flex;align-items:start;gap:10px">
          <span class="badge badge-${n.type === 'warning' ? 'warning' : n.type === 'danger' ? 'danger' : n.type === 'success' ? 'success' : 'info'}" style="margin-top:2px;flex-shrink:0">
            ${n.type === 'warning' ? '⚠' : n.type === 'success' ? '✓' : n.type === 'danger' ? '!' : 'ℹ'}
          </span>
          <div style="flex:1;min-width:0">
            <p style="font-size:0.9rem;margin-bottom:4px">${n.message}</p>
            <span style="font-size:0.75rem;color:var(--text-muted)">${this.timeAgo(n.createdAt)}</span>
            ${n.link ? '<span style="display:block;font-size:0.7rem;color:var(--text-secondary);margin-top:4px">Toca para ver →</span>' : ''}
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.notification-item').forEach((item) => {
      item.addEventListener('click', () => {
        const notif = this.getAll().find((n) => n.id === item.dataset.id);
        this.markRead(item.dataset.id);
        item.classList.remove('unread');
        item.style.background = '';

        if (notif?.link) {
          App.handleNotificationLink(notif.link);
        }
      });
    });
  },

  timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Hace un momento';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
    return formatDate(date);
  },

  togglePanel() {
    const panel = document.getElementById('notification-panel');
    if (panel) {
      panel.classList.toggle('active');
      if (panel.classList.contains('active')) {
        this.renderPanel(document.getElementById('notification-list'));
      }
    }
  },

  closePanel() {
    document.getElementById('notification-panel')?.classList.remove('active');
  }
};

const Toast = {
  show(message, type = 'info', duration = 4000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};
