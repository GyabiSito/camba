<?php

namespace App\Http\Controllers\Admin;

use App\Http\Resources\Account\AddressResource;
use App\Models\Address;
use App\Models\Order;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;

class CustomerController
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate(['q' => ['nullable', 'string', 'max:120']]);
        $query = User::query()->buyers();
        $search = trim($filters['q'] ?? '');
        if ($search !== '') {
            $escape = fn (string $value): string => '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $value).'%';
            $foldedPattern = $escape(mb_strtolower($search));
            $namePattern = $foldedPattern;
            $namePredicate = "LOWER(name) LIKE ? ESCAPE '!'";
            $connection = $query->getConnection();
            if ($connection->getDriverName() === 'sqlite') {
                $connection->getReadPdo()->sqliteCreateFunction('camba_unicode_lower', mb_strtolower(...), 1, \PDO::SQLITE_DETERMINISTIC);
                $namePredicate = "camba_unicode_lower(name) LIKE ? ESCAPE '!'";
            } elseif ($connection->getDriverName() === 'pgsql') {
                $namePredicate = "LOWER(name COLLATE pg_catalog.pg_unicode_fast) LIKE LOWER(? COLLATE pg_catalog.pg_unicode_fast) ESCAPE '!'";
                $namePattern = $escape($search);
            }

            $query->where(fn ($fields) => $fields
                ->whereRaw($namePredicate, [$namePattern])
                ->orWhereRaw("LOWER(email) LIKE ? ESCAPE '!'", [$foldedPattern]));
        }

        return $this->page($query->select(['id', 'name', 'email', 'email_verified_at', 'created_at'])
            ->withCount('orders')->withMax('orders', 'created_at')
            ->orderByRaw('created_at IS NULL')->latest('created_at')->latest('id')->paginate(25)
            ->through(fn (User $buyer) => [
                'id' => $buyer->id,
                ...$this->account($buyer),
                'orders_count' => $buyer->orders_count,
                'last_order_at' => $buyer->orders_max_created_at === null ? null
                    : CarbonImmutable::parse($buyer->orders_max_created_at, 'UTC')->toISOString(),
            ]));
    }

    public function show(Request $request, string $customer): JsonResponse
    {
        $buyer = $this->buyer($customer);
        $addresses = Address::query()->whereBelongsTo($buyer, 'user')
            ->with('geographicLocality.department')->latest('id')->get();

        return response()->json(['data' => [
            ...$this->account($buyer),
            'addresses' => $addresses->map(fn (Address $address) => Arr::only(
                (new AddressResource($address))->resolve($request),
                ['id', 'recipient', 'department', 'locality', 'street', 'number', 'details', 'postal_code'],
            )),
        ]])->header('Cache-Control', 'private, no-store');
    }

    public function orders(string $customer): JsonResponse
    {
        return $this->page($this->buyer($customer)->orders()
            ->latest('created_at')->latest('id')
            ->paginate(25, ['reference', 'created_at', 'total_cents', 'status', 'shipping_method'])
            ->through(fn (Order $order) => [
                'reference' => $order->reference,
                'created_at' => $order->created_at->toISOString(),
                'total_cents' => $order->total_cents,
                'status' => $order->status->value,
                'shipping_method' => $order->shipping_method,
            ]));
    }

    private function buyer(string $customer): User
    {
        $id = filter_var($customer, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        abort_if($id === false, 404);

        return User::query()->buyers()->findOrFail($id, ['id', 'name', 'email', 'email_verified_at', 'created_at']);
    }

    private function account(User $buyer): array
    {
        return [
            'name' => $buyer->name,
            'email' => $buyer->email,
            'email_verified' => $buyer->hasVerifiedEmail(),
            'created_at' => $buyer->created_at?->toISOString(),
        ];
    }

    private function page(LengthAwarePaginator $page): JsonResponse
    {
        return response()->json(['data' => $page->items(), 'meta' => [
            'total' => $page->total(), 'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(),
        ]])->header('Cache-Control', 'private, no-store');
    }
}
