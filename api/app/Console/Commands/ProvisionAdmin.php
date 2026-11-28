<?php

namespace App\Console\Commands;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Str;

class ProvisionAdmin extends Command
{
    protected $signature = 'camba:admin {email : Exact administrative email}
        {--name= : Display name for a new administrator}
        {--from-legacy : Adopt the explicitly named verified legacy administrator}';

    protected $description = 'Provision or recover the single Camba administrator from a trusted shell';

    public function handle(): int
    {
        $email = Str::lower(trim($this->argument('email')));
        if (strlen($email) > 254 || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Enter a valid administrator email.');

            return self::FAILURE;
        }

        $admin = Admin::query()->first();
        if ($admin && ($admin->email !== $email || $this->option('from-legacy'))) {
            $this->error('An administrator already exists. Use its exact email without --from-legacy for recovery.');

            return self::FAILURE;
        }

        if ($this->option('from-legacy')) {
            $legacy = User::query()->where('email', $email)->where('role', 'admin')->first();
            if (! $legacy?->hasVerifiedEmail()) {
                $this->error('The selected email must belong to a verified legacy administrator.');

                return self::FAILURE;
            }
            $attributes = [
                'name' => $legacy->name,
                'password' => $legacy->password,
                'legacy_user_id' => $legacy->getKey(),
            ];
        } else {
            $password = $this->secret('New administrator password', false);
            $confirmation = $this->secret('Repeat administrator password', false);
            if (! is_string($password) || strlen($password) < 12 || strlen($password) > 72 || $password !== $confirmation) {
                $this->error('Use 12 to 72 bytes and enter the same password twice.');

                return self::FAILURE;
            }
            $attributes = ['password' => $password];
            if (! $admin) {
                $attributes['name'] = Str::limit(trim((string) $this->option('name')) ?: 'Camba', 120, '');
            }
        }

        try {
            ($admin ?? new Admin(['email' => $email]))->fill($attributes)->save();
        } catch (UniqueConstraintViolationException) {
            $this->error('An administrator already exists.');

            return self::FAILURE;
        }

        $this->info($admin ? 'Administrator password updated.' : 'Administrator provisioned.');

        return self::SUCCESS;
    }
}
