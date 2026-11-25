<?php

namespace App\Logging;

use App\Models\Order;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Monolog\Level;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;
use WeakMap;

final class PaymentLog
{
    /** @var WeakMap<Throwable, true>|null */
    private static ?WeakMap $handled = null;

    public static function attempt(): string
    {
        return (string) Str::uuid();
    }

    public static function checkout(string $ownerKey, string $idempotencyKey): string
    {
        return hash_hmac('sha256', 'checkout:'.$idempotencyKey, $ownerKey);
    }

    public static function order(Order $order): string
    {
        return self::checkout($order->owner_key, $order->idempotency_key);
    }

    public static function handled(Throwable $error): bool
    {
        return isset(self::$handled[$error]);
    }

    public static function failure(string $stage, string $correlationId, Throwable $error, ?int $orderId = null, ?string $reason = null): void
    {
        if (self::handled($error)) {
            return;
        }
        self::$handled ??= new WeakMap;
        self::$handled[$error] = true;

        $status = match (true) {
            $error instanceof ValidationException => 422,
            $error instanceof ModelNotFoundException => 404,
            $error instanceof HttpExceptionInterface => $error->getStatusCode(),
            default => null,
        };
        $expected = $reason === null && (($status >= 400 && $status < 500) || ($status === 503 && $stage === 'payment.start'));
        self::write(
            $expected ? Level::Warning : Level::Error,
            $stage.($expected ? '.rejected' : '.failed'),
            $correlationId,
            $orderId,
            $reason ?? ($expected ? 'http_'.$status : 'internal_error'),
            exceptionClass: $error::class,
        );
    }

    /** The stage, reason and states are application codes, never request/provider payloads. */
    public static function write(Level $level, string $stage, string $correlationId, ?int $orderId = null, ?string $reason = null,
        ?string $exceptionClass = null, ?string $previousStatus = null, ?string $status = null): void
    {
        $context = array_filter([
            'stage' => $stage,
            'correlation_id' => $correlationId,
            'order_id' => $orderId,
            'reason' => $reason,
            'exception_class' => $exceptionClass,
            'previous_status' => $previousStatus,
            'status' => $status,
        ], static fn (mixed $value): bool => $value !== null);

        // ponytail: telemetry failure must not change the checkout response or fall back to the default log.
        try {
            Log::channel('pagos')->getLogger()->log($level->toPsrLogLevel(), $stage, $context);
        } catch (Throwable) {
        }
    }
}
