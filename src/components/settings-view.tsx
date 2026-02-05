import { ComingSoonView } from "./coming-soon-view"
import { Settings2 } from "lucide-react"

export function SettingsView() {
    return (
        <ComingSoonView
            title="Radio Configuration"
            description="Edit device-specific EEPROM settings directly. Real-time editing of backlight, band limits, and feature flags is currently in development. Application preferences can be found in the Edit > Preferences menu."
            icon={Settings2}
        />
    )
}
