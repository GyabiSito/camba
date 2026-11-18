<?php

namespace App\Http\Controllers\Catalog;

use App\Http\Requests\Catalog\SaveClassificationRequest;
use App\Http\Resources\Catalog\ClassificationResource;
use App\Models\Brand;
use App\Models\Category;
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
        $model = $request->route('classification');
        $query = $model::query()->orderBy('name')->orderBy('id');

        if (! $request->routeIs('admin.catalog.*')) {
            $query->where('active', true);
        }

        return ClassificationResource::collection($query->get());
    }

    public function store(SaveClassificationRequest $request): ClassificationResource
    {
        $model = $request->route('classification');
        $input = $request->validated();
        $item = new $model(['active' => true, ...$input]);
        $item->slug = rtrim(substr(Str::slug($item->name), 0, 160), '-') ?: 'classification-'.strtolower((string) Str::ulid());
        $this->save($item);

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

    private function save(Category|Brand $item): void
    {
        try {
            $item->save();
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['name' => 'Choose a distinct name for this classification.']);
        }
    }
}
