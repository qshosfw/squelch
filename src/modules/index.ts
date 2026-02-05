import { ModuleManager } from '../lib/framework/module-manager';
import { StockProfile } from './stock-module';

import { F4HWNProfile } from './f4hwn';

// Initialize and register all modules
export function initializeModules() {
    ModuleManager.registerProfile(new StockProfile());
    ModuleManager.registerProfile(new F4HWNProfile());
    // Future: ModuleManager.registerProfile(new IJVProfile());

    console.log("[Modules] Initialization complete.");
}
