<?php

namespace App\Actions\Legacy;

use Illuminate\Support\Facades\Validator;

class PlanLegacyCatalogAction
{
    private const MAX = 2147483647;

    public function execute(array $export, array $mapping, string $photoRoot): array
    {
        $errors = Validator::make(['export' => $export, 'mapping' => $mapping], $this->rules())->errors()->toArray();
        if ($errors !== []) {
            return $this->report(is_array($export['products'] ?? null) ? count($export['products']) : 0, [], [], $errors);
        }

        $categories = $residuals = $rows = $photos = $sourceKeys = $candidateKeys = $ids = [];
        foreach ($mapping['categories'] as $entry) {
            $key = $this->categoryKey($entry);
            if (isset($categories[$key])) {
                $errors["mapping.categories.$key"][] = 'This legacy classification tuple is mapped more than once.';
            }
            $categories[$key] = $entry['slug'];
        }
        foreach ($mapping['residuals'] as $entry) {
            $key = $entry['unit'];
            if (isset($residuals[$key])) {
                $errors["mapping.residuals.$key"][] = 'This residual unit is mapped more than once.';
            }
            $residuals[$key] = $entry;
        }

        foreach ($this->sorted($export['products']) as $product) {
            $id = $product['id'];
            $key = "product:$id";
            $source = ['product_id' => $id, 'variation_id' => null, 'subvariation_id' => null];
            $this->registerId($key, $ids, $errors);
            $this->registerIdentity($product, $key, $sourceKeys, $errors);
            $category = $categories[$this->categoryKey($product)] ?? null;
            if ($category === null) {
                $errors["$key.category"][] = 'Map the exact department/category/subcategory tuple to a flat category.';
            }
            $price = $this->cents($product['price_uyu']);
            if ($price === null) {
                $errors["$key.price_uyu"][] = 'Use an exact positive DECIMAL string within the v2 price range.';
            }
            $cover = $product['cover'] === null ? null : $this->photo($product['cover'], "$key.cover", $photoRoot, $photos, $errors);
            $gallery = [];
            foreach ($product['gallery'] as $index => $path) {
                $gallery[] = $this->photo($path, "$key.gallery.$index", $photoRoot, $photos, $errors);
            }
            $shared = [
                'category_slug' => $category, 'brand_slug' => $product['brand_slug'],
                'description' => $product['description'], 'price_cents' => $price,
                'legacy_sku' => $product['sku'], 'legacy_slug' => $product['slug'],
                'legacy_published' => $product['published'], 'cover' => $cover, 'gallery' => $gallery,
            ];

            foreach ($this->sorted($product['variations']) as $variation) {
                $variationId = $variation['id'];
                $variationKey = "variation:$variationId";
                $variationSource = array_replace($source, ['variation_id' => $variationId]);
                $variationName = $product['title'].' / '.$variation['label'];
                $this->registerId($variationKey, $ids, $errors);
                foreach ($this->sorted($variation['subvariations']) as $subvariation) {
                    $subId = $subvariation['id'];
                    $subKey = "subvariation:$subId";
                    $this->registerId($subKey, $ids, $errors);
                    $rows[] = $this->row($shared, $subKey, "S-$subId", array_replace($variationSource, ['subvariation_id' => $subId]),
                        $variationName.' / '.$subvariation['label'], $subvariation['stock']);
                }
                $remainder = $this->stock($variationKey, $variation['stock'], $variation['subvariations'], $residuals, $errors);
                if ($remainder !== null) {
                    $rows[] = $this->row($shared, $variationKey, "V-$variationId", $variationSource,
                        $variationName.$remainder['suffix'], $remainder['stock']);
                }
            }

            $remainder = $this->stock($key, $product['stock'], $product['variations'], $residuals, $errors);
            if ($remainder !== null) {
                $rows[] = $this->row($shared, $key, $product['variations'] === [] ? null : "P-$id", $source,
                    $product['title'].$remainder['suffix'], $remainder['stock']);
            }
        }

        foreach (array_keys($residuals) as $key) {
            $errors["mapping.residuals.$key"][] = 'This residual mapping did not match a positive difference in the export.';
        }
        foreach ($rows as $row) {
            $key = $row['source_unit'];
            $this->registerIdentity($row, $key, $candidateKeys, $errors);
            if (mb_strlen($row['name']) > 120) {
                $errors["$key.name"][] = 'The combined product and unit label must not exceed 120 characters.';
            }
        }

        return $this->report(count($export['products']), $rows, $photos, $errors);
    }

    private function rules(): array
    {
        $id = 'required|integer:strict|min:1';
        $nullableId = 'present|nullable|integer:strict|min:1';
        $stock = 'required|integer:strict|min:0|max:'.self::MAX;
        $slug = 'string|max:160|regex:/\A[a-z0-9-]+\z/';
        $product = 'export.products.*';
        $variation = "$product.variations.*";
        $subvariation = "$variation.subvariations.*";
        $category = 'mapping.categories.*';
        $residual = 'mapping.residuals.*';

        return [
            'export.version' => 'required|integer:strict|in:1',
            'export.products' => 'present|array|list',
            $product => 'required|array',
            "$product.id" => $id,
            "$product.title" => 'required|string|max:120',
            "$product.description" => 'present|nullable|string|max:4000',
            "$product.published" => 'required|boolean:strict',
            "$product.sku" => 'required|string|regex:/\A[A-Za-z0-9][A-Za-z0-9._-]{0,63}\z/',
            "$product.slug" => 'required|string|max:160|regex:/\A[A-Za-z0-9-]+\z/',
            "$product.price_uyu" => 'present',
            "$product.stock" => $stock,
            "$product.department_id" => $id,
            "$product.category_id" => $nullableId,
            "$product.subcategory_id" => $nullableId,
            "$product.brand_slug" => 'present|nullable|'.$slug,
            "$product.cover" => 'present|nullable|string',
            "$product.gallery" => 'present|array|list',
            "$product.gallery.*" => 'required|string',
            "$product.variations" => 'present|array|list',
            $variation => 'required|array',
            "$variation.id" => $id,
            "$variation.label" => 'required|string|max:120',
            "$variation.stock" => $stock,
            "$variation.subvariations" => 'present|array|list',
            $subvariation => 'required|array',
            "$subvariation.id" => $id,
            "$subvariation.label" => 'required|string|max:120',
            "$subvariation.stock" => $stock,
            'mapping.version' => 'required|integer:strict|in:1',
            'mapping.categories' => 'present|array|list',
            $category => 'required|array',
            "$category.department_id" => $id,
            "$category.category_id" => $nullableId,
            "$category.subcategory_id" => $nullableId,
            "$category.slug" => 'required|'.$slug,
            'mapping.residuals' => 'present|array|list',
            $residual => 'required|array',
            "$residual.unit" => ['required', 'string', 'regex:/\A(?:product|variation):[1-9][0-9]*\z/'],
            "$residual.stock" => 'required|integer:strict|min:1|max:'.self::MAX,
            "$residual.label" => 'required|string|max:120',
        ];
    }

    private function categoryKey(array $entry): string
    {
        return $entry['department_id'].'/'.($entry['category_id'] ?? '-').'/'.($entry['subcategory_id'] ?? '-');
    }

    private function cents(mixed $price): ?int
    {
        if (! is_string($price) || ! preg_match('/\A([0-9]{1,8})\.([0-9]{2})\z/', $price, $parts)) {
            return null;
        }
        $cents = ltrim($parts[1].$parts[2], '0');
        $max = (string) self::MAX;

        return $cents !== '' && (strlen($cents) < strlen($max) || (strlen($cents) === strlen($max) && strcmp($cents, $max) <= 0))
            ? (int) $cents : null;
    }

    private function stock(string $key, int $stock, array $children, array &$residuals, array &$errors): ?array
    {
        if ($children === []) {
            return ['stock' => $stock, 'suffix' => ''];
        }
        // The source parent is a cap, not stock to add to its children's quantities.
        foreach ($children as $child) {
            $stock -= $child['stock'];
            if ($stock < 0) {
                $errors["$key.stock"][] = 'Child stock exceeds the legacy parent cap.';

                return null;
            }
        }
        if ($stock === 0) {
            return null;
        }
        if (($residuals[$key]['stock'] ?? null) !== $stock) {
            $errors["$key.stock"][] = "Map the positive residual of $stock units explicitly before migrating.";

            return null;
        }
        $label = $residuals[$key]['label'];
        unset($residuals[$key]);

        return ['stock' => $stock, 'suffix' => ' / '.$label];
    }

    private function photo(string $relative, string $key, string $root, array &$photos, array &$errors): ?array
    {
        if (! array_key_exists($relative, $photos)) {
            $path = $this->resolvePhoto($relative, $root);
            // ponytail: the isolated snapshot must stay unchanged while planning; mount it read-only where possible.
            $hash = $path === null ? false : @hash_file('sha256', $path);
            $photos[$relative] = $hash === false ? null : ['path' => $relative, 'sha256' => $hash];
        }
        if ($photos[$relative] === null) {
            $errors[$key][] = 'Use a readable regular file relative to the isolated photo root without traversal or links.';
        }

        return $photos[$relative];
    }

    private function resolvePhoto(string $relative, string $root): ?string
    {
        if (preg_match('~[\\\\:<>"?*|\x00-\x1f\x7f]~', $relative)) {
            return null;
        }
        $path = $root;
        foreach (explode('/', $relative) as $segment) {
            if ($segment === '' || rtrim($segment, '. ') !== $segment) {
                return null;
            }
            $path = rtrim($path, '/\\').DIRECTORY_SEPARATOR.$segment;
            if (is_link($path) || ($resolved = realpath($path)) === false || ! $this->samePath($path, $resolved)) {
                return null;
            }
        }

        return is_file($path) ? $path : null;
    }

    private function samePath(string $expected, string $resolved): bool
    {
        return DIRECTORY_SEPARATOR === '\\' ? strcasecmp($expected, $resolved) === 0 : $expected === $resolved;
    }

    private function sorted(array $entries): array
    {
        usort($entries, fn ($a, $b) => $a['id'] <=> $b['id']);

        return $entries;
    }

    private function row(array $shared, string $key, ?string $suffix, array $source, string $name, int $stock): array
    {
        $tail = $suffix === null ? '' : '-legacy-'.strtolower($suffix);

        return [
            'source_unit' => $key, 'source' => $source, 'name' => $name, 'stock' => $stock,
            'sku' => $suffix === null ? $shared['legacy_sku'] : 'LEGACY-'.$suffix,
            'slug' => $tail === '' ? $shared['legacy_slug'] : rtrim(substr($shared['legacy_slug'], 0, 160 - strlen($tail)), '-').$tail,
        ] + $shared;
    }

    private function registerId(string $key, array &$seen, array &$errors): void
    {
        if (isset($seen[$key])) {
            $errors["$key.id"][] = 'The source identifier is repeated.';
        }
        $seen[$key] = true;
    }

    private function registerIdentity(array $row, string $key, array &$seen, array &$errors): void
    {
        foreach (['sku', 'slug'] as $field) {
            $value = strtolower($row[$field]);
            $earlier = $seen[$field][$value] ?? null;
            if ($earlier !== null) {
                $message = 'Duplicate '.$field.' (ignoring case); first seen on '.$earlier.'.';
                if (! in_array($message, $errors["$key.$field"] ?? [], true)) {
                    $errors["$key.$field"][] = $message;
                }
            }
            $seen[$field][$value] ??= $key;
        }
    }

    private function report(int $sourceCount, array $rows, array $photos, array $errors): array
    {
        ksort($errors);

        return [
            'version' => 1,
            'dry_run' => true,
            'currency' => 'UYU',
            'counts' => [
                'source_products' => $sourceCount, 'candidate_products' => count($rows),
                'stock' => array_sum(array_column($rows, 'stock')), 'unique_photos' => count(array_filter($photos)),
            ],
            'rows' => $errors === [] ? $rows : [],
            'errors' => $errors,
        ];
    }
}
