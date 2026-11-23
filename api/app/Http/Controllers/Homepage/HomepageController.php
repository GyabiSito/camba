<?php

namespace App\Http\Controllers\Homepage;

use App\Actions\Homepage\ManageHomepageAction;
use App\Actions\Homepage\SaveHomepageImageAction;
use App\Http\Requests\Homepage\RevisionRequest;
use App\Http\Requests\Homepage\SaveHomepageRequest;
use App\Http\Requests\Homepage\UploadHomepageImageRequest;
use App\Models\HomepageImage;
use App\Models\HomepagePublication;
use App\Support\Homepage\HomepagePayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class HomepageController
{
    public function show(HomepagePayload $payload): JsonResponse
    {
        return $this->respond($payload->publication(HomepagePublication::findOrFail(1)));
    }

    public function edit(HomepagePayload $payload): JsonResponse
    {
        return $this->respond($payload->editor(HomepagePublication::findOrFail(1)));
    }

    public function preview(HomepagePayload $payload): JsonResponse
    {
        return $this->respond($payload->publication(HomepagePublication::findOrFail(1), true));
    }

    public function update(SaveHomepageRequest $request, ManageHomepageAction $action): JsonResponse
    {
        $data = $request->validated();

        return $this->respond($action->execute('save', $data['revision'], $this->normalizeText($data['document'])));
    }

    public function publish(RevisionRequest $request, ManageHomepageAction $action): JsonResponse
    {
        return $this->respond($action->execute('publish', $request->validated('revision')));
    }

    public function discard(RevisionRequest $request, ManageHomepageAction $action): JsonResponse
    {
        return $this->respond($action->execute('discard', $request->validated('revision')));
    }

    public function upload(UploadHomepageImageRequest $request, SaveHomepageImageAction $action, HomepagePayload $payload): JsonResponse
    {
        $image = $action->execute($request->file('photo'));

        return $this->respond(['key' => $image->key, 'asset' => $payload->asset($image, true)], 201);
    }

    public function media(string $key, string $variant)
    {
        $private = request()->routeIs('admin.homepage.media');
        $image = HomepageImage::query()->where('key', $key)->when(! $private, fn ($query) => $query->whereNotNull('published_at'))->firstOrFail();
        $path = $variant === 'thumbnail' ? str_replace('.webp', '-thumb.webp', $image->path) : $image->path;

        return Storage::disk('local')->response($path, null, [
            'Content-Type' => 'image/webp', 'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => $private ? 'private, no-store' : 'public, max-age=31536000, immutable',
        ]);
    }

    private function respond(array $data, int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data], $status)->header('Cache-Control', 'private, no-store');
    }

    private function normalizeText(array $node): array
    {
        foreach ($node as $key => $value) {
            if (is_array($value)) {
                $node[$key] = $this->normalizeText($value);
            } elseif ($value === null && in_array($key, ['text', 'alt', 'label'], true)) {
                $node[$key] = '';
            }
        }

        return $node;
    }
}
