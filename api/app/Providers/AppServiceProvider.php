<?php

namespace App\Providers;

use App\Mail\RedactedResendTransport;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Resend;
use Symfony\Component\Mailer\Exception\TransportException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Mail::extend('resend', static function (array $config): RedactedResendTransport {
            $key = $config['key'] ?? config('services.resend.key');
            if (! is_string($key) || trim($key) === '') {
                throw new TransportException('Resend API key is not configured.');
            }

            return new RedactedResendTransport(Resend::client($key));
        });

        Sanctum::getAccessTokenFromRequestUsing(static fn () => null);
        Gate::define('camba-admin', fn (User $user): bool => $user->role === 'admin' && $user->hasVerifiedEmail());
        Gate::define('camba-buyer', fn (User $user): bool => $user->role === 'buyer');
        ResetPassword::createUrlUsing(function (User $user, string $token): string {
            $context = Crypt::encryptString(json_encode([
                'password_reset_user' => $user->getKey(),
                'password_reset_token' => $token,
            ], JSON_THROW_ON_ERROR));

            return rtrim(config('app.url'), '/').'/cuenta/restablecer#reset='.rawurlencode($context);
        });

        RateLimiter::for('register', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));
        RateLimiter::for('store-contact', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));
        RateLimiter::for('withdrawal', function (Request $request): array {
            $email = $request->input('email');

            return [
                Limit::perHour(15)->by('ip:'.$request->ip()),
                ...(is_string($email) && strlen($email) <= 254 ? [
                    Limit::perHour(4)->by('connection-email:'.hash_hmac('sha256', $request->ip().'|'.mb_strtolower(trim($email)), config('app.key'))),
                ] : []),
            ];
        });
        RateLimiter::for('password-reset', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('account-password', fn (Request $request) => Limit::perMinute(10)->by($request->user('web')->getAuthIdentifier()));
        RateLimiter::for('verification-notification', fn (Request $request) => Limit::perMinute(3)->by($request->user()->getAuthIdentifier()));
        RateLimiter::for('login', function (Request $request): array {
            $email = $request->input('email');
            $email = is_string($email) ? Str::lower(trim($email)) : '';

            return [
                Limit::perMinute(30)->by('ip:'.$request->ip()),
                Limit::perMinute(5)->by('account-ip:'.hash('sha256', $email.'|'.$request->ip())),
            ];
        });
    }
}
