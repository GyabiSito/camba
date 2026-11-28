<?php

namespace Tests\Feature\Orders;

use App\Actions\Notices\DeliverCommerceNotice;
use App\Actions\Notices\NoticeEligibility;
use App\Actions\Payments\ApplyPaymentEvidence;
use App\Mail\CommerceNoticeMail;
use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Models\Withdrawal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Mockery;
use Tests\TestCase;

class WithdrawalOwnerConfirmationTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkout_contact_cannot_authorize_linking_or_receive_a_copy_for_an_account_order(): void
    {
        [$order, $owner, $other, $admin] = $this->fixture();
        $wrong = $this->submit($order, $other->email);
        $right = $this->submit($order, strtoupper($owner->email));
        $this->assertSame(array_keys($wrong), array_keys($right));
        $this->assertSame($wrong, $this->submit($order, strtoupper($other->email)));
        $this->assertNull($this->loadCase($wrong)->order_id);
        $this->assertSame($order->id, $this->loadCase($right)->order_id);
        $this->assertSame(2, CommerceNotice::where('kind', CommerceNotice::ADMIN_WITHDRAWAL_RECEIVED)->count());
        $copy = CommerceNotice::where('kind', CommerceNotice::WITHDRAWAL_RECEIPT)->sole();
        app(DeliverCommerceNotice::class)->execute($copy->id);
        Mail::assertSent(CommerceNoticeMail::class, fn ($mail) => $mail->hasTo($owner->email));
        Mail::assertNotSent(CommerceNoticeMail::class, fn ($mail) => $mail->hasTo($other->email));
        $this->actingAs($admin, 'admin')->patchJson($this->adminPath($wrong), ['action' => 'link_order'])->assertConflict();
    }

    public function test_owner_must_post_an_unused_link_and_actual_refund_evidence_is_still_required(): void
    {
        [$order, $owner, $other, $admin] = $this->fixture();
        $receipt = $this->submit($order, $other->email);
        $path = $this->adminPath($receipt);
        $this->patchJson($path, ['action' => 'request_confirmation'])->assertUnauthorized();
        $this->actingAs($admin, 'admin')->patchJson($path, ['action' => 'review'])->assertOk()
            ->assertJsonPath('data.can_request_confirmation', true);
        $this->patchJson($path, ['action' => 'request_confirmation'])->assertOk()->assertJsonPath('data.order_matched', false);
        $this->patchJson($path, ['action' => 'request_confirmation'])->assertOk();
        $notice = CommerceNotice::where('kind', 'withdrawal_owner_confirmation')->sole();
        app(DeliverCommerceNotice::class)->execute($notice->id);
        $token = null;
        Mail::assertSent(CommerceNoticeMail::class, function ($mail) use ($owner, $other, $receipt, &$token) {
            $url = $mail->content()->with['actionUrl'] ?? '';
            $fragment = parse_url($url, PHP_URL_FRAGMENT);
            $token = is_string($fragment) ? $fragment : null;

            return $mail->hasTo($owner->email) && ! $mail->hasTo($other->email)
                && str_contains($url, '/arrepentimiento/confirmar/'.$receipt['reference'].'#') && $token;
        });
        $this->assertDatabaseMissing('withdrawals', ['confirmation_token' => $token]);
        Auth::guard('web')->forgetUser();
        Auth::forgetGuards();
        $confirm = '/api/v1/withdrawals/'.$receipt['reference'].'/confirmation';
        $this->getJson($confirm)->assertMethodNotAllowed();
        $this->assertNull($this->loadCase($receipt)->order_id);
        $this->postJson($confirm, ['token' => str_repeat('a', 64)])->assertGone();
        $this->postJson($confirm, ['token' => $token])->assertOk()->assertExactJson(['data' => $receipt]);
        $this->postJson($confirm, ['token' => $token])->assertGone();
        $case = $this->loadCase($receipt);
        $this->assertSame($order->getKey(), $case->order_id);
        $this->assertSame($other->email, $case->email);
        $this->assertSame($admin->getKey(), $case->confirmation_requested_by_admin_id);
        $this->assertNotNull($case->confirmation_confirmed_at);
        $this->assertNull($case->refund_confirmed_at);
        $this->actingAs($admin, 'admin')->patchJson($path, ['action' => 'confirm_refund'])->assertConflict();
        app(ApplyPaymentEvidence::class)->execute($order->reference, [[
            'id' => '12345678902', 'reference' => $order->reference, 'status' => 'refunded',
            'amount_cents' => $order->total_cents, 'refunded_cents' => $order->total_cents,
            'updated_at' => now()->format('Y-m-d\TH:i:s.v\Z'),
        ]]);
        $this->patchJson($path, ['action' => 'confirm_refund'])->assertOk()->assertJsonPath('data.status', 'refunded');
    }

    public function test_missing_or_unverified_account_does_not_fall_back_to_checkout_contact(): void
    {
        [$order, $owner, $other, $admin] = $this->fixture();
        $owner->forceFill(['email_verified_at' => null])->save();
        $case = $this->submit($order, $other->email);
        $this->assertNull($this->loadCase($case)->order_id);
        $this->actingAs($admin, 'admin')->patchJson($this->adminPath($case), ['action' => 'review'])->assertOk()
            ->assertJsonPath('data.can_request_confirmation', false);
        $this->patchJson($this->adminPath($case), ['action' => 'request_confirmation'])->assertConflict();
        $order->forceFill(['user_id' => null])->save();
        $afterAccountRemoval = $this->submit($order, $owner->email);
        $this->assertNull($this->loadCase($afterAccountRemoval)->order_id);
        $this->assertFalse(Withdrawal::purchaseMatches($order, $order->reference, $other->email));
        $this->assertDatabaseMissing('commerce_notices', ['kind' => CommerceNotice::WITHDRAWAL_RECEIPT]);
    }

    public function test_expired_generation_can_be_replaced_but_an_old_link_and_changed_owner_email_cannot_link(): void
    {
        [$order, $owner, $other, $admin] = $this->fixture();
        $receipt = $this->submit($order, $other->email);
        $path = $this->adminPath($receipt);
        $confirm = '/api/v1/withdrawals/'.$receipt['reference'].'/confirmation';
        $this->actingAs($admin, 'admin')->patchJson($path, ['action' => 'review'])->assertOk();
        $this->patchJson($path, ['action' => 'request_confirmation'])->assertOk();
        $first = $this->loadCase($receipt)->confirmation_token;
        $this->travel(31)->minutes();
        $this->postJson($confirm, ['token' => $first])->assertGone();
        $this->patchJson($path, ['action' => 'request_confirmation'])->assertOk();
        $replacement = $this->loadCase($receipt)->confirmation_token;
        $this->assertNotSame($first, $replacement);
        $this->postJson($confirm, ['token' => $first])->assertGone();
        $owner->forceFill(['email' => 'new-verified-address@camba.test'])->save();
        $this->postJson($confirm, ['token' => $replacement])->assertGone();
        $this->assertNull($this->loadCase($receipt)->order_id);
        foreach (CommerceNotice::where('kind', 'withdrawal_owner_confirmation')->pluck('id') as $id) {
            app(DeliverCommerceNotice::class)->execute($id);
        }
        Mail::assertNothingSent();
    }

    public function test_an_in_flight_notice_never_sends_a_replacement_link_to_the_previous_address(): void
    {
        [$order, $owner, $other, $admin] = $this->fixture();
        $receipt = $this->submit($order, $other->email);
        $path = $this->adminPath($receipt);
        $previousEmail = $owner->email;
        $this->actingAs($admin, 'admin')->patchJson($path, ['action' => 'review'])->assertOk();
        $this->patchJson($path, ['action' => 'request_confirmation'])->assertOk();
        $notice = CommerceNotice::where('kind', CommerceNotice::WITHDRAWAL_OWNER_CONFIRMATION)->sole();
        $previousToken = $this->loadCase($receipt)->confirmation_token;
        $snapshot = app(NoticeEligibility::class)->recipient($notice);

        $owner->forceFill(['email' => 'replacement-owner@camba.test'])->save();
        $this->patchJson($path, ['action' => 'request_confirmation'])->assertOk();
        $replacementToken = $this->loadCase($receipt)->confirmation_token;
        $this->assertNotSame($previousToken, $replacementToken);

        // A stale eligibility read must never be able to pair the former address with a newer token.
        $staleEligibility = Mockery::mock(NoticeEligibility::class);
        $staleEligibility->shouldReceive('recipient')->twice()->andReturn($snapshot);
        (new DeliverCommerceNotice($staleEligibility))->execute($notice->id);
        Mail::assertSent(CommerceNoticeMail::class, fn ($mail) => $mail->hasTo($previousEmail)
            && parse_url($mail->content()->with['actionUrl'], PHP_URL_FRAGMENT) === $previousToken);
        $confirm = '/api/v1/withdrawals/'.$receipt['reference'].'/confirmation';
        $this->postJson($confirm, ['token' => $previousToken])->assertGone();
        $this->assertNull($this->loadCase($receipt)->order_id);

        $replacement = CommerceNotice::where('kind', CommerceNotice::WITHDRAWAL_OWNER_CONFIRMATION)->whereKeyNot($notice->id)->sole();
        app(DeliverCommerceNotice::class)->execute($replacement->id);
        Mail::assertSent(CommerceNoticeMail::class, fn ($mail) => $mail->hasTo($owner->email)
            && parse_url($mail->content()->with['actionUrl'], PHP_URL_FRAGMENT) === $replacementToken);
        $this->postJson($confirm, ['token' => $replacementToken])->assertOk()->assertExactJson(['data' => $receipt]);
    }

    private function fixture(): array
    {
        Mail::fake();
        config(['app.url' => 'https://store.camba.test', 'app.admin_url' => 'https://admin.camba.test']);
        $path = sys_get_temp_dir().'/camba-owner-confirmation-'.Str::uuid();
        config(['logging.channels.refunds.handler_with.directory' => $path, 'logging.channels.refounds.handler_with.directory' => $path]);
        $this->beforeApplicationDestroyed(fn () => File::deleteDirectory($path));
        $owner = User::factory()->create(['role' => 'buyer']);
        $other = User::factory()->create(['role' => 'buyer']);
        $admin = $this->adminIdentity();
        $order = Order::forceCreate([
            'user_id' => $owner->id, 'owner_key' => Order::ownerKey($owner->id, ''),
            'reference' => (string) Str::uuid(), 'idempotency_key' => (string) Str::uuid(), 'request_hash' => hash('sha256', 'owner-confirmation'),
            'status' => 'paid', 'paid_at' => now()->subDay(), 'paid_provider_payment_id' => '12345678902',
            'currency' => 'UYU', 'subtotal_cents' => 45100, 'shipping_cents' => 0, 'total_cents' => 45100,
            'shipping_method' => 'pickup', 'contact' => ['email' => $other->email], 'reservation_expires_at' => now(),
        ]);
        Payment::forceCreate(['order_id' => $order->id, 'provider_payment_id' => '12345678902',
            'amount_cents' => 45100, 'status' => 'approved', 'provider_updated_at' => now()->subDay()->format('Y-m-d\TH:i:s.v\Z')]);

        return [$order, $owner, $other, $admin];
    }

    private function submit(Order $order, string $email): array
    {
        return $this->postJson('/api/v1/withdrawals', ['order_reference' => $order->reference, 'email' => $email])
            ->assertCreated()->json('data');
    }

    private function adminPath(array $receipt): string
    {
        return '/api/v1/admin/withdrawals/'.$receipt['reference'];
    }

    private function loadCase(array $receipt): Withdrawal
    {
        return Withdrawal::where('reference', $receipt['reference'])->sole();
    }
}
