/**
 * 聊天接口出图无法指定尺寸，模型会按自己的比例重绘（常见 9:16）。
 * 这里把结果缩放到原图宽高，保证前后对比与导出尺寸一致。
 * 尺寸已经一致时返回 null，调用方保持原始字节不动。
 */
export const resizeBlobToSize = async (
  blob: Blob,
  width: number,
  height: number,
): Promise<Blob | null> => {
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

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
  } finally {
    bitmap.close();
  }
};
