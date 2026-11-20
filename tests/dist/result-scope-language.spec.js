import { test, expect } from '@playwright/test';
import { registerResultScopeLanguageTests } from '../../test-support/result-scope-language-scenarios.js';
registerResultScopeLanguageTests(test, expect);
