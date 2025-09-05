import HiDPIImage from '@/components/ui/HiDPIImage'
import VideoPlayer from '@/components/ui/VideoPlayer'

interface VotingOption {
  id: number;
  file_path: string;
  pixel_ratio: number;
  width: number;
  height: number;
  media_type: 'image' | 'video';
}

interface VotingCardPreviewProps {
  options: VotingOption[];
}

const VotingCardPreview = ({ options }: VotingCardPreviewProps) => {
  const n = options.length;
  if (n === 0) {
    return <div className="w-full h-full bg-muted" />;
  }

  // Slant amount for the diagonal effect, as a percentage of the width
  const slant = 30; 
  // Gap between images, as a percentage of the width
  const gap = 1.5; 

  const getClipPath = (i: number) => {
    if (n <= 1) {
      return 'none';
    }
    
    // x coordinates at the top
    const top_x_start = (i / n) * 100;
    const top_x_end = ((i + 1) / n) * 100;

    // Apply gap
    const gapped_top_x_start = i === 0 ? top_x_start : top_x_start + gap / 2;
    const gapped_top_x_end = i === n - 1 ? top_x_end : top_x_end - gap / 2;

    // Corresponding x coordinates at the bottom
    const bottom_x_start = gapped_top_x_start - slant;
    const bottom_x_end = gapped_top_x_end - slant;

    return `polygon(${gapped_top_x_start}% 0%, ${gapped_top_x_end}% 0%, ${bottom_x_end}% 100%, ${bottom_x_start}% 100%)`;
  };

  return (
    <div className="relative w-full h-full rounded overflow-hidden bg-muted">
      {options.map((option, i) => (
        <div
          key={option.id}
          className="absolute inset-0"
          style={{
            clipPath: getClipPath(i),
            zIndex: n - i // Render from right to left to stack correctly
          }}
        >
          {option.media_type === 'image' ? (
            <HiDPIImage
              src={`/api/images/${option.file_path.split('/').pop()}`}
              width={option.width}
              height={option.height}
              pixelRatio={option.pixel_ratio}
              fit="cover"
              alt={`Option ${i + 1}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <VideoPlayer
              src={`/api/images/${option.file_path.split('/').pop()}`}
              width={option.width}
              height={option.height}
              fit="cover"
              controls={false}
              muted={true}
              autoPlay={true}
              loop={true}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      ))}
      {/* Divider lines */}
      {n > 1 && Array.from({ length: n - 1 }).map((_, i) => {
         const left_offset = ((i + 1) / n) * 100;
         const right_offset = 100 - left_offset;

         return (
            <div 
              key={`line-${i}`}
              className="absolute top-0 h-full w-px bg-background opacity-50"
              style={{ 
                left: `calc(${left_offset}% - ${slant / n * (i+1)}px)`, // Approximation for slant correction
                transform: `skewX(-15deg)` // Approximate angle based on slant
              }} 
            />
         )
      })}
    </div>
  );
};

export default VotingCardPreview;
