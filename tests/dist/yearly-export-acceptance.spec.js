import { test, expect } from '@playwright/test';
import { registerYearlyExportAcceptance } from '../../test-support/yearly-export-browser-scenarios.js';
registerYearlyExportAcceptance(test, expect);
