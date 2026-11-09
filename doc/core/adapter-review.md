# iimage image provider adapter review

> Historical pre-migration review. The Gemini-only coupling and proposed local adapter files below
> describe the old baseline, not current code or current implementation instructions. See the
> repository README and `doc/core/commit-review.md` for the current package boundary and release limits.

## Current coupling

- `src/hooks/useAssets.ts:13-15` imports `GoogleGenerativeAI`; `startBatch()` lines 811-899 parses newline API keys, constructs the Gemini SDK model, converts the asset URL to base64, sends `[prompt, inlineData]`, and extracts one Gemini inline image. This is the only generation transport.
- `src/hooks/useAssets.ts:691-710` owns URL/blob/base64 conversion, so a second protocol would otherwise duplicate it.
- `src/components/ActionToolbar.tsx:8-23,164-215` exposes only `apiKeys` and Gemini model options. There is no provider/protocol/base URL field.
- `vite.config.ts` only proxies `/api/*` to the OCR FastAPI process. There is no image backend route.

## Minimal adapter contract (transport only)

```ts
type ImageProviderProtocol =
  | "gemini_generate_content"
  | "openai_images";

type ImageEditInput = {
  prompt: string;
  image: { data: string; mimeType: string; fileName: string };
  mask?: { data: string; mimeType: string; fileName: string };
  model: string;
  signal?: AbortSignal;
};

type ImageEditOutput = {
  dataUrl: string;
  mimeType: string;
  providerRequestId?: string;
};

interface ImageEditAdapter {
  readonly protocol: ImageProviderProtocol;
  edit(input: ImageEditInput): Promise<ImageEditOutput>;
}
```

The adapter owns request encoding, URL joining, auth header, HTTP error extraction, response parsing, exactly-one-image validation, and (for async vendors) submit/poll/timeout. It must preserve `AbortSignal` and throw a typed provider error; no fallback to another provider. Prompt building, batch scheduling, asset status, and UI remain outside the adapter.

## Provider selection

Keep protocol identifiers separate from display/provider names, as in polabel2: `gemini_generate_content`, `openai_images`, optionally later `openai_responses_image` and `dashscope_async_image`. A provider config should contain `{id, label, protocol, baseUrl, model, credentialRef}`. `baseUrl` is required for OpenAI-compatible endpoints and must not be inferred from vendor name. Do not expose credential values in the config object sent to the UI.

## Recommended deployment boundary

The current app is static + OCR FastAPI. A production-safe adapter should run server-side behind `POST /api/image/edit` (multipart image/mask + prompt + provider id/model), with keys loaded from server env/secret storage. Extend `ocr_server` only as a local development host or add a small dedicated image API; do not send arbitrary third-party URLs/keys directly from the browser in a deployed build. If local-only direct adapters are chosen, explicitly label key exposure as a blocking risk.

## File plan

### TypeScript client adapter path

- Add `src/image/types.ts`: `ImageEditInput/Output`, protocol, provider config, typed errors.
- Add `src/image/adapters/gemini.ts`: move current SDK request and inlineData extraction.
- Add `src/image/adapters/openai-images.ts`: multipart `POST {baseUrl}/images/edits`, image (and optional mask), prompt, model; parse `data[0].b64_json` or URL; reject URL-only result if browser cannot fetch it due CORS.
- Add `src/image/registry.ts`: explicit protocol/provider registry; unknown protocol is an error.
- Modify `src/hooks/useAssets.ts`: remove direct Gemini import and `extractResultImageUrl`; call `adapter.edit()` after shared source conversion. Keep `buildPrompt`, batch status, parallelism, cancellation, and result URL assignment unchanged.
- Modify `src/components/ActionToolbar.tsx`: provider/protocol/model/base URL configuration; preserve parallel limit. If server-side keys, replace textarea with provider id/credential selector; if local direct mode, keep key input only with an explicit warning.
- Add adapter unit tests and update `src/app.test.tsx` to assert provider dispatch and output parsing, not SDK mocks.

### Server-side key path (recommended)

- Add `ocr_server/image_api.py` (or a dedicated API process) with `/api/image/edit` and provider adapters; add an HTTP client dependency (or use a separately owned Node service), env-backed provider config, size/type limits, timeout, and redacted errors.
- Keep `vite.config.ts` `/api` proxy as-is for local development; update `ocr_server/app.py` to register the image router.
- Update `ocr_server/requirements.txt`, README, and startup script with provider env setup.
- Client adapter then becomes a thin `fetch('/api/image/edit')` client; no provider SDK in the browser.

## Risks / acceptance gates

- OpenAI-compatible vendors vary: `/images/edits` may not support image input, may require `model`, and may return URL instead of base64. Do a real edit request and validate the downloaded artifact; connection/model-list tests do not count.
- Gemini model names and SDK response parts are not interchangeable with Imagen generation; keep `gemini_generate_content` adapter explicit.
- Data URL results can grow memory with six concurrent jobs; later return Blob/object-storage references, but retain dataUrl for minimal current UI change.
- Base URL path joining, CORS, remote result URL expiry, unsupported mime/size, rate limits, async polling, and cancellation need typed visible errors. Do not silently retry a different protocol.
- The current `settings.apiKeys` newline round-robin can be retained temporarily inside the adapter invocation, but it is not a provider registry and should not be the final multi-provider model.

## Smallest useful first slice

Implement Gemini adapter behind the interface, then OpenAI Images Edit-compatible adapter, and switch `startBatch()` to the registry. Keep result shape as `dataUrl` so preview/download work unchanged. Add real smoke test with one source image and one replacement rule per provider before claiming the adapter is useful.
