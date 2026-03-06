import "./style.css";
import { installAuthRedirectHandler } from "./api/client";
import { initializeSession, handleUnauthorizedSession } from "./api/session";
import { initializeNavigation } from "./navigation";
import { initializeI18n } from "./i18n";

const loginButton = document.querySelector(".login");
const root = document;

installAuthRedirectHandler(handleUnauthorizedSession);
await initializeSession(loginButton);
initializeNavigation(root);
initializeI18n();
