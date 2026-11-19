import { test } from '../../test-support/shift-composer-fixture.js';
import { defineShiftValidationLanguageTests } from '../../test-support/shift-validation-language-scenarios.js';

test.use({ locale: 'en-US' });
defineShiftValidationLanguageTests();
