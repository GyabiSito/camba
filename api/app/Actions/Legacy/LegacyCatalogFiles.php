<?php

namespace App\Actions\Legacy;

use InvalidArgumentException;
use JsonException;

class LegacyCatalogFiles
{
    public function readJson(string $path, string $label, ?string $reviewedHash = null): array
    {
        $resolved = $this->localPath($path);
        $json = $resolved && is_file($resolved) ? @file_get_contents($resolved) : false;
        if ($json === false) {
            throw new InvalidArgumentException("Use a readable local $label JSON file.");
        }
        if ($reviewedHash !== null && ! hash_equals(hash('sha256', $json), strtolower($reviewedHash))) {
            throw new InvalidArgumentException('The mapping checksum does not match the reviewed mapping file.');
        }

        try {
            $data = json_decode($json, true, flags: JSON_THROW_ON_ERROR | JSON_BIGINT_AS_STRING);
        } catch (JsonException $e) {
            throw new InvalidArgumentException("Invalid $label JSON: ".$e->getMessage(), previous: $e);
        }

        if (! is_array($data) || array_is_list($data)) {
            throw new InvalidArgumentException("The $label JSON must be an object.");
        }

        return $data;
    }

    public function photoRoot(string $value): string
    {
        $root = $this->localPath($value);
        if ($root === null || ! is_dir($root)) {
            throw new InvalidArgumentException('Set --photos to an existing local photo directory.');
        }

        return $root;
    }

    public function localPath(string $value): ?string
    {
        $portable = str_replace('\\', '/', $value);
        $withoutDrive = preg_replace('~^[A-Za-z]:(?=/)~', '', $portable);
        if ($portable === '' || str_starts_with($portable, '//') || str_contains($withoutDrive, ':') || str_contains($value, "\0")) {
            return null;
        }

        $resolved = realpath($value);

        return $resolved !== false && ! str_starts_with(str_replace('\\', '/', $resolved), '//') ? $resolved : null;
    }

    public function resolvePhoto(string $relative, string $root): ?string
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

    public function allowsGalleryPath(string $root, int $productId): bool
    {
        $path = $root;
        foreach (['products', 'optimized', (string) $productId] as $segment) {
            $path .= DIRECTORY_SEPARATOR.$segment;
            clearstatcache(true, $path);
            if (is_link($path)) {
                return false;
            }
            if (($resolved = realpath($path)) === false) {
                return ! file_exists($path);
            }
            if (! $this->samePath($path, $resolved) || ! is_dir($path)) {
                return false;
            }
        }

        return true;
    }

    private function samePath(string $expected, string $resolved): bool
    {
        return DIRECTORY_SEPARATOR === '\\' ? strcasecmp($expected, $resolved) === 0 : $expected === $resolved;
    }
}
