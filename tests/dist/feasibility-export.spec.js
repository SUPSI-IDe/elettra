import { test, expect } from '@playwright/test';
import { registerFeasibilityExportTests } from '../../test-support/feasibility-export-browser-scenarios.js';
registerFeasibilityExportTests(test, expect);
