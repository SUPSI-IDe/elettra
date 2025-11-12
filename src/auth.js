import { authenticate, fetchCurrentUser } from './api';
import { getCurrentUserId, setCurrentUserId } from './store';

const TEST_EMAIL = import.meta.env.VITE_TEST_EMAIL ?? '';
const TEST_PASSWORD = import.meta.env.VITE_TEST_PASSWORD ?? '';

const readEnvCredentials = ({ email, password }) =>
    email && password ? { email, password } : null;

const promptValue = (label) => prompt(label)?.trim() || null;

const readPromptCredentials = () => {
    const email = promptValue('Enter your email');
    if (!email) {
        return null;
    }

    const password = promptValue('Enter your password');
    if (!password) {
        return null;
    }

    return { email, password };
};

const persistTokens = ({ access_token = '', token_type = '' } = {}) => {
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('token_type', token_type);
    return { access_token, token_type };
};

export const resolveCredentials = () =>
    readEnvCredentials({ email: TEST_EMAIL, password: TEST_PASSWORD }) ??
    readPromptCredentials();

export const resolveUserId = async () => {
    const cached = getCurrentUserId();
    if (cached) {
        return cached;
    }

    const user = await fetchCurrentUser();
    const id = user?.id ?? '';

    if (!id) {
        throw new Error('Unable to resolve current user.');
    }

    setCurrentUserId(id);
    return id;
};

const handleLogin = async () => {
    const credentials = resolveCredentials();
    if (!credentials) {
        return;
    }

    try {
        await authenticate(credentials.email, credentials.password).then(
            persistTokens,
        );
        alert('Logged in with test credentials.');
    } catch (error) {
        console.error('Login failed', error);
        alert(error?.message ?? 'Login failed.');
    }
};

export const initializeLogin = (loginButton) => {
    loginButton?.addEventListener('click', handleLogin);
};


