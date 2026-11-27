<?php

namespace App\Rules;

use Closure;

final class PasswordRules
{
    /** @return list<string|Closure> */
    public static function input(): array
    {
        return ['bail', 'required', 'string', static function (string $attribute, string $value, Closure $fail): void {
            if (strlen($value) > 72 || str_contains($value, "\0")) {
                $fail('La contraseña no es válida o supera el límite de 72 bytes.');
            }
        }];
    }

    /** @return list<string|Closure> */
    public static function replacement(): array
    {
        return [...self::input(), 'min:12'];
    }
}
