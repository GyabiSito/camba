<?php

namespace App\Actions\Homepage;

use App\Models\HomepageImage;
use App\Models\HomepagePublication;
use App\Support\Homepage\HomepagePayload;
use Illuminate\Support\Facades\DB;

class ManageHomepageAction
{
    public function execute(string $operation, int $revision, ?array $document = null): array
    {
        return DB::transaction(function () use ($operation, $revision, $document): array {
            $home = HomepagePublication::query()->lockForUpdate()->findOrFail(1);
            abort_unless($home->revision === $revision, 409, 'La portada cambió en otra sesión. Recargá antes de guardar.');
            if ($operation === 'save') {
                $home->draft = $document;
            } elseif ($operation === 'publish') {
                abort_if($home->draft === null, 422, 'Guardá un borrador antes de publicar.');
                HomepageImage::query()->whereIn('key', HomepagePayload::uploadedImageKeys($home->draft))
                    ->whereNull('published_at')->update(['published_at' => now()]);
                $home->published = $home->draft;
                $home->draft = null;
                $home->published_version++;
            } else {
                $home->draft = null;
            }
            $home->revision++;
            $home->save();

            return app(HomepagePayload::class)->editor($home);
        });
    }
}
