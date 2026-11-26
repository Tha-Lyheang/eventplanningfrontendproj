import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useEvents } from './EventContext';

const AuthContext = createContext(null);
const USERS_KEY = 'gather_users';
const SESSION_KEY = 'gather_session';
const ACCOUNTS_KEY = 'gather_accounts';
const ACTIVE_KEY = 'gather_active_account';
const DEMO_PASSWORD = 'admin';

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
    // Storage may be unavailable or full; keep the app usable in memory.
  }
}

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

function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || '') + (parts.length > 1 ? parts.at(-1)?.[0] || '' : '');
}

function avatarColor() {
  const colors = ['#4f46e5', '#0284c7', '#059669', '#d97706', '#dc2626', '#db2777', '#7c3aed'];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const { users: eventUsers, syncUsers } = useEvents();
  const [users, setUsers] = useState([]);
  const [accountIds, setAccountIds] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        let storedUsers = readJson(window.localStorage, USERS_KEY);
        if (!Array.isArray(storedUsers)) storedUsers = [];

        for (const user of eventUsers) {
          if (!storedUsers.some((item) => item.email.toLowerCase() === user.email.toLowerCase())) {
            const salt = randomHex();
            storedUsers.push({
              ...user,
              avatarInitials: initials(user.name).toUpperCase(),
              salt,
              passwordHash: await hashPassword(DEMO_PASSWORD, salt),
            });
          }
        }
        writeJson(window.localStorage, USERS_KEY, storedUsers);

        const storedAccounts = readJson(window.localStorage, ACCOUNTS_KEY);
        const ids = Array.isArray(storedAccounts)
          ? [...new Set(storedAccounts.filter((id) => storedUsers.some((u) => u.id === id)))]
          : [];

        const localActive = readJson(window.localStorage, ACTIVE_KEY);
        const session = readJson(window.sessionStorage, SESSION_KEY);
        const localSession = readJson(window.localStorage, SESSION_KEY);
        const sessionActive = readJson(window.sessionStorage, ACTIVE_KEY);
        const activeId = session?.userId || sessionActive?.userId || localSession?.userId ||
          (typeof localActive === 'string' ? localActive : localActive?.userId);

        const validActive = ids.includes(activeId) ? activeId : ids[0] || null;
        const activeUser = validActive ? storedUsers.find((user) => user.id === validActive) || null : null;

        if (!cancelled) {
          setUsers(storedUsers);
          setAccountIds(ids);
          setCurrentUser(activeUser);
        }
      } catch {
        if (!cancelled) {
          setUsers([]);
          setAccountIds([]);
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

  const persistSignedAccounts = useCallback((ids) => {
    setAccountIds(ids);
    writeJson(window.localStorage, ACCOUNTS_KEY, ids);
  }, []);

  const persistActive = useCallback((user, remember) => {
    const session = { userId: user.id, remember: !!remember };
    window.localStorage.removeItem(ACTIVE_KEY);
    window.sessionStorage.removeItem(ACTIVE_KEY);
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    if (remember) {
      writeJson(window.localStorage, ACTIVE_KEY, { userId: user.id });
      writeJson(window.localStorage, SESSION_KEY, session);
    } else {
      writeJson(window.sessionStorage, ACTIVE_KEY, { userId: user.id });
      writeJson(window.sessionStorage, SESSION_KEY, session);
    }
  }, []);

  const activateUser = useCallback((user, remember = true) => {
    setCurrentUser(user);
    persistActive(user, remember);
  }, [persistActive]);

  const signup = useCallback(async ({ name, email, password }) => {
    const cleanEmail = email.trim().toLowerCase();
    if (users.some((user) => user.email.toLowerCase() === cleanEmail)) throw new Error('EMAIL_EXISTS');
    const id = `u_${(window.crypto?.randomUUID?.() || `${Date.now()}${randomHex(4)}`).replace(/-/g, '')}`;
    const salt = randomHex();
    const user = {
      id,
      name: name.trim(),
      email: cleanEmail,
      avatarInitials: initials(name).toUpperCase(),
      avatarColor: avatarColor(),
      salt,
      passwordHash: await hashPassword(password, salt),
    };
    const nextUsers = [...users, user];
    setUsers(nextUsers);
    writeJson(window.localStorage, USERS_KEY, nextUsers);

    const nextIds = [...new Set([...accountIds, id])];
    persistSignedAccounts(nextIds);
    activateUser(user, true);
    return user;
  }, [users, accountIds, persistSignedAccounts, activateUser]);

  const login = useCallback(async ({ email, password, remember = true }) => {
    const cleanEmail = email.trim().toLowerCase();
    const user = users.find((item) => item.email.toLowerCase() === cleanEmail);
    if (!user) throw new Error('INVALID_CREDENTIALS');
    const passwordHash = await hashPassword(password, user.salt);
    if (passwordHash !== user.passwordHash) throw new Error('INVALID_CREDENTIALS');

    const nextIds = [...new Set([...accountIds, user.id])];
    persistSignedAccounts(nextIds);
    activateUser(user, remember);
    return user;
  }, [users, accountIds, persistSignedAccounts, activateUser]);

  const loginDemo = useCallback(async (remember = true) =>
    login({ email: 'dev@example.com', password: DEMO_PASSWORD, remember }), [login]);

  const switchAccount = useCallback((userId) => {
    const user = users.find((item) => item.id === userId);
    if (!user || !accountIds.includes(userId)) return false;
    const session = readJson(window.sessionStorage, SESSION_KEY) || readJson(window.localStorage, SESSION_KEY);
    activateUser(user, session?.remember !== false);
    return true;
  }, [users, accountIds, activateUser]);

  const removeAccount = useCallback((userId) => {
    const nextIds = accountIds.filter((id) => id !== userId);
    persistSignedAccounts(nextIds);
    if (currentUser?.id === userId) {
      const fallback = users.find((user) => nextIds.includes(user.id)) || null;
      if (fallback) activateUser(fallback, true);
      else {
        setCurrentUser(null);
        try {
          window.localStorage.removeItem(ACTIVE_KEY);
          window.localStorage.removeItem(SESSION_KEY);
          window.sessionStorage.removeItem(ACTIVE_KEY);
          window.sessionStorage.removeItem(SESSION_KEY);
        } catch {
          // Ignore unavailable storage.
        }
      }
    }
  }, [accountIds, currentUser, users, persistSignedAccounts, activateUser]);

  const logout = useCallback(() => {
    const nextIds = accountIds.filter((id) => id !== currentUser?.id);
    persistSignedAccounts(nextIds);
    const fallback = users.find((user) => nextIds.includes(user.id)) || null;
    if (fallback) activateUser(fallback, true);
    else {
      setCurrentUser(null);
      try {
        window.localStorage.removeItem(ACTIVE_KEY);
        window.localStorage.removeItem(SESSION_KEY);
        window.sessionStorage.removeItem(ACTIVE_KEY);
        window.sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // Ignore unavailable storage.
      }
    }
  }, [accountIds, currentUser, users, persistSignedAccounts, activateUser]);

  const logoutAll = useCallback(() => {
    persistSignedAccounts([]);
    setCurrentUser(null);
    try {
      window.localStorage.removeItem(ACTIVE_KEY);
      window.localStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(ACTIVE_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  }, [persistSignedAccounts]);

  const addAccount = useCallback(() => {
    navigate('/login?add=1');
  }, [navigate]);

  const accounts = useMemo(
    () => accountIds.map((id) => users.find((user) => user.id === id)).filter(Boolean),
    [accountIds, users],
  );

  const value = useMemo(() => ({
    currentUser,
    users,
    accounts,
    signup,
    login,
    loginDemo,
    switchAccount,
    addAccount,
    removeAccount,
    logout,
    logoutAll,
    isAuthenticated: !!currentUser,
    loading,
  }), [
    currentUser, users, accounts, signup, login, loginDemo, switchAccount,
    removeAccount, logout, logoutAll, addAccount, loading,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node.isRequired };

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
