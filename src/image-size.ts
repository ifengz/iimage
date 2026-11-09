/**
 * 聊天接口出图无法指定尺寸，模型会按自己的比例重绘（常见 9:16）。
 * 这里把结果缩放到原图宽高，保证前后对比与导出尺寸一致。
 * 尺寸已经一致时返回 null，调用方保持原始字节不动。
 */
export interface ResizedImage {
  blob: Blob;
  fromWidth: number;
  fromHeight: number;
}

export const resizeBlobToSize = async (
  blob: Blob,
  width: number,
  height: number,
): Promise<ResizedImage | null> => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return null;
  }

  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width === width && bitmap.height === height) return null;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    // 等比缩放后居中留白：直接拉伸会让文字变扁/变长，这里保证不变形
    const scale = Math.min(width / bitmap.width, height / bitmap.height);
    const drawWidth = Math.max(1, Math.round(bitmap.width * scale));
    const drawHeight = Math.max(1, Math.round(bitmap.height * scale));

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      bitmap,
      Math.round((width - drawWidth) / 2),
      Math.round((height - drawHeight) / 2),
      drawWidth,
      drawHeight,
    );

    const resized = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!resized) return null;
    return { blob: resized, fromWidth: bitmap.width, fromHeight: bitmap.height };
  } finally {
    bitmap.close();
  }
};
