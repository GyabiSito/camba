<?php

namespace App\Http\Controllers\Identity;

use App\Actions\Cart\MergeGuestCart;
use App\Actions\Identity\RegisterBuyerAction;
use App\Http\Requests\Identity\LoginRequest;
use App\Http\Requests\Identity\RegisterBuyerRequest;
use App\Http\Resources\Identity\UserResource;
use App\Models\CommerceNotice;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class AuthController
{
    public function register(RegisterBuyerRequest $request, RegisterBuyerAction $register): UserResource
    {
        $result = $register->execute($request->safe()->only(['name', 'email', 'password']));

        return (new UserResource($result['user']))->additional([
            'meta' => ['verification_queued' => $result['verification_queued']],
        ]);
    }

    public function login(LoginRequest $request, MergeGuestCart $mergeCart): Response
    {
        $guard = Auth::guard('web');
        $guestSessionId = $guard->guest() ? $request->session()->getId() : null;

        // Laravel checks credentials before the callback and rotates the session afterwards.
        if (! $guard->attemptWhen($request->validated(), function (User $user) use ($mergeCart, $guestSessionId): bool {
            if ($guestSessionId !== null && $user->role === 'buyer') {
                $mergeCart->execute($guestSessionId, $user->id);
            }

            return true;
        })) {
            throw ValidationException::withMessages(['email' => 'El correo o la contraseña no son correctos.']);
        }

        $request->session()->regenerate();

        return response()->noContent();
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function resendVerification(Request $request): Response
    {
        $buyer = $request->user();

        if (! $buyer->hasVerifiedEmail()) {
            try {
                $buyer->sendEmailVerificationNotification();
            } catch (Throwable $exception) {
                report($exception);
                abort(503, 'No se pudo solicitar la verificación. Intenta de nuevo más tarde.');
            }
        }

        return response()->noContent();
    }

    public function verify(string $id, string $hash): Response
    {
        $verified = DB::transaction(function () use ($id, $hash): ?User {
            $user = User::query()->lockForUpdate()->findOrFail($id);
            abort_unless(hash_equals(sha1($user->getEmailForVerification()), $hash), 403);
            if ($user->hasVerifiedEmail() || ! $user->markEmailAsVerified()) {
                return null;
            }

            if ($user->role === 'buyer') {
                // The existing notice scheduler only queues this record once the transaction is committed.
                CommerceNotice::query()->createOrFirst(['dedup_key' => 'mail:buyer_welcome:user:'.$user->id], [
                    'channel' => 'mail',
                    'kind' => CommerceNotice::BUYER_WELCOME,
                    'subject_type' => 'user',
                    'subject_id' => $user->id,
                    'source_hash' => hash('sha256', $user->getEmailForVerification()),
                    'state' => 'pending',
                    'available_at' => now(),
                ]);
            }

            return $user;
        }, 3);

        if ($verified) {
            event(new Verified($verified));
        }

        return response()->noContent();
    }
}
