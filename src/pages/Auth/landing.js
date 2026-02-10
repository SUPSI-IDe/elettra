import { triggerPartialLoad } from "../../events";

export const initializeLanding = (container, options = {}) => {
  const loginBtn = container.querySelector('[data-action="go-to-login"]');
  const registerBtn = container.querySelector('[data-action="go-to-register"]');

  const handleLoginClick = (event) => {
    event.preventDefault();
    triggerPartialLoad("login");
  };

  const handleRegisterClick = (event) => {
    event.preventDefault();
    triggerPartialLoad("register");
  };

  if (loginBtn) {
    loginBtn.addEventListener("click", handleLoginClick);
  }

  if (registerBtn) {
    registerBtn.addEventListener("click", handleRegisterClick);
  }

  // Cleanup function
  return () => {
    if (loginBtn) {
      loginBtn.removeEventListener("click", handleLoginClick);
    }
    if (registerBtn) {
      registerBtn.removeEventListener("click", handleRegisterClick);
    }
  };
};

