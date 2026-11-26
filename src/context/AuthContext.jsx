import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useEvents } from './EventContext';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);
const USERS_KEY = 'gather_users';
const SESSION_KEY = 'gather_session';
const ACCOUNTS_KEY = 'gather_accounts';
const ACTIVE_KEY = 'gather_active_account';
const VERSION_KEY = 'gather_data_version';
const DATA_VERSION = 2;
const DEMO_PASSWORD = 'admin';
const DEMO_EMAIL = 'dev@gather.app';

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error(`Unable to read ${key} from browser storage.`, error);
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Unable to save ${key} to browser storage.`, error);
    throw new Error('Browser storage is unavailable. Please check your browser settings.');
  }
}

function randomHex(bytes = 16) {
  const values = new Uint8Array(bytes);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(values);
  else values.forEach((_, index) => { values[index] = Math.floor(Math.random() * 256); });
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

function hasSecureCrypto() {
  return !!window.isSecureContext && !!window.crypto?.subtle;
}

async function hashPassword(password, salt) {
  if (!hasSecureCrypto()) {
    const error = new Error('Secure context required. Open Gather over HTTPS or localhost to use password login.');
    error.code = 'SECURE_CONTEXT_REQUIRED';
    throw error;
  }
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

async function repairDemoUsers(storedUsers, demoUsers, storedVersion) {
  const users = [...storedUsers];
  const migrate = Number(storedVersion) < DATA_VERSION;
  let hashesReady = hasSecureCrypto();

  for (const demo of demoUsers) {
    const index = users.findIndex((user) => user.id === demo.id || user.email?.toLowerCase() === demo.email.toLowerCase());
    const existing = index === -1 ? {} : users[index];
    const salt = migrate || !existing.salt ? randomHex() : existing.salt;
    let passwordHash = existing.passwordHash;
    if (hasSecureCrypto()) {
      passwordHash = await hashPassword(DEMO_PASSWORD, salt);
    } else {
      hashesReady = false;
      if (!existing.salt || !passwordHash || migrate) {
        console.error(`Cannot hash the demo password for ${demo.email}: secure context required.`);
        passwordHash = '';
      }
    }

    const repaired = {
      ...existing,
      ...demo,
      avatarInitials: initials(demo.name).toUpperCase(),
      salt,
      passwordHash,
    };
    if (index === -1) users.push(repaired);
    else users[index] = repaired;
  }

  return { users, hashesReady };
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { status: eventsStatus, users: eventUsers, syncUsers } = useEvents();
  const demoUsersRef = useRef(eventUsers);
  demoUsersRef.current = eventUsers;
  const [users, setUsers] = useState([]);
  const [accountIds, setAccountIds] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistSignedAccounts = useCallback((ids) => {
    setAccountIds(ids);
    writeJson(window.localStorage, ACCOUNTS_KEY, ids);
  }, []);

  const persistActive = useCallback((user, remember = true) => {
    const session = { userId: user.id, remember: !!remember };
    window.localStorage.removeItem(ACTIVE_KEY);
    window.sessionStorage.removeItem(ACTIVE_KEY);
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    const storage = remember ? window.localStorage : window.sessionStorage;
    writeJson(storage, ACTIVE_KEY, { userId: user.id });
    writeJson(storage, SESSION_KEY, session);
  }, []);

  const activateUser = useCallback((user, remember = true) => {
    setCurrentUser(user);
    persistActive(user, remember);
  }, [persistActive]);

  const ensureDemoUsers = useCallback(async () => {
    const storedUsers = readJson(window.localStorage, USERS_KEY);
    const existing = Array.isArray(storedUsers) ? storedUsers : [];
    const storedVersion = readJson(window.localStorage, VERSION_KEY);
    const repaired = await repairDemoUsers(existing, demoUsersRef.current, storedVersion);
    writeJson(window.localStorage, USERS_KEY, repaired.users);
    if (repaired.hashesReady) {
      writeJson(window.localStorage, VERSION_KEY, DATA_VERSION);
    }
    return repaired.users;
  }, []);

  useEffect(() => {
    if (eventsStatus !== 'ready') return undefined;
    let cancelled = false;

    async function restore() {
      try {
        const storedUsers = await ensureDemoUsers();
        const accountsValue = readJson(window.localStorage, ACCOUNTS_KEY);
        const ids = Array.isArray(accountsValue)
          ? [...new Set(accountsValue.filter((id) => storedUsers.some((user) => user.id === id)))]
          : [];
        const localActive = readJson(window.localStorage, ACTIVE_KEY);
        const sessionActive = readJson(window.sessionStorage, ACTIVE_KEY);
        const localSession = readJson(window.localStorage, SESSION_KEY);
        const session = readJson(window.sessionStorage, SESSION_KEY);
        const activeId = session?.userId || sessionActive?.userId || localSession?.userId ||
          (typeof localActive === 'string' ? localActive : localActive?.userId);
        const hasSession = !!(session?.userId || localSession?.userId);
        const validId = hasSession && ids.includes(activeId) ? activeId : null;
        const active = storedUsers.find((user) => user.id === validId) || null;

        if (!cancelled) {
          setUsers(storedUsers);
          setAccountIds(ids);
          setCurrentUser(active);
        }
      } catch (error) {
        console.error('Unable to restore Gather authentication state.', error);
        if (!cancelled) {
          setUsers([]);
          setAccountIds([]);
          setCurrentUser(null);
          toast.error(error.message || 'Unable to restore your account data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restore();
    return () => { cancelled = true; };
  }, [eventsStatus, ensureDemoUsers, toast]);

  useEffect(() => {
    if (!loading && users.length > 0) {
      syncUsers(users.map(({ id, name, email, avatarColor: color, avatarInitials }) => ({
        id, name, email, avatarColor: color, avatarInitials,
      })));
    }
  }, [loading, users, syncUsers]);

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
    writeJson(window.localStorage, USERS_KEY, nextUsers);
    writeJson(window.localStorage, VERSION_KEY, DATA_VERSION);
    setUsers(nextUsers);
    persistSignedAccounts([...new Set([...accountIds, user.id])]);
    activateUser(user, true);
    return user;
  }, [users, accountIds, persistSignedAccounts, activateUser]);

  const login = useCallback(async ({ email, password, remember = true }) => {
    const cleanEmail = email.trim().toLowerCase();
    const user = users.find((item) => item.email.toLowerCase() === cleanEmail);
    if (!user) throw new Error('INVALID_CREDENTIALS');
    const passwordHash = await hashPassword(password, user.salt);
    if (passwordHash !== user.passwordHash) throw new Error('INVALID_CREDENTIALS');

    persistSignedAccounts([...new Set([...accountIds, user.id])]);
    activateUser(user, remember);
    return user;
  }, [users, accountIds, persistSignedAccounts, activateUser]);

  const loginAsDemo = useCallback(async () => {
    try {
      const currentDemoUsers = await ensureDemoUsers();
      const demo = currentDemoUsers.find((user) => user.id === 'u_dev' || user.email === DEMO_EMAIL);
      if (!demo) throw new Error('The Dev Patel demo account could not be created.');

      const otherIds = readJson(window.localStorage, ACCOUNTS_KEY);
      const ids = Array.isArray(otherIds)
        ? otherIds.filter((id) => id !== demo.id && currentDemoUsers.some((user) => user.id === id))
        : [];
      const nextIds = [...ids, demo.id];
      writeJson(window.localStorage, ACCOUNTS_KEY, nextIds);
      writeJson(window.localStorage, VERSION_KEY, DATA_VERSION);
      setUsers(currentDemoUsers);
      setAccountIds(nextIds);
      setCurrentUser(demo);
      persistActive(demo, true);
      setLoading(false);
      toast.success('Signed in to the demo as Dev Patel');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Demo sign-in failed.', error);
      toast.error(error.message || 'Unable to sign in to the demo.');
    }
  }, [ensureDemoUsers, persistActive, toast, navigate]);

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
        window.localStorage.removeItem(ACTIVE_KEY);
        window.sessionStorage.removeItem(ACTIVE_KEY);
        window.localStorage.removeItem(SESSION_KEY);
        window.sessionStorage.removeItem(SESSION_KEY);
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
      window.localStorage.removeItem(ACTIVE_KEY);
      window.localStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(ACTIVE_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  }, [accountIds, currentUser, users, persistSignedAccounts, activateUser]);

  const logoutAll = useCallback(() => {
    persistSignedAccounts([]);
    setCurrentUser(null);
    window.localStorage.removeItem(ACTIVE_KEY);
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(ACTIVE_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  }, [persistSignedAccounts]);

  const addAccount = useCallback(() => navigate('/login?add=1'), [navigate]);
  const accounts = useMemo(
    () => accountIds.map((id) => users.find((user) => user.id === id)).filter(Boolean),
    [accountIds, users],
  );
  const value = useMemo(() => ({
    currentUser, users, accounts, signup, login, loginAsDemo, switchAccount,
    addAccount, removeAccount, logout, logoutAll,
    isAuthenticated: !!currentUser, loading,
  }), [
    currentUser, users, accounts, signup, login, loginAsDemo, switchAccount,
    addAccount, removeAccount, logout, logoutAll, loading,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node.isRequired };

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
