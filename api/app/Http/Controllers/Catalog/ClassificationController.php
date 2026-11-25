<?php

namespace App\Http\Controllers\Catalog;

use App\Http\Requests\Catalog\SaveClassificationRequest;
use App\Http\Resources\Catalog\ClassificationResource;
use App\Models\Brand;
use App\Models\Category;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ClassificationController
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = $this->ordered($request);

        if (! $request->routeIs('admin.catalog.*')) {
            $query->where('active', true);
        }

        return ClassificationResource::collection($query->get());
    }

    public function page(Request $request): AnonymousResourceCollection
    {
        $page = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:active,inactive'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:2147483647'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = $this->ordered($request);
        if (isset($page['q'])) {
            // ponytail: substring search scans matching rows; use indexed search if catalog size warrants it.
            $needle = '%'.strtr($page['q'], ['!' => '!!', '%' => '!%', '_' => '!_']).'%';
            $query->where(fn (Builder $query) => $query
                ->whereRaw("LOWER(name) LIKE LOWER(?) ESCAPE '!'", [$needle])
                ->orWhereRaw("LOWER(slug) LIKE LOWER(?) ESCAPE '!'", [$needle]));
        }
        if (isset($page['status'])) {
            $query->where('active', $page['status'] === 'active');
        }

        return ClassificationResource::collection($query->paginate($page['per_page'] ?? 12)->appends($page));
    }

    public function store(SaveClassificationRequest $request): ClassificationResource
    {
        $model = $request->route('classification');
        $input = $request->validated();
        $item = new $model(['active' => true, ...$input]);
        $item->slug = rtrim(substr(Str::slug($item->name), 0, 160), '-') ?: 'classification-'.strtolower((string) Str::ulid());
        $save = fn () => $this->save($item);

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::transaction($save);
        } else {
            $save();
        }

        return new ClassificationResource($item);
    }

    public function update(SaveClassificationRequest $request, string $id): ClassificationResource
    {
        $model = $request->route('classification');
        $input = $request->validated();

        return DB::transaction(function () use ($model, $input, $id): ClassificationResource {
            $item = $model::query()->lockForUpdate()->findOrFail($id);

            if ($item->active && ($input['active'] ?? true) === false) {
                abort_if($item->products()->published()->exists(), 409, 'Reassign or archive published products before deactivation.');
            }

            $item->fill($input);
            $this->save($item);

            return new ClassificationResource($item);
        }, 3);
    }

    private function ordered(Request $request): Builder
    {
        $model = $request->route('classification');

        return $model::query()->orderBy('name')->orderBy('id');
    }

    private function save(Category|Brand $item): void
    {
        try {
            $item->save();
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['name' => 'Choose a distinct name for this classification.']);
        }
    }
}
