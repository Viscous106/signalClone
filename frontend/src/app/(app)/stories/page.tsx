import { ComingSoon } from "@/components/ui/ComingSoon";
import { StoryIcon } from "@/components/ui/icons";

export default function StoriesPage() {
  return (
    <ComingSoon
      icon={<StoryIcon className="h-14 w-14" />}
      title="No stories"
      blurb="Stories are mocked in this build, so new updates will not appear here."
    />
  );
}
