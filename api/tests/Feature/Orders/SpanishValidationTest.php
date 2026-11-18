<?php

namespace Tests\Feature\Orders;

use Tests\TestCase;

class SpanishValidationTest extends TestCase
{
    public function test_checkout_validation_names_the_fields_in_spanish(): void
    {
        app()->setLocale('es');

        $this->withHeader('Origin', 'http://localhost')->postJson('/api/v1/checkout/quote', [])
            ->assertUnprocessable()
            ->assertJsonPath('errors.items.0', 'Ingresá los productos.');
    }
}
