<?php

namespace App\Http\Controllers\Account;

use App\Http\Resources\Account\AddressResource;
use App\Models\Address;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class AddressController
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return AddressResource::collection($this->ownedAddresses($request)->orderBy('id')->get());
    }

    public function store(Request $request): AddressResource
    {
        $address = new Address($request->validate($this->rules()));
        $address->user()->associate($request->user());
        $address->save();

        return new AddressResource($address);
    }

    public function show(Request $request, string $address): AddressResource
    {
        return new AddressResource($this->ownedAddresses($request)->findOrFail($address));
    }

    public function update(Request $request, string $address): AddressResource
    {
        $owned = $this->ownedAddresses($request)->findOrFail($address);
        $owned->update($request->validate($this->rules(partial: true)));

        return new AddressResource($owned);
    }

    public function destroy(Request $request, string $address): Response
    {
        $this->ownedAddresses($request)->findOrFail($address)->delete();

        return response()->noContent();
    }

    /** @return Builder<Address> */
    private function ownedAddresses(Request $request): Builder
    {
        return Address::query()->whereBelongsTo($request->user());
    }

    /** @return array<string, list<string>> */
    private function rules(bool $partial = false): array
    {
        $presence = $partial ? ['sometimes', 'required'] : ['required'];

        return [
            'recipient' => [...$presence, 'string', 'max:120'],
            'department' => [...$presence, 'string', 'max:80'],
            'locality' => [...$presence, 'string', 'max:120'],
            'street' => [...$presence, 'string', 'max:160'],
            'number' => [...$presence, 'string', 'max:20'],
            'details' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'postal_code' => ['nullable', 'string', 'max:12'],
            'user_id' => ['missing'],
        ];
    }
}
