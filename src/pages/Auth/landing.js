import { triggerPartialLoad } from "../../events";

export const initializeLanding = (container, options = {}) => {
  const loginBtn = container.querySelector('[data-action="go-to-login"]');
  const registerBtn = container.querySelector('[data-action="go-to-register"]');
  const aboutBtn = container.querySelector('[data-action="go-to-about"]');

  const handleLoginClick = (event) => {
    event.preventDefault();
    triggerPartialLoad("login");
  };

  const handleRegisterClick = (event) => {
    event.preventDefault();
    triggerPartialLoad("register");
  };

  const handleAboutClick = (event) => {
    event.preventDefault();
    triggerPartialLoad("about");
  };

  if (loginBtn) {
    loginBtn.addEventListener("click", handleLoginClick);
  }

  if (registerBtn) {
    registerBtn.addEventListener("click", handleRegisterClick);
  }

  if (aboutBtn) {
    aboutBtn.addEventListener("click", handleAboutClick);
  }

  return () => {
    if (loginBtn) {
      loginBtn.removeEventListener("click", handleLoginClick);
    }
    if (registerBtn) {
      registerBtn.removeEventListener("click", handleRegisterClick);
    }
    if (aboutBtn) {
      aboutBtn.removeEventListener("click", handleAboutClick);
    }
  };
};

