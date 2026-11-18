<?php

namespace App\Http\Controllers\Imports;

use App\Actions\Imports\ConfirmCatalogImport;
use App\Actions\Imports\PreviewCatalogImport;
use App\Actions\Imports\ReadCatalogSpreadsheet;
use App\Http\Requests\Imports\PreviewCatalogImportRequest;
use App\Http\Resources\Imports\CatalogImportResource;
use App\Models\CatalogImport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CatalogImportController
{
    public function template(): StreamedResponse
    {
        return response()->streamDownload(static function (): void {
            echo implode(',', ReadCatalogSpreadsheet::HEADERS)."\nEXAMPLE-01,Vaso,199.00,3,hogar,,,\n";
        }, 'catalog-import.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function store(PreviewCatalogImportRequest $request, PreviewCatalogImport $preview): JsonResponse
    {
        $import = $preview->execute($request->file('file'), $request->user()->id);

        return $this->resource($import)->response()->setStatusCode($import->wasRecentlyCreated ? 201 : 200);
    }

    public function show(string $id): CatalogImportResource
    {
        return $this->resource(CatalogImport::query()->findOrFail($id));
    }

    public function confirm(Request $request, string $id, ConfirmCatalogImport $confirm): JsonResponse
    {
        return $this->resource($confirm->execute($id, $request->user()->id))->response()->setStatusCode(202);
    }

    private function resource(CatalogImport $import): CatalogImportResource
    {
        return new CatalogImportResource($import->load(['rows' => fn ($query) => $query->orderBy('line')]));
    }
}
