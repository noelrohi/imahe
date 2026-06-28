import { JobProgressList } from '@/features/generate/JobProgressList';
import { PromptBar } from '@/features/generate/PromptBar';
import { useJobEvents } from '@/features/generate/hooks';
import { GalleryGrid } from '@/features/gallery/GalleryGrid';

export default function Home() {
  const { runningJobs, cancelJob, cancelingRequestId } = useJobEvents();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-4 p-4 pb-0">
        <PromptBar />
        <JobProgressList
          jobs={runningJobs}
          cancelingRequestId={cancelingRequestId}
          onCancel={cancelJob}
        />
      </div>
      <GalleryGrid />
    </div>
  );
}
