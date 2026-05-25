"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Props {
  /** Payload encoded into the QR (the URL to open). */
  value: string;
  /** Side, in pixels. The internal canvas renders at this size; the <img>
   *  scales via CSS, so size only affects the bitmap sharpness. */
  size?: number;
  /**
   * Logo source for the centre overlay. Resolved in this order:
   *   1. caller-supplied URL (e.g. brand_logo_url from Settings)
   *   2. /logoalleya.png (the Alleya default packaged with the app)
   *   3. nothing — plain QR
   * Cross-origin URLs need CORS headers to keep the canvas un-tainted;
   * if the image can't load, we silently fall through to the next option.
   */
  logoUrl?: string | null;
  /** Logo side as a fraction of the QR side. Stays safe with the H-level
   *  error correction we use (≈30 % tolerated; 0.22 leaves headroom). */
  logoRatio?: number;
  className?: string;
  alt?: string;
  /** Called with the generated data: URL once the QR (and overlay, if any)
   *  has been drawn — useful for download links / print buttons. */
  onReady?: (dataUrl: string) => void;
}

// Try to load each candidate until one resolves; resolves with the loaded
// HTMLImageElement or null if none succeeded. Cross-origin failures and
// 404s are treated identically — we just continue down the list.
function loadFirstAvailable(srcs: string[]): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= srcs.length) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => {
        i++;
        tryNext();
      };
      img.src = srcs[i];
    };
    tryNext();
  });
}

export function QrWithLogo({
  value,
  size = 640,
  logoUrl,
  logoRatio = 0.22,
  className,
  alt = "QR-код",
  onReady,
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1) Generate the QR onto an offscreen canvas. H-level error
      //    correction lets up to ~30 % of the code be obscured by the
      //    logo and still scan cleanly.
      const canvas = document.createElement("canvas");
      try {
        await QRCode.toCanvas(canvas, value, {
          width: size,
          margin: 1,
          errorCorrectionLevel: "H",
          color: { dark: "#000000", light: "#FFFFFF" },
        });
      } catch (err) {
        console.error("QR render failed:", err);
        return;
      }

      // 2) Overlay the logo (with a small white pad behind it, so the
      //    contrast against the QR modules stays high). Failures here
      //    just leave the bare QR — still scannable.
      const candidates = [
        ...(logoUrl ? [logoUrl] : []),
        "/logoalleya.png",
      ];
      const logo = await loadFirstAvailable(candidates);
      if (logo) {
        try {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const logoSize = Math.round(size * logoRatio);
            const pos = Math.round((size - logoSize) / 2);
            const pad = Math.round(logoSize * 0.12);
            // White rounded pad — keeps the logo readable on a dense QR
            const r = Math.round(logoSize * 0.16);
            ctx.fillStyle = "#FFFFFF";
            const x = pos - pad;
            const y = pos - pad;
            const w = logoSize + pad * 2;
            const h = logoSize + pad * 2;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();
            ctx.drawImage(logo, pos, pos, logoSize, logoSize);
          }
        } catch (err) {
          console.warn("Logo overlay skipped (canvas tainted?):", err);
        }
      }

      if (cancelled) return;
      try {
        const url = canvas.toDataURL("image/png");
        setDataUrl(url);
        onReady?.(url);
      } catch (err) {
        // toDataURL throws on a tainted canvas — last-resort: serve the
        // bare QR by re-rendering without the logo.
        console.warn("Canvas tainted; falling back to logo-less QR:", err);
        try {
          const bare = await QRCode.toDataURL(value, {
            width: size,
            margin: 1,
            errorCorrectionLevel: "H",
            color: { dark: "#000000", light: "#FFFFFF" },
          });
          if (!cancelled) {
            setDataUrl(bare);
            onReady?.(bare);
          }
        } catch (innerErr) {
          console.error("Bare QR fallback failed:", innerErr);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value, size, logoUrl, logoRatio, onReady]);

  if (!dataUrl) {
    // Match aspect during loading so layout doesn't pop.
    return <div className={className} style={{ aspectRatio: "1 / 1" }} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt={alt} className={className} />;
}
