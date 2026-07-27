import { useState } from "react";
import { Share2, Facebook, Twitter, Link as LinkIcon, MessageCircle, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

type Props = {
  url: string;
  title: string;
  text?: string;
};

export function ShareButton({ url, title, text }: Props) {
  const [copied, setCopied] = useState(false);
  const shareText = text ?? title;

  const shares = [
    {
      label: "Facebook",
      icon: Facebook,
      color: "bg-[#1877F2] hover:bg-[#1466d6] text-white",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`,
    },
    {
      label: "WhatsApp",
      icon: MessageCircle,
      color: "bg-[#25D366] hover:bg-[#1fb857] text-white",
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`,
    },
    {
      label: "X / Twitter",
      icon: Twitter,
      color: "bg-black hover:bg-neutral-800 text-white",
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      label: "Telegram",
      icon: Send,
      color: "bg-[#0088cc] hover:bg-[#0077b3] text-white",
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`,
    },
  ];

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url });
      } catch {
        /* user dismissed */
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy failed");
    }
  };

  const canNative = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="lg" variant="secondary" className="mt-2 w-full gap-2">
          <Share2 className="h-4 w-4" />
          Share product
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-72 p-3">
        <div className="text-sm font-medium mb-2 px-1">Share this product</div>
        <div className="grid grid-cols-2 gap-2">
          {shares.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${s.color}`}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </a>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <div className="flex-1 truncate rounded-md border bg-muted px-2 py-2 text-xs text-muted-foreground">
            {url}
          </div>
          <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1">
            {copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        {canNative && (
          <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={handleNativeShare}>
            More options…
          </Button>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground px-1 leading-relaxed">
          Facebook, Instagram, WhatsApp and other apps will show the product image and title
          automatically.
        </p>
      </PopoverContent>
    </Popover>
  );
}
