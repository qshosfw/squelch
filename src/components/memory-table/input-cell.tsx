import React, { useState, useEffect, useRef, memo } from "react"
import { cn } from "@/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface InputCellProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value: string | number
    onCommit: (value: string) => void
    editable?: boolean
    options?: (string | number)[]
    validate?: (value: string) => boolean
    variant?: 'text' | 'number' | 'frequency'
}

export const InputCell = memo(({ value: initialValue, onCommit, editable = true, options, validate, variant = 'text', className, ...props }: InputCellProps) => {
    const [value, setValue] = useState(initialValue)
    const [isEditing, setIsEditing] = useState(false)
    const [editMode, setEditMode] = useState<'masked' | 'raw'>('raw')
    const inputRef = useRef<HTMLInputElement>(null)

    // Reset value when prop changes
    useEffect(() => {
        setValue(initialValue)
    }, [initialValue])

    // Focus handling
    useEffect(() => {
        if (isEditing && !options && inputRef.current) {
            inputRef.current.focus()
            if (editMode === 'raw') {
                inputRef.current.select()
            } else if (editMode === 'masked' && variant === 'frequency') {
                // Masked input handles its own focus
            }
        }
    }, [isEditing, options, editMode, variant])

    const commitChange = (newValue: string) => {
        if (newValue === String(initialValue)) return;

        let valid = true;
        if (validate) {
            valid = validate(newValue);
        }

        if (valid) {
            onCommit(newValue);
        } else {
            setValue(initialValue); // Revert
        }
    }

    const handleBlur = () => {
        setIsEditing(false)
        commitChange(String(value))
    }

    const handleValueChange = (newValue: string) => {
        setValue(newValue)
        setIsEditing(false)
        commitChange(newValue)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            setIsEditing(false)
            commitChange(String(value))
            return
        } else if (e.key === "Escape") {
            setValue(initialValue)
            setIsEditing(false)
            return
        }

        if (variant === 'frequency' && editMode === 'masked' && isEditing) {
            // Masking Logic
            if (e.key.length === 1 && /[0-9]/.test(e.key)) {
                e.preventDefault();
                // Handled by MaskedMinInput if in that mode
            }
        }
    }

    if (!editable) {
        return (
            <div className={cn(
                "w-full h-full px-2 py-1 flex items-center truncate text-[14px]",
                className
            )}>
                {value}
            </div>
        )
    }

    // Optimization: Only render the heavy Select component when editing
    if (options && isEditing) {
        return (
            <div className="w-full h-full p-0">
                <Select
                    value={String(value)}
                    onValueChange={handleValueChange}
                    defaultOpen={true}
                    onOpenChange={(open) => {
                        if (!open) setIsEditing(false)
                    }}
                >
                    <SelectTrigger className={cn(
                        "w-full h-full px-2 py-0 border-none rounded-none focus:ring-1 focus:ring-inset focus:ring-primary/50 text-[14px] bg-transparent hover:bg-muted/40 transition-colors shadow-none [&>svg]:hidden",
                        className
                    )}>
                        <SelectValue placeholder={String(value)} />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((opt) => (
                            <SelectItem key={opt} value={String(opt)} className="text-[14px]">
                                {opt}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        )
    }

    if (isEditing && !options) {
        if (variant === 'frequency' && editMode === 'masked') {
            return (
                <MaskedMinInput
                    value={value}
                    setValue={setValue}
                    onCommit={commitChange}
                    onSwitchToRaw={() => setEditMode('raw')}
                    onCancel={() => { setValue(initialValue); setIsEditing(false); }}
                    className={className}
                />
            )
        }

        return (
            <div className="w-full h-full p-0 border border-primary/50 z-10 box-border">
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (props.type === 'number' || props.inputMode === 'decimal') {
                            setValue(val);
                        } else {
                            setValue(val);
                        }
                    }}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className={cn(
                        "w-full h-full px-2 py-0 bg-background border-none outline-none text-[14px] rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                        className
                    )}
                    {...props}
                    type="text"
                />
            </div>
        )
    }

    return (
        <div
            onClick={(e) => {
                // If already editing, this won't fire (replaced by input)
                // If double click happens fast, handled by state update batching?
                // Actually, if we click once, we enter edit mode. 
                // Double click logic here handles the initial entry.
                if (e.detail === 2) {
                    setEditMode('raw');
                } else {
                    setEditMode(variant === 'frequency' ? 'masked' : 'raw');
                }
                setIsEditing(true);
            }}
            className={cn(
                "w-full h-full px-2 py-1 flex items-center truncate cursor-pointer hover:bg-muted/40 transition-colors text-[14px] border-transparent border-b hover:border-primary/20",
                className
            )}
        >
            {value}
        </div>
    )
})

// Sub-component for Masked Frequency Input
const MaskedMinInput = ({ value, onCommit, onSwitchToRaw, onCancel, className }: any) => {
    // Initial parse to get digits
    const [buffer, setBuffer] = useState(() => {
        const str = String(value);
        // Ensure 000.00000 format
        const parts = str.split('.');
        const mhz = (parts[0] || "0").padStart(3, '0');
        const khz = (parts[1] || "0").padEnd(5, '0').slice(0, 5);
        return (mhz + khz).split('');
    });

    const [index, setIndex] = useState(0); // 0-7
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) containerRef.current.focus();
    }, []);

    const formatDisplay = () => {
        const mhz = buffer.slice(0, 3).join('');
        const khz = buffer.slice(3, 8).join('');
        return `${mhz}.${khz}`;
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Enter') {
            onCommit(formatDisplay());
            return;
        }
        if (e.key === 'Escape') {
            onCancel();
            return;
        }
        if (e.key === 'Backspace') {
            setIndex(Math.max(0, index - 1));
            return;
        }
        if (e.key === 'ArrowLeft') {
            setIndex(Math.max(0, index - 1));
            return;
        }
        if (e.key === 'ArrowRight') {
            setIndex(Math.min(7, index + 1));
            return;
        }

        if (/[0-9]/.test(e.key) && e.key.length === 1) {
            if (index <= 7) {
                const newBuffer = [...buffer];
                newBuffer[index] = e.key;
                setBuffer(newBuffer);
                setIndex(Math.min(7, index + 1));
            }
        }
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full p-0 border border-primary/50 relative bg-background outline-none cursor-text"
            onBlur={() => onCommit(formatDisplay())}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onSwitchToRaw();
            }}
            onClick={(e) => {
                // Determine if this is part of a double click sequence
                if (e.detail >= 2) {
                    onSwitchToRaw();
                }
            }}
        >
            <div className={cn("w-full h-full px-2 py-0 flex items-center font-mono text-[14px]", className)}>
                {buffer.map((char, i) => (
                    <React.Fragment key={i}>
                        {i === 3 && <span className="text-muted-foreground">.</span>}
                        <span className={cn(
                            "inline-block w-[1ch] text-center", // Fixed width needed? font-mono handles it?
                            index === i
                                ? "bg-primary text-primary-foreground animate-[pulse_1s_ease-in-out_infinite]"
                                : ""
                        )}>
                            {char}
                        </span>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

InputCell.displayName = "InputCell"
