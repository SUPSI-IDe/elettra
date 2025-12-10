import "./style.css";
import { initializeLogin } from "./api/session";
import { initializeNavigation } from "./navigation";

const loginButton = document.querySelector(".login");
const root = document;

initializeLogin(loginButton);
initializeNavigation(root);
