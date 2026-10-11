import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { bindLanguageToggle, createI18n } from './i18n/index.js';

const i18n = createI18n();

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

i18n.start();
bindLanguageToggle(i18n, document.getElementById('language-toggle'));

application.start().catch((error) => {
  console.error("God's Eye View initialization failed:", error);
  const loaderStatus = document.querySelector('#loading-screen .loader-status');
  loaderStatus.textContent = `${i18n.t('Error:')} ${describeError(error)}`;
  loaderStatus.style.color = '#ff4444';
});

export { application, i18n };
