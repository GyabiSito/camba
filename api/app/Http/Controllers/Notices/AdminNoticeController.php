<?php

namespace App\Http\Controllers\Notices;

use App\Http\Resources\Notices\CommerceNoticeResource;
use App\Models\CommerceNotice;
use App\Models\Order;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminNoticeController
{
    private const TITLES = [
        'order_created' => 'Pedido recibido',
        'order_paid' => 'Pago aprobado',
        'low_stock' => 'Stock bajo',
        'payment_issue' => 'Incidencia de pago',
        'paid_overdue' => 'Pedido demorado',
        'order_shipped' => 'Aviso de envío',
        'order_delivered' => 'Aviso de entrega',
        'admin_order_created' => 'Aviso de pedido nuevo a administración',
        'order_ready_for_pickup' => 'Aviso de retiro',
        'payment_reminder' => 'Recordatorio de pago',
        'cart_reminder' => 'Recordatorio de carrito',
        'import_completed' => 'Carga finalizada',
        'import_completed_with_errors' => 'Carga finalizada con errores',
        'import_stalled' => 'Carga demorada',
    ];

    public function __invoke(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'state' => ['sometimes', 'in:active,resolved,failed,uncertain'],
            'kind' => ['sometimes', Rule::in(array_keys(self::TITLES))],
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d', ...($request->filled('date_from') ? ['after_or_equal:date_from'] : [])],
            'page' => ['sometimes', 'integer', 'min:1', 'max:2147483647'],
        ]);
        $query = CommerceNotice::query()
            ->where('kind', '!=', CommerceNotice::BUYER_WELCOME)
            ->where(fn ($query) => $query->where('channel', 'panel')
                ->orWhere(fn ($query) => $query->where('channel', 'mail')->whereIn('state', ['failed', 'uncertain'])))
            ->when($filters['state'] ?? null, fn ($query, $state) => $query->where('state', $state))
            ->when($filters['kind'] ?? null, fn ($query, $kind) => $query->where('kind', $kind));
        $timezone = config('store.timezone');
        if (isset($filters['date_from'])) {
            $query->where('updated_at', '>=', CarbonImmutable::createFromFormat('!Y-m-d', $filters['date_from'], $timezone)->utc());
        }
        if (isset($filters['date_to'])) {
            $query->where('updated_at', '<', CarbonImmutable::createFromFormat('!Y-m-d', $filters['date_to'], $timezone)->addDay()->utc());
        }
        $search = trim($filters['q'] ?? '');
        if ($search !== '') {
            $needle = strtolower(Str::ascii($search));
            $needle === '' ? $query->whereIn('kind', []) : $query->where(fn (Builder $matches) => $this->matchNotice($matches, $needle));
        }
        $notices = $query->orderByDesc('updated_at')->orderByDesc('id')->paginate(25)->appends($filters);

        $orderIds = $notices->getCollection()->where('subject_type', 'order')->pluck('subject_id');
        $references = Order::query()->whereKey($orderIds->all())->pluck('reference', 'id');
        $notices->through(fn (CommerceNotice $notice) => $notice->setAttribute('order_reference',
            $notice->subject_type === 'order' ? $references->get($notice->subject_id) : null));

        return CommerceNoticeResource::collection($notices)->additional(['kinds' => self::TITLES])
            ->response()->header('Cache-Control', 'private, no-store');
    }

    private function matchNotice(Builder $matches, string $search): void
    {
        $matchedKinds = array_filter(self::TITLES, fn (string $title) => str_contains(strtolower(Str::ascii($title)), $search));
        $matches->whereIn('kind', array_keys($matchedKinds));
        if (str_contains('aviso operativo', $search)) {
            $matches->orWhereNotIn('kind', array_keys(self::TITLES));
        }
        if (preg_match('/\A[0-9a-f]{8}(?:-[0-9a-f-]{0,27})?\z/', $search)) {
            $cast = in_array($matches->getConnection()->getDriverName(), ['mysql', 'mariadb'], true) ? 'CHAR' : 'TEXT';
            $orders = Order::query()->select('id')->whereRaw("LOWER(CAST(reference AS {$cast})) LIKE ?", [$search.'%']);
            $matches->orWhere(fn (Builder $ref) => $ref->where('subject_type', 'order')->whereIn('subject_id', $orders));
        }
        if (preg_match('/\A[0-9]+\z/', $search) && ($id = filter_var($search, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]))) {
            $matches->orWhere(fn (Builder $ref) => $ref->whereIn('subject_type', ['product', 'import'])->where('subject_id', $id));
        }
    }
}
