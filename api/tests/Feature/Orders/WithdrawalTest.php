<?php

namespace Tests\Feature\Orders;

use App\Actions\Notices\DeliverCommerceNotice;
use App\Mail\CommerceNoticeMail;
use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\User;
use App\Models\Withdrawal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Tests\TestCase;

class WithdrawalTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_request_notifies_the_bound_admin_once_and_opens_the_exact_case(): void
    {
        config(['app.admin_url' => 'https://admin.camba.test']);
        $this->travelTo(Carbon::parse('2026-11-27 01:07:00 UTC'));
        Mail::fake();
        $admin = $this->adminIdentity();
        $linked = $this->orderForReceipt('comprador@camba.test');
        $input = ['order_reference' => $linked->reference, 'email' => 'no-coincide@camba.test'];

        $first = $this->postJson('/api/v1/withdrawals', $input)->assertCreated();
        $reference = $first->json('data.reference');
        $this->postJson('/api/v1/withdrawals', $input)->assertCreated()->assertExactJson($first->json());
        $matched = $this->postJson('/api/v1/withdrawals', [...$input, 'email' => 'COMPRADOR@CAMBA.TEST'])->assertCreated();
        $linkedCase = $matched->json('data.reference');
        $this->assertSame(array_keys($matched->json('data')), array_keys($first->json('data')));

        $this->assertDatabaseCount('withdrawals', 2);
        $this->assertDatabaseCount('commerce_notices', 3);
        foreach (CommerceNotice::query()->pluck('id') as $id) {
            app(DeliverCommerceNotice::class)->execute($id);
            app(DeliverCommerceNotice::class)->execute($id);
        }

        $cta = "https://admin.camba.test/pedidos/arrepentimientos?solicitud=$reference";
        Mail::assertSent(CommerceNoticeMail::class, fn ($mail) => $mail->hasTo($admin->email)
            && $mail->envelope()->subject === 'Nueva solicitud de arrepentimiento'
            && str_contains($mail->render(), $cta)
            && str_contains($mail->render(), '26/11/2026, 22:07 (Uruguay)')
            && str_contains($mail->render(), 'Todavía no está vinculado')
            && ! str_contains($mail->render(), $input['order_reference']));
        Mail::assertSent(CommerceNoticeMail::class, fn ($mail) => $mail->hasTo($admin->email)
            && $mail->envelope()->subject === 'Nueva solicitud de arrepentimiento'
            && str_contains($mail->render(), $linkedCase)
            && str_contains($mail->render(), $linked->reference));
        Mail::assertSent(CommerceNoticeMail::class, fn ($mail) => $mail->hasTo('comprador@camba.test')
            && $mail->kind === CommerceNotice::WITHDRAWAL_RECEIPT && str_contains($mail->render(), $linkedCase));
        Mail::assertNotSent(CommerceNoticeMail::class, fn ($mail) => $mail->hasTo($input['email']));
        Mail::assertSentCount(3);

        $path = '/api/v1/admin/withdrawals?reference='.$reference;
        $this->getJson($path)->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => 'buyer']))->getJson($path)->assertUnauthorized();
        $this->actingAs($admin, 'admin')->getJson($path)->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference', $reference)->assertJsonPath('data.0.order_matched', false);
        $casePath = '/api/v1/admin/withdrawals/'.$reference;
        $this->patchJson($casePath, ['action' => 'review'])->assertOk();
        $this->patchJson($casePath, ['action' => 'link_order'])->assertConflict();
        $this->patchJson($casePath, ['action' => 'confirm_refund'])->assertConflict();
        $case = Withdrawal::query()->where('reference', $reference)->sole();
        $this->assertNull($case->order_id);

        // Legacy data may already have a manual link and a pending, wrongly addressed copy.
        $case->forceFill(['order_id' => $linked->id])->save();
        $legacy = CommerceNotice::query()->create([
            'dedup_key' => 'legacy-unverified-withdrawal-copy', 'channel' => 'mail',
            'kind' => CommerceNotice::WITHDRAWAL_RECEIPT, 'subject_type' => 'withdrawal', 'subject_id' => $case->id,
            'source_at' => now(), 'available_at' => now(), 'state' => 'pending',
        ]);
        app(DeliverCommerceNotice::class)->execute($legacy->id);
        $this->assertSame('cancelled', $legacy->fresh()->state);
        Mail::assertSentCount(3);
        $this->getJson($path)->assertJsonPath('data.0.order_matched', false);
        $this->patchJson($casePath, ['action' => 'confirm_refund'])->assertConflict();
    }

    public function test_admin_address_change_does_not_redirect_the_notice_or_cancel_the_buyer_receipt(): void
    {
        config(['app.admin_url' => 'https://admin.camba.test']);
        Mail::fake();
        $admin = $this->adminIdentity();
        $order = $this->orderForReceipt('probe-buyer@camba.test');
        $this->postJson('/api/v1/withdrawals', [
            'order_reference' => $order->reference,
            'email' => 'probe-buyer@camba.test',
        ])->assertCreated();

        $admin->forceFill(['email' => 'changed@camba.test'])->save();
        foreach (CommerceNotice::query()->pluck('id') as $id) {
            app(DeliverCommerceNotice::class)->execute($id);
        }

        Mail::assertSentCount(1);
        Mail::assertSent(CommerceNoticeMail::class, fn ($mail) => $mail->kind === CommerceNotice::WITHDRAWAL_RECEIPT
            && $mail->hasTo('probe-buyer@camba.test'));
        $this->assertDatabaseHas('commerce_notices', [
            'kind' => CommerceNotice::ADMIN_WITHDRAWAL_RECEIVED,
            'state' => 'cancelled',
            'error_code' => 'no_longer_eligible',
        ]);
    }

    public function test_public_request_is_registered_once_and_receipt_does_not_disclose_order_data(): void
    {
        Mail::fake();
        $input = ['order_reference' => (string) Str::uuid(), 'email' => 'solicitud@camba.test'];

        $first = $this->postJson('/api/v1/withdrawals', $input)
            ->assertCreated()->assertJsonStructure(['data' => ['reference', 'received_at']])
            ->assertJsonMissingPath('data.order');
        $this->postJson('/api/v1/withdrawals', [...$input, 'email' => 'SOLICITUD@CAMBA.TEST'])
            ->assertCreated()->assertExactJson($first->json());

        $this->assertDatabaseCount('withdrawals', 1);
        $this->assertDatabaseMissing('withdrawals', ['email' => $input['email']]);
        $this->assertDatabaseHas('commerce_notices', [
            'kind' => CommerceNotice::ADMIN_WITHDRAWAL_RECEIVED, 'state' => 'cancelled', 'error_code' => 'no_eligible_admin',
        ]);
        $this->assertDatabaseMissing('commerce_notices', ['kind' => CommerceNotice::WITHDRAWAL_RECEIPT]);
        Mail::assertNothingSent();

        $this->getJson('/api/v1/admin/withdrawals')->assertUnauthorized();
        $admin = $this->adminIdentity();
        $this->actingAs($admin, 'admin')->getJson('/api/v1/admin/withdrawals')->assertOk()
            ->assertJsonPath('data.0.reference', $first->json('data.reference'))
            ->assertJsonPath('data.0.order_matched', false);
        $path = '/api/v1/admin/withdrawals/'.$first->json('data.reference');
        $this->patchJson($path, ['action' => 'confirm_refund'])->assertConflict();
        $this->patchJson($path, ['action' => 'review'])->assertOk()->assertJsonPath('data.status', 'reviewing');
        $this->patchJson($path, ['action' => 'link_order'])->assertConflict();
        $this->patchJson($path, ['action' => 'close'])->assertOk()->assertJsonPath('data.status', 'closed');
        $this->assertDatabaseMissing('commerce_notices', ['kind' => CommerceNotice::BUYER_WITHDRAWAL_RESOLVED]);
        $this->patchJson($path, ['action' => 'review'])->assertConflict();
    }

    public function test_withdrawal_quotas_are_isolated_by_connection(): void
    {
        $limit = RateLimiter::limiter('withdrawal');
        $keys = fn (string $ip): array => array_column($limit(Request::create(
            '/api/v1/withdrawals', 'POST', ['email' => 'solicitud@camba.test'], server: ['REMOTE_ADDR' => $ip],
        )), 'key');

        $this->assertSame([], array_intersect($keys('192.0.2.11'), $keys('192.0.2.12')));
    }

    public function test_replaying_an_unlinked_request_does_not_enable_a_legacy_pending_copy(): void
    {
        Mail::fake();
        $input = ['order_reference' => (string) Str::uuid(), 'email' => 'later@camba.test'];
        $first = $this->postJson('/api/v1/withdrawals', $input)->assertCreated();
        $case = Withdrawal::query()->where('reference', $first->json('data.reference'))->sole();
        $notice = CommerceNotice::query()->create([
            'dedup_key' => 'legacy-unlinked-withdrawal-copy', 'channel' => 'mail',
            'kind' => CommerceNotice::WITHDRAWAL_RECEIPT, 'subject_type' => 'withdrawal', 'subject_id' => $case->id,
            'source_at' => now(), 'available_at' => now(), 'state' => 'pending',
        ]);
        $this->orderForReceipt($input['email'])->forceFill(['reference' => $input['order_reference']])->save();
        $this->postJson('/api/v1/withdrawals', $input)->assertCreated()->assertExactJson($first->json());
        $this->assertNull($case->fresh()->order_id);
        $this->assertSame(1, CommerceNotice::query()->where('kind', CommerceNotice::WITHDRAWAL_RECEIPT)->count());

        app(DeliverCommerceNotice::class)->execute($notice->id);
        $this->assertSame('cancelled', $notice->fresh()->state);
        Mail::assertNothingSent();
    }

    public function test_purchase_terms_publish_the_same_rule_for_current_and_versioned_links(): void
    {
        $terms = $this->getJson('/api/v1/purchase-terms')->assertOk();
        $this->assertStringContainsString('5 días hábiles', $terms->json('data.withdrawal'));
        $this->assertStringContainsString('10 días corridos', $terms->json('data.withdrawal'));
        $this->getJson('/api/v1/purchase-terms/'.$terms->json('data.version'))->assertExactJson($terms->json());
    }

    public function test_archived_terms_content_does_not_change_with_later_versions(): void
    {
        $archived = $this->getJson('/api/v1/purchase-terms/2026-11-27')->assertOk()->json('data');
        $this->assertSame('f483635c180e8fc70ac7e35fc5068196604c774c6bb71f010d3d63b1742a4ed3', hash('sha256',
            json_encode($archived, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)));
    }

    private function orderForReceipt(string $email): Order
    {
        return Order::forceCreate([
            'reference' => (string) Str::uuid(), 'owner_key' => Order::ownerKey(null, 'withdrawal-test'),
            'idempotency_key' => (string) Str::uuid(), 'request_hash' => hash('sha256', 'withdrawal-test'),
            'status' => 'pending_payment', 'currency' => 'UYU', 'subtotal_cents' => 100,
            'shipping_cents' => 0, 'total_cents' => 100, 'shipping_method' => 'pickup',
            'contact' => ['email' => $email], 'reservation_expires_at' => now(),
        ]);
    }
}
