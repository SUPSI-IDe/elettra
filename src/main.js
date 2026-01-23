import "./style.css";
import { initializeSession } from "./api/session";
import { initializeNavigation } from "./navigation";
import { initializeI18n } from "./i18n";

const loginButton = document.querySelector(".login");
const root = document;

initializeSession(loginButton);
initializeNavigation(root);
initializeI18n();
