import { ComingSoon } from "@/components/ui/ComingSoon";
import { CallIcon } from "@/components/ui/icons";

export default function CallsPage() {
  return (
    <ComingSoon
      icon={<CallIcon className="h-14 w-14" />}
      title="No calls"
      blurb="Voice and video calling is mocked in this build, so recent calls will not appear here."
    />
  );
}
