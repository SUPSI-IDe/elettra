import { authenticate } from "./auth";
import { fetchCurrentUser } from "./user";
import { getCurrentUserId, setCurrentUserId } from "../store"; // Import from parent store

const promptValue = (label) => prompt(label)?.trim() || null;

const readPromptCredentials = () => {
  const email = promptValue("Enter your email");
  if (!email) {
    return null;
  }

  const password = promptValue("Enter your password");
  if (!password) {
    return null;
  }

  return { email, password };
};

const persistTokens = ({ access_token = "", token_type = "" } = {}) => {
  localStorage.setItem("access_token", access_token);
  localStorage.setItem("token_type", token_type);
  return { access_token, token_type };
};

const readEnvCredentials = () => {
  const email = import.meta.env.VITE_USER || import.meta.env.VITE_TEST_EMAIL;
  const password =
    import.meta.env.VITE_PASSWORD || import.meta.env.VITE_TEST_PASSWORD;

  if (email && password) {
    return { email, password };
  }
  return null;
};

export const resolveCredentials = () =>
  readEnvCredentials() || readPromptCredentials();

export const resolveUserId = async () => {
  const cached = getCurrentUserId();
  if (cached) {
    return cached;
  }

  const user = await fetchCurrentUser();
  const id = user?.id ?? "";

  if (!id) {
    throw new Error("Unable to resolve current user.");
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
      persistTokens
    );
    console.log("Logged in successfully.");
  } catch (error) {
    console.error("Login failed", error);
  }
};

export const initializeLogin = (loginButton) => {
  loginButton?.addEventListener("click", handleLogin);
};
