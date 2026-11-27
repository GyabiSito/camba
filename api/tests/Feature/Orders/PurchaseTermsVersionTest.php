<?php

namespace Tests\Feature\Orders;

use App\Commerce\PurchaseTerms;
use Tests\TestCase;

class PurchaseTermsVersionTest extends TestCase
{
    public function test_current_revision_preserves_the_original_archive_and_has_a_versioned_link(): void
    {
        $archived = $this->getJson('/api/v1/purchase-terms/2026-11-27')->assertOk()->json('data');
        $this->assertSame('f483635c180e8fc70ac7e35fc5068196604c774c6bb71f010d3d63b1742a4ed3', hash('sha256',
            json_encode($archived, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)));
        $current = $this->getJson('/api/v1/purchase-terms')->assertOk()->assertJsonPath('data.version', '2026-11-27-v2');
        $this->getJson('/api/v1/purchase-terms/'.PurchaseTerms::VERSION)->assertExactJson($current->json());
        $this->assertLessThanOrEqual(24, strlen(PurchaseTerms::VERSION));
    }
}
