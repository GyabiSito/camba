<?php

namespace App\Http\Controllers\Account;

use App\Actions\Geography\ResolveAddressGeography;
use App\Http\Resources\Account\AddressResource;
use App\Models\Address;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class AddressController
{
    public function __construct(private readonly ResolveAddressGeography $geography) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return AddressResource::collection($this->ownedAddresses($request)->orderBy('id')->get());
    }

    public function store(Request $request): AddressResource
    {
        $address = new Address($this->data($request));
        $address->user()->associate($request->user());
        $address->save();

        return new AddressResource($address->load('geographicLocality.department'));
    }

    public function show(Request $request, string $address): AddressResource
    {
        return new AddressResource($this->ownedAddresses($request)->findOrFail($address));
    }

    public function update(Request $request, string $address): AddressResource
    {
        $owned = $this->ownedAddresses($request)->findOrFail($address);
        $owned->update($this->data($request, partial: true));

        return new AddressResource($owned->load('geographicLocality.department'));
    }

    public function destroy(Request $request, string $address): Response
    {
        $this->ownedAddresses($request)->findOrFail($address)->delete();

        return response()->noContent();
    }

    /** @return Builder<Address> */
    private function ownedAddresses(Request $request): Builder
    {
        return Address::query()->whereBelongsTo($request->user())->with('geographicLocality.department');
    }

    private function data(Request $request, bool $partial = false): array
    {
        $data = $request->validate($this->rules($partial));
        if (isset($data['locality_id'])) {
            $locality = $this->geography->execute($data['department_id'], $data['locality_id']);
            unset($data['department_id']);
            // Keep readable fallback labels for rows if the additive migration is rolled back.
            $data['department'] = $locality->department->name;
            $data['locality'] = $locality->name;
        }

        return $data;
    }

    /** @return array<string, list<string>> */
    private function rules(bool $partial = false): array
    {
        $presence = $partial ? ['sometimes', 'required'] : ['required'];
        $department = $partial ? 'required_with:locality_id' : 'required';
        $locality = $partial ? 'required_with:department_id' : 'required';

        return [
            'recipient' => [...$presence, 'string', 'max:120'],
            'department_id' => [$department, 'integer:strict', 'min:1'],
            'locality_id' => [$locality, 'integer:strict', 'min:1'],
            'department' => ['missing'],
            'locality' => ['missing'],
            'street' => [...$presence, 'string', 'max:160'],
            'number' => [...$presence, 'string', 'max:20'],
            'details' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'postal_code' => ['nullable', 'string', 'max:12'],
            'user_id' => ['missing'],
        ];
    }
}
