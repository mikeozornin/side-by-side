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

  const slant = 10; // Slant amount for the diagonal effect
  const gap = 1; // Gap between images

  const getClipPath = (i: number) => {
    if (n <= 1) return 'none';

    // Handle two images separately for a simple diagonal split
    if (n === 2) {
      // The geometric angle of a true diagonal is different from the `slant` angle.
      // To make the visual gap appear consistent, we apply a correction factor.
      // This is an empirical value that works well for typical aspect ratios.
      const correctionFactor = 2.5;
      const g = (gap * correctionFactor);

      if (i === 0) {
        return `polygon(0% 0%, calc(100% - ${g}%) 0%, 0% 100%)`;
      } else {
        return `polygon(100% 0%, 100% 100%, ${g}% 100%)`;
      }
    }

    // Equal distribution for n > 2
    const totalGap = (n - 1) * gap;
    const totalShapeWidth = 100 - totalGap;
    const avgWidth = totalShapeWidth / n;

    // Calculate the positions of the dividers on the top edge
    // to achieve equal average width
    const T = [0];
    T[1] = avgWidth + slant / 2;
    for (let j = 2; j < n; j++) {
      T[j] = T[j-1] + avgWidth;
    }

    // Define polygon points
    let p1_x, p2_x, p3_x, p4_x;

    if (i === 0) { // First shape (left trapezoid/triangle)
      p1_x = 0;
      p2_x = T[1];
      p4_x = 0;
      p3_x = T[1] - slant;
    } else { // Middle or last shape
      // Add gap from the previous shape
      const start_x = T[i] + i * gap;
      
      if (i === n - 1) { // Last shape (right trapezoid/triangle)
        p1_x = start_x;
        p2_x = 100;
        p4_x = start_x - slant;
        p3_x = 100;
      } else { // Middle shape (parallelogram)
        const end_x = T[i+1] + i * gap;
        p1_x = start_x;
        p2_x = end_x;
        p4_x = start_x - slant;
        p3_x = end_x - slant;
      }
    }

    return `polygon(${p1_x}% 0%, ${p2_x}% 0%, ${p3_x}% 100%, ${p4_x}% 100%)`;
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
        if (n === 2) {
          // The diagonal line for n=2 is handled by the clip-path gap,
          // drawing a separate divider line is complex and visually noisy.
          // We can return null to not render a divider in this specific case.
          return null;
        }
        
        const totalGap = (n - 1) * gap;
        const totalShapeWidth = 100 - totalGap;
        const avgWidth = totalShapeWidth / n;

        const T = [0];
        T[1] = avgWidth + slant / 2;
        for (let j = 2; j <= i + 1; j++) {
          T[j] = T[j - 1] + avgWidth;
        }

        const left_offset = T[i+1] + (i * gap) + (gap / 2);

        return (
           <div
             key={`line-${i}`}
             className="absolute top-0 h-full w-px bg-background opacity-50"
             style={{
               left: `calc(${left_offset}% - ${slant / 2}px)`,
               transform: `skewX(-15deg)`
             }}
           />
        )
      })}
    </div>
  );
};

export default VotingCardPreview;
