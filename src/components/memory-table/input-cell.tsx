import React, { useState, useEffect, useRef } from "react"
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
}

export function InputCell({ value: initialValue, onCommit, editable = true, options, className, ...props }: InputCellProps) {
    const [value, setValue] = useState(initialValue)
    const [isEditing, setIsEditing] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setValue(initialValue)
    }, [initialValue])

    useEffect(() => {
        if (isEditing && !options && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing, options])

    const handleBlur = () => {
        setIsEditing(false)
        if (value !== initialValue) {
            onCommit(String(value))
        }
    }

    const handleValueChange = (newValue: string) => {
        setValue(newValue)
        setIsEditing(false)
        if (newValue !== initialValue) {
            onCommit(newValue)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            setIsEditing(false)
            if (value !== initialValue) {
                onCommit(String(value))
            }
        } else if (e.key === "Escape") {
            setValue(initialValue)
            setIsEditing(false)
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

    if (options) {
        return (
            <div className="w-full h-full p-0">
                <Select value={String(value)} onValueChange={handleValueChange}>
                    <SelectTrigger className={cn(
                        "w-full h-full px-2 py-0 border-none rounded-none focus:ring-1 focus:ring-inset focus:ring-primary/50 text-[14px] bg-transparent hover:bg-muted/40 transition-colors shadow-none [&>svg]:hidden",
                        className
                    )}>
                        <SelectValue placeholder={value} />
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

    if (isEditing) {
        return (
            <div className="w-full h-full p-0 border border-primary/50 z-10">
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (props.type === 'number' || props.inputMode === 'decimal') {
                            if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                setValue(val);
                            }
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
                    type="text" // Use text to avoid browser spinners, but we filter in onChange and use inputMode
                />
            </div>
        )
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={cn(
                "w-full h-full px-2 py-1 flex items-center truncate cursor-pointer hover:bg-muted/40 transition-colors text-[14px] border-transparent border-b hover:border-primary/20",
                className
            )}
        >
            {value}
        </div>
    )
}
