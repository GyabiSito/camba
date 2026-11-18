<?php

namespace App\Http\Controllers\Cart;

use App\Actions\Cart\SetCartItem;
use App\Http\Requests\Cart\CartRequest;
use App\Http\Resources\Cart\CartResource;
use App\Models\Cart;
use Illuminate\Http\Response;

class CartController
{
    public function show(CartRequest $request): CartResource
    {
        $cart = Cart::query()->where(Cart::ownerKey($request->user('web')?->id, $request->session()->getId()))
            ->with('items.product')->first();

        return new CartResource($cart);
    }

    public function setItem(CartRequest $request, string $product, SetCartItem $item): CartResource
    {
        $cart = $item->execute(
            $request->user('web')?->id, $request->session()->getId(), $product, $request->validated('quantity'),
        );

        return new CartResource($cart?->load('items.product'));
    }

    public function removeItem(CartRequest $request, string $product, SetCartItem $item): Response
    {
        $item->execute($request->user('web')?->id, $request->session()->getId(), $product, null);

        return response()->noContent();
    }
}
