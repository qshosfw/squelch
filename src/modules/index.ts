import { ModuleManager } from '../lib/framework/module-manager';
import { StockProfile } from './stock-module';
import { F4HWNProfile } from './f4hwn';
import { DeltaFWProfile } from './deltafw';

// Initialize and register all modules
export function initializeModules() {
    ModuleManager.registerProfile(new StockProfile());
    ModuleManager.registerProfile(new F4HWNProfile());
    ModuleManager.registerProfile(new DeltaFWProfile());
    // Future: ModuleManager.registerProfile(new IJVProfile());

    console.log("[Modules] Initialization complete.");
}
