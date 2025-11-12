import './style.css';
import { initializeLogin } from './auth';
import { initializeNavigation } from './navigation';

const loginButton = document.querySelector('.login');
const root = document;

initializeLogin(loginButton);
initializeNavigation(root);
