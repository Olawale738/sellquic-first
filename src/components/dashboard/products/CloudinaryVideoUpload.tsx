'use client';

import { useState } from 'react';
import { CldUploadWidget } from 'next-cloudinary';
import { Video, Loader2, Trash2, CheckCircle, FileVideo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Props {
  onUpload: (url: string) => void;
  onRemove: () => void;
  currentVideoUrl?: string;
  disabled?: boolean;
}

export default function CloudinaryVideoUpload({ onUpload, onRemove, currentVideoUrl, disabled }: Props) {
  const { toast } = useToast();
  const [isHovering, setIsHovering] = useState(false);

  // Helper to force unlock scrolling
  const unlockScroll = () => {
    document.body.style.overflow = 'auto';
    document.body.style.paddingRight = '0px'; // Removes layout shift
  };

  return (
    <div className="space-y-3">
        {/* VIDEO PREVIEW (If exists) */}
        {currentVideoUrl ? (
            <div 
                className="relative rounded-md overflow-hidden border bg-black aspect-video group w-full max-w-[300px]"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <video 
                    src={currentVideoUrl} 
                    className="w-full h-full object-contain" 
                    controls
                />
                
                {/* Delete Button */}
                <div className="absolute top-2 right-2">
                    <Button 
                        type="button" 
                        variant="destructive" 
                        size="icon" 
                        className="h-8 w-8 shadow-md opacity-80 hover:opacity-100"
                        onClick={(e) => {
                            e.preventDefault();
                            onRemove();
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        ) : (
            /* UPLOAD BUTTON */
            <CldUploadWidget 
                uploadPreset="sellquic_videos"
                options={{
                    sources: ['local'],
                    resourceType: 'video',
                    maxFiles: 1,
                    maxFileSize: 25000000, // 25MB Limit
                    clientAllowedFormats: ['mp4', 'mov', 'webm'],
                    folder: 'product_videos',
                }}
                onSuccess={(result: any) => {
                    unlockScroll(); // <--- FIX: Unlock scroll on success
                    if (result.info?.secure_url) {
                        onUpload(result.info.secure_url);
                        toast({ title: "Video Uploaded!", description: "Video added successfully." });
                    }
                }}
                onError={(err) => {
                    unlockScroll(); // <--- FIX: Unlock scroll on error
                    console.error("Cloudinary Error:", err);
                    toast({ title: "Upload Failed", description: "Could not upload video.", variant: "destructive" });
                }}
                onClose={() => {
                    unlockScroll(); // <--- FIX: Unlock scroll when closed manually
                }}
            >
                {({ open }) => {
                    return (
                        <div 
                            onClick={() => !disabled && open()}
                            className={`
                                border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-muted/20
                                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50 hover:border-primary/50'}
                            `}
                        >
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <FileVideo className="h-5 w-5" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium">Upload Product Video</p>
                                <p className="text-xs text-muted-foreground">MP4 up to 25MB (Optional)</p>
                            </div>
                        </div>
                    );
                }}
            </CldUploadWidget>
        )}
    </div>
  );
}