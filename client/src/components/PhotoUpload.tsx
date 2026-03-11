import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PHOTO_CATEGORY_LABELS } from "@/lib/constants";
import { Camera, Image } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PhotoUploadProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
  assignmentId?: string;
}

export function PhotoUpload({ open, onClose, jobId, assignmentId }: PhotoUploadProps) {
  const [category, setCategory] = useState<string>("during");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (response) => {
      await apiRequest("POST", "/api/photos", {
        jobId,
        assignmentId,
        photoUrl: response.objectPath,
        category,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/photos/job", jobId] });
      setPreview(null);
      setSelectedFile(null);
      onClose();
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new window.Image();
    img.onload = () => {
      const maxSize = 2000;
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressed = new File([blob], file.name, { type: "image/jpeg" });
            setSelectedFile(compressed);
            setPreview(canvas.toDataURL("image/jpeg", 0.8));
          }
        },
        "image/jpeg",
        0.8
      );
    };
    img.src = URL.createObjectURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    await uploadFile(selectedFile);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Foto hinzufügen
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PHOTO_CATEGORY_LABELS).map(([key, label]) => (
              <Button
                key={key}
                variant={category === key ? "default" : "secondary"}
                className="h-10 text-sm"
                onClick={() => setCategory(key)}
                data-testid={`button-photo-category-${key}`}
              >
                {label}
              </Button>
            ))}
          </div>

          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="Vorschau"
                className="w-full rounded-md max-h-64 object-cover"
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => {
                  setPreview(null);
                  setSelectedFile(null);
                }}
              >
                Entfernen
              </Button>
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-muted rounded-md p-8 flex flex-col items-center gap-3 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-select-photo"
            >
              <Image className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Foto aufnehmen oder auswählen</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />

          <Button
            className="w-full h-12 text-base"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            data-testid="button-upload-photo"
          >
            {isUploading ? "Wird hochgeladen..." : "Foto speichern"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
