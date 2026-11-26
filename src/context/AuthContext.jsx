import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useEvents } from './EventContext';

const AuthContext = createContext(null);
const USERS_KEY = 'gather_users';
const SESSION_KEY = 'gather_session';
const DEMO_EMAIL = 'dev@example.com';
const DEMO_PASSWORD = 'Demo1234';

function randomHex(bytes = 16) {
  const values = new Uint8Array(bytes);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const input = await window.crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(input), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable or full; the app still works in memory.
  }
}

function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || '') + (parts.length > 1 ? parts.at(-1)?.[0] || '' : '');
}

function avatarColor() {
  const colors = ['#4f46e5', '#0284c7', '#059669', '#d97706', '#dc2626', '#db2777', '#7c3aed'];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function AuthProvider({ children }) {
  const { users: eventUsers, syncUsers } = useEvents();
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        let storedUsers = readJson(window.localStorage, USERS_KEY);
        if (!Array.isArray(storedUsers)) storedUsers = [];

        for (const demo of eventUsers) {
          if (!storedUsers.some((user) => user.email === demo.email)) {
            const salt = randomHex();
            const passwordHash = await hashPassword(DEMO_PASSWORD, salt);
            storedUsers.push({
              ...demo,
              avatarInitials: initials(demo.name).toUpperCase(),
              salt,
              passwordHash,
            });
          }
        }
        writeJson(window.localStorage, USERS_KEY, storedUsers);

        let session = readJson(window.localStorage, SESSION_KEY);
        if (!session) session = readJson(window.sessionStorage, SESSION_KEY);
        const sessionUser = session?.userId
          ? storedUsers.find((user) => user.id === session.userId)
          : null;

        if (!cancelled) {
          setUsers(storedUsers);
          setCurrentUser(sessionUser || null);
        }
      } catch {
        if (!cancelled) {
          setUsers([]);
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restore();
    return () => { cancelled = true; };
  }, [eventUsers.length, syncUsers]);

  useEffect(() => {
    if (!loading && users.length > 0) {
      syncUsers(users.map(({ id, name, email, avatarColor: color, avatarInitials }) => ({
        id, name, email, avatarColor: color, avatarInitials,
      })));
    }
  }, [loading, users, syncUsers]);

  const saveSession = useCallback((user, remember) => {
    const session = { userId: user.id };
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    if (remember) writeJson(window.localStorage, SESSION_KEY, session);
    else writeJson(window.sessionStorage, SESSION_KEY, session);
  }, []);

  const signup = useCallback(async ({ name, email, password }) => {
    const cleanEmail = email.trim().toLowerCase();
    if (users.some((user) => user.email.toLowerCase() === cleanEmail)) {
      throw new Error('EMAIL_EXISTS');
    }
    const id = `u_${(window.crypto?.randomUUID?.() || `${Date.now()}${randomHex(4)}`).replace(/-/g, '')}`;
    const salt = randomHex();
    const passwordHash = await hashPassword(password, salt);
    const user = {
      id,
      name: name.trim(),
      email: cleanEmail,
      avatarInitials: initials(name).toUpperCase(),
      avatarColor: avatarColor(),
      salt,
      passwordHash,
    };
    const nextUsers = [...users, user];
    setUsers(nextUsers);
    writeJson(window.localStorage, USERS_KEY, nextUsers);
    setCurrentUser(user);
    saveSession(user, true);
    return user;
  }, [users, saveSession]);

  const login = useCallback(async ({ email, password, remember = true }) => {
    const cleanEmail = email.trim().toLowerCase();
    const user = users.find((item) => item.email.toLowerCase() === cleanEmail);
    if (!user) throw new Error('INVALID_CREDENTIALS');
    const passwordHash = await hashPassword(password, user.salt);
    if (passwordHash !== user.passwordHash) throw new Error('INVALID_CREDENTIALS');
    setCurrentUser(user);
    saveSession(user, remember);
    return user;
  }, [users, saveSession]);

  const loginDemo = useCallback(async (remember = true) =>
    login({ email: DEMO_EMAIL, password: DEMO_PASSWORD, remember }), [login]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  }, []);

  const value = useMemo(() => ({
    currentUser,
    users,
    signup,
    login,
    loginDemo,
    logout,
    isAuthenticated: !!currentUser,
    loading,
  }), [currentUser, users, signup, login, loginDemo, logout, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node.isRequired };

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
