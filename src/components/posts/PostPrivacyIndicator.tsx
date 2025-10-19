import { Globe, Lock, Users } from "lucide-react";

interface PostPrivacyIndicatorProps {
  privacy: "DRAFT" | "FOLLOWERS" | "PUBLIC";
  className?: string;
}

export default function PostPrivacyIndicator({
  privacy,
  className = "h-4 w-4 text-muted-foreground",
}: PostPrivacyIndicatorProps) {
  const getPrivacyConfig = (privacyLevel: string) => {
    switch (privacyLevel) {
      case "DRAFT":
        return {
          icon: Lock,
          tooltip: "Chỉ mình bạn thấy",
          color: "text-orange-500",
        };
      case "FOLLOWERS":
        return {
          icon: Users,
          tooltip: "Chỉ người theo dõi thấy",
          color: "text-blue-500",
        };
      case "PUBLIC":
        return {
          icon: Globe,
          tooltip: "Mọi người có thể thấy",
          color: "text-green-500",
        };
      default:
        return {
          icon: Globe,
          tooltip: "Mọi người có thể thấy",
          color: "text-green-500",
        };
    }
  };

  const config = getPrivacyConfig(privacy);
  const Icon = config.icon;

  return (
    <div className="flex items-center" title={config.tooltip}>
      <Icon className={`${className} ${config.color}`} />
    </div>
  );
}
