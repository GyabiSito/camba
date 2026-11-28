<?php

namespace App\Actions\Imports;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use ZipArchive;

class ReadCatalogSpreadsheet
{
    public const HEADERS = ['codigo', 'nombre', 'precio_uyu', 'stock', 'categoria', 'marca', 'descripcion', 'fotos'];

    private const SHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

    private const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    public function execute(UploadedFile $file): array
    {
        $path = $file->getRealPath();
        $source = strtolower($file->getClientOriginalExtension()) === 'xlsx' ? $this->xlsx($path) : $this->csv($path);
        $rows = [];
        $headers = null;
        $seen = 0;
        foreach ($source as $line => [$cells, $error]) {
            if ($headers === null) {
                $headers = array_map(fn (string $column) => trim($column), $cells);
                $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headers[0] ?? '');
                if ($error || count($headers) !== count(self::HEADERS) || array_diff(self::HEADERS, $headers)) {
                    $this->invalid('Use the template columns without additions or omissions.');
                }

                continue;
            }
            if (++$seen > 500) {
                $this->invalid('Use at most 500 data rows per file.');
            }
            if ($error === null && count(array_filter($cells, fn (string $value) => trim($value) !== '')) === 0) {
                continue;
            }
            if (count($cells) > count($headers)) {
                $error = 'The row has more cells than the template.';
            }
            $cells = array_slice(array_pad($cells, count($headers), ''), 0, count($headers));
            $rows[$line] = [array_combine($headers, $cells), $error];
        }
        if ($rows === []) {
            $this->invalid('The file must contain at least one data row.');
        }

        return $rows;
    }

    private function csv(string $path): iterable
    {
        $stream = fopen($path, 'rb');
        try {
            if (fread($stream, 3) !== "\xEF\xBB\xBF") {
                rewind($stream);
            }
            for ($record = 1; ($values = fgetcsv($stream, null, ',', '"', '')) !== false; $record++) {
                $values = array_map(fn ($value) => (string) $value, $values);
                if (array_filter($values, fn (string $value) => ! mb_check_encoding($value, 'UTF-8') || str_contains($value, "\0"))) {
                    $this->invalid('Use a UTF-8 CSV file.');
                }
                $formula = array_filter($values, fn (string $value) => str_starts_with(ltrim($value), '='));
                yield $record => [$values, $formula ? 'Use literal values instead of formulas.' : null];
            }
        } finally {
            fclose($stream);
        }
    }

    private function xlsx(string $path): iterable
    {
        abort_unless(class_exists(ZipArchive::class), 503, 'XLSX processing is unavailable.');
        $zip = new ZipArchive;
        if ($zip->open($path, ZipArchive::RDONLY | ZipArchive::CHECKCONS) !== true) {
            $this->invalid('The XLSX archive is not valid.');
        }
        try {
            $this->checkArchive($zip);
            $workbook = $this->xml($zip, 'xl/workbook.xml');
            $sheets = $workbook->query('/s:workbook/s:sheets/s:sheet');
            if ($sheets->length !== 1) {
                $this->invalid('XLSX requires a single worksheet.');
            }
            $relation = $sheets->item(0)->getAttributeNS(self::REL_NS, 'id');
            $links = $this->xml($zip, 'xl/_rels/workbook.xml.rels');
            $targets = [];
            foreach ($links->query('/*/*') as $element) {
                if ($element->getAttribute('Id') === $relation && $element->getAttribute('Type') === self::REL_NS.'/worksheet' && $element->getAttribute('TargetMode') !== 'External') {
                    $targets[] = $element->getAttribute('Target');
                }
            }
            if (count($targets) !== 1 || ! preg_match('~\A(?:/xl/)?(worksheets/[A-Za-z0-9_-]+\.xml)\z~', $targets[0], $sheet)) {
                $this->invalid('The XLSX worksheet reference is not supported.');
            }
            $shared = [];
            if ($zip->locateName('xl/sharedStrings.xml') !== false) {
                $strings = $this->xml($zip, 'xl/sharedStrings.xml');
                foreach ($strings->query('/s:sst/s:si') as $item) {
                    $shared[] = $this->text($strings, $item);
                }
                unset($strings);
            }
            $worksheet = $this->xml($zip, 'xl/'.$sheet[1]);
            $previous = 0;
            foreach ($worksheet->query('/s:worksheet/s:sheetData/s:row') as $row) {
                $line = filter_var($row->getAttribute('r'), FILTER_VALIDATE_INT);
                if ($line === false || $line <= $previous || $line > 1048576) {
                    $this->invalid('The XLSX has invalid worksheet row numbers.');
                }
                $previous = $line;
                yield $line => $this->readCells($worksheet, $row, $line, $shared);
            }
        } finally {
            $zip->close();
        }
    }

    private function readCells(DOMXPath $worksheet, DOMElement $row, int $line, array $shared): array
    {
        $cells = array_fill(0, count(self::HEADERS), '');
        $columns = [];
        $error = null;
        foreach ($worksheet->query('s:c', $row) as $cell) {
            if ($worksheet->query('s:f', $cell)->length) {
                $error = 'Use literal values instead of formulas.';

                continue;
            }
            $type = $cell->getAttribute('t');
            $raw = $worksheet->query('s:v', $cell)->item(0)?->textContent ?? '';
            if ($type === '' && $raw === '') {
                continue;
            }
            if (! preg_match('/\A([A-H])'.$line.'\z/', $cell->getAttribute('r'), $match) || isset($columns[$match[1]])) {
                $error = 'The row contains an invalid or duplicate cell reference.';

                continue;
            }
            $columns[$match[1]] = true;
            $value = match ($type) {
                '', 'n', 'str' => $raw,
                'inlineStr' => $this->text($worksheet, $cell),
                's' => ctype_digit($raw) ? ($shared[(int) $raw] ?? null) : null,
                default => null,
            };
            if ($value === null) {
                $error = 'Use text or plain numeric cells in the template.';

                continue;
            }
            $cells[ord($match[1]) - ord('A')] = $value;
        }

        return [$cells, $error];
    }

    private function checkArchive(ZipArchive $zip): void
    {
        $total = 0;
        $seen = [];
        if ($zip->numFiles > 128) {
            $this->invalid('The XLSX contains too many entries.');
        }
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $entry = $zip->statIndex($i);
            $name = strtolower($entry['name'] ?? '');
            $total += $entry['size'] ?? 0;
            $platform = $attributes = 0;
            $zip->getExternalAttributesIndex($i, $platform, $attributes);
            if (! $entry || $total > 12 * 1024 * 1024 || ! preg_match('~\A[\[\]a-z0-9_.-]+(?:/[\[\]a-z0-9_.-]+)*/?\z~', $name)
                || preg_match('~(?:^|/)\.{1,2}(?:/|$)~', $name) || isset($seen[$name])
                || ($entry['encryption_method'] ?? 0) !== 0 || ($platform === ZipArchive::OPSYS_UNIX && (($attributes >> 16) & 0170000) === 0120000)
                || str_starts_with($name, 'xl/externallinks/') || str_ends_with($name, '.bin')) {
                $this->invalid('The XLSX archive has unsupported entries or exceeds the decompression limit.');
            }
            $seen[$name] = true;
        }
    }

    private function xml(ZipArchive $zip, string $name): DOMXPath
    {
        $limit = 512 * 1024;
        $content = $zip->getFromName($name, $limit + 1);
        $document = new DOMDocument;
        if ($content === false || $content === '' || strlen($content) > $limit || ! mb_check_encoding($content, 'UTF-8') || str_contains($content, "\0")
            || stripos($content, '<!DOCTYPE') !== false || ! $document->loadXML($content, LIBXML_NONET | LIBXML_COMPACT | LIBXML_NOERROR | LIBXML_NOWARNING)
            || $document->doctype !== null) {
            $this->invalid('The XLSX has a missing, invalid, or oversized XML part.');
        }
        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('s', self::SHEET_NS);

        return $xpath;
    }

    private function text(DOMXPath $xpath, DOMElement $element): string
    {
        return implode('', array_map(fn ($node) => $node->textContent, iterator_to_array($xpath->query('.//s:t[not(ancestor::s:rPh)]', $element))));
    }

    private function invalid(string $message): never
    {
        throw ValidationException::withMessages(['file' => $message]);
    }
}
