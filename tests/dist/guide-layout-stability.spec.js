import { test, expect } from '@playwright/test';
import { registerGuideLayoutTests } from '../../test-support/guide-layout-scenarios.js';
registerGuideLayoutTests(test, expect);
