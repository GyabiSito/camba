<?php

namespace Tests\Feature\Orders;

use App\Actions\Notices\DeliverCommerceNotice;
use App\Mail\CommerceNoticeMail;
use App\Models\CommerceNotice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class WithdrawalTest extends TestCase
{
    use RefreshDatabase;

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
        $notice = CommerceNotice::query()->where('kind', 'withdrawal_receipt')->sole();
        app(DeliverCommerceNotice::class)->execute($notice->id);
        app(DeliverCommerceNotice::class)->execute($notice->id);
        Mail::assertSent(CommerceNoticeMail::class, fn ($mail) => $mail->hasTo($input['email'])
            && $mail->kind === 'withdrawal_receipt'
            && str_contains($mail->render(), $first->json('data.reference')));
        Mail::assertSentCount(1);

        $this->getJson('/api/v1/admin/withdrawals')->assertUnauthorized();
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->getJson('/api/v1/admin/withdrawals')->assertOk()
            ->assertJsonPath('data.0.reference', $first->json('data.reference'))
            ->assertJsonPath('data.0.order_matched', false);
        $path = '/api/v1/admin/withdrawals/'.$first->json('data.reference');
        $this->patchJson($path, ['action' => 'confirm_refund'])->assertConflict();
        $this->patchJson($path, ['action' => 'review'])->assertOk()->assertJsonPath('data.status', 'reviewing');
        $this->patchJson($path, ['action' => 'close'])->assertOk()->assertJsonPath('data.status', 'closed');
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
}
