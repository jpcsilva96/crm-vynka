import { cn } from "@/lib/utils";

interface Props {
  name: string;
  avatar?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function UserAvatar({ name, avatar, size = "sm", className }: Props) {
  const getInitials = (n: string) => {
    if (!n) return "";
    const parts = n.split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getAvatarColor = (n: string) => {
    const colors = [
      "bg-[#6366f1]", // Indigo
      "bg-[#8b5cf6]", // Violet
      "bg-[#d946ef]", // Fuchsia
      "bg-[#f43f5e]", // Rose
      "bg-[#f59e0b]", // Amber
      "bg-[#10b981]", // Emerald
      "bg-[#06b6d4]", // Cyan
      "bg-[#3b82f6]", // Blue
    ];
    let hash = 0;
    for (let i = 0; i < n.length; i++) {
      hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const sizeClasses = {
    xs: "h-5 w-5 text-[8px]",
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-[12px]",
    lg: "w-10 h-10 text-[14px]",
  };

  return (
    <div 
      className={cn(
        "rounded-full flex items-center justify-center text-white font-bold shrink-0 overflow-hidden",
        sizeClasses[size],
        !avatar && getAvatarColor(name),
        className
      )}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}
