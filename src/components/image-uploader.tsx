import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, X, Trash2, ImageIcon } from "lucide-react";

const BUCKET = "upload";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg"];
const ALLOWED_EXT = [".png", ".jpg", ".jpeg"];

type UserImage = {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
};

function validate(file: File): string | null {
  const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_MIME.includes(file.type.toLowerCase())) {
    return "סוג הקובץ לא נתמך. ניתן להעלות רק PNG, JPG או JPEG";
  }
  if (!ALLOWED_EXT.includes(ext)) {
    return "סיומת הקובץ לא נתמכת. ניתן להעלות רק .png, .jpg או .jpeg";
  }
  if (file.size > MAX_SIZE) {
    return "גודל הקובץ חורג מ-5MB";
  }
  return null;
}

export function ImageUploader() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [images, setImages] = useState<UserImage[]>([]);

  const loadImages = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("user_images")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setImages((data as UserImage[]) || []);
  }, [user]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f: File | null) => {
    if (!f) return;
    const err = validate(f);
    if (err) {
      toast.error(err);
      return;
    }
    setFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pick(e.dataTransfer.files?.[0] ?? null);
  };

  const upload = async () => {
    if (!file || !user) return;
    const err = validate(file);
    if (err) {
      toast.error(err);
      return;
    }
    setUploading(true);
    setProgress(10);
    try {
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const path = `user-uploads/${user.id}/${Date.now()}-${safeName}`;
      setProgress(30);
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      setProgress(70);

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const fileUrl = pub.publicUrl;

      const { error: insErr } = await supabase.from("user_images").insert({
        user_id: user.id,
        file_name: file.name,
        file_url: fileUrl,
        storage_path: path,
        file_size: file.size,
        mime_type: file.type,
      });
      if (insErr) throw insErr;

      setProgress(100);
      toast.success("התמונה הועלתה בהצלחה");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await loadImages();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "שגיאה לא ידועה";
      toast.error(`שגיאה בהעלאה: ${msg}`);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const remove = async (img: UserImage) => {
    try {
      await supabase.storage.from(BUCKET).remove([img.storage_path]);
      const { error } = await supabase.from("user_images").delete().eq("id", img.id);
      if (error) throw error;
      toast.success("התמונה נמחקה");
      await loadImages();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "שגיאה לא ידועה";
      toast.error(`שגיאה במחיקה: ${msg}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>העלאת תמונה</CardTitle>
        <CardDescription>PNG, JPG או JPEG · עד 5MB</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">גרור ושחרר תמונה כאן או לחץ לבחירה</p>
          <p className="text-xs text-muted-foreground mt-1">PNG · JPG · JPEG · עד 5MB</p>
        </div>

        {preview && file && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <img src={preview} alt="תצוגה מקדימה" className="h-24 w-24 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFile(null)}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {uploading && <Progress value={progress} />}
            <div className="flex gap-2">
              <Button onClick={upload} disabled={uploading} className="gap-2">
                <Upload className="h-4 w-4" />
                {uploading ? "מעלה..." : "העלאת תמונה"}
              </Button>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            התמונות שלי ({images.length})
          </h3>
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">עדיין לא הועלו תמונות</p>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
              {images.map((img) => (
                <div key={img.id} className="group relative rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={img.file_url}
                    alt={img.file_name}
                    className="w-full h-32 object-cover"
                    loading="lazy"
                  />
                  <button
                    onClick={() => remove(img)}
                    className="absolute top-2 left-2 p-1.5 rounded bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="מחק"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="p-2 text-xs truncate bg-card">{img.file_name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
