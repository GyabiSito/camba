<?php

namespace Tests\Feature\Notices;

use App\Jobs\SendCommerceNotice;
use App\Mail\CommerceNoticeMail;
use App\Models\Cart;
use App\Models\CatalogImport;
use App\Models\Category;
use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\Product;
use App\Models\StoreSettings;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\Feature\TestDatabase;
use Tests\TestCase;

class CommerceNoticeTest extends TestCase
{
    use RefreshDatabase;

    private const PREFERENCES = '/api/v1/account/reminder-preferences';

    private const ADMIN = '/api/v1/admin/notices';

    protected function beforeRefreshingDatabase(): void
    {
        TestDatabase::assertIsolated($this);
    }

    public function test_only_a_verified_buyer_can_change_their_own_opt_in(): void
    {
        $this->getJson(self::PREFERENCES)->assertUnauthorized();
        $this->signIn(User::factory()->unverified()->create());
        $this->patchJson(self::PREFERENCES, ['cart_reminders' => true])->assertForbidden();
        $this->signIn(User::factory()->create());
        $this->getJson(self::PREFERENCES)->assertOk()->assertJsonPath('data.cart_reminders', false)->assertJsonPath('data.payment_reminders', false);
        $this->patchJson(self::PREFERENCES, ['cart_reminders' => 'true'])->assertUnprocessable();
        $this->patchJson(self::PREFERENCES, ['user_id' => 99])->assertUnprocessable();
        $this->patchJson(self::PREFERENCES, ['cart_reminders' => true])->assertOk()
            ->assertJsonPath('data.cart_reminders', true)->assertJsonPath('data.payment_reminders', false);
        $this->signIn(User::factory()->create());
        $this->getJson(self::PREFERENCES)->assertOk()->assertJsonPath('data.cart_reminders', false);
        $this->getJson(self::ADMIN)->assertForbidden();
    }

    public function test_admin_commerce_feed_does_not_expose_welcome_records(): void
    {
        $buyer = User::factory()->create();
        CommerceNotice::create([
            'dedup_key' => 'test:mail:buyer_welcome:'.$buyer->id,
            'channel' => 'mail',
            'kind' => CommerceNotice::BUYER_WELCOME,
            'subject_type' => 'user',
            'subject_id' => $buyer->id,
            'state' => 'uncertain',
        ]);
        $this->signIn(User::factory()->create(['role' => 'admin']));
        $this->getJson(self::ADMIN.'?state=uncertain')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_admin_filters_the_entire_notice_table_before_paginating(): void
    {
        $this->signIn(User::factory()->create(['role' => 'admin']));
        $order = $this->order(null);
        $target = CommerceNotice::create([
            'dedup_key' => 'notice-table:target', 'channel' => 'panel', 'kind' => 'order_created',
            'subject_type' => 'order', 'subject_id' => $order->id, 'state' => 'active', 'updated_at' => '2026-04-09 03:00:00',
        ]);
        $payment = CommerceNotice::create([
            'dedup_key' => 'notice-table:payment', 'channel' => 'panel', 'kind' => 'order_paid',
            'subject_type' => 'order', 'subject_id' => $order->id, 'state' => 'resolved', 'updated_at' => '2026-04-10 03:00:00',
        ]);
        for ($i = 1; $i <= 24; $i++) {
            CommerceNotice::create([
                'dedup_key' => 'notice-table:stock:'.$i, 'channel' => 'panel', 'kind' => 'low_stock',
                'subject_type' => 'product', 'subject_id' => $i, 'state' => 'active', 'updated_at' => '2026-04-09 12:00:00',
            ]);
        }

        $this->getJson(self::ADMIN)->assertOk()->assertJsonPath('meta.total', 26)
            ->assertJsonPath('data.0.id', $payment->id)->assertJsonMissing(['id' => $target->id]);
        $this->getJson(self::ADMIN.'?page=2')->assertOk()->assertJsonPath('data.0.id', $target->id);

        $short = strtoupper(substr($order->reference, 0, 8));
        $this->getJson(self::ADMIN.'?q='.$short)->assertOk()->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.1.id', $target->id);
        $this->getJson(self::ADMIN.'?q='.rawurlencode('PÁGO APROBADO'))->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $payment->id)->assertJsonPath('kinds.order_paid', 'Pago aprobado');
        $this->getJson(self::ADMIN.'?q='.$short.'&state=active&kind=order_created&date_from=2026-04-09&date_to=2026-04-09')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.order_reference', $order->reference);
        $this->getJson(self::ADMIN.'?kind=order_paid&date_to=2026-04-09')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson(self::ADMIN.'?date_from=2026-04-10&date_to=2026-04-09')->assertUnprocessable();
    }

    public function test_committed_orders_and_operational_events_project_once_and_hide_personal_data(): void
    {
        Queue::fake();
        Mail::fake();
        $admin = User::factory()->create(['role' => 'admin']);
        $buyer = User::factory()->create(['email' => 'verified-buyer@example.test']);
        $order = $this->order($buyer, [
            'status' => 'paid', 'paid_at' => now()->subDays(2),
            'payment_issues' => ['multiple_approved_payments', 'provider_evidence_mismatch', 'late_approval_without_stock'],
        ]);
        $product = $this->product(1);
        CatalogImport::create(['sha256' => str_repeat('a', 64), 'uploaded_by' => $admin->id, 'completed_at' => now()]);
        $this->project();
        $this->project();

        $this->assertDatabaseCount('commerce_notices', 10);
        foreach (CommerceNotice::query()->where('channel', 'mail')->pluck('id') as $id) {
            $this->deliver($id);
            $this->deliver($id);
        }
        Mail::assertSentCount(2);
        Mail::assertSent(CommerceNoticeMail::class, fn ($message) => $message->hasTo($buyer->email) && $message->kind === 'order_paid');
        $this->assertSame('paid', $order->fresh()->getRawOriginal('status'));

        $this->signIn($admin);
        $entries = $this->getJson(self::ADMIN)->assertOk()->assertJsonCount(8, 'data')
            ->assertDontSee('verified-buyer@example.test')->assertDontSee('unverified-checkout@example.test');
        $notices = collect($entries->json('data'))->keyBy('kind');
        $this->assertSame($order->reference, $notices['payment_issue']['order_reference']);
        $this->assertNull($notices['low_stock']['order_reference']);
        $this->assertSame($order->reference, $notices['paid_overdue']['order_reference']);
        $product->update(['stock' => 10]);
        $this->project();
        $this->assertDatabaseHas('commerce_notices', ['kind' => 'low_stock', 'state' => 'resolved']);
        $product->update(['stock' => 1]);
        $this->project();
        $this->assertDatabaseHas('commerce_notices', ['kind' => 'low_stock', 'state' => 'active']);
        $this->assertSame(1, CommerceNotice::where('kind', 'low_stock')->count());
    }

    public function test_reminders_recheck_pending_state_expiry_cart_revision_and_opt_out_before_send(): void
    {
        Queue::fake();
        Mail::fake();
        $this->settings(['remind_payment' => true, 'remind_cart' => true]);
        $buyer = User::factory()->create();
        $this->signIn($buyer);
        $this->patchJson(self::PREFERENCES, ['payment_reminders' => true, 'cart_reminders' => true])->assertOk();
        $approved = $this->order($buyer);
        $expired = $this->order($buyer);
        $valid = $this->order($buyer, ['reservation_expires_at' => now()->addMinutes(9)]);
        $cart = $this->cart($buyer);
        $this->cart(null);

        $this->project();
        $this->assertSame(3, CommerceNotice::where('kind', 'payment_reminder')->count());
        $this->assertSame(1, CommerceNotice::where('kind', 'cart_reminder')->count());
        $approved->forceFill(['status' => 'paid', 'paid_at' => now()])->save();
        $expired->forceFill(['reservation_expires_at' => now()->subSecond()])->save();
        $cart->items()->update(['quantity' => 2]);
        $this->deliver(CommerceNotice::where('kind', 'cart_reminder')->value('id'));
        foreach (CommerceNotice::where('kind', 'payment_reminder')->pluck('id') as $id) {
            $this->deliver($id);
        }
        Mail::assertSentCount(1);
        Mail::assertSent(CommerceNoticeMail::class, fn ($message) => $message->kind === 'payment_reminder');
        $this->assertDatabaseHas('commerce_notices', ['kind' => 'payment_reminder', 'subject_id' => $valid->id, 'state' => 'sent']);
        $this->assertSame(3, CommerceNotice::where('state', 'cancelled')->count());

        $next = $this->order($buyer);
        $this->project();
        $this->patchJson(self::PREFERENCES, ['payment_reminders' => false])->assertOk();
        $this->deliver(CommerceNotice::where('kind', 'payment_reminder')->where('subject_id', $next->id)->value('id'));
        Mail::assertSentCount(1);
        $this->assertDatabaseHas('commerce_notices', ['kind' => 'payment_reminder', 'subject_id' => $next->id, 'state' => 'cancelled']);
    }

    public function test_preparation_failure_retries_but_unknown_transport_acceptance_does_not(): void
    {
        Queue::fake();
        $order = $this->order(null, ['status' => 'paid', 'paid_at' => now()]);
        $this->project();
        $id = CommerceNotice::where('channel', 'mail')->where('kind', 'order_paid')->value('id');
        $originalMail = Mail::getFacadeRoot();
        Mail::shouldReceive('mailer')->once()->andThrow(new RuntimeException('sensitive preflight detail'));
        try {
            $this->deliver($id);
            $this->deliver($id);
        } finally {
            Mail::swap($originalMail);
        }
        $this->assertDatabaseHas('commerce_notices', ['id' => $id, 'state' => 'pending', 'attempts' => 1, 'error_code' => 'preparation_failed']);
        $this->travel(10)->minutes();
        Mail::shouldReceive('mailer->to->send')->once()->andThrow(new RuntimeException('sensitive lost ACK'));
        $this->deliver($id);
        $this->project();
        $this->deliver($id);
        $this->assertDatabaseHas('commerce_notices', ['id' => $id, 'state' => 'uncertain', 'attempts' => 2, 'error_code' => 'smtp_acceptance_unknown']);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'paid']);
    }

    public function test_cart_reminders_require_opt_in_and_do_not_repeat_within_a_week(): void
    {
        Queue::fake();
        Mail::fake();
        $buyer = User::factory()->create();
        $this->signIn($buyer);
        $this->settings(['remind_cart' => true]);
        $cart = $this->cart($buyer);
        $this->project();
        $this->assertDatabaseMissing('commerce_notices', ['kind' => 'cart_reminder']);
        $this->patchJson(self::PREFERENCES, ['cart_reminders' => true])->assertOk();
        $this->project();
        $first = CommerceNotice::where('kind', 'cart_reminder')->value('id');
        $this->deliver($first);

        $cart->forceFill(['updated_at' => now()->subHours(25)])->save();
        $this->project();
        $second = CommerceNotice::where('kind', 'cart_reminder')->where('id', '!=', $first)->value('id');
        $this->deliver($second);
        Mail::assertSentCount(1);
        Mail::assertSent(CommerceNoticeMail::class, fn ($message) => $message->kind === 'cart_reminder' && $message->hasTo($buyer->email));
        $this->assertDatabaseHas('commerce_notices', ['id' => $second, 'state' => 'cancelled']);
    }

    public function test_interrupted_in_flight_send_becomes_uncertain_without_a_retry(): void
    {
        Queue::fake();
        Mail::fake();
        $this->order(null);
        $this->project();
        $notice = CommerceNotice::query()->where('channel', 'mail')->sole();
        $notice->forceFill(['state' => 'sending', 'started_at' => now()->subMinutes(16)])->save();
        $this->project();
        $this->deliver($notice->id);
        $this->assertDatabaseHas('commerce_notices', ['id' => $notice->id, 'state' => 'uncertain', 'error_code' => 'worker_interrupted']);
        Mail::assertNothingSent();
    }

    public function test_fulfilment_uses_committed_events_and_skips_an_outdated_pickup_notice(): void
    {
        Queue::fake();
        config(['mail.default' => 'array']);
        $order = $this->order(null, ['status' => 'paid', 'paid_at' => now(), 'fulfilment_status' => 'ready_for_pickup']);
        $this->project();
        $this->assertDatabaseMissing('commerce_notices', ['kind' => 'order_ready_for_pickup']);
        DB::table('order_fulfilment_events')->insert([
            'order_id' => $order->id, 'to_status' => 'ready_for_pickup', 'note' => 'Operator-only delivery note', 'created_at' => now(),
        ]);
        $this->project();
        $stale = CommerceNotice::where('kind', 'order_ready_for_pickup')->value('id');
        $order->forceFill(['fulfilment_status' => 'completed'])->save();
        $this->deliver($stale);
        $this->assertDatabaseHas('commerce_notices', ['id' => $stale, 'state' => 'cancelled']);

        $shipped = $this->order(null, ['status' => 'paid', 'paid_at' => now(), 'shipping_method' => 'delivery', 'fulfilment_status' => 'preparing']);
        $this->signIn(User::factory()->create(['role' => 'admin']));
        $this->patchJson('/api/v1/admin/orders/'.$shipped->reference.'/fulfilment', [
            'status' => 'shipped', 'note' => 'Operator-only delivery note',
        ])->assertOk();
        $this->project();
        $id = CommerceNotice::where('kind', 'order_shipped')->value('id');
        $this->deliver($id);
        $this->assertDatabaseHas('commerce_notices', ['id' => $id, 'state' => 'sent']);
        $messages = Mail::mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(1, $messages);
        $email = $messages->first()->getOriginalMessage();
        $this->assertSame('Camba: enviamos tu pedido', $email->getSubject());
        $this->assertStringContainsString($shipped->reference, $email->getTextBody());
        $this->assertStringContainsString('UYU 5,00', $email->getTextBody());
        $this->assertStringContainsString('Enviado', $email->getTextBody());
        $this->assertStringContainsString($shipped->reference, $email->getHtmlBody());
        $this->assertStringNotContainsString('Ver pedido', $email->getHtmlBody());
        $this->assertStringNotContainsString('Ayuda:', $email->getTextBody());
        $this->assertStringNotContainsString('Operator-only delivery note', $email->getTextBody());
        $this->assertStringStartsWith("camba-notice-$id@", $messages->first()->getMessageId());
    }

    public function test_shipping_and_delivery_are_recorded_once_even_before_the_queue_runs(): void
    {
        Queue::fake();
        config(['mail.default' => 'array']);
        $buyer = User::factory()->create(['role' => 'buyer']);
        $admin = User::factory()->create(['role' => 'admin']);
        $order = $this->order($buyer, ['status' => 'paid', 'paid_at' => now(), 'shipping_method' => 'delivery', 'fulfilment_status' => 'preparing']);
        $older = $this->order($buyer, ['status' => 'paid', 'paid_at' => now(), 'shipping_method' => 'delivery', 'fulfilment_status' => 'completed']);
        DB::table('order_fulfilment_events')->insert([
            ['order_id' => $older->id, 'to_status' => 'shipped', 'created_at' => now()->subMinute()],
            ['order_id' => $older->id, 'to_status' => 'completed', 'created_at' => now()],
        ]);

        $url = '/api/v1/admin/orders/'.$order->reference.'/fulfilment';
        $this->signIn($admin);
        $this->patchJson($url, ['status' => 'completed'])->assertConflict();
        $this->assertDatabaseMissing('commerce_notices', ['subject_id' => $order->id]);
        foreach (['shipped', 'completed'] as $stage) {
            $this->patchJson($url, ['status' => $stage])->assertOk();
            $this->patchJson($url, ['status' => $stage])->assertConflict();
        }

        $ids = CommerceNotice::where('subject_id', $order->id)->whereIn('kind', ['order_shipped', 'order_delivered'])->orderBy('id')->pluck('id');
        $this->assertCount(2, $ids);
        $this->project();
        $this->assertSame(0, CommerceNotice::where('subject_id', $older->id)->whereIn('kind', ['order_shipped', 'order_delivered'])->count());
        foreach ($ids as $id) {
            $this->deliver($id);
            $this->deliver($id);
        }

        $messages = Mail::mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(2, $messages);
        foreach (['Camba: enviamos tu pedido' => 'Enviado', 'Tu pedido fue entregado' => 'Entregado'] as $subject => $status) {
            $mail = $messages->first(fn ($message) => $message->getOriginalMessage()->getSubject() === $subject)?->getOriginalMessage();
            $this->assertNotNull($mail);
            $this->assertSame($buyer->email, $mail->getTo()[0]->getAddress());
            $this->assertStringContainsString('Estado: '.$status, $mail->getTextBody());
            $this->assertStringContainsString(rtrim(config('app.url'), '/').'/pedidos/'.$order->reference, $mail->getTextBody());
        }
    }

    public function test_fulfilment_does_not_commit_without_its_mail_notice(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $order = $this->order(null, ['status' => 'paid', 'shipping_method' => 'delivery', 'fulfilment_status' => 'preparing']);
        $this->signIn($admin);
        $event = 'eloquent.creating: '.CommerceNotice::class;
        Event::listen($event, function (): never {
            throw new RuntimeException('Synthetic ledger write failure.');
        });
        try {
            $this->patchJson('/api/v1/admin/orders/'.$order->reference.'/fulfilment', ['status' => 'shipped'])->assertServerError();
        } finally {
            Event::forget($event);
        }

        $this->assertSame('preparing', $order->refresh()->fulfilment_status);
        $this->assertDatabaseMissing('order_fulfilment_events', ['order_id' => $order->id]);
        $this->assertDatabaseMissing('commerce_notices', ['subject_id' => $order->id]);
    }

    private function signIn(User $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->withHeader('Origin', 'http://localhost')->actingAs($user->fresh(), 'web');
    }

    private function settings(array $values): void
    {
        StoreSettings::query()->findOrFail(1)->forceFill(['values' => $values])->save();
    }

    private function order(?User $user, array $overrides = []): Order
    {
        return Order::forceCreate([
            'reference' => (string) Str::uuid(),
            'user_id' => $user?->id,
            'owner_key' => $user ? 'buyer:'.$user->id : 'guest:'.str_repeat('a', 64),
            'idempotency_key' => (string) Str::uuid(),
            'request_hash' => str_repeat('b', 64),
            'status' => 'pending_payment', 'currency' => 'UYU', 'subtotal_cents' => 500, 'shipping_cents' => 0, 'total_cents' => 500,
            'shipping_method' => 'pickup', 'contact' => ['email' => 'unverified-checkout@example.test'],
            'created_at' => now()->subDays(3), 'reservation_expires_at' => now()->addMinutes(5),
            ...$overrides,
        ]);
    }

    private function cart(?User $user): Cart
    {
        $cart = Cart::forceCreate([
            'user_id' => $user?->id, 'guest_session_hash' => $user ? null : hash('sha256', 'synthetic'),
            'updated_at' => now()->subDays(2),
        ]);
        $cart->items()->forceCreate(['product_id' => $this->product(10)->id, 'quantity' => 1]);

        return $cart;
    }

    private function product(int $stock): Product
    {
        $category = Category::firstOrCreate(['slug' => 'synthetic'], ['name' => 'Synthetic', 'active' => true]);

        return Product::forceCreate(['sku' => (string) Str::ulid(), 'slug' => (string) Str::ulid(), 'name' => 'Product',
            'stock' => $stock, 'status' => 'published', 'price_cents' => 500, 'category_id' => $category->id]);
    }

    private function project(): void
    {
        $this->artisan('camba:notices')->assertSuccessful();
    }

    private function deliver(int $id): void
    {
        $this->app->call([new SendCommerceNotice($id), 'handle']);
    }
}
