from __future__ import annotations

import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

LOCAL_CACHE_DIR = (Path(__file__).resolve().parent / ".paddlex-cache").as_posix()
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", LOCAL_CACHE_DIR)

app = FastAPI(title="iimage local OCR")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _to_plain_value(value: Any) -> Any:
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            return value
    return value


def _normalize_box(raw_box: Any) -> dict[str, int] | None:
    candidate = raw_box

    if hasattr(candidate, "tolist"):
        candidate = candidate.tolist()

    if isinstance(candidate, (list, tuple)):
        if len(candidate) == 4 and all(
            not isinstance(item, (list, tuple)) for item in candidate
        ):
            x1, y1, x2, y2 = [
                int(round(float(_to_plain_value(value)))) for value in candidate
            ]
            return {
                "x": max(0, x1),
                "y": max(0, y1),
                "width": max(0, x2 - x1),
                "height": max(0, y2 - y1),
            }

        points: list[tuple[float, float]] = []
        for point in candidate:
            if hasattr(point, "tolist"):
                point = point.tolist()
            if isinstance(point, (list, tuple)) and len(point) >= 2:
                points.append(
                    (
                        float(_to_plain_value(point[0])),
                        float(_to_plain_value(point[1])),
                    )
                )

        if points:
            xs = [point[0] for point in points]
            ys = [point[1] for point in points]
            left = int(round(min(xs)))
            top = int(round(min(ys)))
            right = int(round(max(xs)))
            bottom = int(round(max(ys)))
            return {
                "x": max(0, left),
                "y": max(0, top),
                "width": max(0, right - left),
                "height": max(0, bottom - top),
            }

    return None


def _extract_blocks_from_new_result(page_result: Any) -> list[dict[str, Any]]:
    payload = page_result

    if hasattr(payload, "json"):
      payload = payload.json

    if isinstance(payload, dict) and isinstance(payload.get("res"), dict):
        payload = payload["res"]

    if not isinstance(payload, dict):
        return []

    texts = payload.get("rec_texts") or []
    scores = payload.get("rec_scores") or []
    boxes = payload.get("rec_boxes") or payload.get("rec_polys") or payload.get("dt_polys") or []

    blocks: list[dict[str, Any]] = []
    for index, text in enumerate(texts):
        if not str(text).strip():
            continue

        box = _normalize_box(boxes[index] if index < len(boxes) else None)
        if not box:
            continue

        score = None
        if index < len(scores):
            score = float(_to_plain_value(scores[index]))

        blocks.append(
            {
                "id": f"block-{index + 1}",
                "text": str(text),
                "score": score,
                "box": box,
            }
        )

    return blocks


def _extract_blocks_from_legacy_result(prediction: Any) -> list[dict[str, Any]]:
    if not isinstance(prediction, list):
        return []

    pages = prediction
    if prediction and isinstance(prediction[0], (list, tuple)):
        first_row = prediction[0]
        if first_row and isinstance(first_row[0], (list, tuple)):
            pages = [prediction]

    blocks: list[dict[str, Any]] = []

    for page in pages:
        if not isinstance(page, list):
            continue

        for index, row in enumerate(page):
            if not isinstance(row, (list, tuple)) or len(row) < 2:
                continue

            box = _normalize_box(row[0])
            if not box:
                continue

            rec = row[1]
            text = ""
            score = None
            if isinstance(rec, (list, tuple)) and rec:
                text = str(rec[0])
                if len(rec) > 1:
                    score = float(_to_plain_value(rec[1]))

            if not text.strip():
                continue

            blocks.append(
                {
                    "id": f"block-{len(blocks) + 1}",
                    "text": text,
                    "score": score,
                    "box": box,
                }
            )

    return blocks


def _normalize_prediction(prediction: Any) -> list[dict[str, Any]]:
    if prediction is None:
        return []

    if isinstance(prediction, list):
        blocks: list[dict[str, Any]] = []
        for page in prediction:
            page_blocks = _extract_blocks_from_new_result(page)
            if page_blocks:
                blocks.extend(page_blocks)
        if blocks:
            return blocks

    return _extract_blocks_from_legacy_result(prediction)


@lru_cache(maxsize=1)
def get_ocr_engine():
    os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE", "BOS")

    try:
        from paddleocr import PaddleOCR
    except Exception as exc:
        raise RuntimeError(
            "PaddleOCR 还没装好。先安装 ocr_server/requirements.txt 里的依赖，再启动本地 OCR 服务。"
        ) from exc

    try:
        return PaddleOCR(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
    except TypeError:
        return PaddleOCR(use_angle_cls=True, lang="ch")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/ocr")
async def run_ocr(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="请上传图片文件。")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="上传文件为空。")

    suffix = Path(file.filename).suffix or ".png"
    temp_path = ""

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(data)
            temp_path = temp_file.name

        try:
            ocr_engine = get_ocr_engine()
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        if hasattr(ocr_engine, "predict"):
            prediction = ocr_engine.predict(temp_path)
        elif hasattr(ocr_engine, "ocr"):
            prediction = ocr_engine.ocr(temp_path, cls=True)
        else:
            raise HTTPException(status_code=500, detail="当前 PaddleOCR 实例没有可用的识别入口。")

        blocks = _normalize_prediction(prediction)
        return {"blocks": blocks}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR 识别失败：{exc}") from exc
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
