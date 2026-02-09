import React from 'react';
import { DisplayCanvas } from './DisplayCanvas';
import { type ViewerSettings } from '@/lib/lcd-constants';


interface ViewerPanelProps {
    framebuffer: Uint8Array;
    frameVersion: number;
    settings: ViewerSettings;
}

export const ViewerPanel: React.FC<ViewerPanelProps> = ({
    framebuffer,
    frameVersion,
    settings,
}) => {
    return (
        <div className="flex flex-col gap-4">
            {/* Display */}
            <div className="flex justify-center">
                <DisplayCanvas
                    framebuffer={framebuffer}
                    settings={settings}
                    frameVersion={frameVersion}
                />
            </div>
        </div>
    );
};
