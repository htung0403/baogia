import * as React from "react"
import { LucideIcon, Edit2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CrmStatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  icon: LucideIcon
  color?: "blue" | "orange" | "green" | "default"
  showEdit?: boolean
  onEdit?: () => void
}

const colorVariants = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  green: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  default: "bg-muted text-muted-foreground",
}

export function CrmStatCard({
  label,
  value,
  icon: Icon,
  color = "default",
  showEdit = false,
  onEdit,
  className,
  ...props
}: CrmStatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-3 gap-2",
        "bg-card border border-border rounded-xl shadow-sm",
        "transition-all duration-200 hover:shadow-md hover:border-border/80",
        "w-full min-w-0",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "p-2 rounded-full flex items-center justify-center shrink-0",
          colorVariants[color]
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      
      <div className="flex flex-col items-center justify-center min-w-0 w-full gap-0.5">
        <div className="flex items-center gap-1">
          <span className="text-lg font-bold tracking-tight text-foreground leading-none">
            {value}
          </span>
          {showEdit && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit?.();
              }}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
              aria-label="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        
        <span className="text-[11px] text-muted-foreground font-medium text-center leading-tight w-full truncate">
          {label}
        </span>
      </div>
    </div>
  )
}
