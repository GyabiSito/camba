<?php

namespace Tests\Feature\Payments;

use App\Actions\Payments\ApplyPaymentEvidence;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class BuyerPaymentStateTest extends TestCase
{
    use RefreshDatabase;

    public function test_owned_order_distinguishes_verified_rejection_and_pending_without_disclosing_payment_records(): void
    {
        $buyer = User::factory()->create();
        $order = Order::forceCreate([
            'reference' => (string) Str::uuid(), 'user_id' => $buyer->id,
            'owner_key' => Order::ownerKey($buyer->id, ''), 'idempotency_key' => (string) Str::uuid(),
            'request_hash' => str_repeat('a', 64), 'status' => 'pending_payment', 'currency' => 'UYU',
            'subtotal_cents' => 123400, 'shipping_cents' => 0, 'total_cents' => 123400,
            'shipping_method' => 'pickup', 'contact' => [], 'reservation_expires_at' => now()->addMinutes(15),
        ]);
        $this->actingAs($buyer, 'web')->withCredentials()->withHeader('Origin', 'http://localhost');
        $read = fn () => $this->getJson('/api/v1/orders/'.$order->reference.'?status=approved')->assertOk();
        $read()->assertJsonStructure(['data' => ['payment_state']])->assertJsonPath('data.payment_state', null);

        $apply = fn (string $id, string $status, string $time) => app(ApplyPaymentEvidence::class)->execute($order->reference, [[
            'id' => $id, 'reference' => $order->reference, 'amount_cents' => $order->total_cents,
            'status' => $status, 'updated_at' => "2026-11-25T17:$time:00.000Z",
        ]]);
        $apply('999888777001', 'rejected', '01');
        $read()->assertJsonPath('data.payment_state', 'rejected')->assertDontSee('999888777001');
        $previousRejection = $read()->json('data.payment_rejection');
        $this->assertMatchesRegularExpression('/\A[0-9a-f]{64}\z/', (string) $previousRejection);
        $this->assertSame($previousRejection, $read()->json('data.payment_rejection'));

        $apply('999888777002', 'rejected', '02');
        $this->assertNotSame($previousRejection, $read()->json('data.payment_rejection'));

        $apply('999888777003', 'pending', '03');
        $apply('999888777001', 'cancelled', '04');
        $read()->assertJsonPath('data.status', 'pending_payment')->assertJsonPath('data.payment_state', 'pending');

        $apply('999888777003', 'approved', '05');
        $read()->assertJsonPath('data.status', 'paid')->assertJsonPath('data.payment_state', null);

        $this->actingAs(User::factory()->create(), 'web')
            ->getJson('/api/v1/orders/'.$order->reference)->assertNotFound();
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web')
            ->getJson('/api/v1/admin/orders/'.$order->reference)->assertOk()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('payment.observations.0.status', 'approved');
    }
}
